// Series for the "Feeds per day" chart. Long windows show one bar per week (the average feeds per day
// that week), which draws ~14× faster than 400+ daily bars and reads better at that scale. Zoomed in to
// DAILY_MAX_DAYS or less, it switches to daily bars plus the 7-day average line.
import { startOfWeek } from "./format.js";

export const DAILY_MAX_DAYS = 120;
const DAY = 86400000;
const round1 = (n) => Math.round(n * 10) / 10;

export const modeFor = ({ min, max }) => (max - min <= DAILY_MAX_DAYS * DAY ? "daily" : "weekly");

// daily: [{ t (local midnight ms), breast, bottle }] → one row per Sunday-start week. Partial weeks at
// either end are averaged over the days they actually have, so they aren't drawn artificially short.
export function weeklyRows(daily) {
  const weeks = new Map();
  for (const d of daily) {
    const start = startOfWeek(new Date(d.t)).getTime();
    if (!weeks.has(start)) weeks.set(start, { start, breast: 0, bottle: 0, days: 0 });
    const w = weeks.get(start);
    w.breast += d.breast;
    w.bottle += d.bottle;
    w.days += 1;
  }
  return [...weeks.values()].map((w) => ({
    start: w.start,
    mid: w.start + 3.5 * DAY, // bars are centred on their x value, so centre them on the week
    breast: round1(w.breast / w.days),
    bottle: round1(w.bottle / w.days),
    days: w.days,
  }));
}

// The chart's series for a zoom window. Daily mode only includes days in (or just around) the window,
// so zooming in also means drawing fewer bars. `rolling` is [t, 7-day average] aligned with `daily`.
export function feedSeries(daily, rolling, weekly, range) {
  const mode = modeFor(range);
  if (mode === "weekly") {
    return {
      mode,
      series: [
        { name: "Breast", type: "bar", data: weekly.map((w) => [w.mid, w.breast]) },
        { name: "Bottle", type: "bar", data: weekly.map((w) => [w.mid, w.bottle]) },
      ],
    };
  }
  const inWindow = (t) => t >= range.min - DAY && t <= range.max + DAY;
  const rows = daily.filter((d) => inWindow(d.t));
  return {
    mode,
    series: [
      { name: "Breast", type: "bar", data: rows.map((d) => [d.t, d.breast]) },
      { name: "Bottle", type: "bar", data: rows.map((d) => [d.t, d.bottle]) },
      { name: "7-day average (all feeds)", type: "line", data: rolling.filter(([t]) => inWindow(t)) },
    ],
  };
}
