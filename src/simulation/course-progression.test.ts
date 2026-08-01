import { describe, expect, it } from 'vitest';
import { buildCourseGeometry, buildFleetCourseLegs } from './course.js';
import { computeLegSideLimits, fleetRaceStartSeconds, trackDurationSeconds } from './progression.js';
import type { CourseLeg, RaceConfig } from './types.js';

const DEFAULT_CONFIG: RaceConfig = {
  beatLengthNm: 1,
  hasAlternateTopMark: false,
  hasReachingFinish: false,
  alternateBeatLengthNm: 0.8,
  laps: 1,
  offsetMeters: 80,
  startToGateMeters: 150,
  windSpeedKnots: 12,
  showOutline: true,
  fleets: [],
};

describe('fleetRaceStartSeconds', () => {
  it('adds fixed minimum + extra delay to the previous fleet start time', () => {
    expect(fleetRaceStartSeconds(0, 0)).toBe(300);
    expect(fleetRaceStartSeconds(300, 4)).toBe(840);
  });
});

describe('buildCourseGeometry', () => {
  it('converts beat length from nautical miles to metres and runs counterclockwise', () => {
    const geometry = buildCourseGeometry(DEFAULT_CONFIG);

    expect(geometry.windwardMark.y).toBe(150 + 1852);
    expect(geometry.alternateWindwardMark.y).toBe(150 + 0.8 * 1852);
    expect(geometry.offsetMark.x).toBeLessThan(0);
    expect(geometry.legs.map((leg) => leg.type)).toEqual(['upwind', 'offset', 'finish']);
    expect(geometry.legs[0].start).toEqual(geometry.startLine);
  });

  it('starts first upwind at start line and later upwinds at leeward gate', () => {
    const geometry = buildCourseGeometry({ ...DEFAULT_CONFIG, laps: 2 });

    const upwindLegs = geometry.legs.filter((leg) => leg.type === 'upwind');
    expect(upwindLegs).toHaveLength(2);
    expect(upwindLegs[0].start).toEqual(geometry.startLine);
    expect(upwindLegs[1].start).toEqual(geometry.leewardGate);
  });

  it('builds an alternate top-mark course without an offset leg', () => {
    const geometry = buildCourseGeometry({ ...DEFAULT_CONFIG, laps: 2 });
    const legs = buildFleetCourseLegs(geometry, 2, true, false);

    expect(legs.map((leg) => leg.type)).toEqual(['upwind', 'downwind', 'upwind', 'finish']);
    expect(legs[0].end).toEqual(geometry.alternateWindwardMark);
    expect(legs[1].start).toEqual(geometry.alternateWindwardMark);
  });

  it('adds a reaching-finish mark and routes the final lap via the gate', () => {
    const geometry = buildCourseGeometry({ ...DEFAULT_CONFIG, hasReachingFinish: true, laps: 1 });

    expect(geometry.reachingFinishMark.x).toBe(150);
    expect(geometry.reachingFinishMark.y).toBe(50);
    expect(geometry.legs.map((leg) => leg.type)).toEqual(['upwind', 'offset', 'downwind', 'finish']);
    expect(geometry.legs[2].end).toEqual(geometry.leewardGate);
    expect(geometry.legs[3].start).toEqual(geometry.leewardGate);
    expect(geometry.legs[3].end).toEqual(geometry.reachingFinishMark);
  });

  it('builds alternate top-mark + reaching-finish as LRA', () => {
    const geometry = buildCourseGeometry({ ...DEFAULT_CONFIG, laps: 2, hasReachingFinish: true });
    const legs = buildFleetCourseLegs(geometry, 2, true, true);

    expect(legs.map((leg) => leg.type)).toEqual(['upwind', 'downwind', 'upwind', 'downwind', 'finish']);
    expect(legs[3].end).toEqual(geometry.leewardGate);
    expect(legs[4].start).toEqual(geometry.leewardGate);
    expect(legs[4].end).toEqual(geometry.reachingFinishMark);
  });
});

describe('trackDurationSeconds', () => {
  it('adds leg times using the correct speed by leg type', () => {
    const legs: CourseLeg[] = [
      { type: 'upwind', start: { x: 0, y: 0 }, end: { x: 0, y: 200 }, lengthMeters: 200, index: 0 },
      { type: 'offset', start: { x: 0, y: 200 }, end: { x: 0, y: 300 }, lengthMeters: 100, index: 1 },
      { type: 'finish', start: { x: 0, y: 300 }, end: { x: 0, y: 0 }, lengthMeters: 300, index: 2 },
    ];

    expect(trackDurationSeconds(legs, 10, 20)).toBeCloseTo(200 / 10 + 100 / 20 + 300 / 20);
  });
});

describe('computeLegSideLimits', () => {
  it('peaks at the midpoint and narrows toward the ends', () => {
    const leg: CourseLeg = {
      type: 'upwind',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 100 },
      lengthMeters: 100,
      index: 0,
    };
    const samples = [
      { timeSeconds: 0, position: { x: 0, y: 0 }, legIndex: 0, legProgress: 0 },
      { timeSeconds: 10, position: { x: 0, y: 50 }, legIndex: 0, legProgress: 0.5 },
      { timeSeconds: 20, position: { x: 0, y: 100 }, legIndex: 0, legProgress: 1 },
    ];

    const limits = computeLegSideLimits(leg, 45, samples);
    expect(limits[0].leftX).toBe(0);
    expect(limits[2].rightX).toBe(0);
    expect(limits[1].rightX - limits[1].leftX).toBeGreaterThan(limits[0].rightX - limits[0].leftX);
  });
});
