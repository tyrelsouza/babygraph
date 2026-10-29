<script setup>
// "Feeds by time of day" on a single canvas: thousands of dots stay cheap to draw, zoom and hover.
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { localDate } from "../lib/format.js";
import { enqueueRender } from "../lib/renderQueue.js";
import { theme, tok } from "../lib/theme.js";
import ChartSkeleton from "./ChartSkeleton.vue";

const props = defineProps({
  feeds: { type: Array, required: true },
  range: { type: Object, required: true }, // { min, max } in ms, shared with the timeline zoom strip
});

const HEIGHT = 360, LEFT = 40, RIGHT = 12, TOP = 8, BOTTOM = 28, R = 2.5;
const plotH = HEIGHT - TOP - BOTTOM;

// Precompute once: time, hour of day, kind
const points = props.feeds.map((f) => {
  const dt = localDate(f[0]);
  return { t: dt.getTime(), hour: dt.getHours() + dt.getMinutes() / 60, f };
});

const wrap = ref(null);
const canvas = ref(null);
const width = ref(900);
const hover = ref(null);
const ready = ref(false); // first draw done (queued behind the charts above it)

const xOf = (t) => LEFT + ((t - props.range.min) / (props.range.max - props.range.min)) * (width.value - LEFT - RIGHT);
const yOf = (h) => TOP + (h / 24) * plotH; // midnight at the top

const hourLabel = (h) => (h % 24 === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : h - 12 + "p");

function dateTicks() {
  const { min, max } = props.range;
  const days = (max - min) / 86400000;
  const ticks = [];
  const d = new Date(min);
  if (days > 75) {
    // Month starts
    d.setDate(1); d.setHours(0, 0, 0, 0);
    if (d.getTime() < min) d.setMonth(d.getMonth() + 1);
    const step = days > 400 ? 2 : 1;
    for (; d.getTime() <= max; d.setMonth(d.getMonth() + step)) {
      ticks.push({ t: d.getTime(), label: d.toLocaleDateString("en-US", d.getMonth() === 0 ? { year: "numeric" } : { month: "short" }) });
    }
  } else {
    // Weekly (or daily when zoomed right in)
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < min) d.setDate(d.getDate() + 1);
    const step = days > 14 ? 7 : 1;
    for (; d.getTime() <= max; d.setDate(d.getDate() + step)) {
      ticks.push({ t: d.getTime(), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
    }
  }
  return ticks;
}

function draw() {
  const el = canvas.value;
  if (!el) return;
  const dpr = window.devicePixelRatio || 1;
  el.width = Math.round(width.value * dpr);
  el.height = Math.round(HEIGHT * dpr);
  el.style.width = width.value + "px";
  el.style.height = HEIGHT + "px";
  const ctx = el.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width.value, HEIGHT);

  const grid = tok("--chart-grid"), axis = tok("--chart-axis");
  ctx.font = "11px " + getComputedStyle(document.body).fontFamily;
  ctx.lineWidth = 1;

  // Hour grid and labels
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let h = 0; h <= 24; h += 3) {
    const y = Math.round(yOf(h)) + 0.5;
    ctx.strokeStyle = grid;
    ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(width.value - RIGHT, y); ctx.stroke();
    ctx.fillStyle = axis;
    ctx.fillText(hourLabel(h), LEFT - 8, y);
  }
  // Date labels
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const tick of dateTicks()) ctx.fillText(tick.label, xOf(tick.t), HEIGHT - BOTTOM + 8);

  // Dots, clipped to the plot area
  ctx.save();
  ctx.beginPath(); ctx.rect(LEFT, TOP - R, width.value - LEFT - RIGHT, plotH + 2 * R); ctx.clip();
  ctx.globalAlpha = 0.6;
  for (const [kind, color] of [["breast", tok("--series-breast")], ["bottle", tok("--series-bottle")]]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const p of points) {
      if (p.f[1] !== kind || p.t < props.range.min || p.t > props.range.max) continue;
      const x = xOf(p.t), y = yOf(p.hour);
      ctx.moveTo(x + R, y);
      ctx.arc(x, y, R, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();

  // Hovered dot ring
  if (hover.value) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tok("--tblr-body-color");
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(xOf(hover.value.p.t), yOf(hover.value.p.hour), R + 3, 0, Math.PI * 2); ctx.stroke();
  }
}

function tooltipHtml(p) {
  const [t, kind, sec, ml] = p.f;
  const dt = localDate(t);
  const detail = kind === "breast"
    ? (sec ? `${Math.round(sec / 60)} min nursing` : "nursing")
    : (ml != null ? `${ml} ml bottle` : "bottle");
  return `<div class="fw-bold">${dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
    <div>${dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${detail}</div>`;
}

let raf = 0;
const scheduleDraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

function onMove(evt) {
  const box = canvas.value.getBoundingClientRect();
  const mx = evt.clientX - box.left, my = evt.clientY - box.top;
  let best = null, bestD = 64; // within 8px
  for (const p of points) {
    if (p.t < props.range.min || p.t > props.range.max) continue;
    const dx = xOf(p.t) - mx, dy = yOf(p.hour) - my;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = p; }
  }
  const prev = hover.value && hover.value.p;
  hover.value = best ? { p: best, x: Math.min(mx + 12, box.width - 230), y: my + 12, html: tooltipHtml(best) } : null;
  if (prev !== best) scheduleDraw();
}
function onLeave() {
  if (hover.value) { hover.value = null; scheduleDraw(); }
}

watch([() => props.range.min, () => props.range.max, width, theme], () => { hover.value = null; scheduleDraw(); });

let observer, cancelFirstDraw;
onMounted(() => {
  width.value = wrap.value.clientWidth;
  observer = new ResizeObserver(([entry]) => { width.value = entry.contentRect.width; });
  observer.observe(wrap.value);
  cancelFirstDraw = enqueueRender(() => { draw(); ready.value = true; });
});
onBeforeUnmount(() => { observer && observer.disconnect(); cancelAnimationFrame(raf); cancelFirstDraw(); });
</script>

<template>
  <div>
    <div class="d-flex gap-3 small text-secondary mb-2" aria-hidden="true">
      <span><span class="swatch" style="background: var(--series-breast)"></span>Breast</span>
      <span><span class="swatch" style="background: var(--series-bottle)"></span>Bottle</span>
    </div>
    <div ref="wrap" class="position-relative" :style="{ minHeight: HEIGHT + 'px' }" :aria-busy="!ready">
      <canvas ref="canvas" role="img" :aria-label="`${points.length} feeds plotted by date and time of day`"
              @mousemove="onMove" @mouseleave="onLeave"></canvas>
      <Transition name="skeleton-fade">
        <ChartSkeleton v-if="!ready" :height="HEIGHT" class="position-absolute top-0 start-0 w-100" />
      </Transition>
      <div v-if="hover" class="clock-tip" :style="{ left: hover.x + 'px', top: hover.y + 'px' }" v-html="hover.html"></div>
    </div>
  </div>
</template>

<style scoped>
canvas { display: block; }
.clock-tip {
  position: absolute; z-index: 5; pointer-events: none; max-width: 230px;
  padding: .5rem .75rem; font-size: .8125rem; border-radius: 6px;
  background: var(--tblr-bg-surface); border: 1px solid var(--tblr-border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, .12);
}
</style>
