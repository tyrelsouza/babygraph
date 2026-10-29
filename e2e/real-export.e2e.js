// Optional: checks a real export end to end. Skipped unless BABYGRAPH_EXPORT points at one.
// Expected counts come from the parser at test time, so nothing about the real data is committed.
//   BABYGRAPH_EXPORT=~/Downloads/export_narababy_<name>_<date>.csv npm run e2e
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { isFever } from "../src/lib/health.js";
import { REAL_EXPORT, parsed, setup } from "./helpers.js";

describe("real export", { skip: !REAL_EXPORT && "set BABYGRAPH_EXPORT to run" }, () => {
  let t, page, data;
  before(async () => {
    data = parsed(REAL_EXPORT);
    t = await setup();
    page = t.page;
    await page.addInitScript(() => {
      window.__long = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration))))
        .observe({ type: "longtask", buffered: true });
    });
    await t.upload(REAL_EXPORT);
  });
  after(() => t && t.close());

  // Element counts and long tasks per section, printed as test diagnostics (not asserted)
  async function report(ctx, name) {
    const stats = await page.evaluate(() => {
      const s = { elements: document.getElementsByTagName("*").length, longTasks: window.__long };
      window.__long = [];
      return s;
    });
    ctx.diagnostic(`${name}: ${stats.elements} elements, long tasks ${JSON.stringify(stats.longTasks)}`);
  }

  test("Overview loads and the import fits in storage", async (ctx) => {
    assert.match(await page.textContent(".navbar-brand"), new RegExp(data.name.split(" ")[0]));
    const kb = await page.evaluate(() => localStorage.getItem("nara-import").length / 1024);
    ctx.diagnostic(`stored ${kb.toFixed(0)} KB`);
    await report(ctx, "overview");
  });

  test("History, Feeding and Growth draw", async (ctx) => {
    await t.go("history", ".history-table");
    await report(ctx, "history");
    await t.go("feeding", "[aria-busy]");
    await page.waitForFunction(() => document.querySelectorAll("[aria-busy=false]").length >= 5, null, { timeout: 30000 });
    await report(ctx, "feeding");
    await t.go("growth", ".apexcharts-canvas");
    await report(ctx, "growth");
  });

  test("Measurements lists every measurement", async (ctx) => {
    await t.go("measurements", "table tbody tr");
    assert.ok((await page.$$("table tbody tr")).length >= data.growth.length);
    await report(ctx, "measurements");
  });

  test("Firsts shows every entry, lost photo and note", async (ctx) => {
    await t.go("firsts", data.firsts.length ? "article.first-card" : ".empty");
    const shown = await page.evaluate(() => ({
      cards: document.querySelectorAll("article.first-card").length,
      lost: [...document.querySelectorAll(".first-card .card-footer span")].filter((s) => s.textContent.includes("not exported")).length,
      notes: document.querySelectorAll(".first-card .note").length,
    }));
    assert.deepEqual(shown, {
      cards: data.firsts.length,
      lost: data.firsts.filter((f) => f.hadPhoto).length,
      notes: data.firsts.filter((f) => f.note).length,
    });
    await report(ctx, "firsts");
  });

  test("Health shows every dose, fever and vaccine", async (ctx) => {
    await t.go("health", "text=Medicine & temperature");
    const { doses, vaccines } = data.health;
    const shown = await page.evaluate(() => ({
      rows: [...document.querySelectorAll(".card")].find((c) => c.querySelector("h3")?.textContent.includes("Medicine"))
        ?.querySelector("tbody")?.rows.length ?? 0,
      fevers: [...document.querySelectorAll(".badge")].filter((b) => b.textContent.includes("fever")).length,
      codes: [...document.querySelectorAll(".badge.bg-blue-lt")].length,
    }));
    assert.deepEqual(shown, {
      rows: doses.length,
      fevers: doses.filter((d) => isFever(d.tempC)).length,
      codes: vaccines.reduce((n, v) => n + v.codes.length, 0),
    });
    await report(ctx, "health");
  });

  test("phone width doesn't scroll sideways on Firsts", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(t.url("/dashboard.html?phone#/firsts"));
    await page.waitForSelector(data.firsts.length ? "article.first-card" : ".empty");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  });

  test("no console or page errors", () => assert.deepEqual(t.errors, []));
});
