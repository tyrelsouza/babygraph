# PLAN: Babygraph

## Context

The input is a full NaraBaby export for one child (`export_narababy_<name>_<date>.csv`, female). The goal is a local dashboard built on **Tabler** that shows:
1. A timeline of every feeding, from birth until feeding logging stops (about 15 months in).
2. Below that, body-measurement charts plotted against the **WHO Child Growth Standards** (matched to the child's sex), with a percentile worked out for each measurement so you can see how she tracks.

The data is a one-time snapshot and rarely changes. So: **no backend**. The data is hardcoded as a JSON blob that the page's JS loads.

### What's in the CSV (10,273 rows, one wide row per event; the `Type` column decides which fields are filled)

| Type | Rows | Range | Useful fields |
|---|---|---|---|
| Breastfeed | 3,404 | day 1 → 12 months | Left/Right Duration (s), Begin/End Side |
| Bottle Feed | 1,669 | day 1 → 14 months | Breast Milk Volume (ML) on 1,649 rows; Volume (ML) on 14; 6 rows have neither |
| Pump | 878 | day 1 → 10 months | Duration, L/R/Total Volume (ML) |
| Sleep | 2,443 | 10 weeks → 17 months | Duration (s), End time |
| Diaper | 1,581 | day 3 → 9 months | Type (Wet / Dirty / Dirty Wet), color, texture |
| Growth | 70 | birth → export date | Weight (LB, plus 2 rows in KG), Height (IN), Head Size (CM and IN mixed) |
| Baby First / Medical / Vaccine / Routine | 194 / 26 / 3 / 4 | various | Note, Medication, Temperature, Vaccine name |
| Profile | 1 | — | Birth Date, Sex |

Gotchas:
- Units are mixed.
- Each growth row usually holds only one measurement; weight, height and head are logged as separate rows.
- Timestamps are local: mostly America/New_York, with 12 rows in America/Chicago. Use the local `Start Date/time` as-is, not the epoch.

## Approach

### Files

```
babygraph/
├── PLAN.md
├── export_narababy_<name>_<date>.csv   (input, untouched, never committed)
├── package.json / vite.config.js
├── index.html               # landing page entry (drop an export)
├── dashboard.html           # dashboard entry (reads the stored import)
├── fixtures/
│   ├── narababy_fake_girl_export.csv   # committed, fake
│   └── narababy_fake_boy_export.csv    # committed, fake
│   └── expected/*.json                 # reference parser output for the fake exports
├── tests/importer.test.js   # node --test: parser parity + error cases
└── src/
    ├── landing.js, Landing.vue        # landing page
    ├── main.js, App.vue, styles.css   # dashboard shell (sidebar, routing, New upload), colour tokens
    ├── data/who_lms.json              # WHO LMS tables {female, male}
    ├── lib/   importer.js (CSV parser) · storage.js (localStorage)
    │          route.js (hash router) · viewState.js (per-section state)
    │          format.js · who.js (LMS maths) · growth.js · events.js · theme.js
    ├── sections/                # one per sidebar item, each loaded on demand
    │   ├── index.js             # section list: name, title, icon, async component
    │   ├── OverviewSection.vue  # stat cards, latest growth, links (no charts)
    │   ├── HistorySection.vue   # week view; week synced to #/history?week=…
    │   ├── FeedingSection.vue   # feeds/day + zoom strip, milk, nursing, canvas scatter
    │   ├── GrowthSection.vue    # WHO charts, percentile tracking
    │   └── MeasurementsSection.vue
    └── components/
        ├── ApexChart.vue        # thin ApexCharts wrapper (optional lazy rendering)
        ├── FeedClock.vue        # canvas time-of-day scatter
        ├── StatCards.vue
        ├── WeekHistory.vue      # History week view (custom SVG)
        └── SectionLoading.vue
```

**Framework:** a Vite + Vue 3 project with single-file components. No React.
- **Pinned npm dependencies:** `vue` 3.5.44, `apexcharts` 3.54.1, `@tabler/core` 1.0.0, `papaparse` 5.5.3; dev tools `vite` 8.3.5 and `@vitejs/plugin-vue` 6.0.10.
- ApexCharts stays on 3.x on purpose: 8.x is five major versions newer and needs its own verification pass.
- **Commands:** `npm run dev` for development; `npm test` runs the parser tests; `npm run build` writes a static `dist/` (with `base: "./"`, so it works from any subfolder, e.g. GitHub Pages); `npm run preview` serves that build.
- **ApexCharts 3.x quirk**, handled in code: it looks itself up on `window`, so `ApexChart.vue` exposes it there.
- **Performance** with the real export (5,073 feeds), measured in headless Chromium:
  - **Zoom strip:** ApexCharts' built-in brush redraws every target chart on each mouse move, about 1 s per move. The strip now only reports its selection; the timeline charts and the canvas update once dragging pauses (150 ms debounce). A 20-step drag went from 22.8 s to about 1 s.
  - **Growth charts** render lazily, when within 300 px of the viewport (`<ApexChart lazy>`).
  - **Results:** load until charts appear went from 2.9 s to 1.2 s; the longest freeze from 2.2 s to 0.55 s; the theme toggle from 1.5 s to 0.7 s; page elements from 19k to 4k.
- **Child data never ships with the site.** Each visitor drops their own export on the landing page (see "Landing page and in-browser import" below).

### 1. `src/lib/importer.js`: CSV → dashboard data (in the browser)
Parsed with Papa Parse. It started as a port of the original Python build script, and `fixtures/expected/*.json` pin its output.
- Read the birth date and sex from the Profile row.
- **Normalize units:** LB→kg (×0.45359237; 2 rows are already KG), IN→cm (×2.54) for height and head size. Volumes are already in ML.
- **Feeds:** `{t, kind: "breast"|"bottle", sec, ml}`.
  - Bottle `ml` = Breast Milk Volume, falling back to Volume. The 6 bottle rows with no volume are kept as feeds with `ml: null`.
  - Breastfeed `sec` = left + right seconds.
- **Daily rollup** from birth to the last feed, with empty days filled as 0: bottle count, total ml, breastfeed count, total nursing minutes.
- **Growth:** the 70 rows as `{date, ageDays, weightKg?, lengthCm?, headCm?}`, with age counted from the birth date. Rows on the same date are merged, giving 65 dates.
- **Sleeps:** `[start, end]` (2,442 rows; the one in-progress row with no end is skipped).
- **Diapers:** `[time, type, detail]` (1,581 rows).
- The result is saved to `localStorage` (see below). A new export means dropping the new file; nothing else changes.

### 2. WHO reference data (`src/data/who_lms.json`)
- The WHO Child Growth Standards for **both girls and boys**, keyed `female` and `male` to match NaraBaby's `[Profile] Sex`. The dashboard picks the table from the child's sex.
- Each table holds with L/M/S values by day from 0 to 1826 days (0–5 years). The source is WHO's own `anthro` repository (`data-raw/growthstandards/*anthro.txt`), the same values as the who.int expanded tables. They were converted once (by a script since removed) into a JSON file that the app bundles.
- Indicators: weight-for-age, length/height-for-age, head-circumference-for-age, and BMI-for-age.
- Length (lying down, 0–24 months) and height (standing, 24 months and up) share one WHO table. The chart marks the switch at 24 months.

### 3. `src/lib/who.js` and `growth.js`: percentiles in the browser
- `z = ((X/M)^L − 1) / (L·S)`, or `ln(X/M)/S` when L = 0. Percentile = Φ(z) × 100, where Φ is the normal cumulative distribution, computed with an erf approximation.
- WHO's restricted z-score adjustment applies to weight and BMI when |z| > 3.
- BMI only on dates that have a weight and a length taken within ±14 days of each other.
- The 3rd/15th/50th/85th/97th reference curves are computed from the LMS values, sampled monthly up to just past her current age (about 44 months).

### 4. Dashboard UI (`src/App.vue`, `src/sections/`, `src/components/`)
Laid out as a sidebar with one section at a time (see "Sidebar layout"); the content of each section is described here.
ApexCharts is free (MIT) and is what Tabler's own demos use. Light and dark themes come from Tabler's `data-bs-theme`.
- **Header:** name, current age, birth date.
- **Row of stat cards:** feeds logged, feeding span (first → last feed), total bottle milk, total nursing time. Each growth card shows the latest value and percentile in its header.
- **History (week view, modelled on NaraBaby's History screen):**
  - One week at a time, Sunday to Saturday, picked with Prev/Next buttons or a date input that jumps to the week containing that date. Limited to the weeks that have data.
  - Opens on the first full week with sleep logged, so every event type shows.
  - Each day is one 24-hour column, midnight at the top, drawn as custom SVG in a Vue component:
    - sleep as full-width translucent blocks;
    - breastfeeds as inset blocks sized by duration;
    - bottles as inset blocks (they have no duration, so they get a minimum height);
    - diapers as dots on the right edge, hollow for wet and filled for dirty or wet + dirty.
  - Sleep that crosses midnight is split between the two days.
  - Hovering any mark shows its time, duration, ml or diaper type.
  - Below the columns, a table of daily totals: sleep time, breastfeeds, bottles and ml, diapers.
- **Feeding timeline:**
  1. Breast and bottle feeds per day as stacked columns, with a 7-day average line. A small chart underneath zooms this chart and the three below it together.
  2. Bottle ml per day and nursing minutes per day as **two separate charts**, side by side. Never one chart with two y-axes.
  3. A "24h" scatter: date across, time of day down, one dot per feed coloured by breast or bottle. This shows the night feeds dropping off. It's drawn on a `<canvas>` (`FeedClock.vue`) with its own hover tooltip, because as an ApexCharts scatter its 5,073 dots made 12,000 SVG elements.
- **Colours:** one fixed colour per event type across every chart. Breast blue, bottle orange, sleep aqua, diaper yellow. Weight, length, head and BMI each have their own colour too.
- **Growth (below):**
  - A 2×2 grid of WHO charts: weight-for-age, length/height-for-age, head circumference-for-age, and BMI-for-age.
    - Each draws the 3rd/15th/50th/85th/97th curves as light lines, with her measurements as a marked line.
    - Tooltips show the value in metric and imperial, her age, the z-score and the percentile.
  - A **percentile tracking** chart: each measurement's percentile (0–100) over age, all on one chart, so you can see whether she holds her centile.
  - A table of every measurement: date, age, value, z-score, percentile.

### 5. Test data (`fixtures/`)
Real child data is never committed: `.gitignore` excludes `export_narababy_*.csv`, along with `node_modules/` and `dist/`. The site holds no child data; it lives only in each visitor's browser.

The fake exports hold one month (2024-02-25 → 2024-03-26) of fake data for a **Test Girl** and a **Test Boy**:
- Same CSV columns and quoting as a real NaraBaby export, so the importer reads them unchanged.
- Fixed random seed per child, so the output only changes when the script does.
- Every event type, with roughly realistic newborn rhythms: about 9 feeds, 9 sleeps and 7–8 diapers a day, night sleeps lengthening, bottle volumes rising.
- Growth near the WHO median for each sex, including the newborn weight dip and regain.
- Edge cases from the real export:
  - mixed units (LB/KG, IN/CM);
  - a bottle with no volume, and bottles that use the generic Volume field;
  - pump sessions with only a total;
  - an in-progress sleep with no end;
  - sleeps across midnight;
  - a daylight-saving change (2024-03-10);
  - two days logged in America/Chicago;
  - a note with a comma, quotes and a newline.

To see the dashboard on fake data: run `npm run dev` and drop a fixture CSV on the landing page.

### 6. Later
- Pump sessions, plus medicine, temperature and vaccine events, as extra marks in the History view.
- Daily-trend charts for sleep and diapers, in the same style as the feeding timeline.
- (The milestones list is now its own planned phase: see "Baby's Firsts" below.)
- "Download added photos" as a zip backup, since added photos live only in the browser.

## Landing page and in-browser import (built)

**Goal:** anyone can drop their own NaraBaby export into the page and see their dashboard, with no Python and no personal data in the repo. The data stays in the visitor's browser.

| Page | Role |
|---|---|
| `index.html` | Landing page: drop zone (or click to pick a file) |
| `dashboard.html` | The dashboard; a second Vite entry (`build.rolldownOptions.input`) |

### Landing page (`src/Landing.vue`)
- **The drop zone:** drag and drop, or click / Enter / Space to open the file picker. It accepts `.csv`.
- **On a valid file:** parse in the browser, save to `localStorage`, redirect to `dashboard.html`.
- **Errors**, shown inline with no redirect:
  - not a `.csv` file;
  - not a NaraBaby export (names the missing columns);
  - no Profile row with a birth date;
  - no feeds;
  - storage full or blocked.
- If an import is already stored, a card shows the name, file and import date with an "Open dashboard" button.
- After a "New upload", the page shows a notice that the previous export was removed.
- Privacy note: the file is read on the device and saved to local storage; nothing is uploaded.

### Storage (`src/lib/storage.js`)
- One `localStorage` key, `nara-import`, holding `{ version: 1, importedAt, fileName, data }`.
- A missing, unreadable or wrong-`version` record counts as "nothing imported".
- Only the processed data is stored, never the raw CSV: 391 KB for the real 2.5 MB export.

### Dashboard (`src/main.js`, `src/App.vue`)
- With no stored import, `main.js` redirects to `index.html` before mounting.
- **"New upload" button** in the navbar. It opens a confirmation modal: *"This removes the loaded export from this browser. You'll need to upload a NaraBaby export again to see the dashboard."*
  - The modal is a small Vue modal using Tabler's modal styles, so Bootstrap's JS isn't needed.
  - Focus goes to Cancel; Escape or clicking the backdrop closes it.
  - "Clear and upload" removes `nara-import` and goes to `index.html?cleared`.

### Python removed from the site
- `scripts/build_data.py` is deleted. Before deleting it, its output for both fake fixtures was saved as `fixtures/expected/*.json`, and `npm test` requires the JS importer to match exactly.
- The JS output was also checked identical to the Python output on the real export, which isn't committed.
- Matching Python needed one detail: `round()` uses half-to-even on exact binary ties. `pyRound` in the importer reproduces it.
- **Python fully removed (2026-10-29).** `scripts/build_who.py` and `scripts/make_fake_export.py` are deleted too. Their output (`src/data/who_lms.json`, `fixtures/*.csv`) is committed and unchanged. Changing the fixtures now means editing the CSVs by hand or writing a Node generator.

### Hosting
Serve the site; don't open it from disk, because Firefox gives each `file://` page its own storage. Use `npm run dev` locally, and host `dist/` anywhere static, such as GitHub Pages.

## Sidebar layout, one section at a time (built)

**Goal:** a Tabler sidebar dashboard that shows **one section at a time** instead of one long page. Today every chart renders at once (about 4k elements, with the growth charts deferred). Splitting into sections means only the active section's charts exist, and navigating away destroys them. It also gives Firsts and Health a natural home as they arrive.

### Sections (sidebar order)
| Section | Route | Contents |
|---|---|---|
| Overview | `#/overview` (default) | The stat cards, latest growth percentiles as text, "Recent firsts", and a link to each section. No big charts; it's the cheap landing view. |
| History | `#/history` | The week view and its daily totals table |
| Feeding | `#/feeding` | Feeds per day with the zoom strip, bottle ml and nursing minutes, the canvas time-of-day scatter |
| Growth | `#/growth` | The four WHO charts and percentile tracking |
| Measurements | `#/measurements` | The "All measurements" table, moved out of Growth so it opens without drawing charts |
| *Events* (sidebar heading) | | |
| Firsts | `#/firsts` | The milestone timeline (see Baby's Firsts below) |
| Health | `#/health` | Medicine & temperature, Vaccines (see Health below) |

Firsts and Health sit under an "Events" heading in the sidebar (a `group` field on the section entry).

### Layout
- **Desktop:** Tabler's vertical navbar (`navbar-vertical navbar-expand-lg`).
  - The top of the sidebar has the child's avatar and name, and the age underneath.
  - Section links have icons and an active state (`aria-current="page"`).
  - The bottom has "New upload" and the theme toggle.
  - The content area shows a page header (section title, export file name) and the active section.
- **Phone:** the sidebar collapses into a top bar with a menu button. The open/close state is a Vue ref, so Bootstrap's JS isn't needed. Choosing a section closes the menu.
- The content keeps today's `container-xl` width and cards, so sections look as they do now.

### Routing and loading
- **A tiny hash router**, no dependency: `src/lib/route.js` is a `ref` synced with `location.hash` through `hashchange`.
  - Back/forward, refresh and deep links work, and it's fine on GitHub Pages because the hash never reaches the server.
  - An unknown route falls back to Overview.
- **Only the active section is mounted:** `<component :is>` with no `<KeepAlive>`, so leaving a section destroys its charts and frees their DOM and memory.
- **Section components load with `defineAsyncComponent(() => import(...))`**, so Vite code-splits them.
  - ApexCharts and the WHO tables (about 300 KB) download only when Feeding, Growth or Overview's percentiles are first opened.
  - Overview, History, Measurements, Health and Firsts don't pull in ApexCharts at all, except where Overview needs the WHO maths for the percentile text. That import is `who.js` plus the JSON, not ApexCharts.
- **View state survives navigation** without keeping the components alive, through small module-level stores in `src/lib/viewState.js`:
  - the History week, also in the URL as `#/history?week=YYYY-MM-DD` so it can be shared or bookmarked;
  - the Feeding zoom range;
  - the Measurements filter;
  - the Firsts search and year.
- **Scroll:** moving to a new section resets the content to the top; Back restores where you were if that's cheap, otherwise top.

### Files
- `src/App.vue` becomes the shell: sidebar, page header, `<component :is="currentSection">`, and the New upload modal.
- New `src/sections/`: `OverviewSection.vue`, `HistorySection.vue` (wraps `WeekHistory`), `FeedingSection.vue` (the former `FeedingTimeline`), `GrowthSection.vue` (charts only), `MeasurementsSection.vue` (the table split out of Growth), then `HealthSection.vue` and `FirstsSection.vue` when those phases land.
- **Cached derived data:** `buildGrowth()` and `buildEvents()` are cached per dataset (a `WeakMap`), so switching sections doesn't recompute them.
- `src/components/` keeps the reusable pieces: `ApexChart`, `FeedClock`, `WeekHistory`, `StatCards`.

### Verification
1. **Element count:** on each section, the DOM holds only that section's charts. Moving Feeding → History drops the ApexCharts and canvas elements. Long tasks are measured per section with the real export: target no single task over 300 ms on Overview and History.
2. **Code splitting:** the first load of `dashboard.html#/overview` fetches no ApexCharts chunk (check the Network tab and the build output's chunk list).
3. **Routing:** deep links (`#/growth`, `#/history?week=…`) open directly, and Back/Forward step through sections. Refresh stays put; an unknown hash shows Overview.
4. **State:** zoom Feeding, go to Growth and back, and the zoom is kept. Pick a History week, leave and return, and it's the same week.
5. **Phone width (375 px):** the menu opens and closes, choosing a section closes it, and nothing scrolls sideways.
6. **Accessibility:** the active link has `aria-current`, the menu button has `aria-expanded`, and focus moves to the section heading on navigation.
7. The existing browser flow (upload → dashboard → New upload → landing) still passes. The dashboard opens on Overview.

### Results (real export, headless Chromium)
| Section | Elements | Long tasks | Notes |
|---|---|---|---|
| Overview | 191 | none | ApexCharts chunk not fetched |
| History | ~500 | none | |
| Feeding | ~2,450 | one, ~600 ms | opens in about 1 s |
| Growth | ~3,200 | ~560 ms | charts render lazily on scroll |
| Measurements | ~1,100 | none | |

- **Before:** the single page had about 4,000 elements with deferred charts, and 19,000 originally.
- **Chunks:** ApexCharts is 533 KB (140 KB gzip) and the WHO tables 320 KB (81 KB gzip), both loaded only by the sections that use them.
- **A fix found while measuring:** the zoom strip reports its starting selection when it renders, which triggered a second full redraw. Feeding now ignores an unchanged selection, saving about 0.6 s per visit.
- **All checks pass:**
  - Overview loads no chart library;
  - leaving a section destroys its charts;
  - the History week is in the URL and kept;
  - the Feeding zoom is kept;
  - Back/Forward, deep links, refresh and the unknown-hash fallback work;
  - focus moves to the heading and the active link has `aria-current`;
  - at phone width the menu opens and closes and nothing scrolls sideways;
  - the upload/clear flow works, `npm test` passes, and there are no console errors.

## Loading skeletons (built, 2026-10-29)
Feeding used to stay blank and then show every chart at once, because ApexCharts drew everything in one long task.
- **Chart skeletons:** each chart slot (`ApexChart.vue`, `FeedClock.vue`) shows a `ChartSkeleton`, faint gridlines with a slow shimmer, until it has drawn. The skeleton then fades out over the chart, and pointer events pass through it so the first drag works.
- **Render queue (`src/lib/renderQueue.js`):** charts render one at a time, each after a painted frame, so skeletons show first and charts fill in top to bottom. This applies to every section, including Growth.
- **Section skeleton:** `FeedingSkeleton.vue` is Feeding's loading component while its code chunk (with ApexCharts) downloads. It has the same cards and chart heights, so the page doesn't move when the real section arrives. Measured card positions are identical before and after load.
- ApexCharts adds 15 px below each SVG, so slots reserve `height + 15`.
- **Results (real export):** skeletons paint about 100 ms after the click, and all charts are in by about 550–700 ms. The longest task is now about 400 ms instead of about 550 ms. "Feeds per day" alone accounts for nearly all of it; the other charts take about 20 ms each.
- Later: make "Feeds per day" cheaper to draw (about 900 stacked bars). It's the one slow chart.

## Baby's Firsts (built)

**Goal:** a browsable record of NaraBaby's "Baby First" entries (first smile, first steps…), each with its date, the child's age at the time, a title, an optional description and an optional photo.

### What the export has
| | Real export |
|---|---|
| Rows (`Type` = "Baby First") | 194, spanning about 2½ years |
| Title (`[Baby First] Baby First`) | always set; up to 223 characters, so some titles are really descriptions |
| Description (`Note`) | 92 rows; up to 634 characters, a few multi-line |
| Photo (`Photo`) | 129 rows, but only the app's internal file name (`<uuid>.jpg`). **NaraBaby's export doesn't include photos**, so the images are lost on export. |
| Time | always midnight, so a date with no time |

A further 6 rows of other types (bottle, diaper, medical) also have photos; they're out of scope here.

### Data shape
The importer adds a `firsts` list, sorted by date:
```ts
First { id: string /* NaraBaby _activityKey */; date: "YYYY-MM-DD"; ageDays: number;
        title: string; note: string | null; hadPhoto: boolean /* a photo existed in the app */ }
```
`id` is NaraBaby's `_activityKey`, which stays the same across exports. Photos added in the dashboard are linked to it, so re-importing a newer export keeps them attached.
This maps directly onto the planned event model's `milestone` kind (`title`, plus the event's own `note`). Adding the field bumps the storage `version` to 2, so a browser holding an older import asks for a fresh upload instead of breaking.

### Where it lives: the Firsts section, plus a teaser on Overview
194 entries, two-thirds with photos, is too much for a table under the charts. So:
- **The `#/firsts` sidebar section** (see Sidebar layout), a vertical timeline grouped by month:
  - each entry is a card with the date, age ("8 mo", "1 y 3 mo"), title and description, and a photo thumbnail when one is available;
  - clicking a photo opens it larger in a lightbox;
  - a search box filters titles and descriptions, and a year selector jumps through the timeline.
- **A "Recent firsts" card on Overview**: the latest 3–5 entries with thumbnails, and a "See all" link to `#/firsts`.
- **The table view** for accessibility already exists in effect: the timeline is plain HTML text, and screen readers get the same content.

### Photos: added by hand, never uploaded
NaraBaby's export drops photos; only the app's internal file name survives, so nothing can be matched automatically. Instead:
- **Photo badge:** entries that had a photo in the app (`hadPhoto`) show "Photo in NaraBaby (not exported)" with an **"Add photo"** button.
  - Every entry can take a photo, not just those.
  - The two-thirds that had one are the obvious ones to restore, and a filter "Had a photo in the app" lists just them, for working through.
- **Adding a photo:** "Add photo" opens a file picker, or you drop an image on the card.
  - The image is downscaled in the browser (longest side about 1,600 px, JPEG, plus a roughly 400 px thumbnail).
  - It's stored in **IndexedDB**, keyed by the entry's `id`. `localStorage` is too small for images.
  - Replace and remove are available per photo.
  - Estimated total for about 130 photos: 20–30 MB.
- **Photos outlive a "New upload":** they take effort to add, and they re-link automatically to the same entries from a newer export.
  - The confirmation modal gains an unchecked option, "Also remove the N photos you added". The data itself is still cleared as before.
  - Photos whose entry isn't in the current import are kept, and reported on the Firsts page ("3 photos belong to entries not in this export"), with a button to remove them.
- **Backup warning:** photos live only in this browser, so clearing site data or switching browsers loses them. The Firsts page says so plainly. "Download added photos" (a zip named by date and title) is listed under Later.
- Nothing leaves the browser.

### Test data
- The fake exports gain a handful more Baby First rows: some with descriptions, some with a `Photo` file name (so `hadPhoto` is true), one long title, one multi-line description.
- A tiny generated test image (`fixtures/test-photo.jpg`) for the add, replace and remove flow.
- `fixtures/expected/*.json` are regenerated by the parser, and the change is reviewed in the diff.

#### Browser tests in the repo (2026-10-29)
- The browser tests moved from a scratch folder into `e2e/` and run with `npm run e2e`. That builds first, then runs Node's test runner with `playwright-core` 1.56.1, pinned.
- `e2e/helpers.js` starts a Vite preview server on a free port and finds a Chromium (`CHROME_PATH`, Playwright's own download, or any cached `ms-playwright` Chromium).
- **Suites:** `landing`, `sections`, `events` (Firsts, Health, photos), `skeleton` (no layout shift, drag works while skeletons fade). Everything runs against the fake fixtures: 45 tests, about 9 s.
- `real-export.e2e.js` runs only with `BABYGRAPH_EXPORT=/path.csv`. Its expected counts come from the parser at runtime, so no real-data numbers are committed. Element counts and long tasks per section are printed as diagnostics.
- The skeleton drag test was checked to fail with the `pointer-events: none` fix removed.
- **Gotchas:**
  - Assert on counts, not Playwright element handles. A failing assert on a handle tries to print the whole object and ran the test process out of memory (SIGKILL).
  - `go()` waits for the page title to switch, because the old section's content lingers for a tick.

### Deployment: Caddy serves the files (2026-10-29)
- **Decision:** no runtime container. The site is static and Caddy already runs on the host, so an nginx container behind Caddy added a process and a port for nothing. A first version did that (unprivileged nginx bound to 127.0.0.1:8090, which passed all tests), but it was replaced.
- **Deploy:** `npm ci && npm run build`, then `rsync -a --delete dist/ server:/srv/babygraph/`.
- **`deploy/Caddyfile.example`:**
  - `file_server` with `encode zstd gzip`;
  - CSP, nosniff, no-referrer and Permissions-Policy headers, and the `Server` header removed;
  - `/assets/*` cached for a year (immutable), everything else `no-cache`;
  - `LICENSE` and `*.md` served as text/plain.
- **`Dockerfile`** is build-only and optional: `docker build --output type=local,dest=./dist .` writes `dist/` through a `scratch` export stage. `.dockerignore` is an allowlist, so the real CSV can't enter the build context.
- **Verified:** with `caddy:2-alpine` serving the Docker-built `dist/` through the example Caddyfile, the status codes, content types, cache headers, CSP and gzip are all correct, and all 46 e2e tests plus the real-export suite pass against it (`E2E_BASE_URL`).

### Licensing (2026-10-29)
- The project is MIT (`LICENSE`, Tyrel Souza). The project is named **Babygraph** (package `babygraph`); the repo isn't created yet.
- `NOTICE.md` covers what the generated list can't:
  - svg.js and its plugins, which ApexCharts 3 has built into its own files;
  - Tabler Icons paths copied into `src/sections/index.js`;
  - the WHO growth tables.
- `vite.config.js` sets `build.license`, so `dist/THIRD-PARTY-LICENSES.md` lists every bundled npm package. A small plugin copies `LICENSE` and `NOTICE.md` into `dist/`. The landing page links to the notices and licenses.
- **Open:** `src/data/who_lms.json` comes from the WHO `anthro` repo, which is GPL-3 (© WHO). Either keep it with that notice, or rebuild it from WHO's own published expanded tables.

## Verification
1. `npm test`: `firsts` parses correctly (id, dates, ages, null description, `hadPhoto`, multi-line description), and the storage version bump makes old records read as "nothing imported".
2. Drop a fake export: the Firsts page lists every entry in date order with correct ages, and search, year and "had a photo" filters work.
3. Add, replace and remove the test photo on an entry: the thumbnail and lightbox show, and it's stored downscaled.
4. Reload: the photo persists from IndexedDB.
5. "New upload" with the box unchecked, then re-import the same export: the photo reappears on the same entry. With the box checked, photos are gone.
6. Real export: 194 entries, 129 flagged "Photo in NaraBaby (not exported)". The page stays fast with many thumbnails (`loading="lazy"`).

### Results (2026-10-29)
- **Files:** `src/lib/photos.js` (IndexedDB db `nara-photos`, store `photos`, keyed by `_activityKey`; a shared reactive map of thumbnail object URLs used by both Firsts and Overview) and `src/sections/FirstsSection.vue`.
- **Layout:** newest month first, entries in date order within each month. Notes keep their line breaks. Long titles wrap.
- **Browser test (`e2e/events.mjs`, headless Chromium), all passing:**
  - fake export: 6 cards, 3 marked "Photo in NaraBaby (not exported)", search matches note text, the had-photo filter shows 3;
  - add photo: stored as a 640×480 JPEG (no upscaling) plus a 400×300 thumbnail; the lightbox opens with focus on Close, and Escape closes it and returns focus;
  - replace keeps one photo, remove deletes it; Overview's Recent firsts shows the thumbnail;
  - "New upload" with the box unchecked, then re-import: the photo re-links. With the box checked, IndexedDB is empty afterwards;
  - the girl's photo while the boy's export is loaded shows as an orphan, and "Remove them" deletes it;
  - a stored v1 record redirects to the landing page.
- **Real export:** 194 cards, 129 "not exported" badges, 92 notes. Opens in about 125 ms with about 2,000 elements, and nothing scrolls sideways at 390 px.
- Dropping an image on a card is built but only checked by hand; the test uses the file picker.

## Health (built)

**Goal:** medicine doses, temperatures and vaccines in one place, as tables in the **`#/health` sidebar section** (see Sidebar layout). The amount of data (tens of rows) suits tables, not charts.

### What the export has
| `Type` | Real export | Fields |
|---|---|---|
| Medical | 26 rows, at about 8–13 months, with real times | `[Medical] Medication`: every row. 24 follow `"<name>, <dose> (<unit>)"`, e.g. `"Motrin, 4 (ML)"`; 2 are just a name. Units are always ML so far. `[Medical] Temperature` + `Unit`: 3 rows, all °F, each in the same row as a medicine. `Note`: 2 rows. |
| Vaccine | 3 rows (visits), date only | `[Vaccine] Vaccine`: newline-separated codes, e.g. `DTaP\nHepB\nHib\nIPV\nPCV13\nRV` |

### Data shape (importer adds `health`)
```ts
health {
  doses: { t: string; name: string | null; dose: number | null; unit: string | null;
           tempC: number | null; note: string | null }[]   // one per Medical row, sorted by time
  vaccines: { date: string; ageDays: number; codes: string[] }[]
}
```
- **Medication string:** parsed with `^(.+), ([\d.]+) \((\w+)\)$`. A string that doesn't match becomes the whole `name`, with `dose` and `unit` null. The raw string is never lost.
- **Temperature:** stored canonically in °C (F→C on import) and displayed in both units. A row can hold a temperature with no medicine; `name` is null then.
- **Event-model mapping:** one Medical row becomes a `medication` event and/or a `temperature` event (already noted in the model). One Vaccine row becomes one `vaccine` event per code, sharing the visit's date.
- Adding `health` bumps the storage `version`. If Firsts ships in the same release, they share one bump.

### UI (`src/sections/HealthSection.vue`)
- **Summary line:** doses logged per medicine (e.g. "Motrin 13 · Children's Tylenol 11"), date of the last dose, highest temperature with its date, and vaccine visits.
- **"Medicine & temperature" table**, newest first: date and time, age, medicine, dose, temperature (°F / °C), note.
  - It also shows the **time since the previous dose of the same medicine** ("6h 10m"). That's useful when reading back through a sick day; it's information only, with no dosing advice.
  - **Fever readings** (≥ 100.4 °F / 38.0 °C) get a labelled badge, "fever ≥ 100.4 °F", in the reserved status colour. The badge always has text, never colour alone.
  - Filter by medicine; default all.
- **"Vaccines" table:** date, age, and each code as a badge whose tooltip and screen-reader text give the full name. A small built-in lookup supplies the names:

  | Code | Name |
  |---|---|
  | DTaP | Diphtheria, tetanus, pertussis |
  | HepA | Hepatitis A |
  | HepB | Hepatitis B |
  | Hib | Haemophilus influenzae type b |
  | IIV | Influenza (inactivated) |
  | IPV | Polio (inactivated) |
  | MMR | Measles, mumps, rubella |
  | PCV13 | Pneumococcal |
  | RV | Rotavirus |
  | VAR | Varicella (chickenpox) |

  Unknown codes are shown as typed. It isn't compared against any vaccination schedule.
- **Empty states:** if an export has no Medical or Vaccine rows, the section says so instead of showing empty tables.
- **Not medical advice:** the section only displays what was logged. A footer line says so.

### Test data
The fake generator adds:
- a run of Motrin and Tylenol doses a few hours apart, so the dose intervals show;
- a medicine with no dose;
- a temperature-only row;
- a fever reading in the same row as a dose;
- one temperature logged in **°C**, to exercise conversion (the real export only has °F);
- a vaccine visit with several newline-separated codes, plus one unknown code.

`fixtures/expected/*.json` are regenerated and reviewed in the diff.

### Verification
1. `npm test`:
   - medicine strings parse, including the no-dose fallback;
   - F→C and C passthrough are correct (100.5 °F → 38.06 °C);
   - vaccine codes split on newlines;
   - Health parsing doesn't change the parity of the existing `feeds`, `growth` and other fields.
2. Fake export:
   - dose intervals are correct between same-medicine doses and don't count across different medicines;
   - the fever badge shows only at or above 38.0 °C;
   - unknown vaccine codes show as typed.
3. Real export: 26 doses (Motrin 13, Children's Tylenol 11, 2 with no dose), 3 temperatures with one fever (100.5 °F), and 3 vaccine visits with 16 codes in total.
4. Keyboard and screen reader: the tables have headers, and badges have text.

### Results (2026-10-29)
- **Files:** `src/lib/health.js` (fever threshold, °C/°F, dose intervals, vaccine names) and `src/sections/HealthSection.vue`. Rows also carry the export's epoch so intervals use real elapsed time: the fake 23:50 New York → 04:55 Chicago Tylenol pair reads 6h 5m, not 5h 5m. Intervals over 72 h aren't shown.
- **Summary:** four small cards (doses by medicine, last dose, highest temperature with reading and fever counts, vaccine visits) rather than one line.
- **Medicine names** are grouped case-insensitively for the filter and the intervals.
- **Vaccine lookup** also covers PCV15 and PCV20.
- **Browser test, all passing:**
  - fake export: 9 rows, 2 fever badges (100.6 °F and the 100.4 °F boundary, which counts as a fever), Tylenol intervals 6h 5m / 3h 30m / –, the filter narrows rows, and vaccines appear newest first with full names in screen-reader text;
  - real export: 26 rows, 1 fever, 3 visits, 16 codes. The filter lists **Children's Tylenol (13)** and **Motrin (13)**: the 2 rows with no dose are Children's Tylenol, so they group with its 11 dosed rows.

## Status (2026-10-29)
Sections 1–5 are built, including the History week view and the fake test data. Converted to a Vite + Vue project. The landing page and in-browser import are built, and the Python build script is removed. A standard tracker-agnostic event model (`Subject`, `Event`, `kind` + `data`, canonical units, `source` provenance) has been designed but not implemented.

The sidebar layout (one section at a time) is built. Baby's Firsts (with photos added in the browser) and Health are built and share storage version 2. No Python remains in the repo. Next candidates are in Later.

## Verification
1. `npm test`: the importer matches `fixtures/expected/*.json` for both fake exports, and rejects a non-NaraBaby CSV and an export with no Profile row.
2. `npm run build && npm run preview`, then in the browser (see also the Sidebar layout checks):
   - `dashboard.html` with nothing stored redirects to `index.html`.
   - A non-NaraBaby CSV and a non-`.csv` file each show an error and stay on the page.
   - Dropping a fake fixture redirects to `dashboard.html#/overview` showing Test Girl or Test Boy. Growth shows the WHO curves for that child's sex, with monthly age ticks.
   - Picking the real export shows 5,073 feeds (the last at about 14 months). Feeding and Growth render 10 charts between them, and about 391 KB is stored.
   - "New upload": Escape or Cancel keeps the data; "Clear and upload" lands on `index.html?cleared` with the notice and storage emptied.
   - The landing page offers "Open dashboard" when an import is stored.
   - No console errors.
3. Unit check: the 3.502 kg row at about 4 weeks falls between its neighbours four days before (≈3.39 kg) and one day after (≈3.49 kg).
4. Percentile check against the WHO Anthro calculator. For example, birth weight 2.93 kg for a girl comes out at the 25th percentile.
5. History: the default week is the first full week with sleep logged. Prev/Next stop at the first and last weeks with data. Overnight sleep appears at the bottom of one day and the top of the next.
6. Light and dark modes are both readable; the timeline zoom strip zooms all four timeline charts.
