// WHO Child Growth Standards: LMS method (z-scores, percentiles, reference curves).

// Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7)
function erf(x) {
  const sign = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}
export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// L/M/S for one indicator table ({L: [], M: [], S: []} indexed by age in days)
export function lmsAt(table, day) {
  if (day < 0 || day >= table.M.length) return null;
  return { L: table.L[day], M: table.M[day], S: table.S[day] };
}

// Value at a given z-score
export const lmsValue = ({ L, M, S }, z) => (L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L));

// WHO z-score; `restricted` applies the WHO adjustment beyond ±3 SD (weight-based indicators)
export function zScore(x, lms, restricted) {
  const { L, M, S } = lms;
  let z = L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
  if (restricted && Math.abs(z) > 3) {
    if (z > 3) {
      const sd3 = lmsValue(lms, 3);
      z = 3 + (x - sd3) / (sd3 - lmsValue(lms, 2));
    } else {
      const sd3 = lmsValue(lms, -3);
      z = -3 + (x - sd3) / (lmsValue(lms, -2) - sd3);
    }
  }
  return z;
}

export const REF_PERCENTILES = [
  { label: "3rd", z: -1.8808 },
  { label: "15th", z: -1.0364 },
  { label: "50th", z: 0 },
  { label: "85th", z: 1.0364 },
  { label: "97th", z: 1.8808 },
];
