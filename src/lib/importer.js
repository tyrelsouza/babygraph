// Parses a NaraBaby CSV export into the dashboard's data shape, entirely in the browser.
// fixtures/expected/*.json pin its output (npm test).
import Papa from "papaparse";

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;
const REQUIRED_COLUMNS = ["Type", "Start Date/time", "[Profile] Birth Date", "[Profile] Sex"];

export class ImportError extends Error {}

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toKg = (v, unit) => { const n = num(v); return n == null ? null : unit === "LB" ? n * LB_TO_KG : n; };
const toCm = (v, unit) => { const n = num(v); return n == null ? null : unit === "IN" ? n * IN_TO_CM : n; };

// Python's round(): half-to-even on exact ties, otherwise nearest (toFixed uses the exact binary value).
// A double is exactly halfway at `digits` places only if x·2^(digits+1) is an integer and x·2·10^digits is odd.
function pyRound(x, digits = 0) {
  const exactTie = Number.isInteger(x * 2 ** (digits + 1)) && Math.abs(x * 2 * 10 ** digits) % 2 === 1;
  if (exactTie) {
    const floor = Math.floor(x * 10 ** digits);
    return (floor % 2 === 0 ? floor : floor + 1) / 10 ** digits;
  }
  return Number(x.toFixed(digits));
}

// "Motrin, 4 (ML)" → name, dose, unit. Anything else is kept whole as the name.
const MEDICATION = /^(.+), ([\d.]+) \((\w+)\)$/;
function parseMedication(text) {
  if (!text) return { name: null, dose: null, unit: null };
  const m = MEDICATION.exec(text.trim());
  return m ? { name: m[1], dose: Number(m[2]), unit: m[3] } : { name: text.trim(), dose: null, unit: null };
}

// Temperatures are stored in °C (two decimals); the export records the unit per row
function toCelsius(value, unit) {
  const n = num(value);
  if (n == null) return null;
  return Math.round((unit === "F" ? (n - 32) * 5 / 9 : n) * 100) / 100;
}

// Whole days between two YYYY-MM-DD dates, immune to DST
const dayNumber = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const isoFromDayNumber = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

// Lexicographic compare for arrays of strings/null (null sorts first)
function compareArrays(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (a[i] == null) return -1;
    if (b[i] == null) return 1;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function parseNaraExport(csvText, fileName) {
  const parsed = Papa.parse(csvText.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const columns = parsed.meta.fields || [];
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) {
    throw new ImportError(`This doesn't look like a NaraBaby export (missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}).`);
  }
  const rows = parsed.data;

  const profile = rows.find((r) => r.Type === "Profile");
  if (!profile || !/^\d{4}-\d{2}-\d{2}$/.test(profile["[Profile] Birth Date"] || "")) {
    throw new ImportError("The export has no child profile with a birth date.");
  }
  const birth = profile["[Profile] Birth Date"];

  // Feeds: compact rows [time, kind, seconds, ml]
  const feeds = [];
  for (const r of rows) {
    if (r.Type === "Breastfeed") {
      const sec = (num(r["[Breastfeed] Left Duration (Seconds)"]) || 0) + (num(r["[Breastfeed] Right Duration (Seconds)"]) || 0);
      feeds.push([r["Start Date/time"], "breast", Math.trunc(sec), null]);
    } else if (r.Type === "Bottle Feed") {
      let ml = num(r["[Bottle Feed] Breast Milk Volume"]);
      if (ml == null) ml = num(r["[Bottle Feed] Volume"]);
      feeds.push([r["Start Date/time"], "bottle", null, ml]);
    }
  }
  if (!feeds.length) throw new ImportError("The export has no breastfeeding or bottle entries, which the dashboard needs.");
  feeds.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  // Sleep: [start, end]; skip in-progress rows with no end
  const sleeps = rows
    .filter((r) => r.Type === "Sleep" && r["[Sleep] End Date/time"])
    .map((r) => [r["Start Date/time"], r["[Sleep] End Date/time"]])
    .sort(compareArrays);

  // Diapers: [time, type, detail]
  const diapers = rows
    .filter((r) => r.Type === "Diaper")
    .map((r) => [r["Start Date/time"], r["[Diaper] Type"], r["[Diaper] Detail"] || null])
    .sort(compareArrays);

  // Daily rollup from birth to last feed, empty days filled with zeros
  const byDay = new Map();
  for (const [t, kind, sec, ml] of feeds) {
    const key = t.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, { breast: 0, breastMin: 0, bottle: 0, ml: 0 });
    const d = byDay.get(key);
    if (kind === "breast") {
      d.breast += 1;
      d.breastMin += sec / 60;
    } else {
      d.bottle += 1;
      d.ml += ml || 0;
    }
  }
  const daily = [];
  const lastFeedDay = dayNumber(feeds[feeds.length - 1][0].slice(0, 10));
  for (let n = dayNumber(birth); n <= lastFeedDay; n++) {
    const iso = isoFromDayNumber(n);
    const d = byDay.get(iso) || { breast: 0, breastMin: 0, bottle: 0, ml: 0 };
    daily.push([iso, d.breast, pyRound(d.breastMin, 1), d.bottle, pyRound(d.ml)]);
  }

  // Growth: one entry per date, measurements merged
  const growthByDate = new Map();
  for (const r of rows) {
    if (r.Type !== "Growth") continue;
    const date = r["Start Date/time"].slice(0, 10);
    if (!growthByDate.has(date)) growthByDate.set(date, {});
    const g = growthByDate.get(date);
    const kg = toKg(r["[Growth] Weight"], r["[Growth] Weight Unit"]);
    const length = toCm(r["[Growth] Height"], r["[Growth] Height Unit"]);
    const head = toCm(r["[Growth] Head Size"], r["[Growth] Head Size Unit"]);
    if (kg != null) g.weightKg = pyRound(kg, 3);
    if (length != null) g.lengthCm = pyRound(length, 2);
    if (head != null) g.headCm = pyRound(head, 2);
  }
  const growth = [...growthByDate.entries()]
    .filter(([, m]) => Object.keys(m).length)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, m]) => ({ date, ageDays: dayNumber(date) - dayNumber(birth), ...m }));

  // Baby Firsts. `id` is NaraBaby's activity key, stable across exports, so photos added in the
  // dashboard stay linked. The photo itself isn't exported, only whether one existed.
  const firsts = rows
    .filter((r) => r.Type === "Baby First")
    .map((r) => {
      const date = r["Start Date/time"].slice(0, 10);
      return {
        id: r._activityKey, date, ageDays: dayNumber(date) - dayNumber(birth),
        title: r["[Baby First] Baby First"] || "", note: r.Note || null, hadPhoto: Boolean(r.Photo),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Health: one dose/temperature entry per Medical row, and one entry per vaccine visit
  const doses = rows
    .filter((r) => r.Type === "Medical")
    .map((r) => ({
      t: r["Start Date/time"],
      epoch: num(r["Start Date/time (Epoch)"]), // real instant, for dose intervals across time zones/DST
      ...parseMedication(r["[Medical] Medication"]),
      tempC: toCelsius(r["[Medical] Temperature"], r["[Medical] Temperature Unit"]),
      note: r.Note || null,
    }))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  const vaccines = rows
    .filter((r) => r.Type === "Vaccine")
    .map((r) => {
      const date = r["Start Date/time"].slice(0, 10);
      return {
        date, ageDays: dayNumber(date) - dayNumber(birth),
        codes: (r["[Vaccine] Vaccine"] || "").split(/\r?\n/).map((c) => c.trim()).filter(Boolean),
        note: r.Note || null,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    name: profile["Profile Name"],
    birthDate: birth,
    sex: profile["[Profile] Sex"],
    exportedFrom: fileName,
    feeds,
    daily,
    sleeps,
    diapers,
    growth,
    firsts,
    health: { doses, vaccines },
  };
}
