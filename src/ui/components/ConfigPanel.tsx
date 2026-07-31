import type { FleetConfig } from '../../simulation/types.js';
import { useAppStore, AVAILABLE_CLASSES } from '../../state/store.js';

export function ConfigPanel() {
  const config = useAppStore((s) => s.config);
  const { updateConfig, addFleet, removeFleet, updateFleet, refreshSimulation, resetToDefault } =
    useAppStore();

  return (
    <aside className="config-panel">
      <section className="config-section">
        <h3>Course</h3>
        <label>
          Beat length
          <span className="input-row">
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.01}
              value={config.beatLengthNm}
              onChange={(e) => updateConfig({ beatLengthNm: Number(e.target.value) })}
            />
            <span className="unit">nm</span>
          </span>
        </label>
        <label>
          Laps
          <input
            type="number"
            min={1}
            max={10}
            value={config.laps}
            onChange={(e) => updateConfig({ laps: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label>
          Wind speed
          <span className="input-row">
            <input
              type="number"
              min={4}
              max={20}
              value={config.windSpeedKnots}
              onChange={(e) =>
                updateConfig({ windSpeedKnots: Math.min(20, Math.max(4, Number(e.target.value))) })
              }
            />
            <span className="unit">kn</span>
          </span>
        </label>
        <label>
          Offset leg
          <span className="input-row">
            <input
              type="number"
              min={0}
              max={500}
              step={10}
              value={config.offsetMeters}
              onChange={(e) => updateConfig({ offsetMeters: Number(e.target.value) })}
            />
            <span className="unit">m</span>
          </span>
        </label>
        <label>
          Start → gate
          <span className="input-row">
            <input
              type="number"
              min={50}
              max={1000}
              step={10}
              value={config.startToGateMeters}
              onChange={(e) => updateConfig({ startToGateMeters: Number(e.target.value) })}
            />
            <span className="unit">m</span>
          </span>
        </label>
        <label>
          Show outline
          <input
            type="checkbox"
            checked={config.showOutline}
            onChange={(e) => updateConfig({ showOutline: e.target.checked })}
          />
        </label>
      </section>

      <section className="config-section">
        <h3>Fleets</h3>
        {config.fleets.length === 0 && (
          <p className="empty-hint">No fleets yet. Add one below.</p>
        )}
        {config.fleets.map((fleet) => (
          <FleetRow
            key={fleet.id}
            fleet={fleet}
            onUpdate={(u) => updateFleet(fleet.id, u)}
            onRemove={() => removeFleet(fleet.id)}
          />
        ))}
        <button className="add-btn" onClick={() => addFleet()}>
          + Add Fleet
        </button>
      </section>

      <section className="config-actions">
        <button className="primary" onClick={refreshSimulation}>
          Run Simulation
        </button>
        <button onClick={resetToDefault}>Reset to defaults</button>
      </section>
    </aside>
  );
}

function FleetRow({
  fleet,
  onUpdate,
  onRemove,
}: {
  fleet: FleetConfig;
  onUpdate: (u: Partial<FleetConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="fleet-row">
      <div className="fleet-row-header">
        <input
          type="color"
          value={fleet.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          title="Fleet colour"
        />
        <select
          value={fleet.className}
          onChange={(e) => onUpdate({ className: e.target.value })}
        >
          {AVAILABLE_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="remove-btn" onClick={onRemove} title="Remove fleet">
          ×
        </button>
      </div>
      <div className="fleet-row-body">
        <label>
          Spread
          <span className="input-row">
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={Math.round(fleet.lastSlowdownFraction * 100)}
              onChange={(e) =>
                onUpdate({ lastSlowdownFraction: Number(e.target.value) / 100 })
              }
            />
            <span className="unit">%</span>
          </span>
        </label>
        <label>
          Additional delay
          <span className="input-row">
            <input
              type="number"
              min={0}
              max={120}
              step={1}
              value={fleet.additionalDelayMinutes}
              onChange={(e) =>
                onUpdate({ additionalDelayMinutes: Math.max(0, Math.round(Number(e.target.value))) })
              }
            />
            <span className="unit">min</span>
          </span>
        </label>
      </div>
    </div>
  );
}
