<script setup>
// One week at a time; each day is a 24h column with sleep, feeds and diapers drawn together.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { buildEvents } from "../lib/events.js";
import { HOUR, addDays, fmtClock, fmtDur, isoDay, localDate, startOfWeek } from "../lib/format.js";

const props = defineProps({
  data: { type: Object, required: true },
  week: { type: Date, default: null }, // v-model:week, start of the week shown
});
const emit = defineEmits(["update:week"]);

const { events, minWeek, maxWeek, defaultWeek } = buildEvents(props.data);
const KIND_ORDER = { sleep: 0, breast: 1, bottle: 1, diaper: 2 }; // paint order: sleep under feeds under diapers
const DIAPER_LABEL = { "Wet": "Wet", "Dirty": "Dirty", "Dirty Wet": "Wet + dirty" };

const GUTTER = 40, GAP = 8, TOP = 44, HOUR_PX = 22;
const plotH = 24 * HOUR_PX;
const height = TOP + plotH + 4;
const minIso = isoDay(minWeek);
const maxIso = isoDay(addDays(maxWeek, 6));

const clampWeek = (d) => (d < minWeek ? minWeek : d > maxWeek ? maxWeek : d);
const weekStart = ref(props.week ? clampWeek(startOfWeek(props.week)) : defaultWeek);
watch(weekStart, (w) => emit("update:week", w), { immediate: true });
const width = ref(900);
const hover = ref(null);
const wrap = ref(null);

const colW = computed(() => Math.max(24, (width.value - GUTTER - GAP * 6) / 7));
const colX = (i) => GUTTER + i * (colW.value + GAP);
const hourLines = Array.from({ length: 25 }, (_, h) => ({
  h, y: TOP + h * HOUR_PX, major: h % 3 === 0,
  label: h % 3 === 0 ? (h % 12 === 0 ? "12" + (h === 12 ? "p" : "a") : (h % 12) + (h < 12 ? "a" : "p")) : "",
}));

function tooltipHtml(e) {
  const at = fmtClock(e.start);
  if (e.kind === "sleep") return `<div class="fw-bold">Sleep</div><div>${at} – ${fmtClock(e.end)} · ${fmtDur(e.end - e.start)}</div>`;
  if (e.kind === "breast") return `<div class="fw-bold">Breastfeed</div><div>${at}${e.sec ? ` · ${Math.round(e.sec / 60)} min` : ""}</div>`;
  if (e.kind === "bottle") return `<div class="fw-bold">Bottle</div><div>${at}${e.ml != null ? ` · ${e.ml} ml` : ""}</div>`;
  return `<div class="fw-bold">Diaper</div><div>${at} · ${DIAPER_LABEL[e.type] || e.type}${e.detail ? ` · ${e.detail}` : ""}</div>`;
}

const days = computed(() => {
  const w = colW.value;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart.value, i);
    const dayStart = date.getTime();
    const dayEnd = addDays(date, 1).getTime();
    const evs = events
      .filter((e) => e.end >= dayStart && e.start < dayEnd && !(e.end === e.start && e.start === dayEnd))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.start - b.start);
    const yOf = (t) => TOP + ((Math.min(Math.max(t, dayStart), dayEnd) - dayStart) / HOUR) * HOUR_PX;
    const marks = evs.map((e, k) => {
      const y0 = yOf(e.start), y1 = yOf(e.end);
      const id = `${i}-${k}`;
      if (e.kind === "sleep") return { id, e, shape: "rect", x: 0, y: y0, w, h: Math.max(2, y1 - y0), cls: "mark-sleep" };
      if (e.kind === "diaper") return { id, e, shape: "circle", cx: w * 0.86, cy: y0, r: Math.min(5, w * 0.08), cls: e.type === "Wet" ? "mark-diaper-wet" : "mark-diaper-dirty" };
      return { id, e, shape: "rect", x: w * 0.12, y: y0, w: w * 0.58, h: Math.max(4, y1 - y0), cls: "mark-" + e.kind };
    });
    const sleepMs = evs.filter((e) => e.kind === "sleep")
      .reduce((a, e) => a + Math.min(e.end, dayEnd) - Math.max(e.start, dayStart), 0);
    const startsToday = (e) => e.start >= dayStart && e.start < dayEnd;
    const bottles = evs.filter((e) => e.kind === "bottle" && startsToday(e));
    return {
      key: isoDay(date), date, marks,
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totals: {
        sleep: sleepMs ? fmtDur(sleepMs) : "–",
        breast: evs.filter((e) => e.kind === "breast" && startsToday(e)).length,
        bottles: bottles.length,
        ml: bottles.reduce((a, e) => a + (e.ml || 0), 0),
        diapers: evs.filter((e) => e.kind === "diaper").length,
      },
    };
  });
});

const rangeLabel = computed(() => {
  const end = addDays(weekStart.value, 6);
  const opts = { month: "short", day: "numeric" };
  return `${weekStart.value.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
});
const canPrev = computed(() => weekStart.value > minWeek);
const canNext = computed(() => weekStart.value < maxWeek);
const shift = (n) => { weekStart.value = addDays(weekStart.value, 7 * n); hover.value = null; };
function pick(iso) {
  if (!iso) return;
  weekStart.value = clampWeek(startOfWeek(localDate(iso)));
}

function show(m, evt) {
  const box = wrap.value.getBoundingClientRect();
  const x = Math.min(evt.clientX - box.left + 12, box.width - 230);
  hover.value = { id: m.id, x, y: evt.clientY - box.top + 12, html: tooltipHtml(m.e) };
}

let observer;
onMounted(() => {
  width.value = wrap.value.clientWidth; // size immediately; the observer only reports later
  observer = new ResizeObserver(([entry]) => { width.value = entry.contentRect.width; });
  observer.observe(wrap.value);
});
onBeforeUnmount(() => observer && observer.disconnect());
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <div class="btn-group">
        <button type="button" class="btn btn-sm" :disabled="!canPrev" @click="shift(-1)" aria-label="Previous week">‹ Prev</button>
        <button type="button" class="btn btn-sm" :disabled="!canNext" @click="shift(1)" aria-label="Next week">Next ›</button>
      </div>
      <input type="date" class="form-control form-control-sm w-auto" :min="minIso" :max="maxIso"
             :value="isoDay(weekStart)" @change="pick($event.target.value)" aria-label="Jump to the week containing a date">
      <span class="fw-bold ms-1">{{ rangeLabel }}</span>
      <div class="ms-md-auto d-flex flex-wrap gap-3 small text-secondary">
        <span><svg width="14" height="12" aria-hidden="true"><rect width="14" height="12" rx="2" class="mark-sleep"/></svg> Sleep</span>
        <span><svg width="10" height="12" aria-hidden="true"><rect width="10" height="12" rx="2" class="mark-breast"/></svg> Breastfeed</span>
        <span><svg width="10" height="12" aria-hidden="true"><rect width="10" height="12" rx="2" class="mark-bottle"/></svg> Bottle</span>
        <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" class="mark-diaper-wet"/></svg> Wet diaper</span>
        <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" class="mark-diaper-dirty"/></svg> Dirty diaper</span>
      </div>
    </div>

    <div ref="wrap" class="position-relative" @mouseleave="hover = null">
      <svg :width="width" :height="height" role="img" :aria-label="'Sleep, feeds and diapers for the week of ' + rangeLabel">
        <g v-for="l in hourLines" :key="l.h">
          <line :x1="GUTTER" :x2="width" :y1="l.y" :y2="l.y" :class="l.major ? 'hour-major' : 'hour-minor'"/>
          <text v-if="l.label" :x="GUTTER - 8" :y="l.y + 4" text-anchor="end" class="hour-label">{{ l.label }}</text>
        </g>
        <g v-for="(day, i) in days" :key="day.key" :transform="'translate(' + colX(i) + ',0)'">
          <text :x="colW / 2" y="16" text-anchor="middle" class="day-name">{{ day.weekday }}</text>
          <text :x="colW / 2" y="32" text-anchor="middle" class="day-date">{{ day.label }}</text>
          <rect :y="TOP" :width="colW" :height="plotH" rx="4" class="day-bg"/>
          <template v-for="m in day.marks" :key="m.id">
            <rect v-if="m.shape === 'rect'" :x="m.x" :y="m.y" :width="m.w" :height="m.h" rx="2"
                  :class="[m.cls, { 'is-hover': hover && hover.id === m.id }]" @mousemove="show(m, $event)"/>
            <circle v-else :cx="m.cx" :cy="m.cy" :r="m.r"
                    :class="[m.cls, { 'is-hover': hover && hover.id === m.id }]" @mousemove="show(m, $event)"/>
          </template>
        </g>
      </svg>
      <div v-if="hover" class="history-tip" :style="{ left: hover.x + 'px', top: hover.y + 'px' }" v-html="hover.html"></div>
    </div>

    <div class="table-responsive mt-3">
      <table class="table table-sm card-table mb-0 history-table">
        <thead><tr><th></th><th v-for="day in days" :key="day.key" class="text-end">{{ day.weekday }} {{ day.label }}</th></tr></thead>
        <tbody>
          <tr><td>Sleep</td><td v-for="day in days" :key="day.key" class="text-end num">{{ day.totals.sleep }}</td></tr>
          <tr><td>Breastfeeds</td><td v-for="day in days" :key="day.key" class="text-end num">{{ day.totals.breast || '–' }}</td></tr>
          <tr><td>Bottles</td><td v-for="day in days" :key="day.key" class="text-end num">{{ day.totals.bottles ? day.totals.bottles + ' · ' + day.totals.ml + ' ml' : '–' }}</td></tr>
          <tr><td>Diapers</td><td v-for="day in days" :key="day.key" class="text-end num">{{ day.totals.diapers || '–' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.day-bg { fill: var(--tblr-bg-surface-secondary); }
.hour-minor { stroke: var(--chart-grid); stroke-width: 1; opacity: .5; }
.hour-major { stroke: var(--chart-grid); stroke-width: 1; }
.hour-label, .day-date { fill: var(--chart-axis); font-size: 11px; font-variant-numeric: tabular-nums; }
.day-name { fill: var(--tblr-body-color); font-size: 12px; font-weight: 600; }
.mark-sleep { fill: var(--series-sleep); fill-opacity: .35; }
.mark-breast { fill: var(--series-breast); stroke: var(--tblr-bg-surface); stroke-width: 1.5; }
.mark-bottle { fill: var(--series-bottle); stroke: var(--tblr-bg-surface); stroke-width: 1.5; }
.mark-diaper-dirty { fill: var(--series-diaper); stroke: var(--tblr-bg-surface); stroke-width: 1.5; }
.mark-diaper-wet { fill: var(--tblr-bg-surface); stroke: var(--series-diaper); stroke-width: 2; }
.is-hover { stroke: var(--tblr-body-color); stroke-width: 2; }
.mark-sleep.is-hover { fill-opacity: .55; stroke: none; }
.history-tip {
  position: absolute; z-index: 5; pointer-events: none; max-width: 230px;
  padding: .5rem .75rem; font-size: .8125rem; border-radius: 6px;
  background: var(--tblr-bg-surface); border: 1px solid var(--tblr-border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, .12);
}
.history-table th, .history-table td { white-space: nowrap; }
</style>
