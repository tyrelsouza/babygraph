import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ImportError, parseNaraExport } from "../src/lib/importer.js";

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

for (const kid of ["girl", "boy"]) {
  test(`fake ${kid} export matches the reference output`, () => {
    const file = `narababy_fake_${kid}_export.csv`;
    const actual = parseNaraExport(fixture(file), file);
    const expected = JSON.parse(fixture(`expected/narababy_fake_${kid}.json`));
    // Round-trip through JSON so number formatting (160 vs 160.0) can't differ
    assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected);
  });
}

test("rejects a CSV that isn't a NaraBaby export", () => {
  assert.throws(() => parseNaraExport("name,amount\nfoo,1\n", "other.csv"), ImportError);
});

test("rejects an export without a Profile row", () => {
  const csv = fixture("narababy_fake_girl_export.csv").split("\n").filter((l) => !l.startsWith('"Profile"')).join("\n");
  assert.throws(() => parseNaraExport(csv, "no-profile.csv"), /no child profile/);
});

test("ignores a leading byte-order mark", () => {
  const file = "narababy_fake_boy_export.csv";
  assert.equal(parseNaraExport("﻿" + fixture(file), file).name, "Test Boy");
});

test("Baby Firsts: stable ids, date order, optional description and photo flag", () => {
  const { firsts } = parseNaraExport(fixture("narababy_fake_girl_export.csv"), "girl.csv");
  assert.equal(firsts.length, 6);
  assert.equal(new Set(firsts.map((f) => f.id)).size, 6);
  assert.deepEqual(firsts.map((f) => f.date), [...firsts.map((f) => f.date)].sort());
  assert.equal(firsts.filter((f) => f.hadPhoto).length, 3);
  assert.equal(firsts.find((f) => f.title === "First smile").note, 'Smiled at "Parent B", then again,\nat the dog');
  assert.equal(firsts.find((f) => f.title === "Met the grandparents").note, null);
  assert.equal(firsts.find((f) => f.title === "First laugh").ageDays, 27);
});

test("Health: medicine strings, temperatures and vaccine codes", () => {
  const { health } = parseNaraExport(fixture("narababy_fake_girl_export.csv"), "girl.csv");
  const tylenol = health.doses.find((d) => d.name === "Infant Tylenol");
  assert.deepEqual([tylenol.dose, tylenol.unit], [1.25, "ML"]);
  const saline = health.doses.find((d) => d.name === "Saline drops");
  assert.deepEqual([saline.dose, saline.unit, saline.note], [null, null, "Before feeding"]);
  const temps = health.doses.filter((d) => d.tempC != null).map((d) => d.tempC);
  assert.deepEqual(temps, [37.28, 38.11, 37.9, 38]); // 99.1 °F, 100.6 °F, 37.9 °C passthrough, 100.4 °F
  assert.equal(health.doses.filter((d) => d.name == null).length, 3); // temperature-only rows
  assert.deepEqual(health.vaccines.map((v) => v.codes), [["HepB"], ["HepB", "RSV"]]);
});

test("Health: dose intervals use real time, per medicine; fever at 38.0 °C", async () => {
  const { withIntervals, isFever } = await import("../src/lib/health.js");
  const { health } = parseNaraExport(fixture("narababy_fake_girl_export.csv"), "girl.csv");
  const doses = withIntervals(health.doses);
  const tylenol = doses.filter((d) => d.name === "Infant Tylenol");
  // 20:20 → 23:50 is 3h30; 23:50 New York → 04:55 Chicago is 6h05 of real time (5h05 on the wall clock)
  const minutes = (list) => list.map((d) => (d.sincePrevMs == null ? null : d.sincePrevMs / 60000));
  assert.deepEqual(minutes(tylenol), [null, 210, 365]);
  const gas = doses.filter((d) => d.name === "Gas drops");
  assert.deepEqual(minutes(gas), [null, 19 * 60]);
  assert.ok(isFever(38) && isFever(38.11) && !isFever(37.9) && !isFever(null));
});
