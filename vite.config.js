import { execFileSync } from "node:child_process";
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

// The commit this build came from, shown on the landing page. BUILD_COMMIT overrides it where
// there's no .git (e.g. the Docker build). "dirty" marks builds with uncommitted changes, which
// `npm run build` refuses (scripts/check-clean.js); `vite build` alone allows them for local testing.
function buildInfo() {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (process.env.BUILD_COMMIT) return { commit: process.env.BUILD_COMMIT, dirty: false };
  try {
    return { commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain") !== "" };
  } catch {
    return { commit: null, dirty: false }; // not a git checkout, or no commits yet
  }
}

export default defineConfig({
  define: { __BUILD__: JSON.stringify(buildInfo()) },
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
