<script setup>
import { fmtDate, fmtInt } from "../lib/format.js";

const props = defineProps({ data: { type: Object, required: true } });

const feeds = props.data.feeds;
const bottles = feeds.filter((f) => f[1] === "bottle");
const breasts = feeds.filter((f) => f[1] === "breast");
const withMl = bottles.filter((f) => f[3] != null);
const withSec = breasts.filter((f) => f[2] > 0);
const totalMl = withMl.reduce((a, f) => a + f[3], 0);
const totalSec = withSec.reduce((a, f) => a + f[2], 0);
const stats = {
  total: feeds.length, breast: breasts.length, bottle: bottles.length,
  days: props.data.daily.length,
  first: feeds[0][0].slice(0, 10), last: feeds[feeds.length - 1][0].slice(0, 10),
  litres: totalMl / 1000, avgMl: Math.round(totalMl / withMl.length),
  nursingHours: totalSec / 3600, avgNurseMin: Math.round(totalSec / withSec.length / 60),
};
</script>

<template>
  <div class="row row-cards mb-3">
    <div class="col-sm-6 col-lg-3">
      <div class="card card-sm"><div class="card-body">
        <div class="subheader">Feeds logged</div>
        <div class="stat-value">{{ fmtInt(stats.total) }}</div>
        <div class="text-secondary small">
          <span class="swatch" style="background: var(--series-breast)"></span>{{ fmtInt(stats.breast) }} breast ·
          <span class="swatch" style="background: var(--series-bottle)"></span>{{ fmtInt(stats.bottle) }} bottle
        </div>
      </div></div>
    </div>
    <div class="col-sm-6 col-lg-3">
      <div class="card card-sm"><div class="card-body">
        <div class="subheader">Feeding logged</div>
        <div class="stat-value">{{ stats.days }} days</div>
        <div class="text-secondary small">{{ fmtDate(stats.first) }} → {{ fmtDate(stats.last) }}</div>
      </div></div>
    </div>
    <div class="col-sm-6 col-lg-3">
      <div class="card card-sm"><div class="card-body">
        <div class="subheader">Bottle milk</div>
        <div class="stat-value">{{ fmtInt(stats.litres) }} L</div>
        <div class="text-secondary small">avg {{ stats.avgMl }} ml per bottle</div>
      </div></div>
    </div>
    <div class="col-sm-6 col-lg-3">
      <div class="card card-sm"><div class="card-body">
        <div class="subheader">Nursing time</div>
        <div class="stat-value">{{ fmtInt(stats.nursingHours) }} h</div>
        <div class="text-secondary small">avg {{ stats.avgNurseMin }} min per session</div>
      </div></div>
    </div>
  </div>
</template>
