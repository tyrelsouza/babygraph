// Landing page, import errors, drag-and-drop, and the Reset and Clear flow.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { BOY, GIRL, setup } from "./helpers.js";

let t;
const requests = [];
before(async () => {
  t = await setup();
  t.page.on("request", (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
});
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

test("Reset and Clear modal focuses Cancel, and Escape closes it keeping the data", async () => {
  await t.page.click("text=Reset and Clear");
  await t.page.waitForSelector(".modal-dialog");
  assert.equal(await t.page.evaluate(() => document.activeElement.textContent.trim()), "Cancel");
  await t.page.keyboard.press("Escape");
  assert.equal(await t.count(".modal-dialog"), 0);
  assert.ok(await t.page.evaluate(() => !!localStorage.getItem("nara-import")));
});

test("Clear removes the data and shows a notice", async () => {
  await t.page.click("text=Reset and Clear");
  await t.page.click(".modal button:has-text('Clear')");
  await t.page.waitForURL(/index\.html\?cleared$/);
  assert.match(await t.page.textContent(".alert-info"), /removed/);
  assert.equal(await t.page.evaluate(() => localStorage.getItem("nara-import")), null);
});

test("the demo button loads the made-up boy, labelled as demo data", async () => {
  await t.page.click("text=Try it with demo data");
  await t.page.waitForURL(/dashboard\.html#\/overview$/);
  await t.page.waitForSelector("text=Latest growth");
  assert.match(await t.page.textContent(".navbar-brand"), /Test Boy/);
  assert.match(await t.page.textContent(".page-pretitle"), /Demo data \(Test Boy, made up\)/);
});

test("with an export already loaded, the demo asks before replacing it", async () => {
  await t.upload(GIRL);
  await t.page.goto(t.url("/index.html"));
  t.page.once("dialog", (d) => d.dismiss());
  await t.page.click("text=Try it with demo data");
  await t.page.waitForTimeout(300);
  assert.ok(t.page.url().endsWith("/index.html"), "stays put when cancelled");
  assert.match(await t.page.textContent(".card-sm"), /Test Girl/);
  t.page.once("dialog", (d) => d.accept());
  await t.page.click("text=Try it with demo data");
  await t.page.waitForURL(/dashboard\.html/);
  await t.page.waitForSelector("text=Latest growth");
  assert.match(await t.page.textContent(".navbar-brand"), /Test Boy/);
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

test("the privacy policy is linked, and links to the Caddy config on GitHub", async () => {
  await t.page.goto(t.url("/index.html"));
  assert.equal(await t.count('a[href="./privacy.html"]'), 2); // the local-only callout and the footer
  await t.page.click("footer a[href='./privacy.html'], .card-footer a[href='./privacy.html']");
  await t.page.waitForSelector("h1:text('Privacy policy')");
  assert.equal(await t.count('a[href="https://github.com/tyrelsouza/babygraph/blob/main/deploy/Caddyfile.example"]'), 1);
});

test("the footer links to the commit it was built from, flagging uncommitted changes", async () => {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  let head;
  try { head = git("rev-parse", "HEAD"); } catch { return; } // no commits: nothing to show
  if (process.env.E2E_BASE_URL) return; // a deployed copy may be from another commit
  await t.page.goto(t.url("/index.html"));
  const link = t.page.locator("[data-build] a");
  assert.equal(await link.getAttribute("href"), `https://github.com/tyrelsouza/babygraph/commit/${head}`);
  assert.equal((await link.textContent()).trim(), head.slice(0, 7));
  const dirty = git("status", "--porcelain") !== "";
  assert.equal((await t.page.textContent("[data-build]")).includes("+ local changes"), dirty);
});

test("nothing is sent anywhere: only GETs for the site's own files, no request bodies, no cookies", async () => {
  // Covers every upload above (drop and file picker), the dashboard and New upload
  assert.ok(requests.length > 0);
  const origin = new URL(t.base).origin;
  const offenders = requests.filter((r) => r.method !== "GET" || r.body || new URL(r.url).origin !== origin);
  assert.deepEqual(offenders, []);
  assert.deepEqual(await t.context.cookies(), []);
});

test("no console or page errors", () => assert.deepEqual(t.errors, []));
