<script setup>
import WeekHistory from "../components/WeekHistory.vue";
import { isoDay, localDate } from "../lib/format.js";
import { replaceQuery, route } from "../lib/route.js";
import { viewState } from "../lib/viewState.js";

const props = defineProps({ data: { type: Object, required: true } });

// Week from the URL (#/history?week=YYYY-MM-DD), else the last one viewed
const fromUrl = route.value.query.week;
const initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(fromUrl || "") ? localDate(fromUrl) : viewState.historyWeek;

function onWeek(week) {
  viewState.historyWeek = week;
  if (route.value.name === "history") replaceQuery({ week: isoDay(week) });
}
</script>

<template>
  <div class="card">
    <div class="card-body">
      <WeekHistory :data="data" :week="initialWeek" @update:week="onWeek" />
    </div>
  </div>
</template>
