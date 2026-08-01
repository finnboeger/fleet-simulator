import { describe, expect, it } from 'vitest';
import { autoCalculateBeatLengths } from './beat-length.js';
import type { ClassPerformance, FleetConfig, RaceConfig } from './types.js';
import { buildCourseGeometry, buildFleetCourseLegs } from './course.js';
import { clampWindSpeed, resolveFleetPerformance } from './performance.js';
import { knotsToMps, trackDurationSeconds } from './progression.js';

const perfMap = new Map<string, ClassPerformance>([
  [
    'Fast',
    {
      className: 'Fast',
      rows: [{ windKnot: 12, upwindVMG: 6, downwindVMG: 8, upwindAngle: 45, downwindAngle: 165 }],
    },
  ],
  [
    'Slow',
    {
      className: 'Slow',
      rows: [{ windKnot: 12, upwindVMG: 4.2, downwindVMG: 5.8, upwindAngle: 45, downwindAngle: 165 }],
    },
  ],
]);

const baseConfig: RaceConfig = {
  beatLengthNm: 0.6,
  hasAlternateTopMark: false,
  hasReachingFinish: false,
  alternateBeatLengthNm: 0.5,
  laps: 2,
  offsetMeters: 80,
  startToGateMeters: 150,
  windSpeedKnots: 12,
  showOutline: true,
  fleets: [],
};

function fleet(id: string, className: string, targetTimeMinutes?: number, useAlternateTopMark = false): FleetConfig {
  const base: FleetConfig = {
    id,
    className,
    useAlternateTopMark,
    lastSlowdownFraction: 0.15,
    additionalDelayMinutes: 0,
    color: '#ffffff',
  };

  return targetTimeMinutes == null ? base : { ...base, targetTimeMinutes };
}

function predictedTargetDurationSeconds(config: RaceConfig, selectedFleet: FleetConfig): number {
  const perf = perfMap.get(selectedFleet.className);
  if (!perf) throw new Error('missing class performance');
  const geometry = buildCourseGeometry(config);
  const legs = buildFleetCourseLegs(
    geometry,
    selectedFleet.customLaps ?? config.laps,
    config.hasAlternateTopMark && selectedFleet.useAlternateTopMark,
    config.hasReachingFinish,
  );
  const windKnots = clampWindSpeed(config.windSpeedKnots);
  const { base, multipliers } = resolveFleetPerformance(perf, windKnots, selectedFleet);
  const upwindMps = knotsToMps(base.upwindVMG * multipliers.firstMultiplier);
  const downwindMps = knotsToMps(base.downwindVMG * multipliers.firstMultiplier);
  return trackDurationSeconds(legs, upwindMps, downwindMps);
}

describe('autoCalculateBeatLengths', () => {
  it('matches a single fleet target time', () => {
    const fleets = [fleet('f1', 'Fast', 55)];
    const config: RaceConfig = { ...baseConfig, fleets };

    const solved = autoCalculateBeatLengths(config, perfMap);
    const solvedConfig: RaceConfig = { ...config, ...solved };
    const durationSec = predictedTargetDurationSeconds(solvedConfig, fleets[0]);

    expect(durationSec).toBeCloseTo(55 * 60, -1);
  });

  it('matches average target when fleets cannot all hit the same target', () => {
    const fleets = [fleet('f1', 'Fast', 60), fleet('f2', 'Slow', 60)];
    const config: RaceConfig = { ...baseConfig, fleets };

    const solved = autoCalculateBeatLengths(config, perfMap);
    const solvedConfig: RaceConfig = { ...config, ...solved };

    const avgDurationSec =
      (predictedTargetDurationSeconds(solvedConfig, fleets[0]) +
        predictedTargetDurationSeconds(solvedConfig, fleets[1])) /
      2;

    expect(avgDurationSec).toBeCloseTo(60 * 60, -1);
  });

  it('solves regular and alternate beat lengths independently', () => {
    const fleets = [fleet('f1', 'Fast', 48, false), fleet('f2', 'Slow', 64, true)];
    const config: RaceConfig = {
      ...baseConfig,
      hasAlternateTopMark: true,
      fleets,
    };

    const solved = autoCalculateBeatLengths(config, perfMap);
    const solvedConfig: RaceConfig = { ...config, ...solved };

    expect(predictedTargetDurationSeconds(solvedConfig, fleets[0])).toBeCloseTo(48 * 60, -1);
    expect(predictedTargetDurationSeconds(solvedConfig, fleets[1])).toBeCloseTo(64 * 60, -1);
  });
});
