# Grafted3D

A one-page site for Grafted3D. HTML, CSS and JavaScript on Vite — no framework, no
runtime dependencies. Typefaces are Inter for copy and IBM Plex Mono for technical
labels, both loaded from Google Fonts.

## Run locally

```sh
npm install
npm run dev
```

`bun install` / `bun run dev` work too if Bun is installed. Vite prints the local URL.

```sh
npm run build     # outputs dist/
npm run preview   # serves the production build
```

## Structure

```
index.html          Hero, services, process, work, contact, footer
src/style.css       Styles (light, technical theme)
src/main.js         Mobile menu, form validation, footer year
src/viewport.js     Draggable 3D preview (three.js + OrbitControls)
src/config.js       Inquiry endpoint + attachment limits
scripts/            build-benchy.mjs — regenerates the 3D model asset
public/models/      Decimated 3DBenchy mesh for the 3D preview
public/favicon.svg  Small G3D mark
```

One page, one route. The only navigation is anchor links: `#home`, `#services`,
`#process`, `#work`, `#contact`.

## 3D preview

The hero shows the official #3DBenchy calibration model in a WebGL viewport.
The STL comes from [CreativeTools/3DBenchy](https://github.com/CreativeTools/3DBenchy)
and is public domain (CC0). It is welded, decimated to 30,000 triangles with
[meshoptimizer](https://github.com/zeux/meshoptimizer), turned Y-up, centred and
stored as a quantised 16-bit mesh (`G3D1`, described in the build script). The
asset is 193 KB gzipped at `public/models/3dbenchy.mesh.gz`; the original 11 MB
STL is not shipped.

```sh
npm run build:model          # re-download, decimate and rewrite the mesh
npm run build:model -- path/to/3DBenchy.stl   # or use a local file
```

- Drag to orbit, or focus the canvas and use the arrow keys; zoom is disabled so
the page keeps its scroll.
- The render loop pauses off screen and when the tab is hidden.
- `prefers-reduced-motion` turns off the slow auto-rotation.
- Without WebGL or `DecompressionStream` the stage shows a short message instead.

## Deploying to GitHub Pages

The repo is public and Pages builds it with GitHub Actions — no branch deploy, no
build step in the Pages UI.

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Every push to `main` runs `.github/workflows/deploy.yml`, which installs, builds
   and publishes `dist/`.
3. The site is served at <https://senpaisubby.github.io/grafted3d/>.

`vite.config.js` uses relative asset URLs, so the same build also works at a domain
root.

### Custom domain

`grafted3d.com` is not attached to Pages yet — its apex A record still points at the
old host. When you are ready to move it:

1. At the DNS provider (the domain already uses Cloudflare nameservers), replace the
   apex A record with GitHub Pages':
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   (optional AAAA: `2606:50c0:8000::153`, `8001::153`, `8002::153`, `8003::153`), and
   add `CNAME www → senpaisubby.github.io`.
2. Settings → Pages → Custom domain → `grafted3d.com`, then tick **Enforce HTTPS**
   once the certificate is issued.

## Connecting the inquiry form

The form validates input and sends a real `POST`. It never fakes a success state.
Until an endpoint is configured it verifies the fields and then tells the visitor that
delivery isn't connected, pointing to MakerWorld instead.

```sh
cp .env.example .env
# VITE_INQUIRY_ENDPOINT=https://your-form-endpoint.example/submit
```

`.env` is git-ignored. To use an endpoint on Pages, add `VITE_INQUIRY_ENDPOINT` as a
repository variable (Settings → Secrets and variables → Actions → Variables) and
pass it to the build step in `.github/workflows/deploy.yml`:

```yaml
      - run: npm run build
        env:
          VITE_INQUIRY_ENDPOINT: ${{ vars.VITE_INQUIRY_ENDPOINT }}
```

### What the endpoint receives

`POST` with `multipart/form-data`:

| Field         | Type   | Notes                                        |
| ------------- | ------ | -------------------------------------------- |
| `name`        | text   | trimmed, required                            |
| `email`       | text   | trimmed, required, basic format check        |
| `projectType` | text   | `3D Design`, `3D Modeling`, `3D Printing`, `Full Project` |
| `description` | text   | trimmed, required, 20+ characters            |
| `file`        | file   | optional, one file, max 10 MB                |
| `source`      | text   | always `grafted3d.com`                       |

Accepted attachments: PNG, JPG, WEBP, PDF, STL, OBJ, 3MF, STEP, STP, ZIP.

The endpoint must accept a cross-origin `POST` (send `Access-Control-Allow-Origin`) and
answer with a 2xx status. Any form service or serverless function that accepts
multipart posts works. Limits live in `src/config.js`; keep client and server rules in
sync.

## External links

- MakerWorld: <https://makerworld.com/en/@Grafted3D>
- Discord: <https://discord.gg/vGRDAPmKx>
- GitHub: <https://github.com/senpaiSubby>

Update the canonical and Open Graph URLs in `index.html` if the domain changes.

## Publish

`dist/` is static, so any host will serve it. This project publishes to GitHub Pages
on every push to `main` — see
[Deploying to GitHub Pages](#deploying-to-github-pages).
