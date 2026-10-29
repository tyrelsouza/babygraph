// Date and number formatting shared across the dashboard.
export const DAYS_PER_MONTH = 30.4375;
export const HOUR = 3600000;

// Export timestamps are local wall-clock strings ("YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD")
export const localDate = (s) => new Date(s.length === 10 ? s + "T00:00:00" : s.replace(" ", "T"));
export const fmtDate = (s) => localDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
export const fmtClock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

export function ordinal(p) {
  if (p < 1) return "<1st";
  if (p > 99) return ">99th";
  const n = Math.round(p);
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return n + s;
}

export function fmtAge(days) {
  if (days < 60) return `${days} d`;
  const months = Math.floor(days / DAYS_PER_MONTH);
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} y ${months % 12} mo`;
}

export function lbOz(kg) {
  const totalOz = kg / 0.45359237 * 16;
  const lb = Math.floor(totalOz / 16);
  return `${lb} lb ${Math.round(totalOz - lb * 16)} oz`;
}

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const startOfWeek = (d) => addDays(startOfDay(d), -d.getDay()); // weeks start Sunday
export const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
