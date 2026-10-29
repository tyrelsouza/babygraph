<script setup>
// Placeholder for a chart that hasn't drawn yet: faint gridlines with a slow shimmer.
defineProps({ height: { type: Number, required: true } });
</script>

<template>
  <div class="chart-skeleton" :style="{ height: height + 'px' }" aria-hidden="true"></div>
</template>
