<script setup>
import { computed } from "vue";
import { DAYS_PER_MONTH, fmtAge, fmtDate, ordinal } from "../lib/format.js";
import { INDICATORS, buildGrowth } from "../lib/growth.js";
import { chartBase, theme, tok } from "../lib/theme.js";
import { REF_PERCENTILES, lmsAt, lmsValue } from "../lib/who.js";
import ApexChart from "../components/ApexChart.vue";

const props = defineProps({ data: { type: Object, required: true } });

const { sex, who, measurements, latest, xMaxDays, xMaxMonths } = buildGrowth(props.data);
const sexLabel = sex === "male" ? "boy" : "girl";
const firstName = props.data.name.split(" ")[0];

const monthAxis = () => ({
  // ApexCharts numeric axes draw tickAmount + 1 intervals, hence the - 1.
  // Monthly ticks for babies under a year of data, 6-monthly after.
  type: "numeric", min: 0, max: xMaxMonths, tickAmount: xMaxMonths / (xMaxMonths <= 12 ? 1 : 6) - 1,
  labels: { formatter: (v) => `${Math.round(v)} mo`, style: { colors: tok("--chart-axis") } },
  axisBorder: { color: tok("--chart-grid") }, axisTicks: { color: tok("--chart-grid") },
  tooltip: { enabled: false },
});

function buildGrowthOptions(ind) {
  const refSeries = REF_PERCENTILES.map((r) => {
    const data = [];
    for (let d = 0; d <= xMaxDays; d += 7) data.push({ x: d / DAYS_PER_MONTH, y: lmsValue(lmsAt(who[ind.key], d), r.z) });
    return { name: `WHO ${r.label}`, type: "line", data };
  });
  const childSeries = {
    name: firstName, type: "line",
    data: measurements[ind.key].map((m) => ({ x: m.ageDays / DAYS_PER_MONTH, y: m.value, m })),
  };
  const refColor = tok("--ref-line"), medColor = tok("--ref-median"), childColor = tok("--series-" + ind.key);
  const endLabels = refSeries.map((s, i) => {
    const last = s.data[s.data.length - 1];
    return {
      x: last.x, y: last.y, marker: { size: 0 },
      label: {
        text: REF_PERCENTILES[i].label, borderWidth: 0, offsetX: 14, offsetY: 8, textAnchor: "start",
        style: { background: "transparent", color: tok("--chart-axis"), fontSize: "10px", padding: { left: 0, right: 0, top: 0, bottom: 0 } },
      },
    };
  });
  const xAnnotations = ind.key === "length" ? [{
    x: 24, strokeDashArray: 3, borderColor: tok("--chart-axis"),
    label: { text: "lying → standing", borderWidth: 0, orientation: "horizontal", style: { background: "transparent", color: tok("--chart-axis"), fontSize: "10px" } },
  }] : [];

  return chartBase({
    chart: { type: "line", height: 300 },
    series: [...refSeries, childSeries],
    colors: [refColor, refColor, medColor, refColor, refColor, childColor],
    stroke: { width: [1, 1, 1.5, 1, 1, 2], dashArray: [4, 4, 0, 4, 4, 0], curve: "straight" },
    markers: { size: [0, 0, 0, 0, 0, 4], strokeWidth: 2, strokeColors: tok("--tblr-bg-surface") || "#fff", hover: { size: 6 } },
    xaxis: monthAxis(),
    yaxis: { labels: { formatter: ind.axis, minWidth: 32 } },
    legend: { show: false },
    annotations: { points: endLabels, xaxis: xAnnotations },
    grid: { borderColor: tok("--chart-grid"), padding: { left: 8, right: 36 } },
    tooltip: {
      shared: false, intersect: true,
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const p = w.config.series[seriesIndex].data[dataPointIndex];
        if (!p.m) {
          return `<div class="growth-tip"><span class="label">${w.config.series[seriesIndex].name} at ${fmtAge(Math.round(p.x * DAYS_PER_MONTH))}:</span> ${ind.fmt(p.y)}</div>`;
        }
        const m = p.m;
        const imp = ind.imperial(m.value);
        return `<div class="growth-tip">
          <div class="fw-bold">${fmtDate(m.date)} · ${fmtAge(m.ageDays)}</div>
          <div>${ind.fmt(m.value)}${imp !== "–" ? ` <span class="label">(${imp})</span>` : ""}</div>
          <div><span class="label">z</span> ${m.z.toFixed(2)} · <span class="label">percentile</span> ${ordinal(m.pct)}</div>
        </div>`;
      },
    },
  });
}

const growthOpts = computed(() => Object.fromEntries(INDICATORS.map((ind) => [ind.key, buildGrowthOptions(ind)])));

const percentileOptions = computed(() => chartBase({
  chart: { type: "line", height: 320 },
  series: INDICATORS.map((ind) => ({
    name: ind.short,
    data: measurements[ind.key].map((m) => ({ x: m.ageDays / DAYS_PER_MONTH, y: +m.pct.toFixed(1), m, ind })),
  })),
  colors: INDICATORS.map((ind) => tok("--series-" + ind.key)),
  stroke: { width: 2, curve: "straight" },
  markers: { size: 4, strokeWidth: 2, strokeColors: tok("--tblr-bg-surface") || "#fff", hover: { size: 6 } },
  xaxis: monthAxis(),
  yaxis: { min: 0, max: 100, tickAmount: 4, labels: { formatter: (v) => v.toFixed(0), minWidth: 32 } },
  legend: { position: "top", horizontalAlign: "left" },
  annotations: {
    yaxis: [3, 50, 97].map((y) => ({
      y, strokeDashArray: y === 50 ? 0 : 4, borderColor: tok("--chart-axis"), opacity: 0.6,
      label: { text: ordinal(y), borderWidth: 0, position: "left", textAnchor: "start", offsetX: 4,
               style: { background: "transparent", color: tok("--chart-axis"), fontSize: "10px" } },
    })),
  },
  tooltip: {
    shared: false, intersect: true,
    custom: ({ seriesIndex, dataPointIndex, w }) => {
      const { m, ind } = w.config.series[seriesIndex].data[dataPointIndex];
      return `<div class="growth-tip"><div class="fw-bold">${ind.short} · ${fmtDate(m.date)}</div>
        <div>${ind.fmt(m.value)} · ${fmtAge(m.ageDays)}</div>
        <div><span class="label">percentile</span> ${ordinal(m.pct)} <span class="label">(z ${m.z.toFixed(2)})</span></div></div>`;
    },
  },
}));

</script>

<template>
  <div>
    <p class="text-secondary mb-3">Grey lines are the WHO {{ sexLabel }}s' 3rd, 15th, 50th, 85th and 97th percentiles. Hover a point for its z‑score and percentile.</p>
    <div class="row row-cards mb-3">
      <div class="col-md-6 col-12" v-for="ind in INDICATORS" :key="ind.key">
        <div class="card">
          <div class="card-header">
            <div class="w-100 d-flex justify-content-between align-items-start">
              <div>
                <h3 class="card-title">{{ ind.title }}</h3>
                <div class="card-subtitle">{{ ind.subtitle }}</div>
              </div>
              <div class="text-end" v-if="latest[ind.key]">
                <div class="fw-bold num">{{ ind.fmt(latest[ind.key].value) }}</div>
                <div class="small text-secondary">{{ ordinal(latest[ind.key].pct) }} pct · {{ fmtDate(latest[ind.key].date) }}</div>
              </div>
            </div>
          </div>
          <div class="card-body"><ApexChart lazy :key="ind.key + '-' + theme" :options="growthOpts[ind.key]" /></div>
        </div>
      </div>
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Percentile tracking</h3>
              <div class="card-subtitle">WHO percentile for each measurement over time; a steady line means growth is holding its curve</div>
            </div>
          </div>
          <div class="card-body"><ApexChart lazy :key="'pct-' + theme" :options="percentileOptions" /></div>
        </div>
      </div>
    </div>

  </div>
</template>
