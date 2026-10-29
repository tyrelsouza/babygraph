import { createApp } from "vue";
import "@tabler/core/dist/css/tabler.min.css";
import "./styles.css";
import App from "./App.vue";
import { loadImport } from "./lib/storage.js";

const stored = loadImport();
if (stored) {
  createApp(App, { data: stored.data }).mount("#app");
} else {
  // Nothing imported in this browser yet
  window.location.replace("./index.html");
}
