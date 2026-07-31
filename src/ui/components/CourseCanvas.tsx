import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../state/store.js';
import { Scene } from '../../visualization/Scene.js';
import { EnvelopeLayer } from '../../visualization/EnvelopeLayer.js';
import { buildCourseGeometry } from '../../simulation/course.js';
import type { CourseGeometry } from '../../simulation/types.js';

export function CourseCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const layersRef = useRef<Map<string, EnvelopeLayer>>(new Map());
  const geometryRef = useRef<CourseGeometry | null>(null);
  const [ready, setReady] = useState(false);

  const simulation = useAppStore((s) => s.simulation);
  const config = useAppStore((s) => s.config);
  const showOutline = useAppStore((s) => s.config.showOutline);
  const currentTimeSec = useAppStore((s) => s.playback.currentTimeSec);

  // Redraws from refs/store – safe to call from any effect without stale closures.
  const drawFrame = useCallback(() => {
    const scene = sceneRef.current;
    const geometry = geometryRef.current;
    if (!scene?.isReady || !geometry) return;

    const { simulation: sim, playback, config: liveConfig } = useAppStore.getState();
    scene.clear();
    scene.renderCourse(geometry);

    if (sim && liveConfig.showOutline) {
      for (const fleetEnv of sim.fleets) {
        layersRef.current.get(fleetEnv.fleetId)?.draw(scene, fleetEnv, playback.currentTimeSec);
      }
    }
  }, []);

  // Init Canvas 2D – synchronous, no async complications.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new Scene();
    scene.init(canvas);
    sceneRef.current = scene;
    setReady(true);
    return () => {
      scene.destroy();
      sceneRef.current = null;
      setReady(false);
    };
  }, []);

  // Size the canvas to match its CSS container and keep it in sync on resize.
  useEffect(() => {
    const container = containerRef.current;
    const scene = sceneRef.current;
    if (!container || !scene || !ready) return;

    const doResize = () => {
      scene.resize(container.clientWidth, container.clientHeight);
      drawFrame();
    };
    const observer = new ResizeObserver(doResize);
    observer.observe(container);
    doResize(); // initial size
    return () => observer.disconnect();
  }, [ready, drawFrame]);

  // Recompute geometry when race config changes.
  useEffect(() => {
    if (!ready || !sceneRef.current) return;
    const geometry = buildCourseGeometry(config);
    geometryRef.current = geometry;
    sceneRef.current.fitCourse(geometry);
    drawFrame();
  }, [config, ready, drawFrame]);

  // Rebuild envelope layers when simulation output changes.
  useEffect(() => {
    if (!ready) return;
    layersRef.current.clear();

    const { config: cfg, simulation: sim } = useAppStore.getState();
    if (sim) {
      for (const fleetEnv of sim.fleets) {
        const fleetCfg = cfg.fleets.find((f) => f.id === fleetEnv.fleetId);
        if (!fleetCfg) continue;
        const colorInt = parseInt(fleetCfg.color.replace('#', ''), 16);
        const layer = new EnvelopeLayer(colorInt);
        layer.renderHistory(fleetEnv, sceneRef.current!);
        layersRef.current.set(fleetEnv.fleetId, layer);
      }
    }
    drawFrame();
  }, [simulation, ready, drawFrame]);

  // Redraw on every time-cursor tick.
  useEffect(() => {
    drawFrame();
  }, [currentTimeSec, drawFrame]);

  // Redraw when outline visibility changes.
  useEffect(() => {
    drawFrame();
  }, [showOutline, drawFrame]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
