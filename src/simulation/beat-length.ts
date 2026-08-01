import { buildCourseGeometry, buildFleetCourseLegs } from './course.js';
import { clampWindSpeed, resolveFleetPerformance } from './performance.js';
import { knotsToMps, trackDurationSeconds } from './progression.js';
import type { ClassPerformance, FleetConfig, RaceConfig } from './types.js';

const MIN_BEAT_LENGTH_NM = 0.1;
const MAX_BEAT_LENGTH_NM = 10;

export function autoCalculateBeatLengths(
  config: RaceConfig,
  classPerformances: Map<string, ClassPerformance>,
): Pick<RaceConfig, 'beatLengthNm' | 'alternateBeatLengthNm'> {
  const targeted = config.fleets
    .filter((fleet) => Number.isFinite(fleet.targetTimeMinutes) && (fleet.targetTimeMinutes ?? 0) > 0)
    .map((fleet) => {
      const perf = classPerformances.get(fleet.className);
      if (!perf) throw new Error(`No class performance loaded for "${fleet.className}"`);
      return { fleet, perf, targetSeconds: (fleet.targetTimeMinutes as number) * 60 };
    });

  if (targeted.length === 0) {
    return {
      beatLengthNm: config.beatLengthNm,
      alternateBeatLengthNm: config.alternateBeatLengthNm,
    };
  }

  const regularTargeted = targeted.filter(
    ({ fleet }) => !(config.hasAlternateTopMark && fleet.useAlternateTopMark),
  );
  const alternateTargeted = targeted.filter(
    ({ fleet }) => config.hasAlternateTopMark && fleet.useAlternateTopMark,
  );

  const beatLengthNm =
    regularTargeted.length > 0
      ? solveBeatLength(
          config.beatLengthNm,
          (nm) =>
            averageResidualSeconds(regularTargeted, (entry) =>
              predictFleetDurationSeconds(config, entry.fleet, entry.perf, nm, config.alternateBeatLengthNm),
            ),
        )
      : config.beatLengthNm;

  const alternateBeatLengthNm =
    alternateTargeted.length > 0
      ? solveBeatLength(
          config.alternateBeatLengthNm,
          (nm) =>
            averageResidualSeconds(alternateTargeted, (entry) =>
              predictFleetDurationSeconds(config, entry.fleet, entry.perf, beatLengthNm, nm),
            ),
        )
      : config.alternateBeatLengthNm;

  return {
    beatLengthNm,
    alternateBeatLengthNm,
  };
}

type TargetedFleet = {
  fleet: FleetConfig;
  perf: ClassPerformance;
  targetSeconds: number;
};

function averageResidualSeconds(
  fleets: TargetedFleet[],
  predict: (entry: TargetedFleet) => number,
): number {
  const total = fleets.reduce((sum, entry) => sum + (predict(entry) - entry.targetSeconds), 0);
  return total / fleets.length;
}

function solveBeatLength(
  initialNm: number,
  residualAt: (beatLengthNm: number) => number,
): number {
  const minResidual = residualAt(MIN_BEAT_LENGTH_NM);
  const maxResidual = residualAt(MAX_BEAT_LENGTH_NM);

  if (Math.abs(minResidual) <= 1e-6) return MIN_BEAT_LENGTH_NM;
  if (Math.abs(maxResidual) <= 1e-6) return MAX_BEAT_LENGTH_NM;

  if (minResidual * maxResidual > 0) {
    // Target is outside achievable range; pick the closest bound.
    return Math.abs(minResidual) < Math.abs(maxResidual) ? MIN_BEAT_LENGTH_NM : MAX_BEAT_LENGTH_NM;
  }

  let lo = MIN_BEAT_LENGTH_NM;
  let hi = MAX_BEAT_LENGTH_NM;

  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const residual = residualAt(mid);
    if (Math.abs(residual) < 1e-3) return mid;

    if (minResidual * residual <= 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const solved = (lo + hi) / 2;
  const fallback = Number.isFinite(initialNm) ? initialNm : solved;
  return clampBeatLengthNm(Number.isFinite(solved) ? solved : fallback);
}

function predictFleetDurationSeconds(
  config: RaceConfig,
  fleet: FleetConfig,
  perf: ClassPerformance,
  beatLengthNm: number,
  alternateBeatLengthNm: number,
): number {
  const geometry = buildCourseGeometry({
    ...config,
    beatLengthNm,
    alternateBeatLengthNm,
  });
  const lapCount = fleet.customLaps ?? config.laps;
  const useAlternateTopMark = config.hasAlternateTopMark && fleet.useAlternateTopMark;
  const legs = buildFleetCourseLegs(geometry, lapCount, useAlternateTopMark, config.hasReachingFinish);

  const windKnots = clampWindSpeed(config.windSpeedKnots);
  const { base, multipliers } = resolveFleetPerformance(perf, windKnots, fleet);
  // Target-time alignment is based on winner/first-track elapsed race time.
  const upwindMps = knotsToMps(base.upwindVMG * multipliers.firstMultiplier);
  const downwindMps = knotsToMps(base.downwindVMG * multipliers.firstMultiplier);

  return trackDurationSeconds(legs, upwindMps, downwindMps);
}

function clampBeatLengthNm(value: number): number {
  return Math.max(MIN_BEAT_LENGTH_NM, Math.min(MAX_BEAT_LENGTH_NM, value));
}
