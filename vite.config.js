import { defineConfig } from "vite";

export default defineConfig({
  /**
   * Relative asset URLs, so the same build works both at
   * https://<user>.github.io/<repo>/ and at the grafted3d.com root.
   */
  base: "./",
});
