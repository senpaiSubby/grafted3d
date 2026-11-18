#!/usr/bin/env node
/**
 * Rasterises public/og-image.svg to public/og-image.png (1200x630), the
 * social preview used by og:image and twitter:image.
 *
 *   node scripts/build-og.mjs
 */
import { readFileSync, statSync } from "node:fs";
import sharp from "sharp";

const source = readFileSync("public/og-image.svg");
const output = "public/og-image.png";

await sharp(source, { density: 144 })
  .resize(1200, 630)
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);

const kb = (statSync(output).size / 1024).toFixed(0);
console.log(`${output}: 1200x630, ${kb} KB`);
