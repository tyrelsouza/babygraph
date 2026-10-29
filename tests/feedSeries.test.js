import assert from "node:assert/strict";
import { test } from "node:test";
import { DAILY_MAX_DAYS, feedSeries, modeFor, weeklyRows } from "../src/lib/feedSeries.js";

const DAY = 86400000;
const local = (y, m, d) => new Date(y, m - 1, d).getTime();
// Consecutive local days from a start date, as FeedingSection builds them
const days = (y, m, d, n, fn = (i) => ({ breast: 4, bottle: 2 + (i % 2) })) =>
  Array.from({ length: n }, (_, i) => ({ t: new Date(y, m - 1, d + i).getTime(), ...fn(i) }));

test("weeks start on Sunday, and partial weeks average only the days they have", () => {
  // Thu 2024-02-29 .. Wed 2024-03-13: 3 days, a full week, then 4 days
  const w = weeklyRows(days(2024, 2, 29, 14, (i) => ({ breast: i, bottle: 1 })));
  assert.deepEqual(w.map((x) => new Date(x.start).toDateString()), ["Sun Feb 25 2024", "Sun Mar 03 2024", "Sun Mar 10 2024"]);
  assert.deepEqual(w.map((x) => x.days), [3, 7, 4]);
  assert.deepEqual(w.map((x) => x.breast), [1, 6, 11.5]); // (0+1+2)/3, (3..9)/7, (10..13)/4
  assert.deepEqual(w.map((x) => x.bottle), [1, 1, 1]);
});

test("a week across the daylight-saving change stays one week of 7 days", () => {
  const w = weeklyRows(days(2024, 3, 10, 7));
  assert.equal(w.length, 1);
  assert.equal(w[0].days, 7);
});

test(`daily bars up to ${DAILY_MAX_DAYS} days, weekly beyond`, () => {
  const min = local(2023, 3, 2);
  assert.equal(modeFor({ min, max: min + DAILY_MAX_DAYS * DAY }), "daily");
  assert.equal(modeFor({ min, max: min + (DAILY_MAX_DAYS + 1) * DAY }), "weekly");
});

test("weekly mode: two stacked series, one bar per week centred on the week, no average line", () => {
  const daily = days(2023, 3, 5, 200);
  const weekly = weeklyRows(daily);
  const { mode, series } = feedSeries(daily, [], weekly, { min: daily[0].t, max: daily.at(-1).t + DAY });
  assert.equal(mode, "weekly");
  assert.deepEqual(series.map((s) => s.name), ["Breast", "Bottle"]);
  assert.equal(series[0].data.length, weekly.length);
  assert.equal(series[0].data[0][0], weekly[0].start + 3.5 * DAY);
  assert.deepEqual(series[1].data[0], [weekly[0].mid, 2.4]); // bottles alternate 2,3 → 17/7
});

test("daily mode: only days in the window (plus one either side), with the 7-day average", () => {
  const daily = days(2023, 3, 2, 200);
  const rolling = daily.map((d) => [d.t, 6.5]);
  const range = { min: daily[50].t, max: daily[80].t };
  const { mode, series } = feedSeries(daily, rolling, weeklyRows(daily), range);
  assert.equal(mode, "daily");
  assert.deepEqual(series.map((s) => s.name), ["Breast", "Bottle", "7-day average (all feeds)"]);
  assert.equal(series[0].data[0][0], daily[49].t);
  assert.equal(series[0].data.at(-1)[0], daily[81].t);
  assert.equal(series[2].data.length, series[0].data.length);
});
