// Runs heavy chart renders one at a time, each after the browser has painted a frame.
// Without it every chart on a section renders in one long task, so skeletons never get
// painted and the whole page appears at once; with it charts fill in top to bottom.
let tail = Promise.resolve();
const afterPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

// Queues `job` (may return a promise). Returns a cancel function for components that unmount first.
export function enqueueRender(job) {
  let cancelled = false;
  tail = tail.then(afterPaint).then(() => (cancelled ? null : job())).catch((e) => console.error(e));
  return () => { cancelled = true; };
}
