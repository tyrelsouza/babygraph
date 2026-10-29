// Sidebar sections: lazy loading, charts only on their own section, URL state, history, deep links, phone menu.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GIRL, setup } from "./helpers.js";

let t, page;
const requests = [];
before(async () => {
  t = await setup();
  page = t.page;
  page.on("request", (r) => requests.push(r.url()));
  await t.upload(GIRL);
});
after(() => t.close());

const counts = () => page.evaluate(() => ({
  elements: document.getElementsByTagName("*").length,
  apex: document.querySelectorAll(".apexcharts-canvas").length,
  canvas: document.querySelectorAll("canvas[role=img]").length,
}));
const feedsMin = () => page.evaluate(() => window.ApexCharts.getChartByID("feeds").w.globals.minX);
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

test("Overview doesn't download ApexCharts", () => {
  assert.ok(!requests.some((u) => /ApexChart-/.test(u)));
});

let firstWeek;
test("History puts the week in the URL, and Next updates it", async () => {
  await t.go("history", ".history-table");
  firstWeek = page.url().match(/#\/history\?week=(\d{4}-\d{2}-\d{2})$/)?.[1];
  assert.ok(firstWeek, "week in URL: " + page.url());
  await page.click("text=Next ›");
  await page.click("text=Next ›");
  assert.ok(page.url().endsWith("week=" + addDays(firstWeek, 14)), page.url());
});

let unzoomed, zoomed;
test("Feeding loads ApexCharts and its five charts", async () => {
  await t.go("feeding", "[aria-busy=false] .apexcharts-canvas");
  await page.waitForFunction(() => document.querySelectorAll("[aria-busy=false]").length >= 5);
  assert.ok(requests.some((u) => /ApexChart-/.test(u)));
  const c = await counts();
  assert.equal(c.apex, 4);
  assert.equal(c.canvas, 1);
});

test("dragging the zoom strip zooms the charts", async () => {
  unzoomed = await feedsMin();
  const rb = await (await page.$("#apexchartsfeeds-brush .apexcharts-selection-rect")).boundingBox();
  await page.mouse.move(rb.x + 1, rb.y + rb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(rb.x + 1 + i * 40, rb.y + rb.height / 2);
  await page.mouse.up();
  await page.waitForFunction((min) => window.ApexCharts.getChartByID("feeds").w.globals.minX > min, unzoomed, { timeout: 5000 });
  zoomed = await feedsMin();
});

test("Growth draws its charts, and leaving Feeding destroyed Feeding's", async () => {
  await t.go("growth", ".apexcharts-canvas");
  assert.equal(await t.count("#apexchartsfeeds"), 0);
  assert.equal(await t.count("canvas[role=img]"), 0);
});

test("Measurements has a table and no charts", async () => {
  await t.go("measurements", "table tbody tr");
  assert.equal((await counts()).apex, 0);
});

test("returning to Feeding keeps the zoom", async () => {
  await t.go("feeding", "[aria-busy=false] #apexchartsfeeds");
  assert.equal(await feedsMin(), zoomed);
  assert.notEqual(zoomed, unzoomed);
});

test("returning to History keeps the week", async () => {
  await t.go("history", ".history-table");
  assert.ok(page.url().endsWith("week=" + addDays(firstWeek, 14)), page.url());
});

test("Back and Forward move between sections", async () => {
  await page.goBack();
  await page.waitForFunction(() => location.hash === "#/feeding");
  await page.goForward();
  await page.waitForFunction(() => location.hash.startsWith("#/history"));
});

test("deep links open the right section and week, and survive a refresh", async () => {
  await page.goto(t.url("/dashboard.html#/growth"));
  await page.waitForSelector(".apexcharts-canvas");
  assert.equal((await page.textContent(".page-title")).trim(), "Growth");
  await page.goto(t.url("/dashboard.html#/history?week=2024-03-10")); // the DST week
  await page.waitForSelector(".history-table");
  assert.match(await page.textContent(".history-table thead"), /Mar 10/);
  await page.reload();
  await page.waitForSelector(".history-table");
  assert.ok(page.url().endsWith("week=2024-03-10"));
});

test("an unknown section falls back to Overview", async () => {
  await page.goto(t.url("/dashboard.html#/nope"));
  await page.waitForSelector("text=Latest growth");
  assert.ok(page.url().endsWith("#/overview"));
});

test("navigating focuses the section heading and marks the link current", async () => {
  await page.click('aside a.nav-link[href="#/measurements"]');
  await page.waitForFunction(() => document.activeElement.classList.contains("page-title"));
  assert.equal(await page.getAttribute('aside a.nav-link[href="#/measurements"]', "aria-current"), "page");
});

test("phone width: menu toggles, closes on choosing, no sideways scroll", async () => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(t.url("/dashboard.html#/overview"));
  await page.waitForSelector("text=Latest growth");
  assert.ok(await page.isHidden("#sidebar-menu .nav-link >> nth=0"), "menu starts hidden");
  await page.click(".navbar-toggler");
  assert.equal(await page.getAttribute(".navbar-toggler", "aria-expanded"), "true");
  await page.click('#sidebar-menu a.nav-link[href="#/history"]');
  await page.waitForSelector(".history-table");
  assert.ok(await page.isHidden("#sidebar-menu .nav-link >> nth=0"), "menu closes");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
});

test("no console or page errors", () => assert.deepEqual(t.errors, []));
