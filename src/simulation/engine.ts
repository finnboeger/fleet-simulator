import type { ClassPerformance, RaceConfig, SimulationOutput } from './types.js';
import { buildCourseGeometry } from './course.js';
import { simulateFleetEnvelope } from './envelope.js';
import { clampWindSpeed } from './performance.js';
import { fleetRaceStartSeconds, START_SEQUENCE_SECONDS } from './progression.js';

let _cache: { key: string; output: SimulationOutput } | null = null;

export function runSimulation(
  config: RaceConfig,
  classPerformances: Map<string, ClassPerformance>,
): SimulationOutput {
  const key = JSON.stringify(config);
  if (_cache?.key === key) return _cache.output;
  const output = compute(config, classPerformances);
  _cache = { key, output };
  return output;
}

function compute(
  config: RaceConfig,
  classPerformances: Map<string, ClassPerformance>,
): SimulationOutput {
  const geometry = buildCourseGeometry(config);
  const windKnots = clampWindSpeed(config.windSpeedKnots);

  const maxRaceStart =
    config.fleets.length > 0
      ? Math.max(...config.fleets.map((f) => fleetRaceStartSeconds(f.startDelayMinutes)))
      : START_SEQUENCE_SECONDS;
  // 6 hours past the last race start is a safe upper bound
  const totalSec = maxRaceStart + 6 * 3600;

  const fleets = config.fleets.map((fleet) => {
    const perf = classPerformances.get(fleet.className);
    if (!perf) throw new Error(`No class performance loaded for "${fleet.className}"`);
    return simulateFleetEnvelope(fleet, perf, windKnots, geometry.legs, totalSec);
  });

  return { fleets, durationSeconds: totalSec };
}
