// Landing page, upload errors, drag-and-drop, and the New upload flow.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { BOY, GIRL, setup } from "./helpers.js";

let t;
before(async () => { t = await setup(); });
after(() => t.close());

test("dashboard with nothing stored redirects to the landing page", async () => {
  await t.page.goto(t.url("/dashboard.html"));
  await t.page.waitForURL(/index\.html$/);
});

test("a CSV that isn't a NaraBaby export shows an error and stays put", async () => {
  await t.page.setInputFiles('input[type="file"]', { name: "other.csv", mimeType: "text/csv", buffer: Buffer.from("name,amount\nfoo,1\n") });
  await t.page.waitForSelector(".alert-danger");
  assert.match(await t.page.textContent(".alert-danger"), /doesn't look like a NaraBaby export/);
  assert.ok(t.page.url().endsWith("/index.html"));
});

test("a file that isn't .csv is rejected", async () => {
  await t.page.setInputFiles('input[type="file"]', { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  assert.match(await t.page.textContent(".alert-danger"), /\.csv file/);
});

test("dropping an export opens its dashboard", async () => {
  const text = readFileSync(GIRL, "utf8");
  await t.page.evaluate((csv) => {
    const dt = new DataTransfer();
    dt.items.add(new File([csv], "narababy_fake_girl_export.csv", { type: "text/csv" }));
    document.querySelector(".dropzone").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, text);
  await t.page.waitForURL(/dashboard\.html#\/overview$/);
  await t.page.waitForSelector("text=Latest growth");
  assert.match(await t.page.textContent(".navbar-brand"), /Test Girl/);
});

test("New upload modal focuses Cancel, and Escape closes it keeping the data", async () => {
  await t.page.click("text=New upload");
  await t.page.waitForSelector(".modal-dialog");
  assert.equal(await t.page.evaluate(() => document.activeElement.textContent.trim()), "Cancel");
  await t.page.keyboard.press("Escape");
  assert.equal(await t.count(".modal-dialog"), 0);
  assert.ok(await t.page.evaluate(() => !!localStorage.getItem("nara-import")));
});

test("Clear and upload removes the data and shows a notice", async () => {
  await t.page.click("text=New upload");
  await t.page.click("text=Clear and upload");
  await t.page.waitForURL(/index\.html\?cleared$/);
  assert.match(await t.page.textContent(".alert-info"), /removed/);
  assert.equal(await t.page.evaluate(() => localStorage.getItem("nara-import")), null);
});

test("the file picker works, and the landing page then offers to reopen", async () => {
  await t.upload(BOY);
  assert.match(await t.page.textContent(".navbar-brand"), /Test Boy/);
  await t.page.goto(t.url("/index.html"));
  assert.match(await t.page.textContent(".card-sm"), /Open dashboard/);
});

test("landing page links to the license files, and they're served", async () => {
  for (const href of ["./NOTICE.md", "./THIRD-PARTY-LICENSES.md"]) {
    assert.equal(await t.count(`a[href="${href}"]`), 1, href + " linked");
    const res = await t.page.request.get(t.url("/" + href.slice(2)));
    assert.equal(res.status(), 200, href + " served");
  }
});

test("no console or page errors", () => assert.deepEqual(t.errors, []));
