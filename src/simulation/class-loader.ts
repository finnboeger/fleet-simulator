import type { ClassPerformance, RawClassFile } from './types.js';
import { parseClassFile } from './class-data.js';

// Bundled at build time by Vite
const rawModules = import.meta.glob<{ default: RawClassFile }>(
  '../data/classes/*.json',
  { eager: true },
);

let _cache: Map<string, ClassPerformance> | null = null;

export function loadAllClasses(): Map<string, ClassPerformance> {
  if (_cache) return _cache;
  _cache = new Map();
  for (const [path, mod] of Object.entries(rawModules)) {
    const name = path.replace(/^.*\//, '').replace(/\.json$/, '');
    _cache.set(name, parseClassFile(name, mod.default));
  }
  return _cache;
}

export function getAvailableClassNames(): string[] {
  return [...loadAllClasses().keys()].sort();
}
