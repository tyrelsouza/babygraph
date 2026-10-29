// Growth measurements with WHO z-scores and percentiles, per indicator.
import WHO_LMS from "../data/who_lms.json";
import { DAYS_PER_MONTH, lbOz } from "./format.js";
import { lmsAt, normCdf, zScore } from "./who.js";

export const INDICATORS = [
  {
    key: "weight", field: "weightKg", restricted: true,
    title: "Weight-for-age", short: "Weight", subtitle: "kg",
    fmt: (v) => v.toFixed(2) + " kg", imperial: lbOz, axis: (v) => v.toFixed(0),
  },
  {
    key: "length", field: "lengthCm", restricted: false,
    title: "Length/height-for-age", short: "Length/height", subtitle: "cm · lying length to 24 months, standing height after",
    fmt: (v) => v.toFixed(1) + " cm", imperial: (v) => (v / 2.54).toFixed(1) + " in", axis: (v) => v.toFixed(0),
  },
  {
    key: "head", field: "headCm", restricted: false,
    title: "Head circumference-for-age", short: "Head", subtitle: "cm",
    fmt: (v) => v.toFixed(1) + " cm", imperial: (v) => (v / 2.54).toFixed(1) + " in", axis: (v) => v.toFixed(0),
  },
  {
    key: "bmi", restricted: true,
    title: "BMI-for-age", short: "BMI", subtitle: "kg/m² · weight and length within 14 days",
    fmt: (v) => v.toFixed(1), imperial: () => "–", axis: (v) => v.toFixed(0),
  },
];

// BMI from each weight paired with the nearest length taken within 14 days
function bmiPoints(growth) {
  const lengths = growth.filter((g) => g.lengthCm != null);
  const out = [];
  for (const g of growth) {
    if (g.weightKg == null) continue;
    let best = null;
    for (const l of lengths) {
      const gap = Math.abs(l.ageDays - g.ageDays);
      if (gap <= 14 && (!best || gap < Math.abs(best.ageDays - g.ageDays))) best = l;
    }
    if (best) out.push({ date: g.date, ageDays: g.ageDays, value: g.weightKg / Math.pow(best.lengthCm / 100, 2) });
  }
  return out;
}

// Cached per imported dataset: Overview, Growth and Measurements all need it
const cache = new WeakMap();

export function buildGrowth(data) {
  if (!cache.has(data)) cache.set(data, computeGrowth(data));
  return cache.get(data);
}

function computeGrowth(data) {
  const sex = data.sex === "MALE" ? "male" : "female";
  const who = WHO_LMS[sex]; // reference tables for the child's sex
  const growth = data.growth;

  const measurements = {};
  const latest = {};
  for (const ind of INDICATORS) {
    const raw = ind.key === "bmi"
      ? bmiPoints(growth)
      : growth.filter((g) => g[ind.field] != null).map((g) => ({ date: g.date, ageDays: g.ageDays, value: g[ind.field] }));
    measurements[ind.key] = raw.map((m) => {
      const lms = lmsAt(who[ind.key], m.ageDays);
      const z = lms ? zScore(m.value, lms, ind.restricted) : null;
      return { ...m, key: ind.key, z, pct: z == null ? null : normCdf(z) * 100 };
    });
    const list = measurements[ind.key];
    if (list.length) latest[ind.key] = list[list.length - 1];
  }

  const maxAgeDays = Math.max(0, ...growth.map((g) => g.ageDays));
  const xMaxDays = Math.min(who.weight.M.length - 1, maxAgeDays + 60);
  const xMaxMonths = Math.max(2, Math.ceil(xMaxDays / DAYS_PER_MONTH / 6) * 6);

  return { sex, who, measurements, latest, xMaxDays, xMaxMonths };
}
