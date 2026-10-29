// Where the source lives, and which commit this copy was built from (set by vite.config.js).
export const REPO_URL = "https://github.com/tyrelsouza/babygraph";

/* global __BUILD__ */
export const BUILD = __BUILD__; // { commit: "40-hex" | null, dirty: boolean }
export const commitUrl = (sha) => `${REPO_URL}/commit/${sha}`;
