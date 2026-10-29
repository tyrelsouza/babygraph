// Feeding's loading skeletons: shown while loading, same layout as the real page, and never in the way.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GIRL, setup } from "./helpers.js";

let t, page, cdp;
before(async () => {
  t = await setup();
  page = t.page;
  await t.upload(GIRL);
  cdp = await t.context.newCDPSession(page);
});
after(() => t.close());

const cardTops = () => page.$$eval(".page-body .card", (cards) => cards.map((c) => Math.round(c.getBoundingClientRect().top)));
const throttle = (on) => cdp.send("Network.emulateNetworkConditions", on
  ? { offline: false, latency: 400, downloadThroughput: 200 * 1024, uploadThroughput: 200 * 1024 }
  : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

let skeletonTops;
test("a Feeding-shaped skeleton shows while the section's code downloads", async () => {
  await throttle(true);
  await page.click('aside a.nav-link[href="#/feeding"]');
  await page.waitForSelector("[aria-label='Loading feeding charts']", { timeout: 5000 });
  skeletonTops = await cardTops();
  assert.equal(skeletonTops.length, 4);
  await throttle(false);
});

test("charts replace their skeletons without moving the layout", async () => {
  await page.waitForFunction(() => document.querySelectorAll("[aria-busy=false]").length >= 5, null, { timeout: 30000 });
  assert.deepEqual(await cardTops(), skeletonTops);
});

test("a fading skeleton doesn't block the first drag on the zoom strip", async () => {
  // Drag immediately, while skeletons may still be fading out over the charts
  const before = await page.evaluate(() => window.ApexCharts.getChartByID("feeds").w.globals.minX);
  const rb = await (await page.$("#apexchartsfeeds-brush .apexcharts-selection-rect")).boundingBox();
  await page.mouse.move(rb.x + 1, rb.y + rb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(rb.x + 1 + i * 40, rb.y + rb.height / 2);
  await page.mouse.up();
  await page.waitForFunction((min) => window.ApexCharts.getChartByID("feeds").w.globals.minX > min, before, { timeout: 5000 });
});

test("no skeletons are left once everything has drawn", async () => {
  await page.waitForSelector(".chart-skeleton", { state: "detached" });
});

test("no console or page errors", () => assert.deepEqual(t.errors, []));
