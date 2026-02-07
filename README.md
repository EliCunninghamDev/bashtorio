# Bashtorio

**Unix Pipe Factory Game - Factorio meets Bash**

Build conveyor belt systems to process data through real Unix commands running in an actual Linux VM in your browser. Place sources, route bytes along belts, pipe them through `grep`, `sed`, `awk`, and any other command, then collect the output in sinks.

## Architecture

### Monorepo Layout

```
bashtorio/
├── packages/bashtorio-core/   # Core game library (TypeScript)
│   └── src/
│       ├── game/              # Types, grid, simulation, packets
│       ├── render/            # Canvas renderer
│       ├── ui/                # Input handling, components
│       ├── vm/                # v86 Linux VM integration
│       ├── audio/             # Sound system
│       ├── events/            # Event bus
│       ├── util/              # Themes, save/load, presets, settings
│       └── index.ts           # Main entry point & UI assembly
└── apps/web/                  # Astro frontend
    └── src/
        ├── pages/index.astro  # Single-page shell
        └── scripts/game.ts    # Mounts the game
```

The core library exports a `mount()` function that takes a container element, asset paths, and callbacks, returning a `BashtorioInstance` with full control over state, VM, renderer, input, sound, and events. The Astro app is a thin shell that calls `mount()` and serves static assets.

### Build

```sh
pnpm install
pnpm build    # tsc + vite (core) → astro build (web)
pnpm dev      # dev server with HMR
```

## Game Concepts

### Grid & Belts

The game world is a **32×32 grid** (48px per cell). Cells can hold:

- **Belts** - Directional conveyors (right/down/left/up) that carry packets
- **Splitters** - Alternate packets between two output directions
- **Machines** - 23 types of processing units (see below)

Packets are visual representations of bytes/characters. They move along belts at a fixed speed, change direction at cell transitions, and **block when the next cell is occupied** (backpressure). Packets that fall off the grid get orphaned - they tumble with gravity and fade out.

### Machines

Machines are a discriminated union (`Machine`) with `type` as the discriminant. Key base types:

- `MachineBase` - shared `x`, `y`, `lastCommandTime`
- `EmitTimer` - shared `emitInterval`, `lastEmitTime` (SOURCE, LINEFEED, CONSTANT, CLOCK)
- `BufferingMachine` - union of 15 types that have an `outputBuffer` (emit one char at a time)

#### Source Machines

| Machine | Key | Description |
|---------|-----|-------------|
| SOURCE | E | Emits configured text one character at a time |
| CONSTANT | T | Loops text forever at a set interval |
| KEYBOARD | K | Emits real keypresses during simulation |
| LINEFEED | C | Emits `\n` on a timer |
| CLOCK | O | Emits a configurable byte on a timer |

#### Routing Machines

| Machine | Key | Description |
|---------|-----|-------------|
| BELT | Q | Directional conveyor |
| SPLITTER | W | Alternates packets between two outputs |
| FLIPPER | V | Rotates output direction clockwise on each byte |
| DUPLICATOR | D | Sends same byte to ALL adjacent output belts (waits for all clear) |
| ROUTER | H | Match byte goes one direction, else goes another |
| GATE | I | Data passes only when control signal opens it (dual-input) |
| WIRELESS | J | Broadcasts to all same-channel wireless machines instantly |
| MERGER | - | Simple passthrough for combining flows |

#### Processing Machines

| Machine | Key | Description |
|---------|-----|-------------|
| COMMAND (Shell) | F | Executes real Unix commands via the VM |
| FILTER | G | Pass or block a specific byte |
| COUNTER | N | Counts bytes, emits count on a trigger byte |
| DELAY | B | Holds packets for a configured duration |
| PACKER | P | Accumulates bytes until delimiter, emits as multi-char packet |
| UNPACKER | U | Receives a packet, dumps all chars one at a time |
| REPLACE | L | Byte substitution (a → b) |
| MATH | M | Byte arithmetic (add/sub/mul/mod/xor/and/or/not), clamped 0–255 |
| LATCH | Y | Stores a data byte, emits it on control signal (dual-input) |

#### Output Machines

| Machine | Key | Description |
|---------|-----|-------------|
| SINK | S | Collects output, displays as text in the sidebar |
| DISPLAY | A | Shows complete lines as speech bubbles above the machine |
| NULL | X | Silently discards packets |

### The Shell Machine (COMMAND)

The most powerful machine. It runs real Unix commands inside an Alpine Linux VM (via [v86](https://github.com/nicknameismy/nicknameismyv86) emulator):

- **Pipe mode** - Collects a complete line of input, runs the command with that line as stdin, emits output
- **Stream mode** - Creates a persistent named pipe (FIFO). Input bytes stream in continuously, output streams back. Useful for stateful commands like `awk` or `sort`
- **Input mode** - Pipe as stdin, or append bytes as command arguments
- **Auto-run** - Execute immediately on simulation start (for commands that don't need input, like `date`)

### Simulation

The simulation loop (`updateSimulation()`) runs every frame:

1. **Emit phase** - Machines with `outputBuffer` emit one character at a time on the `emitDelay` timer (~150ms). Timer-based machines (LINEFEED, CONSTANT, CLOCK) emit on their own intervals.
2. **Delay queue** - DELAY machines release packets whose timers have expired.
3. **Command processing** - Shell machines read/write to the VM. Stream mode polls FIFOs; pipe mode processes complete lines.
4. **Packet movement** - Packets advance along belts. On cell transitions, they're delivered to machines via `deliverToMachine()`, which handles type-specific logic (buffering, filtering, routing, etc.).
5. **Orphan physics** - Stray packets fall with gravity and fade.

Direction-aware delivery: `deliverToMachine()` receives a `fromDir` parameter so GATE and LATCH can distinguish data input from control input.

## Systems

### Event Bus

A typed pub/sub bus (`GameEventBus`) with ~22 events connecting all subsystems:

- **UI events** - `place`, `erase`, `select`, `modeChange`, `placeableChange`, `directionChange`
- **Simulation events** - `simulationStart`, `simulationEnd`
- **Machine events** - `machineReceive`, `sinkReceive`, `commandStart`, `commandComplete`, `streamWrite`
- **Other** - `toast`, `keyPress`, `pack`, `speedChange`

### Renderer

Canvas-based with a camera system (pan with Ctrl+drag, zoom with scroll wheel):

- Draws grid lines, belts (animated directional arrows), splitters, machines (colored boxes with labels), packets (rounded rects colored by char type), speech bubbles, hover tooltips, and a semi-transparent placement preview
- Packets are color-coded: control chars, spaces, lowercase, uppercase, digits, extended ASCII, punctuation
- Machines flash on byte receive (interpolates toward a highlight color)
- Fully themed - all colors come from the active theme

### Themes

Four built-in themes: **Midnight** (default, dark purple/blue), **Monokai**, **Dracula**, **Solarized Dark**. Themes define 50+ color properties spanning canvas, grid, belts, packets, machines, UI chrome, and speech bubbles. Switching is instant - no reload needed.

### Audio

Event-driven sound system connected to the event bus:

- **Ambient loops** - Crossfade between editing and simulation ambient tracks
- **SFX** - Place, erase, select, shell typing, sink receive, stream write, pack
- **Variant support** - e.g. `shellType1`–`shellType6` chosen randomly
- **Pitch variation** - Optional random pitch on SFX
- **Throttling** - Min interval per sound to prevent spam
- Separate volume controls for ambient and machine sounds

### Save/Load

Serializes the full grid and machine state to JSON:

- Grid cells reference machines by index
- Machine properties serialized per-type (only non-default values)
- Backward compatible - handles legacy field names from older versions
- Unknown machine types fall back to NULL on load
- Download as `.json` / upload to restore

### Presets

Programmatically constructed example factories:

- **Sample** - source → grep → sink
- **ROT13** - encode/decode with duplicator paths
- **Uppercase** - source → `tr a-z A-Z` → sink
- **Word Reverser** - source → `rev` → sink

### UI

The sidebar shows:

- **Output panel** - Text received by each sink
- **Stats** - Uptime, active packets, throughput, commands run, errors, avg command time
- **Streams** - Active FIFO stream status
- **Command log** - Recent command executions with duration and error status
- **VM Terminal** - Collapsible direct access to the Linux shell

Each machine type has a configuration modal (command text, intervals, byte selectors, direction pickers, etc.). The `ByteInput` component provides a single-byte picker with support for escape sequences (`\n`, `\t`), hex (`0xFF`), control names (`LF`, `ESC`), and printable characters.

## Controls

| Action | Input |
|--------|-------|
| Place item | Left click |
| Paint belts | Left drag |
| Erase | Right click/drag |
| Pan camera | Ctrl + left drag |
| Select mode | 1 |
| Erase mode | 2 |
| Machine mode | 3 |
| Rotate direction | R |
| Toggle simulation | Space |
| Configure machine | Click in select mode |

## Adding a New Machine Type

Files to modify (in order):

1. **`game/types.ts`** - Add to `MachineType` enum, create interface extending `MachineBase`, add to `Machine` union, add to `PlaceableType`
2. **`game/grid.ts`** - Add case in `placeMachine()` switch
3. **`game/simulation.ts`** - Add to `deliverToMachine()`, `emitFromMachine()`, `updateSimulation()` loop, and `startSimulation()` reset
4. **`render/renderer.ts`** - Add to `MACHINE_COLORS`, `drawMachine()` label, `drawPlacementPreview()`
5. **`ui/InputHandler.ts`** - Add keyboard shortcut, callback, select-mode click handler, `placeCurrentItem()` case
6. **`util/saveload.ts`** - Add to `SerializedMachine`, serialize/deserialize
7. **`util/themes.ts`** - Add colors in `makeTheme()` and default fallback
8. **`index.ts`** - Add to toolbar placeables, machine picker HTML, modal HTML + logic, input callback wiring

## Credits

- [v86](https://copy.sh/v86/) - x86 emulator in JavaScript
- [Alpine Linux](https://alpinelinux.org/) - Minimal Linux distribution
- Inspired by [Factorio](https://factorio.com/)
