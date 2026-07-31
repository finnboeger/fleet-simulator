import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../state/store.js';
import { Scene } from '../../visualization/Scene.js';
import { EnvelopeLayer } from '../../visualization/EnvelopeLayer.js';
import { buildCourseGeometry } from '../../simulation/course.js';

export function CourseCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const layersRef = useRef<Map<string, EnvelopeLayer>>(new Map());
  const [ready, setReady] = useState(false);

  const simulation = useAppStore((s) => s.simulation);
  const config = useAppStore((s) => s.config);
  const currentTimeSec = useAppStore((s) => s.playback.currentTimeSec);

  // Initialise PixiJS once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const scene = new Scene();
    sceneRef.current = scene;

    scene.init(container).then(() => {
      if (!cancelled) setReady(true);
    }).catch(console.error);

    return () => {
      cancelled = true;
      scene.destroy();
      sceneRef.current = null;
      setReady(false);
    };
  }, []);

  // Rebuild course display when config changes (or scene becomes ready)
  useEffect(() => {
    if (!ready) return;
    const scene = sceneRef.current!;
    const geometry = buildCourseGeometry(config);

    scene.fitCourse(geometry);
    scene.renderCourse(geometry);

    // Re-fit on canvas resize
    scene.onResize(() => {
      scene.fitCourse(geometry);
      scene.renderCourse(geometry);
    });
  }, [config, ready]);

  // Rebuild envelope history layers when simulation changes
  useEffect(() => {
    if (!ready) return;
    const scene = sceneRef.current!;

    for (const layer of layersRef.current.values()) {
      scene.envelopeContainer.removeChild(layer);
      layer.destroy();
    }
    layersRef.current.clear();

    if (!simulation) return;

    // Read current config without subscribing (fleets are stable here)
    const { config: cfg } = useAppStore.getState();
    for (const fleetEnv of simulation.fleets) {
      const fleetCfg = cfg.fleets.find((f) => f.id === fleetEnv.fleetId);
      if (!fleetCfg) continue;
      const hexColor = parseInt(fleetCfg.color.replace('#', ''), 16);
      const layer = new EnvelopeLayer(hexColor);
      layer.renderHistory(fleetEnv, scene);
      scene.envelopeContainer.addChild(layer);
      layersRef.current.set(fleetEnv.fleetId, layer);
    }
  }, [simulation, ready]);

  // Render at current time each frame
  useEffect(() => {
    if (!ready || !simulation) return;
    const scene = sceneRef.current!;
    for (const fleetEnv of simulation.fleets) {
      layersRef.current.get(fleetEnv.fleetId)?.renderAtTime(fleetEnv, currentTimeSec, scene);
    }
  }, [currentTimeSec, simulation, ready]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
