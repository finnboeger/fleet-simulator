import type { ClassPerformance, ClassSpeedRow, FleetConfig } from './types.js';
import { lookupPerformance } from './class-data.js';

export const MIN_WIND_KNOTS = 4;
export const MAX_WIND_KNOTS = 20;

/**
 * Clamp user-supplied wind speed to the allowed 4–20 kn range.
 */
export function clampWindSpeed(knots: number): number {
  return Math.max(MIN_WIND_KNOTS, Math.min(MAX_WIND_KNOTS, knots));
}

/**
 * Resolve fleet slowdown fractions, injecting the bulk default when absent.
 * Returns `{ firstMultiplier, bulkMultiplier, lastMultiplier }` where
 * a multiplier of 1.0 means full first-boat speed.
 */
export function resolveSpeedMultipliers(fleet: FleetConfig): {
  firstMultiplier: number;
  bulkMultiplier: number;
  lastMultiplier: number;
} {
  const lastSlowdown = fleet.lastSlowdownFraction;
  const bulkSlowdown = fleet.bulkSlowdownFraction ?? lastSlowdown / 3;
  return {
    firstMultiplier: 1.0,
    bulkMultiplier: 1.0 - bulkSlowdown,
    lastMultiplier: 1.0 - lastSlowdown,
  };
}

/**
 * Get the performance row for a fleet at the given wind speed, then return
 * effective VMG values for each envelope track after applying pace multipliers.
 */
export function resolveFleetPerformance(
  perf: ClassPerformance,
  windKnots: number,
  fleet: FleetConfig,
): {
  base: ClassSpeedRow;
  multipliers: ReturnType<typeof resolveSpeedMultipliers>;
} {
  const clamped = clampWindSpeed(windKnots);
  const base = lookupPerformance(perf, clamped);
  const multipliers = resolveSpeedMultipliers(fleet);
  return { base, multipliers };
}

/**
 * Convert upwind VMG (course-axis speed) given the upwind angle.
 * For a pure windward-leeward course the VMG already equals the course-axis
 * speed, so this is an identity. Kept for forward compatibility.
 */
export function upwindCourseSpeed(vmg: number, _angleFromWind: number): number {
  return vmg;
}

/**
 * Convert downwind VMG (course-axis speed) given the downwind angle.
 * Same identity reasoning as upwind.
 */
export function downwindCourseSpeed(vmg: number, _angleFromWind: number): number {
  return vmg;
}
