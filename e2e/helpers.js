// Shared setup for the browser tests: a Vite preview server of dist/ and a headless Chromium page.
// Run with `npm run e2e` (builds first). Set BABYGRAPH_EXPORT=/path/to/export.csv to also test a real export,
// and E2E_BASE_URL (e.g. http://127.0.0.1:8090) to test an already-running server such as the Docker container.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { chromium } from "playwright-core";
import { preview } from "vite";
import { parseNaraExport } from "../src/lib/importer.js";

export const ROOT = new URL("..", import.meta.url).pathname;
export const fixture = (name) => join(ROOT, "fixtures", name);
export const GIRL = fixture("narababy_fake_girl_export.csv");
export const BOY = fixture("narababy_fake_boy_export.csv");
export const PHOTO = fixture("test-photo.jpg");
export const REAL_EXPORT = process.env.BABYGRAPH_EXPORT || null;

// Parser output for a CSV, so tests can compare the page against it without hardcoding counts
export const parsed = (file) => parseNaraExport(readFileSync(file, "utf8"), basename(file));

// CHROME_PATH wins; then Playwright's own download; then any Chromium Playwright has downloaded before
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (existsSync(chromium.executablePath())) return undefined;
  const cache = join(homedir(), ".cache", "ms-playwright");
  const found = existsSync(cache) && readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().reverse()
    .map((d) => join(cache, d, "chrome-linux64", "chrome")).find(existsSync);
  if (found) return found;
  throw new Error("No Chromium found. Run `npx playwright-core install chromium` or set CHROME_PATH.");
}

const freePort = () => new Promise((resolve) => {
  const srv = createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

// Starts the preview server and browser. Returns helpers bound to one page; call `close()` in `after`.
export async function setup({ viewport = { width: 1400, height: 1000 }, colorScheme = "light" } = {}) {
  let server = null, base = process.env.E2E_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    if (!existsSync(join(ROOT, "dist", "dashboard.html"))) throw new Error("dist/ is missing: run `npm run build` (npm run e2e does this).");
    server = await preview({ root: ROOT, logLevel: "silent", preview: { port: await freePort(), strictPort: true } });
    base = server.resolvedUrls.local[0].replace(/\/$/, "");
  }
  const browser = await chromium.launch({ executablePath: chromePath() });
  const context = await browser.newContext({ viewport, colorScheme });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  return {
    base, browser, context, page, errors,
    url: (path) => base + path,
    // Upload an export from the landing page and wait for the Overview
    async upload(file) {
      await page.goto(base + "/index.html");
      await page.setInputFiles('input[type="file"]', file);
      await page.waitForURL(/dashboard\.html#\/overview$/, { timeout: 30000 });
      await page.waitForSelector("text=Latest growth");
    },
    // Click a sidebar link, wait for the section to switch (the old one's content can linger a tick),
    // then for something in the new section
    async go(name, selector) {
      const title = (await page.textContent(`aside a.nav-link[href="#/${name}"] .nav-link-title`)).trim();
      await page.click(`aside a.nav-link[href="#/${name}"]`);
      await page.waitForFunction((t) => document.querySelector(".page-title")?.textContent.trim() === t, title);
      await page.waitForSelector(selector, { timeout: 30000 });
    },
    // Number of matching elements. Assert on this, not on element handles: a failing assert
    // on a handle tries to print the whole browser object and can exhaust memory.
    count: async (selector) => (await page.$$(selector)).length,
    // Optional screenshot for eyeballing, in e2e/.output/ (gitignored)
    async shot(name, options = {}) {
      const dir = join(ROOT, "e2e", ".output");
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, name + ".png"), ...options });
    },
    async close() {
      await browser.close();
      if (server) await server.close();
    },
  };
}
