import { useState, type DragEvent } from 'react';
import type { FleetConfig } from '../../simulation/types.js';
import { useAppStore, AVAILABLE_CLASSES } from '../../state/store.js';

export function ConfigPanel() {
  const config = useAppStore((s) => s.config);
  const { clearFleetCustomLaps, updateConfig, addFleet, moveFleet, removeFleet, updateFleet, refreshSimulation, resetToDefault } =
    useAppStore();
  const [draggedFleetId, setDraggedFleetId] = useState<string | null>(null);
  const [dragOverFleetId, setDragOverFleetId] = useState<string | null>(null);

  const moveById = (fromId: string, toId: string) => {
    const fromIndex = config.fleets.findIndex((f) => f.id === fromId);
    const toIndex = config.fleets.findIndex((f) => f.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    moveFleet(fromIndex, toIndex);
  };

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
        {config.hasAlternateTopMark ? (
          <label>
            Alternate beat
            <span className="input-row">
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.01}
                value={config.alternateBeatLengthNm}
                onChange={(e) => updateConfig({ alternateBeatLengthNm: Number(e.target.value) })}
              />
              <span className="unit">nm</span>
            </span>
          </label>
        ) : (
          <button onClick={() => updateConfig({ hasAlternateTopMark: true })}>
            Add alternate top mark
          </button>
        )}
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
            defaultLaps={config.laps}
            isDragging={draggedFleetId === fleet.id}
            isDragOver={dragOverFleetId === fleet.id && draggedFleetId !== fleet.id}
            onDragStart={() => setDraggedFleetId(fleet.id)}
            onDragEnd={() => {
              setDraggedFleetId(null);
              setDragOverFleetId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedFleetId && draggedFleetId !== fleet.id) {
                setDragOverFleetId(fleet.id);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedFleetId && draggedFleetId !== fleet.id) {
                moveById(draggedFleetId, fleet.id);
              }
              setDraggedFleetId(null);
              setDragOverFleetId(null);
            }}
            showAlternateTopMark={config.hasAlternateTopMark}
            onClearCustomLaps={() => clearFleetCustomLaps(fleet.id)}
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
  defaultLaps,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  showAlternateTopMark,
  onClearCustomLaps,
  onUpdate,
  onRemove,
}: {
  fleet: FleetConfig;
  defaultLaps: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  showAlternateTopMark: boolean;
  onClearCustomLaps: () => void;
  onUpdate: (u: Partial<FleetConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`fleet-row${isDragging ? ' is-dragging' : ''}${isDragOver ? ' is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="fleet-row-header">
        <span className="drag-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
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
        {fleet.customLaps == null ? (
          <button onClick={() => onUpdate({ customLaps: defaultLaps })}>
            + Set custom lap count
          </button>
        ) : (
          <label>
            Laps
            <span className="input-row">
              <input
                type="number"
                min={1}
                max={10}
                value={fleet.customLaps}
                onChange={(e) => onUpdate({ customLaps: Math.max(1, Number(e.target.value)) })}
              />
              <button
                type="button"
                className="unset-btn"
                title="Use default lap count"
                onClick={onClearCustomLaps}
              >
                🗑️
              </button>
            </span>
          </label>
        )}
        {showAlternateTopMark && (
          <label>
            Alternate top mark
            <input
              type="checkbox"
              checked={fleet.useAlternateTopMark}
              onChange={(e) => onUpdate({ useAlternateTopMark: e.target.checked })}
            />
          </label>
        )}
      </div>
    </div>
  );
}
