import '../App.css';
import { useEffect } from 'react';
import { CourseCanvas } from './components/CourseCanvas.js';
import { ConfigPanel } from './components/ConfigPanel.js';
import { Timeline } from './components/Timeline.js';
import { useAppStore } from '../state/store.js';

export default function App() {
  const { config, simulation, refreshSimulation } = useAppStore();

  // Auto-run simulation on load if a saved config has fleets but no simulation
  useEffect(() => {
    if (config.fleets.length > 0 && !simulation) refreshSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-layout">
      <div className="main-area">
        <div className="canvas-area">
          <CourseCanvas />
        </div>
        <div className="timeline-area">
          <Timeline />
        </div>
      </div>
      <ConfigPanel />
    </div>
  );
}
