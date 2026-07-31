import { describe, expect, it } from 'vitest';
import { buildCourseGeometry } from './course.js';
import { computeLegSideLimits, fleetRaceStartSeconds, trackDurationSeconds } from './progression.js';
import type { CourseLeg, RaceConfig } from './types.js';

const DEFAULT_CONFIG: RaceConfig = {
  beatLengthNm: 1,
  laps: 1,
  offsetMeters: 80,
  startToGateMeters: 150,
  windSpeedKnots: 12,
  showOutline: true,
  fleets: [],
};

describe('fleetRaceStartSeconds', () => {
  it('keeps a fixed five minute minimum and adds the extra delay', () => {
    expect(fleetRaceStartSeconds(0)).toBe(300);
    expect(fleetRaceStartSeconds(4)).toBe(540);
  });
});

describe('buildCourseGeometry', () => {
  it('converts beat length from nautical miles to metres and runs counterclockwise', () => {
    const geometry = buildCourseGeometry(DEFAULT_CONFIG);

    expect(geometry.windwardMark.y).toBe(150 + 1852);
    expect(geometry.offsetMark.x).toBeLessThan(0);
    expect(geometry.legs.map((leg) => leg.type)).toEqual(['upwind', 'offset', 'finish']);
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
