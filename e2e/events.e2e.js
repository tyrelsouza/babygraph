// Firsts (with photos stored in IndexedDB), Health, and photos surviving or clearing on New upload.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { BOY, GIRL, PHOTO, setup } from "./helpers.js";

let t, page;
before(async () => {
  t = await setup();
  page = t.page;
  await t.upload(GIRL);
});
after(() => t.close());

async function addPhotoVia(buttonSelector) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click(buttonSelector)]);
  await chooser.setFiles(PHOTO);
}
const loadedThumbs = () => page.$$eval("article.first-card img.thumb", (els) => els.filter((e) => e.complete && e.naturalWidth > 0).length);
const storedPhotoCount = () => page.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("nara-photos"); q.onsuccess = () => r(q.result); });
  return new Promise((r) => { const q = db.transaction("photos").objectStore("photos").count(); q.onsuccess = () => r(q.result); });
});
const medRows = () => page.$$eval(".card:has(h3:text('Medicine & temperature')) tbody tr", (rows) =>
  rows.map((r) => [...r.cells].map((c) => c.textContent.trim())));

// ----- Overview and Firsts -----
test("sidebar has an Events heading, and Overview lists 5 recent firsts", async () => {
  assert.equal((await page.textContent("aside .nav-group-heading")).trim(), "Events");
  assert.equal((await page.$$(".list-group-item")).length, 5);
});

test("Firsts lists every entry, marks lost photos, keeps note line breaks", async () => {
  await t.go("firsts", "article.first-card");
  assert.equal((await page.$$("article.first-card")).length, 6);
  assert.equal((await page.$$("text=Photo in NaraBaby (not exported)")).length, 3);
  assert.equal(await page.$eval("article.first-card .note", (e) => getComputedStyle(e).whiteSpace), "pre-line");
});

test("adding a photo stores a downscaled JPEG and a thumbnail", async () => {
  await addPhotoVia('button[aria-label="Add photo: First laugh"]');
  await page.waitForSelector('button[aria-label="View photo: First laugh"] img');
  await page.waitForFunction(() => [...document.querySelectorAll("img.thumb")].some((i) => i.complete && i.naturalWidth));
  assert.match(await page.textContent("[aria-live=polite]"), /1 photo added/);
  const dims = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("nara-photos"); q.onsuccess = () => r(q.result); });
    const rec = await new Promise((r) => { const q = db.transaction("photos").objectStore("photos").get("t-FAKEGIRL000000000935"); q.onsuccess = () => r(q.result); });
    const size = async (b) => { const bm = await createImageBitmap(b); return [bm.width, bm.height, b.type]; };
    return { full: await size(rec.full), thumb: await size(rec.thumb) };
  });
  assert.deepEqual(dims, { full: [640, 480, "image/jpeg"], thumb: [400, 300, "image/jpeg"] }); // 640×480 source isn't upscaled
});

test("the lightbox opens focused on Close, and Escape returns focus", async () => {
  await page.click('button[aria-label="View photo: First laugh"]');
  await page.waitForSelector(".lightbox-img");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Close");
  await page.keyboard.press("Escape");
  assert.equal(await t.count(".lightbox-img"), 0);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "View photo: First laugh");
});

test("replacing keeps a single photo", async () => {
  await addPhotoVia('button[aria-label="Replace photo: First laugh"]');
  await page.waitForTimeout(400);
  assert.equal(await loadedThumbs(), 1);
  assert.equal(await storedPhotoCount(), 1);
});

test("search matches notes, and the had-a-photo filter narrows the list", async () => {
  await page.fill("input[type=search]", "fan");
  assert.equal((await page.$$("article.first-card")).length, 1);
  await page.fill("input[type=search]", "");
  await page.check("text=Had a photo in NaraBaby");
  assert.equal((await page.$$("article.first-card")).length, 3);
  await page.uncheck("text=Had a photo in NaraBaby");
});

test("Overview's recent firsts shows the added photo", async () => {
  await t.go("overview", "text=Recent firsts");
  await page.waitForSelector(".recent-thumb");
  const sizes = await page.$$eval(".list-group-item .avatar", (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.ok(sizes.every((w) => w === sizes[0]), "avatars don't shrink next to long titles: " + sizes);
});

// ----- Health -----
test("Health shows every dose and temperature, with fever badges at ≥ 100.4 °F", async () => {
  await t.go("health", "text=Medicine & temperature");
  assert.equal((await medRows()).length, 9);
  assert.equal((await page.$$("text=fever ≥ 100.4 °F")).length, 2); // 100.6 °F and exactly 100.4 °F
});

test("time since the last dose uses real elapsed time across time zones", async () => {
  const tylenol = (await medRows()).filter((r) => /tylenol/i.test(r[2])).map((r) => r[5]);
  assert.deepEqual(tylenol, ["6h 5m", "3h 30m", "–"]); // 23:50 New York → 04:55 Chicago is 6h 5m
});

test("vaccines are newest first with full names for screen readers", async () => {
  const badges = await page.$$eval(".card:has(h3:text('Vaccines')) tbody tr", (rows) =>
    rows.map((r) => [...r.querySelectorAll(".badge")].map((b) => b.textContent.trim())));
  assert.deepEqual(badges, [["HepB (Hepatitis B)", "RSV"], ["HepB (Hepatitis B)"]]);
});

test("the medicine filter narrows rows", async () => {
  await page.selectOption("select[aria-label='Filter by medicine']", { index: 1 });
  const n = (await medRows()).length;
  assert.ok(n > 0 && n < 9, String(n));
  await page.selectOption("select[aria-label='Filter by medicine']", "");
});

// ----- photos across New upload -----
test("New upload offers to remove photos, unchecked; unchecked keeps them", async () => {
  await page.click("text=New upload");
  await page.waitForSelector("text=Also remove the 1 photo you added");
  assert.equal(await page.isChecked(".modal input[type=checkbox]"), false);
  await page.click("text=Clear and upload");
  await page.waitForURL(/index\.html\?cleared/);
  await t.upload(GIRL);
  await t.go("firsts", "img.thumb");
  assert.equal(await loadedThumbs(), 1);
});

test("a photo whose entry isn't in the export is reported and removable", async () => {
  await page.evaluate(() => localStorage.removeItem("nara-import"));
  await t.upload(BOY);
  await t.go("firsts", "text=Remove them");
  assert.equal(await t.count("text=1 added photo belongs to entries that aren't in this export."), 1);
  await page.click("text=Remove them");
  await page.waitForSelector("text=Remove them", { state: "detached" });
  assert.equal(await storedPhotoCount(), 0);
});

test("Remove deletes a photo, and the checked box clears all photos", async () => {
  await page.evaluate(() => localStorage.removeItem("nara-import"));
  await t.upload(GIRL);
  await t.go("firsts", "article.first-card");
  await addPhotoVia('button[aria-label="Add photo: First laugh"]');
  await page.waitForSelector("img.thumb");
  await page.click('button[aria-label="Remove photo: First laugh"]');
  await page.waitForSelector("img.thumb", { state: "detached" });
  await addPhotoVia('button[aria-label="Add photo: First laugh"]');
  await page.waitForSelector("img.thumb");
  await page.click("text=New upload");
  await page.check(".modal input[type=checkbox]");
  await page.click("text=Clear and upload");
  await page.waitForURL(/index\.html\?cleared/);
  assert.equal(await storedPhotoCount(), 0);
});

test("an import stored by an older version asks for a re-upload", async () => {
  await t.upload(GIRL);
  await page.evaluate(() => { const r = JSON.parse(localStorage.getItem("nara-import")); r.version = 1; localStorage.setItem("nara-import", JSON.stringify(r)); });
  await page.goto(t.url("/dashboard.html?v1#/firsts")); // a new query forces a real reload
  await page.waitForURL(/index\.html/);
});

test("phone width: Firsts doesn't scroll sideways", async () => {
  await t.upload(GIRL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(t.url("/dashboard.html#/firsts"));
  await page.waitForSelector("article.first-card");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
});

test("no console or page errors", () => assert.deepEqual(t.errors, []));
