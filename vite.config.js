import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Ships LICENSE and NOTICE.md (WHO data, Tabler Icons) with the built site
const licenseFiles = {
  name: "license-files",
  generateBundle() {
    for (const fileName of ["LICENSE", "NOTICE.md"]) {
      this.emitFile({ type: "asset", fileName, source: readFileSync(resolve(import.meta.dirname, fileName), "utf8") });
    }
  },
};

export default defineConfig({
  base: "./", // relative asset paths, so dist/ works on GitHub Pages or any subfolder
  plugins: [vue(), licenseFiles],
  build: {
    license: { fileName: "THIRD-PARTY-LICENSES.md" }, // licenses of every bundled npm package
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),         // landing page: drop an export
        dashboard: resolve(import.meta.dirname, "dashboard.html"), // reads the stored import
      },
    },
  },
});
