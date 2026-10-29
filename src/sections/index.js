// Sidebar sections, in order. Each loads on demand, so ApexCharts and the WHO tables
// only download when a section that needs them is first opened.
import { defineAsyncComponent } from "vue";
import SectionLoading from "../components/SectionLoading.vue";
import FeedingSkeleton from "./FeedingSkeleton.vue";

// `loading` can be a section-shaped skeleton so the layout is in place before the code arrives
const lazy = (loader, loading = SectionLoading) => defineAsyncComponent({ loader, loadingComponent: loading, delay: 150 });

// Icon paths from Tabler Icons (MIT), drawn with stroke="currentColor"
export const SECTIONS = [
  {
    name: "overview", title: "Overview", blurb: "Totals and the latest growth percentiles",
    icon: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
    component: lazy(() => import("./OverviewSection.vue")),
  },
  {
    name: "history", title: "History", blurb: "Sleep, feeds and diapers, one week at a time",
    icon: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/>',
    component: lazy(() => import("./HistorySection.vue")),
  },
  {
    name: "feeding", title: "Feeding", blurb: "Feeds per day, bottle milk, nursing and time of day",
    icon: '<path d="M8 6h8v-2a1 1 0 0 0 -1 -1h-6a1 1 0 0 0 -1 1v2z"/><path d="M16 6l1.094 1.759a6 6 0 0 1 .906 3.17v8.071a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8.071a6 6 0 0 1 .906 -3.17l1.094 -1.759"/><path d="M8 11h8"/>',
    component: lazy(() => import("./FeedingSection.vue"), FeedingSkeleton),
  },
  {
    name: "growth", title: "Growth", blurb: "Weight, length, head and BMI against WHO curves",
    icon: '<path d="M4 19l16 0"/><path d="M4 15l4 -6l4 2l4 -5l4 4"/>',
    component: lazy(() => import("./GrowthSection.vue")),
  },
  {
    name: "measurements", title: "Measurements", blurb: "Every measurement with its z-score and percentile",
    icon: '<path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z"/><path d="M3 10h18"/><path d="M10 3v18"/>',
    component: lazy(() => import("./MeasurementsSection.vue")),
  },
  {
    name: "firsts", title: "Firsts", group: "Events", blurb: "Milestones by month, with photos you add back",
    icon: '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
    component: lazy(() => import("./FirstsSection.vue")),
  },
  {
    name: "health", title: "Health", group: "Events", blurb: "Medicine, temperatures and vaccines",
    icon: '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/><path d="M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25"/>',
    component: lazy(() => import("./HealthSection.vue")),
  },
];

export const DEFAULT_SECTION = "overview";
