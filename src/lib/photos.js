// Photos added to Baby Firsts. NaraBaby's export drops photos, so people re-attach them here.
// Stored in IndexedDB (localStorage is far too small), keyed by the entry's NaraBaby activity key,
// so they re-link to the same entries after importing a newer export. Never uploaded.
import { reactive } from "vue";

const DB_NAME = "nara-photos";
const STORE = "photos";
const FULL_PX = 1600;
const THUMB_PX = 400;

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Longest side at most `maxPx`, re-encoded as JPEG (EXIF orientation applied by createImageBitmap)
async function downscale(file, maxPx, quality) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    throw new Error("This browser can't read that image. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function savePhoto(id, file) {
  const [full, thumb] = await Promise.all([downscale(file, FULL_PX, 0.85), downscale(file, THUMB_PX, 0.8)]);
  const record = { id, full, thumb, addedAt: new Date().toISOString() };
  await run("readwrite", (s) => s.put(record));
  return record;
}

// All stored photos as { id, thumb, full } (Blobs are lazy handles, so this stays cheap)
export const listPhotos = () => run("readonly", (s) => s.getAll());
export const deletePhoto = (id) => run("readwrite", (s) => s.delete(id));
export const countPhotos = () => run("readonly", (s) => s.count());
export const clearPhotos = () => run("readwrite", (s) => s.clear());
export const getPhoto = (id) => run("readonly", (s) => s.get(id));

// Shared thumbnail URLs (entry id → object URL), loaded once and kept in step with saves/deletes,
// so the Firsts section and the Overview card show the same photos without re-reading IndexedDB.
export const thumbUrls = reactive(new Map());
let loading;
export function loadThumbs() {
  loading ??= listPhotos()
    .then((all) => { for (const p of all) thumbUrls.set(p.id, URL.createObjectURL(p.thumb)); })
    .catch(() => {}); // IndexedDB unavailable (e.g. some private windows): no photos, nothing breaks
  return loading;
}
export async function addPhoto(id, file) {
  const record = await savePhoto(id, file);
  if (thumbUrls.has(id)) URL.revokeObjectURL(thumbUrls.get(id));
  thumbUrls.set(id, URL.createObjectURL(record.thumb));
}
export async function removePhoto(id) {
  await deletePhoto(id);
  if (thumbUrls.has(id)) URL.revokeObjectURL(thumbUrls.get(id));
  thumbUrls.delete(id);
}
