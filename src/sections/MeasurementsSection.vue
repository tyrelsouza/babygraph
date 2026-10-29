<script setup>
import { computed } from "vue";
import { fmtAge, ordinal } from "../lib/format.js";
import { INDICATORS, buildGrowth } from "../lib/growth.js";
import { viewState } from "../lib/viewState.js";

const props = defineProps({ data: { type: Object, required: true } });
const { measurements } = buildGrowth(props.data);

const tableRows = computed(() => INDICATORS
  .filter((ind) => !viewState.measurementsFilter || ind.key === viewState.measurementsFilter)
  .flatMap((ind) => measurements[ind.key].map((m) => ({
    ...m, short: ind.short, metric: ind.fmt(m.value), imperial: ind.imperial(m.value),
  })))
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
</script>

<template>
  <div class="card mb-4">
    <div class="card-header">
      <h3 class="card-title">{{ tableRows.length }} measurements</h3>
      <div class="card-actions">
        <select class="form-select form-select-sm" v-model="viewState.measurementsFilter" aria-label="Filter measurements">
          <option value="">All</option>
          <option v-for="ind in INDICATORS" :key="ind.key" :value="ind.key">{{ ind.short }}</option>
        </select>
      </div>
    </div>
    <div class="table-responsive">
      <table class="table table-vcenter card-table table-sm">
        <thead>
          <tr><th>Date</th><th>Age</th><th>Measure</th><th class="text-end">Value</th><th class="text-end">Imperial</th><th class="text-end">z‑score</th><th class="text-end">Percentile</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in tableRows" :key="m.date + m.key">
            <td class="num">{{ m.date }}</td>
            <td>{{ fmtAge(m.ageDays) }}</td>
            <td><span class="swatch" :style="{ background: 'var(--series-' + m.key + ')' }"></span>{{ m.short }}</td>
            <td class="text-end num">{{ m.metric }}</td>
            <td class="text-end num text-secondary">{{ m.imperial }}</td>
            <td class="text-end num">{{ m.z == null ? '–' : m.z.toFixed(2) }}</td>
            <td class="text-end num">
              {{ m.pct == null ? '–' : ordinal(m.pct) }}
              <span v-if="m.pct != null && (m.pct < 3 || m.pct > 97)" class="badge bg-yellow-lt ms-1">outside 3–97</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
