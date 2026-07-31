// ─── Boat class performance ───────────────────────────────────────────────

/** Raw JSON shape of a single speed-range entry in a class file. */
export interface RawSpeedEntry {
  upwind?: {
    knot: number;
    /** Angle in degrees from true wind. */
    angle?: number;
  };
  downwind?: {
    knot: number;
    /** Angle in degrees from true wind. */
    angle?: number;
  };
  reach?: { knot: number };
}

/** Raw `src/data/classes/[name].json` shape (only the parts we use). */
export interface RawClassFile {
  speeds: Record<string, RawSpeedEntry>;
}

/** Single normalised row in the class performance table. */
export interface ClassSpeedRow {
  /** Lower bound of the wind-speed range in knots. */
  windKnot: number;
  upwindVMG: number;
  downwindVMG: number;
  upwindAngle: number;
  downwindAngle: number;
}

/** Fully parsed and normalised class performance table. */
export interface ClassPerformance {
  className: string;
  rows: ClassSpeedRow[];
}

// ─── Race configuration ───────────────────────────────────────────────────

export interface FleetConfig {
  id: string;
  className: string;
  /** Percentage of first-boat pace for last boat (e.g. 0.15 = 15 % slower). */
  lastSlowdownFraction: number;
  /**
   * Percentage of first-boat pace for the bulk of the fleet.
   * Defaults to one-third of lastSlowdownFraction if not supplied.
   */
  bulkSlowdownFraction?: number;
  /** Extra delay in whole minutes beyond the fixed 5-minute start sequence. */
  additionalDelayMinutes: number;
  /** CSS hex colour for this fleet's envelope (e.g. "#ff6600"). */
  color: string;
}

export interface RaceConfig {
  /** Beat length in nautical miles. */
  beatLengthNm: number;
  /** Number of laps (each lap = 1 upwind + 1 downwind). */
  laps: number;
  /** Offset leg length in metres (default 80). */
  offsetMeters: number;
  /** Start-line to leeward-gate distance in metres (default 150). */
  startToGateMeters: number;
  /** True wind speed in knots, clamped to 4–20. */
  windSpeedKnots: number;
  fleets: FleetConfig[];
}

// ─── Course geometry ──────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type LegType =
  | 'upwind'
  | 'offset'
  | 'downwind'
  | 'finish';

export interface CourseLeg {
  type: LegType;
  start: Point;
  end: Point;
  /** Leg length in metres. */
  lengthMeters: number;
  /** Index of this leg (0-based). */
  index: number;
}

export interface CourseGeometry {
  legs: CourseLeg[];
  startLine: Point;
  leewardGate: Point;
  windwardMark: Point;
  offsetMark: Point;
}

// ─── Simulation output ────────────────────────────────────────────────────

/** A single time-step sample for one trajectory (first / bulk / last). */
export interface TrajectoryPoint {
  /** Elapsed seconds from time = 0 (start of overall sequence). */
  timeSeconds: number;
  position: Point;
  legIndex: number;
  /** Fraction along the current leg [0, 1]. */
  legProgress: number;
}

export type TrackRole = 'first' | 'bulk' | 'last';

export interface TrackSamples {
  role: TrackRole;
  points: TrajectoryPoint[];
}

/** Side limit for one leg – the horizontal extent at each time sample. */
export interface SideLimitSample {
  timeSeconds: number;
  leftX: number;
  rightX: number;
}

export interface FleetEnvelope {
  fleetId: string;
  /** Race start time in seconds from time = 0. */
  raceStartSeconds: number;
  /** Class-specific upwind angle from true wind in degrees. */
  upwindAngle: number;
  /** Class-specific downwind angle from true wind in degrees. */
  downwindAngle: number;
  /** Finish time of the first boat in seconds from time = 0. */
  firstFinishSeconds: number;
  tracks: [TrackSamples, TrackSamples, TrackSamples]; // first, bulk, last
  sideLimitsPerLeg: SideLimitSample[][];
}

export interface SimulationOutput {
  fleets: FleetEnvelope[];
  /** Total simulated duration in seconds. */
  durationSeconds: number;
}
