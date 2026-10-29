// Full-page screenshots of every section, using the fake girl export, for docs/screenshots/.
// Run with `npm run screenshots` (builds first). Uses the same server and browser setup as the e2e tests.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { GIRL, PHOTO, ROOT, setup } from "../e2e/helpers.js";

const OUT = join(ROOT, "docs", "screenshots");
const WIDTH = 1400;
mkdirSync(OUT, { recursive: true });

const t = await setup({ viewport: { width: WIDTH, height: 900 } });
const { page } = t;

// The sidebar is position: fixed, so a "fullPage" capture cuts it off at the window height.
// Instead, grow the window to the page's height, let charts finish, then capture.
async function capture(name) {
  // Scroll through once so lazy charts (Growth) start drawing
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => !document.querySelector("[aria-busy=true]"), null, { timeout: 30000 });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: WIDTH, height });
  await page.waitForFunction(() => !document.querySelector("[aria-busy=true], .chart-skeleton"), null, { timeout: 30000 });
  await page.waitForTimeout(300); // let resize-driven redraws settle
  await page.screenshot({ path: join(OUT, name + ".png") });
  await page.setViewportSize({ width: WIDTH, height: 900 });
  console.log("saved", `docs/screenshots/${name}.png`, `(${WIDTH}×${height})`);
}

await page.goto(t.url("/index.html"));
await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase("nara-photos"); });
await page.reload();
await capture("00-landing");

await t.upload(GIRL);

// One added photo, so Firsts and Overview show what a restored photo looks like
await t.go("firsts", "article.first-card");
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click('button[aria-label="Add photo: First laugh"]')]);
await chooser.setFiles(PHOTO);
await page.waitForSelector("img.thumb");

const sections = [
  ["overview", "text=Latest growth"],
  ["history", ".history-table"],
  ["feeding", "[aria-busy]"],
  ["growth", ".apexcharts-canvas"],
  ["measurements", "table tbody tr"],
  ["firsts", "article.first-card"],
  ["health", "text=Medicine & temperature"],
];
for (const [i, [name, ready]] of sections.entries()) {
  await t.go(name, ready);
  await capture(`${String(i + 1).padStart(2, "0")}-${name}`);
}

if (t.errors.length) console.error("console errors:", t.errors);
await t.close();
