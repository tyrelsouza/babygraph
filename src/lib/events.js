// Flattens sleeps, feeds and diapers into one timeline for the week history view.
import { addDays, localDate, startOfWeek } from "./format.js";

const cache = new WeakMap();

export function buildEvents(data) {
  if (!cache.has(data)) cache.set(data, computeEvents(data));
  return cache.get(data);
}

function computeEvents(data) {
  const events = [
    ...data.sleeps.map(([s, e]) => ({ kind: "sleep", start: localDate(s).getTime(), end: localDate(e).getTime() })),
    ...data.feeds.map(([t, kind, sec, ml]) => {
      const start = localDate(t).getTime();
      return { kind, start, end: start + (sec || 0) * 1000, sec, ml };
    }),
    ...data.diapers.map(([t, type, detail]) => {
      const start = localDate(t).getTime();
      return { kind: "diaper", start, end: start, type, detail };
    }),
  ].sort((a, b) => a.start - b.start);

  const minWeek = startOfWeek(new Date(events[0].start));
  const maxWeek = startOfWeek(new Date(Math.max(...events.map((e) => e.end))));
  // Default to the first full week with sleep logged, so every event type shows
  const firstSleep = events.find((e) => e.kind === "sleep");
  const defaultWeek = firstSleep ? addDays(startOfWeek(new Date(firstSleep.start)), 7) : minWeek;

  return { events, minWeek, maxWeek, defaultWeek: defaultWeek > maxWeek ? maxWeek : defaultWeek };
}
