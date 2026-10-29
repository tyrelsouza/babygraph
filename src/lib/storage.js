// The imported export lives only in this browser's localStorage.
const KEY = "nara-import";
const VERSION = 2; // bump when the stored data shape changes; older imports then ask for a re-upload
                  // v2: added `firsts` and `health`

export function saveImport(data, fileName) {
  const record = { version: VERSION, importedAt: new Date().toISOString(), fileName, data };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch (e) {
    throw new Error(e && e.name === "QuotaExceededError"
      ? "This export is too large to store in the browser."
      : "The browser blocked saving the data (private mode or storage disabled?).");
  }
}

// Returns the stored import, or null if missing, unreadable or from an older version
export function loadImport() {
  try {
    const record = JSON.parse(localStorage.getItem(KEY));
    return record && record.version === VERSION && record.data ? record : null;
  } catch (e) {
    return null;
  }
}

export function clearImport() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ }
}
