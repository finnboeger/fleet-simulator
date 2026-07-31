import { create } from 'zustand';
import type { RaceConfig, SimulationOutput } from '../simulation/types.js';

/** Default race configuration for quick start. */
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
  /** Current time cursor in seconds from t=0. */
  currentTimeSec: number;
}

interface AppState {
  config: RaceConfig;
  simulation: SimulationOutput | null;
  playback: PlaybackState;

  setConfig: (config: RaceConfig) => void;
  setSimulation: (output: SimulationOutput) => void;
  setPlaying: (playing: boolean) => void;
  setSpeedMultiplier: (speed: number) => void;
  setCurrentTime: (timeSec: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: DEFAULT_CONFIG,
  simulation: null,
  playback: {
    isPlaying: false,
    speedMultiplier: 1,
    currentTimeSec: 0,
  },

  setConfig: (config) => set({ config }),
  setSimulation: (simulation) => set({ simulation }),
  setPlaying: (isPlaying) =>
    set((s) => ({ playback: { ...s.playback, isPlaying } })),
  setSpeedMultiplier: (speedMultiplier) =>
    set((s) => ({ playback: { ...s.playback, speedMultiplier } })),
  setCurrentTime: (currentTimeSec) =>
    set((s) => ({ playback: { ...s.playback, currentTimeSec } })),
}));
