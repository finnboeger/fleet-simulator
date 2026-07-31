import type { ClassPerformance, ClassSpeedRow, RawClassFile, RawSpeedEntry } from './types.js';

const DEFAULT_UPWIND_ANGLE = 45;
const DEFAULT_DOWNWIND_ANGLE = 170;

/**
 * Parse a speed key like `"5"` or `"5..8"` into the lower-bound wind speed.
 * Range keys (`"5..8"`) normalise to their lower bound (`5`).
 */
export function parseSpeedKey(key: string): number {
  const rangeMatch = /^(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)$/.exec(key);
  if (rangeMatch) {
    return parseFloat(rangeMatch[1]);
  }
  const single = parseFloat(key);
  if (!isNaN(single)) return single;
  throw new Error(`Unrecognised speed key: "${key}"`);
}

function normaliseRow(windKnot: number, entry: RawSpeedEntry): ClassSpeedRow {
  return {
    windKnot,
    upwindVMG: entry.upwind?.knot ?? 0,
    downwindVMG: entry.downwind?.knot ?? 0,
    upwindAngle: entry.upwindAngle ?? DEFAULT_UPWIND_ANGLE,
    downwindAngle: entry.downwindAngle ?? DEFAULT_DOWNWIND_ANGLE,
  };
}

/**
 * Parse a raw class JSON file into a sorted, normalised `ClassPerformance`.
 * Rows are sorted ascending by `windKnot`.
 */
export function parseClassFile(name: string, raw: RawClassFile): ClassPerformance {
  const rows: ClassSpeedRow[] = Object.entries(raw.speeds).map(([key, entry]) =>
    normaliseRow(parseSpeedKey(key), entry),
  );
  rows.sort((a, b) => a.windKnot - b.windKnot);
  return { className: name, rows };
}

/**
 * Look up (and interpolate/clamp) upwind and downwind VMG and angles
 * for the given true wind speed.
 *
 * - If `windKnots` is below the lowest known speed, clamp to lowest row.
 * - If `windKnots` is above the highest known speed, clamp to highest row.
 * - Otherwise linearly interpolate between the bracketing rows.
 */
export function lookupPerformance(
  perf: ClassPerformance,
  windKnots: number,
): ClassSpeedRow {
  const { rows } = perf;
  if (rows.length === 0) throw new Error(`No performance data for class "${perf.className}"`);

  if (windKnots <= rows[0].windKnot) return { ...rows[0] };

  const last = rows[rows.length - 1];
  if (windKnots >= last.windKnot) return { ...last };

  // Find the bracketing pair
  let lo = rows[0];
  let hi = rows[1];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].windKnot >= windKnots) {
      lo = rows[i - 1];
      hi = rows[i];
      break;
    }
  }

  const t = (windKnots - lo.windKnot) / (hi.windKnot - lo.windKnot);
  return {
    windKnot: windKnots,
    upwindVMG: lo.upwindVMG + t * (hi.upwindVMG - lo.upwindVMG),
    downwindVMG: lo.downwindVMG + t * (hi.downwindVMG - lo.downwindVMG),
    upwindAngle: lo.upwindAngle + t * (hi.upwindAngle - lo.upwindAngle),
    downwindAngle: lo.downwindAngle + t * (hi.downwindAngle - lo.downwindAngle),
  };
}
