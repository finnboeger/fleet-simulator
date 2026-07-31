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
  beatLengthMeters: 1000,
  laps: 2,
  offsetMeters: 80,
  startToGateMeters: 150,
  windSpeedKnots: 12,
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
  removeFleet: (id: string) => void;
  updateFleet: (id: string, updates: Partial<FleetConfig>) => void;
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
      playback: { isPlaying: false, speedMultiplier: 1, currentTimeSec: 0 },

      updateConfig: (updates) =>
        set((s) => ({ config: { ...s.config, ...updates } })),

      addFleet: (className) => {
        const { config } = get();
        const usedColors = config.fleets.map((f) => f.color);
        const fleet: FleetConfig = {
          id: crypto.randomUUID(),
          className: className ?? DEFAULT_CLASS,
          lastSlowdownFraction: 0.15,
          startDelayMinutes: 0,
          color: nextColor(usedColors),
        };
        set((s) => ({ config: { ...s.config, fleets: [...s.config.fleets, fleet] } }));
      },

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

      refreshSimulation: () => {
        const { config } = get();
        if (config.fleets.length === 0) { set({ simulation: null }); return; }
        try {
          const simulation = _runSimulation(config, classPerformances);
          set({ simulation, playback: { isPlaying: false, speedMultiplier: 1, currentTimeSec: 0 } });
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
        set({ config: DEFAULT_CONFIG, simulation: null, playback: { isPlaying: false, speedMultiplier: 1, currentTimeSec: 0 } }),
    }),
    {
      name: 'fleet-position-v1',
      // Only persist the race configuration; simulation and playback are transient
      partialize: (state) => ({ config: state.config }),
    },
  ),
);
