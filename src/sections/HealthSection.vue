<script setup>
// Medicine doses, temperatures and vaccine visits, as logged. A record, not advice.
import { computed } from "vue";
import { fmtAge, fmtDate, fmtDur, localDate } from "../lib/format.js";
import { VACCINE_NAMES, fmtTemp, isFever, withIntervals } from "../lib/health.js";
import { viewState } from "../lib/viewState.js";

const props = defineProps({ data: { type: Object, required: true } });
const { doses, vaccines } = props.data.health;
const birth = props.data.birthDate;

const ageDays = (t) => Math.round((localDate(t.slice(0, 10)) - localDate(birth)) / 86400000);
const rows = withIntervals(doses).map((d) => ({ ...d, ageDays: ageDays(d.t) })).reverse(); // newest first

// Medicine names grouped case-insensitively, labelled with the most common spelling
const medicines = (() => {
  const byKey = new Map();
  for (const d of doses) {
    if (!d.name) continue;
    const key = d.name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { key, count: 0, spellings: new Map() });
    const m = byKey.get(key);
    m.count += 1;
    m.spellings.set(d.name, (m.spellings.get(d.name) || 0) + 1);
  }
  return [...byKey.values()]
    .map((m) => ({ key: m.key, count: m.count, label: [...m.spellings].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.count - a.count);
})();

const shown = computed(() => viewState.healthMedicine
  ? rows.filter((r) => r.name && r.name.toLowerCase() === viewState.healthMedicine)
  : rows);

const lastDose = rows.find((r) => r.name);
const temps = doses.filter((d) => d.tempC != null);
const highest = temps.length ? temps.reduce((a, b) => (b.tempC > a.tempC ? b : a)) : null;
const feverCount = temps.filter((d) => isFever(d.tempC)).length;

const dateTime = (t) => localDate(t).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const doseText = (r) => (r.dose == null ? "–" : `${r.dose} ${r.unit ? r.unit.toLowerCase() : ""}`.trim());
const vaccinesNewest = [...vaccines].reverse();
const codeCount = vaccines.reduce((n, v) => n + v.codes.length, 0);
</script>

<template>
  <div>
    <div class="row row-cards mb-3">
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm h-100"><div class="card-body">
          <div class="subheader">Doses logged</div>
          <div class="h2 mb-1 num">{{ doses.filter((d) => d.name).length }}</div>
          <div class="small text-secondary">
            <span v-for="(m, i) in medicines.slice(0, 3)" :key="m.key">{{ i ? ' · ' : '' }}{{ m.label }} {{ m.count }}</span>
          </div>
        </div></div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm h-100"><div class="card-body">
          <div class="subheader">Last dose</div>
          <template v-if="lastDose">
            <div class="h3 mb-1">{{ fmtDate(lastDose.t.slice(0, 10)) }}</div>
            <div class="small text-secondary">{{ lastDose.name }}</div>
          </template>
          <div v-else class="h3 mb-1 text-secondary">None</div>
        </div></div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm h-100"><div class="card-body">
          <div class="subheader">Highest temperature</div>
          <template v-if="highest">
            <div class="h3 mb-1 num">{{ fmtTemp(highest.tempC) }}</div>
            <div class="small text-secondary">{{ temps.length }} reading{{ temps.length === 1 ? '' : 's' }}, {{ feverCount }} at fever level</div>
          </template>
          <div v-else class="h3 mb-1 text-secondary">None logged</div>
        </div></div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm h-100"><div class="card-body">
          <div class="subheader">Vaccine visits</div>
          <div class="h2 mb-1 num">{{ vaccines.length }}</div>
          <div class="small text-secondary">{{ codeCount }} vaccine{{ codeCount === 1 ? '' : 's' }} recorded</div>
        </div></div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header">
        <h3 class="card-title">Medicine &amp; temperature</h3>
        <div class="card-actions" v-if="medicines.length > 1">
          <select class="form-select form-select-sm" v-model="viewState.healthMedicine" aria-label="Filter by medicine">
            <option value="">All entries</option>
            <option v-for="m in medicines" :key="m.key" :value="m.key">{{ m.label }} ({{ m.count }})</option>
          </select>
        </div>
      </div>
      <div v-if="!doses.length" class="card-body text-secondary">No Medical entries in this export.</div>
      <div v-else class="table-responsive">
        <table class="table table-vcenter card-table table-sm">
          <thead>
            <tr>
              <th>Date &amp; time</th><th>Age</th><th>Medicine</th><th class="text-end">Dose</th>
              <th class="text-end">Temperature</th><th class="text-end">Since last dose</th><th>Note</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in shown" :key="r.t + i">
              <td class="num text-nowrap">{{ dateTime(r.t) }}</td>
              <td class="text-nowrap">{{ fmtAge(r.ageDays) }}</td>
              <td>{{ r.name || '–' }}</td>
              <td class="text-end num text-nowrap">{{ doseText(r) }}</td>
              <td class="text-end num text-nowrap">
                <template v-if="r.tempC != null">
                  {{ fmtTemp(r.tempC) }}
                  <span v-if="isFever(r.tempC)" class="badge bg-red-lt ms-1">fever ≥ 100.4 °F</span>
                </template>
                <template v-else>–</template>
              </td>
              <td class="text-end num text-nowrap text-secondary">{{ r.sincePrevMs == null ? '–' : fmtDur(r.sincePrevMs) }}</td>
              <td class="text-secondary note">{{ r.note || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="doses.length" class="card-footer small text-secondary">
        “Since last dose” is the time since the previous logged dose of the same medicine (shown up to 72 h), using real elapsed time across time zones.
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header"><h3 class="card-title">Vaccines</h3></div>
      <div v-if="!vaccines.length" class="card-body text-secondary">No Vaccine entries in this export.</div>
      <div v-else class="table-responsive">
        <table class="table table-vcenter card-table table-sm">
          <thead><tr><th>Date</th><th>Age</th><th>Vaccines</th><th>Note</th></tr></thead>
          <tbody>
            <tr v-for="(v, i) in vaccinesNewest" :key="v.date + i">
              <td class="num text-nowrap">{{ fmtDate(v.date) }}</td>
              <td class="text-nowrap">{{ fmtAge(v.ageDays) }}</td>
              <td>
                <span v-for="c in v.codes" :key="c" class="badge bg-blue-lt me-1 mb-1" :title="VACCINE_NAMES[c] || null">
                  {{ c }}<span v-if="VACCINE_NAMES[c]" class="visually-hidden"> ({{ VACCINE_NAMES[c] }})</span>
                </span>
              </td>
              <td class="text-secondary note">{{ v.note || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="small text-secondary">A record of what was logged in NaraBaby, not medical advice. Ask your pediatrician about doses and fevers.</p>
  </div>
</template>

<style scoped>
.note { white-space: pre-line; }
</style>
