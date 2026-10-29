<script setup>
// Shown while the Feeding chunk (with ApexCharts) downloads. Same cards and chart heights as
// FeedingSection, whose own chart skeletons then take over, so nothing jumps.
import ChartSkeleton from "../components/ChartSkeleton.vue";

const cards = [
  { col: "col-12", charts: [320, 110] },
  { col: "col-md-6", charts: [240] },
  { col: "col-md-6", charts: [240] },
  { col: "col-12", charts: [360], legend: true },
];
</script>

<template>
  <div class="row row-cards mb-4" role="status" aria-label="Loading feeding charts">
    <div v-for="(c, i) in cards" :key="i" :class="c.col">
      <div class="card">
        <div class="card-header">
          <div class="w-100">
            <span class="skeleton-line mb-2" style="width: 10rem; height: 1rem"></span>
            <span class="skeleton-line" style="width: min(24rem, 80%); height: 1.25rem"></span>
          </div>
        </div>
        <div class="card-body">
          <span v-if="c.legend" class="skeleton-line mb-2" style="width: 8rem"></span>
          <!-- ApexChart slots are 15px taller than the chart (see ApexChart.vue); the canvas isn't -->
          <ChartSkeleton v-for="(h, j) in c.charts" :key="j" :height="h" :style="{ marginBottom: c.legend ? 0 : '15px' }" />
        </div>
      </div>
    </div>
  </div>
</template>
