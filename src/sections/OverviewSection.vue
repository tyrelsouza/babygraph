<script setup>
// The cheap landing view: totals, latest growth as text, and a way into each section. No charts.
import { onMounted } from "vue";
import StatCards from "../components/StatCards.vue";
import { fmtAge, fmtDate, ordinal } from "../lib/format.js";
import { INDICATORS, buildGrowth } from "../lib/growth.js";
import { loadThumbs, thumbUrls } from "../lib/photos.js";
import { sectionHref } from "../lib/route.js";
import { SECTIONS } from "./index.js";

const props = defineProps({ data: { type: Object, required: true } });
const { latest } = buildGrowth(props.data);
const latestRows = INDICATORS.filter((ind) => latest[ind.key]).map((ind) => ({ ind, m: latest[ind.key] }));
const sections = SECTIONS.filter((s) => s.name !== "overview");
const recentFirsts = props.data.firsts.slice(-5).reverse();
onMounted(() => { if (recentFirsts.length) loadThumbs(); });
</script>

<template>
  <div>
    <StatCards :data="data" />

    <div class="row row-cards">
      <div class="col-lg-6">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Latest growth</h3>
            <div class="card-actions"><a :href="sectionHref('growth')" class="btn btn-sm">See charts</a></div>
          </div>
          <div class="table-responsive">
            <table class="table table-vcenter card-table">
              <thead><tr><th>Measure</th><th class="text-end">Value</th><th class="text-end">WHO percentile</th><th class="text-end">Measured</th></tr></thead>
              <tbody>
                <tr v-for="{ ind, m } in latestRows" :key="ind.key">
                  <td><span class="swatch" :style="{ background: 'var(--series-' + ind.key + ')' }"></span>{{ ind.short }}</td>
                  <td class="text-end num">{{ ind.fmt(m.value) }}</td>
                  <td class="text-end num">{{ ordinal(m.pct) }}</td>
                  <td class="text-end text-secondary">{{ fmtDate(m.date) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="recentFirsts.length" class="col-lg-6">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent firsts</h3>
            <div class="card-actions"><a :href="sectionHref('firsts')" class="btn btn-sm">See all</a></div>
          </div>
          <div class="list-group list-group-flush">
            <div v-for="f in recentFirsts" :key="f.id" class="list-group-item d-flex gap-3 align-items-center">
              <img v-if="thumbUrls.has(f.id)" :src="thumbUrls.get(f.id)" alt="" class="avatar avatar-md flex-shrink-0 recent-thumb" />
              <span v-else class="avatar avatar-md flex-shrink-0 bg-primary-lt" aria-hidden="true">★</span>
              <div class="text-truncate min-w-0">
                <div class="text-truncate">{{ f.title || 'Untitled' }}</div>
                <div class="small text-secondary">{{ fmtDate(f.date) }} · {{ fmtAge(f.ageDays) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-6">
        <div class="row row-cards">
          <div class="col-sm-6" v-for="s in sections" :key="s.name">
            <a class="card card-link card-sm h-100" :href="sectionHref(s.name)">
              <div class="card-body d-flex gap-3 align-items-start">
                <span class="avatar bg-primary-lt">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="s.icon"></svg>
                </span>
                <div>
                  <div class="fw-bold">{{ s.title }}</div>
                  <div class="text-secondary small">{{ s.blurb }}</div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recent-thumb { object-fit: cover; }
.min-w-0 { min-width: 0; }
</style>
