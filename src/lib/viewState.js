// Per-section view state that should survive navigating away (sections unmount when hidden).
import { reactive } from "vue";

export const viewState = reactive({
  historyWeek: null,       // Date: start of the week shown in History
  feedingZoom: null,       // { min, max } ms: the Feeding zoom window
  measurementsFilter: "",  // indicator key, "" = all
  firstsSearch: "",
  firstsYear: "",          // "" = all years
  firstsHadPhoto: false,   // only entries that had a photo in NaraBaby
  healthMedicine: "",      // medicine name filter, "" = all
});
