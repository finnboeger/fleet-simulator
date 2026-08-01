import { useEffect, useRef } from 'react';
import { useAppStore } from '../../state/store.js';

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDurationMinSec(sec: number): string {
  const totalSeconds = Math.max(0, Math.round(sec));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const SPEEDS = [30, 60, 120, 180, 240];

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  );
}

function nextSpeed(current: number): number {
  for (const speed of SPEEDS) {
    if (speed > current) return speed;
  }
  return SPEEDS[SPEEDS.length - 1];
}

function previousSpeed(current: number): number {
  for (let i = SPEEDS.length - 1; i >= 0; i--) {
    if (SPEEDS[i] < current) return SPEEDS[i];
  }
  return SPEEDS[0];
}

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
      const minTime = sim?.timelineStartSeconds ?? 0;
      const next = playback.currentTimeSec + delta * speedRef.current;

      if (next <= minTime) {
        setCurrentTime(minTime);
        setPlaying(false);
        return;
      }

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTextInputTarget(event.target)) return;
      if (!useAppStore.getState().simulation) return;

      if (event.code === 'Space') {
        event.preventDefault();
        const { playback } = useAppStore.getState();
        setPlaying(!playback.isPlaying);
        return;
      }

      const isIncrease = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
      if (isIncrease) {
        event.preventDefault();
        const { playback } = useAppStore.getState();
        setSpeedMultiplier(nextSpeed(playback.speedMultiplier));
        return;
      }

      const isDecrease = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
      if (isDecrease) {
        event.preventDefault();
        const { playback } = useAppStore.getState();
        setSpeedMultiplier(previousSpeed(playback.speedMultiplier));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setPlaying, setSpeedMultiplier]);

  const timelineStart = simulation?.timelineStartSeconds ?? 0;
  const timelineEnd = simulation?.durationSeconds ?? 0;
  const duration = Math.max(0, timelineEnd - timelineStart);

  return (
    <div className="timeline">
      <div className="timeline-main-row">
        <div className="timeline-track">
          {/* Fleet start markers */}
          {simulation &&
            config.fleets.map((fleet) => {
              const env = simulation.fleets.find((e) => e.fleetId === fleet.id);
              if (!env || duration === 0) return null;
              const pct = ((env.raceStartSeconds - timelineStart) / duration) * 100;
              return (
                <div
                  key={fleet.id}
                  className="start-marker"
                  style={{ left: `${pct}%`, background: fleet.color }}
                  title={`${fleet.className} gun: ${fmt(env.raceStartSeconds)}`}
                />
              );
            })}

          {/* First-boat finish markers */}
          {simulation &&
            config.fleets.map((fleet) => {
              const env = simulation.fleets.find((e) => e.fleetId === fleet.id);
              if (!env || duration === 0) return null;
              const pct = ((env.firstFinishSeconds - timelineStart) / duration) * 100;
              const raceDuration = env.firstFinishSeconds - env.raceStartSeconds;
              return (
                <div
                  key={`${fleet.id}-finish`}
                  className="finish-marker-group"
                  style={{ left: `${pct}%` }}
                  title={`${fleet.className} first finish: ${fmt(env.firstFinishSeconds)}`}
                >
                  <div className="finish-duration-bubble">🏁 {fmtDurationMinSec(raceDuration)}</div>
                  <div className="finish-marker" style={{ background: fleet.color }} />
                </div>
              );
            })}

          <input
            type="range"
            min={timelineStart}
            max={timelineEnd}
            step={1}
            value={currentTimeSec}
            disabled={!simulation}
            onChange={(e) => {
              setPlaying(false);
              setCurrentTime(Number(e.target.value));
            }}
          />
        </div>

        <span className="time-display">{fmt(Math.max(0, currentTimeSec - timelineStart))}</span>
      </div>

      <div className="timeline-controls-row">
        <button
          className="play-btn"
          onClick={() => setPlaying(!isPlaying)}
          disabled={!simulation}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

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
    </div>
  );
}
