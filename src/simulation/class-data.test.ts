import { describe, it, expect } from 'vitest';
import { parseSpeedKey, parseClassFile, lookupPerformance } from './class-data.js';
import type { RawClassFile } from './types.js';

describe('parseSpeedKey', () => {
  it('parses single value keys', () => {
    expect(parseSpeedKey('5')).toBe(5);
    expect(parseSpeedKey('12')).toBe(12);
  });

  it('normalises range keys to lower bound', () => {
    expect(parseSpeedKey('5..8')).toBe(5);
    expect(parseSpeedKey('8..12')).toBe(8);
    expect(parseSpeedKey('12..15')).toBe(12);
  });

  it('throws on unrecognised keys', () => {
    expect(() => parseSpeedKey('abc')).toThrow();
  });
});

const SAMPLE_CLASS: RawClassFile = {
  speeds: {
    '5..8': { upwind: { knot: 3.0 }, downwind: { knot: 4.0 } },
    '8..12': { upwind: { knot: 4.0 }, downwind: { knot: 6.0 } },
    '12..15': { upwind: { knot: 5.0 }, downwind: { knot: 8.0 } },
  },
};

describe('parseClassFile', () => {
  it('sorts rows by windKnot ascending', () => {
    const perf = parseClassFile('Test', SAMPLE_CLASS);
    expect(perf.rows.map((r) => r.windKnot)).toEqual([5, 8, 12]);
  });

  it('applies default upwind and downwind angles', () => {
    const perf = parseClassFile('Test', SAMPLE_CLASS);
    expect(perf.rows[0].upwindAngle).toBe(45);
    expect(perf.rows[0].downwindAngle).toBe(170);
  });
});

describe('lookupPerformance', () => {
  const perf = parseClassFile('Test', SAMPLE_CLASS);

  it('returns exact value at table knot', () => {
    const row = lookupPerformance(perf, 8);
    expect(row.upwindVMG).toBe(4.0);
    expect(row.downwindVMG).toBe(6.0);
  });

  it('interpolates between knots', () => {
    // midpoint between 8 (4.0 upwind) and 12 (5.0 upwind) → 4.5
    const row = lookupPerformance(perf, 10);
    expect(row.upwindVMG).toBeCloseTo(4.5);
    expect(row.downwindVMG).toBeCloseTo(7.0);
  });

  it('clamps below minimum known speed', () => {
    const row = lookupPerformance(perf, 2);
    expect(row.upwindVMG).toBe(3.0);
  });

  it('clamps above maximum known speed', () => {
    const row = lookupPerformance(perf, 20);
    expect(row.upwindVMG).toBe(5.0);
  });
});
