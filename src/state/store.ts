import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FleetConfig, RaceConfig, SimulationOutput } from '../simulation/types.js';
import { runSimulation as _runSimulation } from '../simulation/engine.js';
import { loadAllClasses, getAvailableClassNames } from '../simulation/class-loader.js';

// Loaded once at module initialisation from bundled JSON files
export const classPerformances = loadAllClasses();
export const AVAILABLE_CLASSES = getAvailableClassNames();

const FLEET_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
  '#fabed4', '#469990',
];

function nextColor(usedColors: string[]): string {
  for (const c of FLEET_COLORS) {
    if (!usedColors.includes(c)) return c;
  }
  return FLEET_COLORS[usedColors.length % FLEET_COLORS.length];
}

const DEFAULT_CLASS =
  AVAILABLE_CLASSES.find((n) => n.startsWith('ILCA 6')) ??
  AVAILABLE_CLASSES[0] ??
  'ILCA 6';

const DEFAULT_CONFIG: RaceConfig = {
  beatLengthNm: 1000 / 1852,
  hasAlternateTopMark: false,
  hasReachingFinish: false,
  alternateBeatLengthNm: (1000 / 1852) * 0.85,
  laps: 2,
  offsetMeters: 80,
  startToGateMeters: 150,
  windSpeedKnots: 12,
  showOutline: true,
  fleets: [],
};

interface PlaybackState {
  isPlaying: boolean;
  speedMultiplier: number;
  currentTimeSec: number;
}

interface AppState {
  config: RaceConfig;
  simulation: SimulationOutput | null;
  playback: PlaybackState;

  updateConfig: (updates: Partial<Omit<RaceConfig, 'fleets'>>) => void;
  addFleet: (className?: string) => void;
  moveFleet: (fromIndex: number, toIndex: number) => void;
  removeFleet: (id: string) => void;
  updateFleet: (id: string, updates: Partial<FleetConfig>) => void;
  clearFleetCustomLaps: (id: string) => void;
  refreshSimulation: () => void;
  setPlaying: (playing: boolean) => void;
  setSpeedMultiplier: (speed: number) => void;
  setCurrentTime: (timeSec: number) => void;
  resetToDefault: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      simulation: null,
      playback: { isPlaying: false, speedMultiplier: 60, currentTimeSec: 0 },

      updateConfig: (updates) =>
        set((s) => ({ config: { ...s.config, ...updates } })),

      addFleet: (className) => {
        const { config } = get();
        const usedColors = config.fleets.map((f) => f.color);
        const fleet: FleetConfig = {
          id: crypto.randomUUID(),
          className: className ?? DEFAULT_CLASS,
          useAlternateTopMark: false,
          lastSlowdownFraction: 0.15,
          additionalDelayMinutes: 0,
          color: nextColor(usedColors),
        };
        set((s) => ({ config: { ...s.config, fleets: [...s.config.fleets, fleet] } }));
      },

      moveFleet: (fromIndex, toIndex) =>
        set((s) => {
          const fleets = [...s.config.fleets];
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= fleets.length ||
            toIndex >= fleets.length ||
            fromIndex === toIndex
          ) {
            return s;
          }

          const [moved] = fleets.splice(fromIndex, 1);
          fleets.splice(toIndex, 0, moved);
          return { config: { ...s.config, fleets } };
        }),

      removeFleet: (id) =>
        set((s) => ({
          config: { ...s.config, fleets: s.config.fleets.filter((f) => f.id !== id) },
        })),

      updateFleet: (id, updates) =>
        set((s) => ({
          config: {
            ...s.config,
            fleets: s.config.fleets.map((f) => (f.id === id ? { ...f, ...updates } : f)),
          },
        })),

      clearFleetCustomLaps: (id) =>
        set((s) => ({
          config: {
            ...s.config,
            fleets: s.config.fleets.map((f) => {
              if (f.id !== id) return f;
              const { customLaps: _customLaps, ...rest } = f;
              return rest;
            }),
          },
        })),

      refreshSimulation: () => {
        const { config } = get();
        if (config.fleets.length === 0) { set({ simulation: null }); return; }
        try {
          const simulation = _runSimulation(config, classPerformances);
          set({
            simulation,
            playback: {
              isPlaying: true,
              speedMultiplier: get().playback.speedMultiplier,
              currentTimeSec: simulation.timelineStartSeconds,
            },
          });
        } catch (err) {
          console.error('Simulation error:', err);
        }
      },

      setPlaying: (isPlaying) =>
        set((s) => ({ playback: { ...s.playback, isPlaying } })),
      setSpeedMultiplier: (speedMultiplier) =>
        set((s) => ({ playback: { ...s.playback, speedMultiplier } })),
      setCurrentTime: (currentTimeSec) =>
        set((s) => ({ playback: { ...s.playback, currentTimeSec } })),

      resetToDefault: () =>
        set({ config: DEFAULT_CONFIG, simulation: null, playback: { isPlaying: false, speedMultiplier: 60, currentTimeSec: 0 } }),
    }),
    {
      name: 'fleet-position-v1',
      version: 7,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { config?: Record<string, unknown> } | undefined;
        const config = state?.config;
        if (!config) return persistedState;

        if (!('hasAlternateTopMark' in config)) {
          config.hasAlternateTopMark = false;
        }

        if (!('hasReachingFinish' in config)) {
          config.hasReachingFinish = DEFAULT_CONFIG.hasReachingFinish;
        }

        if ('secondaryBeatLengthNm' in config && !('alternateBeatLengthNm' in config)) {
          config.alternateBeatLengthNm = Number(config.secondaryBeatLengthNm) || DEFAULT_CONFIG.alternateBeatLengthNm;
          delete config.secondaryBeatLengthNm;
        }

        if (!('alternateBeatLengthNm' in config)) {
          config.alternateBeatLengthNm =
            (Number(config.beatLengthNm) || DEFAULT_CONFIG.beatLengthNm) * 0.85;
        }

        if (!('showOutline' in config)) {
          config.showOutline = DEFAULT_CONFIG.showOutline;
        }

        if ('beatLengthMeters' in config && !('beatLengthNm' in config)) {
          const meters = Number(config.beatLengthMeters);
          config.beatLengthNm = Number.isFinite(meters) ? meters / 1852 : DEFAULT_CONFIG.beatLengthNm;
          delete config.beatLengthMeters;
        }

        for (const fleet of (config.fleets as Array<Record<string, unknown>> | undefined) ?? []) {
          if (!('useAlternateTopMark' in fleet)) {
            fleet.useAlternateTopMark = false;
          }
          if (!('customLaps' in fleet)) {
            fleet.customLaps = undefined;
          }
          if ('startDelayMinutes' in fleet && !('additionalDelayMinutes' in fleet)) {
            fleet.additionalDelayMinutes = Number(fleet.startDelayMinutes) || 0;
            delete fleet.startDelayMinutes;
          }
        }

        return persistedState;
      },
      // Only persist the race configuration; simulation and playback are transient
      partialize: (state) => ({ config: state.config }),
    },
  ),
);
