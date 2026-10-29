import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Ships LICENSE, NOTICE.md (WHO data, Tabler Icons) and the Caddy config (linked from the privacy policy)
const licenseFiles = {
  name: "license-files",
  generateBundle() {
    for (const [fileName, from] of [["LICENSE", "LICENSE"], ["NOTICE.md", "NOTICE.md"], ["Caddyfile.example", "deploy/Caddyfile.example"]]) {
      this.emitFile({ type: "asset", fileName, source: readFileSync(resolve(import.meta.dirname, from), "utf8") });
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
        privacy: resolve(import.meta.dirname, "privacy.html"),     // privacy policy
      },
    },
  },
});
