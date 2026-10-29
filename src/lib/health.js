// Health helpers: dose intervals, fever flag, temperature units and vaccine names.
// Display only; nothing here gives dosing or medical advice.
import { localDate } from "./format.js";

export const FEVER_C = 38.0; // 100.4 °F
export const cToF = (c) => c * 9 / 5 + 32;
export const isFever = (c) => c != null && c >= FEVER_C - 1e-9;
export const fmtTemp = (c) => `${cToF(c).toFixed(1)} °F / ${c.toFixed(1)} °C`;

// Intervals longer than this aren't shown; they're separate illnesses, not a dosing rhythm
const INTERVAL_LIMIT_MS = 72 * 3600 * 1000;

// Adds `sincePrevMs` to each dose: time since the previous dose of the same medicine (case-insensitive),
// using the export's real timestamp when present so trips across time zones and DST stay correct.
export function withIntervals(doses) {
  const last = new Map();
  return doses.map((d) => {
    const at = d.epoch ?? localDate(d.t).getTime();
    const key = d.name ? d.name.toLowerCase() : null; // temperature-only rows have no medicine
    let sincePrevMs = null;
    if (key) {
      if (last.has(key) && at - last.get(key) <= INTERVAL_LIMIT_MS) sincePrevMs = at - last.get(key);
      last.set(key, at);
    }
    return { ...d, at, sincePrevMs };
  });
}

// Common US schedule abbreviations; unknown codes are shown as typed
export const VACCINE_NAMES = {
  DTaP: "Diphtheria, tetanus, pertussis",
  HepA: "Hepatitis A",
  HepB: "Hepatitis B",
  Hib: "Haemophilus influenzae type b",
  IIV: "Influenza (inactivated)",
  IPV: "Polio (inactivated)",
  MMR: "Measles, mumps, rubella",
  PCV13: "Pneumococcal (13-valent)",
  PCV15: "Pneumococcal (15-valent)",
  PCV20: "Pneumococcal (20-valent)",
  RV: "Rotavirus",
  VAR: "Varicella (chickenpox)",
};
