// Light/dark theme (Tabler's data-bs-theme) and the shared ApexCharts chrome that follows it.
import { ref } from "vue";

function initialTheme() {
  try {
    const saved = localStorage.getItem("nara-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) { /* storage unavailable */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const theme = ref(initialTheme());
document.documentElement.setAttribute("data-bs-theme", theme.value);

export function toggleTheme() {
  const next = theme.value === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-bs-theme", next);
  try { localStorage.setItem("nara-theme", next); } catch (e) { /* ignore */ }
  theme.value = next;
}

// Reads a CSS token for the current theme
export const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Shared ApexCharts options; call inside computed() so charts rebuild on theme change
export function chartBase(extra) {
  theme.value; // reactive dependency
  return {
    chart: {
      fontFamily: "inherit", foreColor: tok("--chart-text"), background: "transparent",
      toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false },
      ...extra.chart,
    },
    theme: { mode: theme.value },
    grid: { borderColor: tok("--chart-grid"), strokeDashArray: 0, padding: { left: 8, right: 16 } },
    dataLabels: { enabled: false },
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "chart")),
  };
}
