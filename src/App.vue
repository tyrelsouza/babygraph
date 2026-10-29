<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { localDate } from "./lib/format.js";
import { replaceRoute, route, sectionHref } from "./lib/route.js";
import { clearPhotos, countPhotos } from "./lib/photos.js";
import { clearImport } from "./lib/storage.js";
import { theme, toggleTheme } from "./lib/theme.js";
import { DEFAULT_SECTION, SECTIONS } from "./sections/index.js";

// Parsed export from localStorage (see main.js); large and read-only, so not made reactive
const props = defineProps({ data: { type: Object, required: true } });
const data = props.data;

const initials = data.name.split(" ").map((w) => w[0]).join("");
const ageToday = (() => {
  const b = localDate(data.birthDate), now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  const y = Math.floor(months / 12), mo = months % 12;
  return y ? `${y} year${y > 1 ? "s" : ""}, ${mo} month${mo === 1 ? "" : "s"}` : `${mo} months`;
})();

// ----- sections: only the active one is mounted -----
if (!SECTIONS.some((s) => s.name === route.value.name)) replaceRoute(DEFAULT_SECTION);
const section = computed(() => SECTIONS.find((s) => s.name === route.value.name) || SECTIONS[0]);
const menuOpen = ref(false); // phone-width sidebar
const heading = ref(null);

watch(() => section.value.name, async (name, prev) => {
  if (!SECTIONS.some((s) => s.name === route.value.name)) replaceRoute(DEFAULT_SECTION);
  document.title = `${section.value.title} · Babygraph`;
  menuOpen.value = false;
  if (prev === undefined) return;
  window.scrollTo(0, 0);
  await nextTick();
  heading.value && heading.value.focus({ preventScroll: true }); // announce the new section
}, { immediate: true });

// ----- "Attach new export": confirm, then clear the stored export and go back to the landing page -----
// Attached photos are removed by default, so nobody's left thinking they're kept somewhere. Unchecking keeps
// them, and they re-link to the same Baby Firsts in a newer export.
const confirmOpen = ref(false);
const cancelButton = ref(null);
const photoCount = ref(0);
const alsoPhotos = ref(true);
watch(confirmOpen, async (open) => {
  if (!open) return;
  alsoPhotos.value = true;
  countPhotos().then((n) => { photoCount.value = n; }, () => { photoCount.value = 0; });
  await nextTick();
  cancelButton.value.focus();
});
async function startOver() {
  clearImport();
  if (alsoPhotos.value) await clearPhotos().catch(() => {});
  window.location.assign("./index.html?cleared");
}
const onKeydown = (e) => { if (e.key === "Escape") confirmOpen.value = false; };
onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="page">
    <aside class="navbar navbar-vertical navbar-expand-lg" aria-label="Sections">
      <div class="container-fluid">
        <button class="navbar-toggler" type="button" aria-controls="sidebar-menu" :aria-expanded="menuOpen"
                aria-label="Toggle navigation" @click="menuOpen = !menuOpen">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="navbar-brand d-flex align-items-center gap-2 py-lg-3">
          <span class="avatar avatar-sm bg-primary-lt">{{ initials }}</span>
          <span class="text-start lh-sm">
            <span class="d-block">{{ data.name }}</span>
            <span class="d-block small fw-normal text-secondary">{{ ageToday }}</span>
          </span>
        </div>
        <div id="sidebar-menu" class="collapse navbar-collapse" :class="{ show: menuOpen }">
          <ul class="navbar-nav pt-lg-2">
            <template v-for="(s, i) in SECTIONS" :key="s.name">
              <li v-if="s.group && s.group !== (SECTIONS[i - 1] || {}).group" class="nav-item">
                <div class="nav-group-heading">{{ s.group }}</div>
              </li>
              <li class="nav-item" :class="{ active: s.name === section.name }">
                <a class="nav-link" :href="sectionHref(s.name)" :aria-current="s.name === section.name ? 'page' : null"
                   @click="menuOpen = false">
                  <span class="nav-link-icon d-md-none d-lg-inline-block">
                    <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="s.icon"></svg>
                  </span>
                  <span class="nav-link-title">{{ s.title }}</span>
                </a>
              </li>
            </template>
          </ul>
          <div class="mt-lg-auto d-flex flex-column gap-2 px-lg-3 py-3">
            <div class="local-note small text-secondary d-flex gap-2 align-items-start">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="flex-shrink-0 mt-1">
                <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" />
              </svg>
              <span>Your data only lives in this browser. Nothing is uploaded, and there's no analytics. <a href="./privacy.html">Privacy</a></span>
            </div>
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="confirmOpen = true">Attach new export</button>
            <button class="btn btn-ghost-secondary btn-sm" type="button" @click="toggleTheme"
                    :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
              {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <div class="page-wrapper">
      <div class="page-header d-print-none">
        <div class="container-xl">
          <div class="page-pretitle">NaraBaby export · {{ data.exportedFrom }}</div>
          <h2 ref="heading" class="page-title" tabindex="-1">{{ section.title }}</h2>
        </div>
      </div>

      <div class="page-body">
        <div class="container-xl">
          <component :is="section.component" :key="section.name" :data="data" />

          <footer class="text-secondary small py-4">
            Growth reference: WHO Child Growth Standards (2006), LMS method; restricted z‑scores for weight and BMI beyond ±3 SD.
            Counts reflect what was logged in the app, not necessarily every event.
            <a href="./privacy.html">Privacy policy</a>
          </footer>
        </div>
      </div>
    </div>

    <template v-if="confirmOpen">
      <div class="modal modal-blur d-block" tabindex="-1" role="dialog" aria-modal="true"
           aria-labelledby="new-export-title" aria-describedby="new-export-body" @click.self="confirmOpen = false">
        <div class="modal-dialog modal-sm modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-status bg-danger"></div>
            <div class="modal-body text-center py-4">
              <h3 id="new-export-title">Attach a new export?</h3>
              <div id="new-export-body" class="text-secondary">
                Your export is only in this browser's local storage, never uploaded, so clearing it here means it's gone.
                You'll need to attach a NaraBaby export again to see the dashboard.
              </div>
              <label v-if="photoCount" class="form-check text-start mt-3 mb-0">
                <input class="form-check-input" type="checkbox" v-model="alsoPhotos" />
                <span class="form-check-label">Also remove the {{ photoCount }} photo{{ photoCount === 1 ? '' : 's' }} you attached</span>
                <span class="form-hint">Photos are only in this browser too. Uncheck to keep them for your next export.</span>
              </label>
            </div>
            <div class="modal-footer">
              <div class="w-100">
                <div class="row">
                  <div class="col"><button ref="cancelButton" type="button" class="btn w-100" @click="confirmOpen = false">Cancel</button></div>
                  <div class="col"><button type="button" class="btn btn-danger w-100" @click="startOver">Clear</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </template>
  </div>
</template>

<style scoped>
.page-title:focus { outline: none; }
.local-note { line-height: 1.4; }
.nav-group-heading {
  padding: 1rem var(--tblr-navbar-nav-link-padding-x, .75rem) .25rem;
  font-size: .625rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--tblr-secondary);
}
</style>
