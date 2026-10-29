<script setup>
// Thin wrapper: renders once from `options`; parents re-key it to rebuild (e.g. on theme change).
// A skeleton holds the chart's space until it has drawn. Renders go through a shared queue
// (lib/renderQueue.js) so the skeleton paints first and charts appear one after another.
// `lazy` defers rendering until the chart is near the viewport, keeping the first paint fast.
import ApexCharts from "apexcharts";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { enqueueRender } from "../lib/renderQueue.js";
import ChartSkeleton from "./ChartSkeleton.vue";

// ApexCharts 3.x looks itself up on window for brush/linked charts (getChartByID)
window.ApexCharts = ApexCharts;

const props = defineProps({
  options: { type: Object, required: true },
  lazy: { type: Boolean, default: false },
});
const height = (props.options.chart && props.options.chart.height) || 0;
const APEX_EXTRA_PX = 15; // ApexCharts adds this much below the SVG; reserved so nothing shifts
const el = ref(null);
const ready = ref(false);
let chart, observer, cancel, unmounted = false;

function queueRender() {
  cancel = enqueueRender(async () => {
    if (unmounted) return;
    chart = new ApexCharts(el.value, props.options);
    await chart.render();
    if (!unmounted) ready.value = true;
  });
}

onMounted(() => {
  if (!props.lazy) return queueRender();
  observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    queueRender();
  }, { rootMargin: "300px 0px" });
  observer.observe(el.value);
});
onBeforeUnmount(() => {
  unmounted = true;
  cancel && cancel();
  observer && observer.disconnect();
  if (chart) {
    // ApexCharts 3 redraws 150 ms after a window resize and destroy() doesn't cancel that,
    // so resizing then switching section logged NaN-size SVG errors from the dead chart
    clearTimeout(chart.w.globals.resizeTimer);
    chart.destroy();
  }
});
</script>

<template>
  <!-- Reserve the chart's height so nothing shifts when it appears -->
  <div class="position-relative" :style="{ minHeight: height + APEX_EXTRA_PX + 'px' }" :aria-busy="!ready">
    <div ref="el"></div>
    <Transition name="skeleton-fade">
      <ChartSkeleton v-if="!ready" :height="height" class="position-absolute top-0 start-0 w-100" />
    </Transition>
  </div>
</template>
