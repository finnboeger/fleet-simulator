import { useEffect, useRef } from 'react';
import { useAppStore } from '../../state/store.js';

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SPEEDS = [1, 2, 5, 10, 30, 60];

export function Timeline() {
  const simulation = useAppStore((s) => s.simulation);
  const config = useAppStore((s) => s.config);
  const { isPlaying, speedMultiplier, currentTimeSec } = useAppStore((s) => s.playback);
  const { setPlaying, setSpeedMultiplier, setCurrentTime } = useAppStore();

  // Keep a ref to speed so the RAF closure always has the current value
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;

  // Animation loop – started when isPlaying becomes true, cancelled on false
  useEffect(() => {
    if (!isPlaying || !simulation) return;

    let rafId: number;
    let lastTs: number | null = null;

    function frame(ts: number) {
      if (lastTs === null) { lastTs = ts; rafId = requestAnimationFrame(frame); return; }
      const delta = (ts - lastTs) / 1000;
      lastTs = ts;

      const { playback, simulation: sim } = useAppStore.getState();
      const maxTime = sim?.durationSeconds ?? 0;
      const next = playback.currentTimeSec + delta * speedRef.current;

      if (next >= maxTime) {
        setCurrentTime(maxTime);
        setPlaying(false);
        return;
      }
      setCurrentTime(next);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, simulation, setCurrentTime, setPlaying]);

  const duration = simulation?.durationSeconds ?? 0;

  return (
    <div className="timeline">
      <button
        className="play-btn"
        onClick={() => setPlaying(!isPlaying)}
        disabled={!simulation}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div className="timeline-track">
        {/* Fleet start markers */}
        {simulation &&
          config.fleets.map((fleet) => {
            const env = simulation.fleets.find((e) => e.fleetId === fleet.id);
            if (!env || duration === 0) return null;
            const pct = (env.raceStartSeconds / duration) * 100;
            return (
              <div
                key={fleet.id}
                className="start-marker"
                style={{ left: `${pct}%`, background: fleet.color }}
                title={`${fleet.className} gun: ${fmt(env.raceStartSeconds)}`}
              />
            );
          })}

        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={currentTimeSec}
          disabled={!simulation}
          onChange={(e) => {
            setPlaying(false);
            setCurrentTime(Number(e.target.value));
          }}
        />
      </div>

      <span className="time-display">{fmt(currentTimeSec)}</span>

      <div className="speed-controls">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed-btn${s === speedMultiplier ? ' active' : ''}`}
            onClick={() => setSpeedMultiplier(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
