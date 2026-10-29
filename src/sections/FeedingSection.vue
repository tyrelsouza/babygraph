<script setup>
import ApexCharts from "apexcharts";
import { computed, onBeforeUnmount, reactive } from "vue";
import { fmtInt, localDate } from "../lib/format.js";
import { chartBase, theme, tok } from "../lib/theme.js";
import { viewState } from "../lib/viewState.js";
import ApexChart from "../components/ApexChart.vue";
import FeedClock from "../components/FeedClock.vue";

const props = defineProps({ data: { type: Object, required: true } });

const feeds = props.data.feeds;
const daily = props.data.daily.map(([d, breast, breastMin, bottle, ml]) => ({ t: localDate(d).getTime(), breast, breastMin, bottle, ml }));
const xMin = daily[0].t;
const xMax = daily[daily.length - 1].t + 86400000;

const rolling = daily.map((d, i) => {
  const win = daily.slice(Math.max(0, i - 6), i + 1);
  return [d.t, +(win.reduce((a, w) => a + w.breast + w.bottle, 0) / win.length).toFixed(1)];
});

// Zoom window shared by the strip and every timeline chart. ApexCharts' own brush redraws all
// targets on every mouse move (about 1s each with the full export), so the strip only reports
// its selection and the charts update once dragging pauses.
// Starts from the last zoom used (viewState), so leaving and returning keeps it.
const zoom = { ...(viewState.feedingZoom || { min: xMin, max: xMax }) }; // plain copy, read when (re)creating charts
const range = reactive({ ...zoom });                                       // reactive copy for the canvas scatter
const ZOOM_TARGETS = ["feeds", "ml", "nursing"];
let zoomTimer = 0;
function onSelection(_chart, { xaxis }) {
  clearTimeout(zoomTimer);
  // The strip reports its initial selection on render; redrawing for an unchanged window wastes ~0.6s
  if (Math.abs(xaxis.min - zoom.min) < 1000 && Math.abs(xaxis.max - zoom.max) < 1000) return;
  zoomTimer = setTimeout(() => {
    zoom.min = range.min = xaxis.min;
    zoom.max = range.max = xaxis.max;
    viewState.feedingZoom = { ...zoom };
    for (const id of ZOOM_TARGETS) ApexCharts.exec(id, "zoomX", xaxis.min, xaxis.max);
  }, 150);
}
onBeforeUnmount(() => clearTimeout(zoomTimer));

const timeAxis = () => ({
  type: "datetime", min: zoom.min, max: zoom.max,
  labels: { datetimeUTC: false, style: { colors: tok("--chart-axis") } },
  axisBorder: { color: tok("--chart-grid") }, axisTicks: { color: tok("--chart-grid") },
});

const feedsPerDayOptions = computed(() => chartBase({
  chart: { id: "feeds", type: "line", height: 320, stacked: true },
  series: [
    { name: "Breast", type: "bar", data: daily.map((d) => [d.t, d.breast]) },
    { name: "Bottle", type: "bar", data: daily.map((d) => [d.t, d.bottle]) },
    { name: "7-day average (all feeds)", type: "line", data: rolling },
  ],
  colors: [tok("--series-breast"), tok("--series-bottle"), tok("--chart-text")],
  stroke: { width: [0, 0, 2], curve: "smooth" },
  plotOptions: { bar: { columnWidth: "90%" } },
  xaxis: timeAxis(),
  yaxis: { title: { text: "feeds" }, labels: { formatter: (v) => v.toFixed(0) } },
  legend: { position: "top", horizontalAlign: "left" },
  tooltip: { shared: true, intersect: false, x: { format: "ddd, MMM d yyyy" } },
}));

const brushOptions = computed(() => chartBase({
  chart: {
    id: "feeds-brush", type: "area", height: 110,
    // A custom selection handler makes ApexCharts skip its per-move brush updates
    brush: { enabled: true, autoScaleYaxis: false },
    events: { selection: onSelection },
    selection: {
      enabled: true, xaxis: { min: zoom.min, max: zoom.max },
      fill: { color: tok("--series-breast"), opacity: 0.12 },
      stroke: { color: tok("--series-breast") },
    },
  },
  series: [{ name: "All feeds", data: daily.map((d) => [d.t, d.breast + d.bottle]) }],
  colors: [tok("--chart-axis")],
  stroke: { width: 1 },
  fill: { type: "solid", opacity: 0.25 },
  xaxis: { ...timeAxis(), min: xMin, max: xMax }, // the strip always shows the full range
  yaxis: { show: false, tickAmount: 2 },
  tooltip: { enabled: false },
}));

const dailyArea = (id, name, color, values, unit) => chartBase({
  chart: { id, type: "area", height: 240 },
  series: [{ name, data: daily.map((d) => [d.t, values(d)]) }],
  colors: [color],
  stroke: { width: 2, curve: "straight" },
  fill: { type: "solid", opacity: 0.18 },
  xaxis: timeAxis(),
  yaxis: { labels: { formatter: (v) => fmtInt(v), minWidth: 40 } },
  tooltip: { x: { format: "ddd, MMM d yyyy" }, y: { formatter: (v) => `${fmtInt(v)} ${unit}` } },
});

const mlOptions = computed(() => dailyArea("ml", "Bottle milk", tok("--series-bottle"), (d) => d.ml, "ml"));
const nursingOptions = computed(() => dailyArea("nursing", "Nursing", tok("--series-breast"), (d) => d.breastMin, "min"));

</script>

<template>
  <div class="row row-cards mb-4">
    <div class="col-12">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Feeds per day</h3>
            <div class="card-subtitle">Breast and bottle sessions logged each day, with the 7‑day average of all feeds. Drag the strip below to zoom.</div>
          </div>
        </div>
        <div class="card-body">
          <ApexChart :key="'feeds-' + theme" :options="feedsPerDayOptions" />
          <ApexChart :key="'brush-' + theme" :options="brushOptions" />
        </div>
      </div>
    </div>
    <div class="col-md-6">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Bottle milk per day</h3>
            <div class="card-subtitle">Total ml from bottles</div>
          </div>
        </div>
        <div class="card-body"><ApexChart :key="'ml-' + theme" :options="mlOptions" /></div>
      </div>
    </div>
    <div class="col-md-6">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Nursing per day</h3>
            <div class="card-subtitle">Total minutes at the breast (left + right)</div>
          </div>
        </div>
        <div class="card-body"><ApexChart :key="'min-' + theme" :options="nursingOptions" /></div>
      </div>
    </div>
    <div class="col-12">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Feeds by time of day</h3>
            <div class="card-subtitle">Each dot is one feed: date across, time of day down. Watch the night feeds thin out.</div>
          </div>
        </div>
        <div class="card-body"><FeedClock :feeds="feeds" :range="range" /></div>
      </div>
    </div>
  </div>
</template>
