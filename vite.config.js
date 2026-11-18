import { defineConfig } from "vite";

export default defineConfig({
  /**
   * Relative asset URLs, so the same build works at a host root
   * (grafted3d.com) and from a subdirectory path.
   */
  base: "./",
});
