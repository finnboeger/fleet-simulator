## Plan: Sailing Fleet Envelope Simulator MVP

Build a TypeScript web app that simulates and visualizes fleet progress on a windward-leeward course using envelope trajectories (first, bulk, last + side limits) rather than individual boats. Use a deterministic simulation core decoupled from rendering. Start with React + Vite + PixiJS for smooth 2D timeline animation and gradient area rendering.

**Steps**
1. ✅ Phase 1: Project setup and architecture baseline
1. ✅ Initialize a TypeScript React app with Vite and strict compiler settings. Define module boundaries between simulation core and UI/rendering to keep logic testable. 
1. ✅ Add core libraries first: React, Zustand, PixiJS, and a schema validator (Zod) for user input validation. 
1. ✅ Configure testing (Vitest + Testing Library) and linting (ESLint + TypeScript rules) so simulation math and config parsing are validated from the start.

1. ✅ Phase 2: Domain model and configuration schema
1. ✅ Define race configuration types: beat length, laps, offset distance (default 80m), start-to-gate distance (default 150m), wind speed, and fleets with class/spread/start delay/color.
1. ✅ Define boat class performance table model loaded from `src/data/classes/[classname].json` using each file's `speeds` entry.
1. ✅ Parse `speeds` keys that can be either a single value (for example `"5"`) or a range (for example `"5..8"`); normalize range keys to their lower bound so `"5..8"` maps to windspeed `5`.
1. ✅ Implement defaults and normalization rules:
- If upwind angle missing, use 45 degrees.
- If downwind angle missing, use 170 degrees.
- If bulk slowdown missing, compute as one-third of the last-boat slowdown.
- Enforce start delay as integer minutes >= 0.
1. ✅ Restrict user-entered wind speed to a minimum of 4 kn and a maximum of 20 kn.
1. ✅ If requested wind speed is not present in the class table, linearly interpolate between the closest known speeds.
1. ✅ If requested wind speed is below the smallest known class speed, clamp to the smallest known speed value.
1. ✅ If requested wind speed is above the largest known class speed, clamp to the largest known speed value.

1. ✅ Phase 3: Course geometry and leg progression engine
1. ✅ Implement windward-leeward geometry generator with fixed up-screen wind direction and computed mark coordinates from beat length.
1. ✅ Build leg progression state machine for envelope tracks:
- Start area to leeward gate
- Upwind to windward mark
- Offset leg
- Downwind to leeward gate
- Repeat for laps
- Final downwind finish
1. ✅ Convert VMG to course-axis speed per leg using corresponding angle assumptions for boundary projection logic.
1. ✅ Implement start procedure timing model (fixed 5-minute sequence) and derive each fleet race start from cumulative procedure offsets.

1. ✅ Phase 4: Envelope simulation (first/bulk/last + side limits)
1. ✅ Represent each fleet with three primary trajectories (first, bulk, last), each with its own pace multiplier from slowdown percentages.
1. ✅ Simulate trajectories over time with a fixed step (for example 1 second), producing position samples for each timeline timestamp.
1. ✅ Compute left/right side limits per leg based on your rule:
- At leg entry, project two reachable boundary paths if a boat immediately chooses left or right and tacks/gybes once at halfway distance.
- Use class upwind/downwind angle for that leg.
1. ✅ Build polygon/envelope slices for rendering, with gradient intensity profile:
- 100% saturation at bulk trajectory
- 50% saturation at first and last limits
1. ✅ Cache per-fleet simulation outputs and invalidate only when dependent inputs change.

1. ✅ Phase 5: Visualization and interaction
1. ✅ Build a PixiJS scene with layers: course marks/lines, envelope fills, first/last boundary lines, and optional bulk centerline.
1. ✅ Implement timeline UI below the diagram with play/pause, speed control, and visible markers for each fleet starting procedure and race start.
1. ✅ Add synchronized time cursor that drives rendered sample selection.
1. ✅ Implement fleet color defaults with non-reuse rotation until palette exhaustion; preserve manual overrides.
1. ✅ Add responsive layout for desktop and mobile (canvas scaling + control panel stacking).

1. ✅ Phase 6: Input UX and data management
1. ✅ Create forms for race config and fleet list with validation and sensible defaults.
1. ✅ Create class-data loading/parsing for `src/data/classes/[classname].json` with normalized speed keys and interpolation-ready lookup maps.
1. ✅ Persist scenario state locally (localStorage) and provide reset-to-default scenario.

1. Phase 7: Quality hardening and release readiness
1. Add unit tests for interpolation, defaulting behavior, leg timing, start offset handling, and side-boundary geometry.
1. Add snapshot or pixel-tolerance checks for envelope geometry generation where practical.
1. Add performance checks on target scenario sizes (multiple fleets across full race timeline).
1. Document assumptions and formulas in README.

**Relevant files**
- /Users/finnboeger/fleet-position/src/simulation/types.ts — canonical domain types for config, class tables, envelopes, and timeline samples.
- /Users/finnboeger/fleet-position/src/simulation/performance.ts — VMG lookup/interpolation, angle defaults, slowdown profile generation.
- /Users/finnboeger/fleet-position/src/simulation/course.ts — windward-leeward geometry and mark coordinates.
- /Users/finnboeger/fleet-position/src/simulation/progression.ts — leg state machine and lap/finish progression.
- /Users/finnboeger/fleet-position/src/simulation/envelope.ts — first/bulk/last and side-limit trajectory generation.
- /Users/finnboeger/fleet-position/src/simulation/engine.ts — deterministic time-stepped simulation runner and caching.
- /Users/finnboeger/fleet-position/src/simulation/class-data.ts — parsing `src/data/classes/[classname].json`, speed-key normalization, interpolation/clamping lookup helpers.
- /Users/finnboeger/fleet-position/src/ui/App.tsx — page composition and state wiring.
- /Users/finnboeger/fleet-position/src/ui/components/ConfigPanel.tsx — race/fleet/class input UI.
- /Users/finnboeger/fleet-position/src/ui/components/Timeline.tsx — play/pause, speed controls, and start markers.
- /Users/finnboeger/fleet-position/src/visualization/Scene.ts — Pixi setup and layer orchestration.
- /Users/finnboeger/fleet-position/src/visualization/EnvelopeLayer.ts — gradient fill and boundary line drawing.
- /Users/finnboeger/fleet-position/src/state/store.ts — Zustand store for config, playback state, and computed outputs.
- /Users/finnboeger/fleet-position/src/data/classes/[classname].json — source boat-class files containing `speeds` with single-value or range keys.

**Verification**
1. Automated math tests:
1. Validate interpolation outputs at exact table knots, between knots, and out-of-range clamps.
1. Validate speed-key normalization (`"5"` and `"5..8"` both mapping as expected, with ranges using lower bound).
1. Validate default angle injection and bulk slowdown default formula.
1. Validate windspeed input guardrails at 4 kn minimum and 20 kn maximum.
1. Validate start procedure timeline offsets and race-start timestamps per fleet.
1. Automated geometry tests:
1. Confirm generated leg sequence lengths and transitions for multi-lap courses.
1. Confirm side-boundary half-way tack/gybe projection geometry for upwind and downwind legs.
1. UI/integration checks:
1. Play/pause and speed change affect time progression deterministically.
1. Timeline markers match configured start procedures.
1. Envelope gradient shows highest saturation at bulk line and lower saturation at first/last.
1. Performance checks:
1. Ensure smooth playback at 60fps target on a typical laptop for representative multi-fleet scenarios.
1. Manual acceptance:
1. Change beat length/laps/wind/class data and verify envelope shape and timing update correctly.
1. Test on desktop and mobile widths for layout and control usability.

**Decisions**
- Included scope: envelope-only simulation model (first/bulk/last + side bounds), not per-boat micro simulation.
- Included scope: fixed wind direction aligned upward in viewport for MVP.
- Included scope: fixed 5-minute starting procedure.
- Included scope: class data loaded from `src/data/classes/[classname].json` and `speeds` range keys normalized to the lower bound.
- Included scope: user windspeed constrained to 4-20 kn, with class performance interpolation and min/max clamping against known class-speed points.
- Excluded for MVP: dynamic wind shifts/gust models, current/tide effects, collisions/rules logic, map/geospatial projection.

**Further Considerations**
1. Library alternative for rendering: if gradient polygon handling in Pixi becomes complex, switch envelope rendering to SVG overlays while keeping Pixi for course/timeline animation.
2. If performance becomes limiting, move simulation engine into a Web Worker and stream sampled timeline states to UI.
3. If you later need realistic fleet spread distributions, extend from three-track envelope model to quantile bands (for example p10/p50/p90).
