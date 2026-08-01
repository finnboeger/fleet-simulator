# Fleet Position Simulator

Fleet Position Simulator is a planning and visualization tool for windward-leeward racing fleets.

It simulates in which area each fleet will be during each point in time. 
For the speed of the first boat it uses the [Speed Charts](https://www.rya.org.uk/racing/speed-charts/) provided by the RYA. As the charts only include speeds for wind ranges, we are linearly interpolating between the beginning of each range.
For the speed of the last boat we are using a spread factor (by default the last boat is assumed to be 15% slower)

For multi-fleet regattas the tool supports the addition of an alternate windward mark with a different beat length, the use of which can be chosen on a fleet by fleet basis. Each fleet can have a different amount of laps specified.

The start of each fleet is assumed to take 5 minutes with an additional delay that can be added for each fleet.

## Main Inputs

Course settings:
- Beat length
- Optional alternate beat length
- Laps
- Wind speed
- Offset-leg distance
- Start-to-gate distance
- Reaching finish toggle

Fleet settings:
- Class performance profile
- Spread (first-to-last slowdown)
- Additional start delay
- Optional custom lap count
- Optional target time in minutes
- Color

## Beat-Length Auto Calculation

You can define target times per fleet and click Auto-calculate beat lengths.

Behavior:
- Fleets without target time are ignored
- If one fleet has a target time, beat length is solved for that target
- If multiple fleets have incompatible targets, the solver picks a shared beat length that matches the average target time across those fleets
- For mixed regular and alternate-top-mark fleets, regular and alternate beat lengths are solved independently

## Timeline And Playback Controls

- Play/Pause button
- Speed presets: 30x, 60x, 120x, 180x, 240x
- Time scrubber with start and finish markers
- Finish duration bubbles per fleet

Hotkeys:
- Space: Play/Pause
- Plus (+): Increase speed
- Minus (-): Decrease speed

## Local Development

Requirements:
- Node.js 20+
- npm

Install and run:

```bash
npm install
npm start
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Tech Stack

- React + TypeScript + Vite
- Zustand for state
- Canvas-based course rendering
- Vitest for simulation and geometry tests
