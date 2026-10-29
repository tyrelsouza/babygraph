// Tiny hash router: "#/<section>?<query>". No dependency, and the hash never reaches the server
// (so deep links work on static hosts like GitHub Pages).
import { ref } from "vue";

function parse() {
  const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  return { name: path, query: Object.fromEntries(new URLSearchParams(query)) };
}

export const route = ref(parse());
window.addEventListener("hashchange", () => { route.value = parse(); });

const toHash = (name, query) => {
  const qs = new URLSearchParams(query || {}).toString();
  return `#/${name}${qs ? "?" + qs : ""}`;
};

// Update the current section's query without adding a history entry (e.g. the History week)
export function replaceQuery(query) {
  window.history.replaceState(null, "", toHash(route.value.name, query));
  route.value = parse();
}

export const sectionHref = (name, query) => toHash(name, query);

// Normalise to a known section without adding a history entry (e.g. empty or unknown hash)
export function replaceRoute(name) {
  window.history.replaceState(null, "", toHash(name));
  route.value = parse();
}
