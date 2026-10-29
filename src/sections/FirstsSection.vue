<script setup>
// Baby Firsts as a month-by-month timeline. The export drops photos, so they can be re-added here;
// they're kept in this browser's IndexedDB only (see lib/photos.js).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fmtAge, fmtDate, localDate } from "../lib/format.js";
import { addPhoto, getPhoto, loadThumbs, removePhoto, thumbUrls } from "../lib/photos.js";
import { viewState } from "../lib/viewState.js";

const props = defineProps({ data: { type: Object, required: true } });
const firsts = props.data.firsts;
const ids = new Set(firsts.map((f) => f.id));
const years = [...new Set(firsts.map((f) => f.date.slice(0, 4)))];
const hadPhotoCount = firsts.filter((f) => f.hadPhoto).length;

onMounted(loadThumbs);

const shown = computed(() => {
  const q = viewState.firstsSearch.trim().toLowerCase();
  return firsts.filter((f) =>
    (!viewState.firstsYear || f.date.startsWith(viewState.firstsYear)) &&
    (!viewState.firstsHadPhoto || f.hadPhoto) &&
    (!q || f.title.toLowerCase().includes(q) || (f.note && f.note.toLowerCase().includes(q))));
});

// Newest month first, entries oldest-to-newest within a month (reads like a diary page)
const months = computed(() => {
  const groups = new Map();
  for (const f of shown.value) {
    const key = f.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups.entries()].reverse().map(([key, items]) => ({
    key, items,
    label: localDate(key + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  }));
});

const addedCount = computed(() => firsts.filter((f) => thumbUrls.has(f.id)).length);
// Photos whose entry isn't in this export (deleted in the app, or from another child's export)
const orphans = computed(() => [...thumbUrls.keys()].filter((id) => !ids.has(id)));

// ----- adding, replacing and removing photos -----
const fileInput = ref(null);
const busy = ref(null);   // entry id being saved
const error = ref(null);  // { id, message }
let target = null;

function pick(id) {
  target = id;
  fileInput.value.value = "";
  fileInput.value.click();
}
async function attach(id, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { error.value = { id, message: "That file isn't an image." }; return; }
  busy.value = id; error.value = null;
  try {
    await addPhoto(id, file);
  } catch (e) {
    error.value = { id, message: e.message || "Couldn't save the photo." };
  } finally {
    busy.value = null;
  }
}
const onPicked = (e) => attach(target, e.target.files[0]);

const dragOver = ref(null);
function onDrop(id, e) {
  dragOver.value = null;
  attach(id, e.dataTransfer.files[0]);
}

async function remove(id) {
  await removePhoto(id);
  if (lightbox.value && lightbox.value.id === id) closeLightbox();
}
const removeOrphans = () => Promise.all(orphans.value.map(removePhoto));

// ----- lightbox -----
const lightbox = ref(null); // { id, title, url }
const closeButton = ref(null);
let opener = null;
async function openLightbox(f, e) {
  opener = e.currentTarget;
  const record = await getPhoto(f.id);
  if (!record) return;
  lightbox.value = { id: f.id, title: f.title, date: f.date, url: URL.createObjectURL(record.full) };
  await nextTick();
  closeButton.value.focus();
}
function closeLightbox() {
  if (!lightbox.value) return;
  URL.revokeObjectURL(lightbox.value.url);
  lightbox.value = null;
  opener && opener.focus();
}
const onKeydown = (e) => { if (e.key === "Escape") closeLightbox(); };
onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => { document.removeEventListener("keydown", onKeydown); lightbox.value && URL.revokeObjectURL(lightbox.value.url); });
watch(shown, () => { error.value = null; });
</script>

<template>
  <div>
    <div v-if="!firsts.length" class="empty">
      <p class="empty-title">No Baby Firsts in this export</p>
      <p class="empty-subtitle text-secondary">Milestones logged as Baby Firsts in NaraBaby will appear here.</p>
    </div>

    <template v-else>
      <div class="alert alert-info mb-3" role="note">
        <div>
          NaraBaby's export leaves out photos, so {{ hadPhotoCount }} of these entries lost theirs.
          You can attach them here. <strong>Photos are saved in this browser's storage only</strong>, never uploaded,
          so clearing site data, switching browsers or attaching a new export loses them. Keep the originals.
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2 align-items-center">
          <input class="form-control form-control-sm w-auto flex-grow-1" type="search" placeholder="Search titles and notes"
                 v-model="viewState.firstsSearch" aria-label="Search Baby Firsts" />
          <select class="form-select form-select-sm w-auto" v-model="viewState.firstsYear" aria-label="Year">
            <option value="">All years</option>
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
          <label class="form-check form-check-inline mb-0 small">
            <input class="form-check-input" type="checkbox" v-model="viewState.firstsHadPhoto" />
            <span class="form-check-label">Had a photo in NaraBaby</span>
          </label>
          <span class="ms-auto small text-secondary" aria-live="polite">
            {{ shown.length }} of {{ firsts.length }} · {{ addedCount }} photo{{ addedCount === 1 ? '' : 's' }} added
          </span>
        </div>
        <div v-if="orphans.length" class="card-footer small d-flex gap-2 align-items-center">
          <span class="text-secondary">
            {{ orphans.length }} added photo{{ orphans.length === 1 ? ' belongs' : 's belong' }} to entries that aren't in this export.
          </span>
          <button type="button" class="btn btn-sm btn-ghost-danger ms-auto" @click="removeOrphans">Remove them</button>
        </div>
      </div>

      <p v-if="!shown.length" class="text-secondary">No entries match.</p>

      <section v-for="m in months" :key="m.key" class="mb-4" :aria-labelledby="'m-' + m.key">
        <h3 :id="'m-' + m.key" class="h4 mb-2">{{ m.label }}</h3>
        <div class="row row-cards">
          <div v-for="f in m.items" :key="f.id" class="col-md-6 col-xl-4">
            <article class="card first-card" :class="{ 'drop-target': dragOver === f.id }"
                     @dragover.prevent="dragOver = f.id" @dragleave="dragOver = null" @drop.prevent="onDrop(f.id, $event)">
              <button v-if="thumbUrls.has(f.id)" type="button" class="thumb-btn" @click="openLightbox(f, $event)"
                      :aria-label="`View photo: ${f.title}`">
                <img :src="thumbUrls.get(f.id)" alt="" loading="lazy" class="card-img-top thumb" />
              </button>
              <div class="card-body">
                <div class="small text-secondary mb-1">
                  <time :datetime="f.date">{{ fmtDate(f.date) }}</time> · {{ fmtAge(f.ageDays) }}
                </div>
                <h4 class="card-title mb-1 first-title">{{ f.title || 'Untitled' }}</h4>
                <p v-if="f.note" class="mb-0 text-secondary note">{{ f.note }}</p>
              </div>
              <div class="card-footer small d-flex flex-wrap gap-2 align-items-center">
                <template v-if="thumbUrls.has(f.id)">
                  <button type="button" class="btn btn-sm" :disabled="busy === f.id" @click="pick(f.id)"
                          :aria-label="`Replace photo: ${f.title}`">Replace</button>
                  <button type="button" class="btn btn-sm btn-ghost-danger" @click="remove(f.id)"
                          :aria-label="`Remove photo: ${f.title}`">Remove</button>
                </template>
                <template v-else>
                  <span v-if="f.hadPhoto" class="text-secondary">Photo in NaraBaby (not exported)</span>
                  <button type="button" class="btn btn-sm ms-auto" :disabled="busy === f.id" @click="pick(f.id)"
                          :aria-label="`Add photo: ${f.title}`">{{ busy === f.id ? 'Saving…' : 'Add photo' }}</button>
                </template>
                <span v-if="error && error.id === f.id" class="text-danger w-100" role="alert">{{ error.message }}</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="onPicked" />
    </template>

    <template v-if="lightbox">
      <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="lightbox-title"
           @click.self="closeLightbox">
        <div class="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="lightbox-title" class="modal-title">{{ lightbox.title }} <span class="text-secondary fw-normal">· {{ fmtDate(lightbox.date) }}</span></h3>
              <button ref="closeButton" type="button" class="btn-close" aria-label="Close" @click="closeLightbox"></button>
            </div>
            <div class="modal-body text-center p-2">
              <img :src="lightbox.url" :alt="lightbox.title" class="lightbox-img" />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </template>
  </div>
</template>

<style scoped>
.note { white-space: pre-line; }
.first-title { overflow-wrap: anywhere; }
.thumb-btn { padding: 0; border: 0; background: none; display: block; width: 100%; cursor: zoom-in; }
.thumb { aspect-ratio: 4 / 3; object-fit: cover; width: 100%; }
.first-card.drop-target { outline: 2px dashed var(--tblr-primary); outline-offset: -2px; }
.lightbox-img { max-width: 100%; max-height: 80vh; }
</style>
