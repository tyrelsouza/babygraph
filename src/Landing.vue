<script setup>
import { ref } from "vue";
import { fmtDate } from "./lib/format.js";
import { ImportError, parseNaraExport } from "./lib/importer.js";
import { BUILD, commitUrl } from "./lib/site.js";
import { loadImport, saveImport } from "./lib/storage.js";
import { theme, toggleTheme } from "./lib/theme.js";

const stored = loadImport();
const cleared = new URLSearchParams(window.location.search).has("cleared");
const fileInput = ref(null);
const dragDepth = ref(0); // counts nested dragenter/dragleave so the highlight doesn't flicker
const busy = ref(false);
const error = ref("");

async function handleFile(file) {
  error.value = "";
  if (!file) return;
  if (!/\.csv$/i.test(file.name)) {
    error.value = "Please choose the .csv file exported from NaraBaby.";
    return;
  }
  busy.value = true;
  try {
    const data = parseNaraExport(await file.text(), file.name);
    saveImport(data, file.name);
    window.location.assign("./dashboard.html");
  } catch (e) {
    error.value = e instanceof ImportError ? e.message : e.message || "Something went wrong reading that file.";
    busy.value = false;
  }
}

function onDrop(e) {
  dragDepth.value = 0;
  handleFile(e.dataTransfer.files[0]);
}
function onPick(e) {
  handleFile(e.target.files[0]);
  e.target.value = ""; // allow picking the same file again after an error
}
const openPicker = () => !busy.value && fileInput.value.click();
</script>

<template>
  <div class="page page-center">
    <div class="position-absolute top-0 end-0 p-3">
      <button class="btn btn-ghost-secondary btn-sm" type="button" @click="toggleTheme"
              :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
        {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
      </button>
    </div>

    <div class="container container-tight py-4">
      <div class="text-center mb-4">
        <h1 class="h2 mb-1">Babygraph</h1>
        <div class="text-secondary">Charts and timelines from your NaraBaby export</div>
      </div>

      <div v-if="cleared" class="alert alert-info" role="status">
        The previous export was removed from this browser. Upload an export to see the dashboard again.
      </div>

      <div class="card card-md">
        <div class="card-body">
          <h2 class="h3 mb-3">Load your NaraBaby export</h2>
          <div
            class="dropzone"
            :class="{ 'is-dragging': dragDepth > 0, 'is-busy': busy }"
            role="button" tabindex="0"
            aria-describedby="drop-help"
            @click="openPicker"
            @keydown.enter.prevent="openPicker" @keydown.space.prevent="openPicker"
            @dragenter.prevent="dragDepth++" @dragleave.prevent="dragDepth--"
            @dragover.prevent @drop.prevent="onDrop"
          >
            <svg class="dropzone-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" />
            </svg>
            <div class="fw-bold mt-2">{{ busy ? "Reading export…" : "Drop your NaraBaby export here" }}</div>
            <div id="drop-help" class="text-secondary small">or click to choose the <code>.csv</code> file</div>
          </div>
          <input ref="fileInput" type="file" accept=".csv,text/csv" class="d-none" @change="onPick">

          <div v-if="error" class="alert alert-danger mt-3 mb-0" role="alert">{{ error }}</div>

          <div class="local-only mt-3" role="note" aria-labelledby="local-title">
            <svg class="local-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" />
            </svg>
            <div>
              <div id="local-title" class="fw-bold">Everything stays on your device</div>
              <div class="small">
                Your export is read by your browser and saved in this browser's storage. It's never uploaded to my
                server or anyone else's. No accounts, no cookies, no analytics or tracking.
                <a href="./privacy.html">Privacy policy</a>
              </div>
              <div class="small text-secondary mt-1">
                You can check: open your browser's network tab while you upload. You'll only see the page's own
                files load, never your data going out.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="stored" class="card card-sm mt-3">
        <div class="card-body d-flex align-items-center gap-3">
          <div class="flex-fill">
            <div class="fw-bold">{{ stored.data.name }}</div>
            <div class="text-secondary small">{{ stored.fileName }} · imported {{ fmtDate(stored.importedAt.slice(0, 10)) }}</div>
          </div>
          <a class="btn btn-primary" href="./dashboard.html">Open dashboard</a>
        </div>
      </div>

      <section class="card mt-4" aria-labelledby="why-title">
        <div class="card-body">
          <h2 id="why-title" class="h4 mb-2">Why this exists</h2>
          <p class="mb-2">
            NaraBaby started charging, and without a subscription your account goes read-only. You can still
            export your data, but the CSV is messy and hard to read.
          </p>
          <p class="mb-0">
            This parses that export and shows everything you logged, instead of leaving it sitting in a backup.
          </p>
        </div>
        <div class="card-footer small text-secondary">
          Unofficial; not affiliated with NaraBaby. Free and open source (MIT).
          <a href="./privacy.html">Privacy</a> · <a href="./NOTICE.md">Notices</a> · <a href="./THIRD-PARTY-LICENSES.md">Licenses</a>
          <div v-if="BUILD.commit" class="mt-1" data-build>
            Built from commit
            <a :href="commitUrl(BUILD.commit)" :title="BUILD.commit"><code>{{ BUILD.commit.slice(0, 7) }}</code></a>
            <span v-if="BUILD.dirty"> + local changes</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  border: 2px dashed var(--tblr-border-color);
  border-radius: 8px;
  padding: 2.5rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: border-color .15s, background-color .15s;
}
.dropzone:hover, .dropzone:focus-visible, .dropzone.is-dragging {
  border-color: var(--tblr-primary);
  background: rgba(var(--tblr-primary-rgb), .06);
  outline: none;
}
.dropzone.is-busy { cursor: progress; opacity: .7; }
.dropzone-icon { color: var(--tblr-secondary); }
.local-only {
  display: flex; gap: .75rem; align-items: flex-start;
  padding: .875rem 1rem; border-radius: 8px;
  border: 1px solid rgba(var(--tblr-green-rgb), .35);
  background: rgba(var(--tblr-green-rgb), .08);
}
.local-icon { flex-shrink: 0; color: var(--tblr-green); margin-top: .1rem; }
</style>
