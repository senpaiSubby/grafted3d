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
index.html            Hero, services, process, work, FAQ, contact, footer
404.html              Standalone not-found page (published as dist/404.html)
src/style.css         Styles (light, technical theme)
src/main.js           Mobile menu, form validation, footer year, lazy 3D boot
src/viewport.js       Draggable 3D preview (three.js + OrbitControls), loaded on demand
src/config.js         Build-time options: inquiry endpoint, contact email, analytics
scripts/              build-benchy.mjs (3D asset), build-og.mjs (social preview)
public/models/        Decimated 3DBenchy mesh for the 3D preview
public/og-image.svg   Source art for the social preview; .png is generated from it
public/robots.txt     Crawler rules + sitemap pointer
public/sitemap.xml    Single-URL sitemap
public/favicon.*      Vector mark, PNG fallback, multi-size .ico
public/apple-touch-icon.png, public/icon-*.png, public/site.webmanifest
                      Home-screen and PWA icons
```

One page, one route. The only navigation is anchor links: `#home`, `#services`,
`#process`, `#work`, `#faq`, `#contact`.

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

- three.js and the viewport live in their own chunk; `src/main.js` imports it only
  when the stage is within 600 px of the viewport, so the first paint is not blocked.
- Drag to orbit, or focus the canvas and use the arrow keys; zoom is disabled so
  the page keeps its scroll.
- Drop an STL onto the stage to preview it. The file is parsed in the browser with
  `STLLoader` and never uploaded; 25 MB cap, Z-up rotation, camera refit, and a
  "Show the benchy" button to reset.
- The render loop pauses off screen and when the tab is hidden.
- `prefers-reduced-motion` turns off the slow auto-rotation.
- Without WebGL or `DecompressionStream` the stage shows a short message instead.

## Social preview image

`public/og-image.png` (1200×630) is what Discord, MakerWorld and search results show
for a shared link. It is generated from `public/og-image.svg`:

```sh
npm run build:og    # rewrites public/og-image.png (needs the sharp dev dependency)
```

Edit the SVG, re-run the script, and commit the PNG. `index.html` points `og:image`
and `twitter:image` at `https://grafted3d.com/og-image.png`.

## Icons

One vector mark (an isometric cube on the ink background) is the source for every
icon. `npm run build:icons` regenerates the set from `scripts/build-icons.mjs`:

| File                      | Used for                                             |
| ------------------------- | ---------------------------------------------------- |
| `favicon.svg`             | modern browsers, crisp at any size                    |
| `favicon.ico`             | 16/32/48 PNG-in-ICO for older browsers and OSes       |
| `favicon-32.png`          | PNG fallback                                         |
| `apple-touch-icon.png`    | iOS home screen (180px, full-bleed)                  |
| `icon-192.png` / `-512`   | manifest `any`                                       |
| `icon-maskable-512.png`   | manifest `maskable`, mark inside the 80% safe zone    |

`site.webmanifest` lists the three manifest icons and sets the theme colours. It uses
`display: browser` on purpose — the site has no offline support, so it should not
present itself as an installable app.

In-page glyphs for the social links (cube, chat bubble, branch, envelope) are stroke
icons at the site's 1.6 weight, defined once in an SVG sprite at the top of
`index.html` and referenced with `<use>`. They are decorative (`aria-hidden`) and
inherit the link colour, so there are no coloured logos anywhere on the page.

## Deploying to GitHub Pages

The repo is public and Pages builds it with GitHub Actions — no branch deploy, no
build step in the Pages UI.

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Every push to `main` runs `.github/workflows/deploy.yml`, which installs, builds
   and publishes `dist/`.
3. The site is served at <https://grafted3d.com/> (custom domain) and
   <https://senpaisubby.github.io/grafted3d/>, which redirects to it.

`vite.config.js` uses relative asset URLs, so the same build also works at a domain
root. `404.html` and `robots.txt` sit at the published root, so GitHub Pages serves
the custom not-found page for unknown paths.

### Custom domain

`grafted3d.com` is attached to the Pages site (apex A records
`185.199.108–111.153`, no proxy). GitHub issues the Let's Encrypt certificate
asynchronously: while `https_certificate.state` is not `approved`, the domain answers
on `http://` only and `https://` shows a certificate error. Once it is approved, tick
**Enforce HTTPS** in Settings → Pages:

```sh
gh api repos/senpaiSubby/grafted3d/pages --jq '.https_certificate.state'
```

## Optional integrations

All three are build-time variables and are inert when unset. Locally they live in
`.env` (`cp .env.example .env`); on Pages they are repository variables
(Settings → Secrets and variables → Actions → Variables) passed by `deploy.yml`.

| Variable                | Effect when set                                                       |
| ----------------------- | --------------------------------------------------------------------- |
| `VITE_INQUIRY_ENDPOINT` | The form posts to this URL instead of showing the "not connected" note |
| `VITE_CONTACT_EMAIL`    | Adds a `mailto:` link to the contact row, footer, and form fallback    |
| `VITE_CF_BEACON_TOKEN`  | Loads the Cloudflare Web Analytics beacon (cookieless page views)     |

### The inquiry form

The form validates input and sends a real `POST`. It never fakes a success state.
Until an endpoint is configured it verifies the fields and then tells the visitor that
delivery isn't connected, pointing to the contact links (including the email address
when `VITE_CONTACT_EMAIL` is set).

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
- Discord: <https://discord.gg/vGRDAPmKx> (this invite expires 18 December 2026 —
  replace it with a never-expiring one, here and in `index.html`)
- GitHub: <https://github.com/senpaiSubby>

Update the canonical, Open Graph and sitemap URLs if the domain changes.
