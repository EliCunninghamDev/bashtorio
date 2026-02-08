# Bashtorio

**Factorio meets Bash** - build conveyor belt factories that process data through real Unix commands running in a Linux VM in your browser.

Place sources, route bytes along belts, pipe them through `grep`, `sed`, `awk`, or any other command, and collect output in sinks. Every Shell machine runs actual commands inside an Alpine Linux system emulated in-browser via [v86](https://copy.sh/v86/).

## How It Works

In Unix, a **pipe** connects the output of one program to the input of another:

```
echo "hello" | tr a-z A-Z
```

The shell creates an anonymous pipe - a small kernel buffer - between the two processes. `echo` writes bytes in, `tr` reads them out. No files on disk, no intermediate copies.

```
  echo "hello"          tr a-z A-Z
       |                    ^
       |  ┌──────────────┐  |
       └─>│ kernel buffer │──┘
          └──────────────┘
            anonymous pipe
```

Bashtorio takes this idea and makes it visual. Bytes are physical objects that ride conveyor belts between machines. When a byte reaches a Shell machine, it gets piped into a real Unix command running inside the VM.

### Shell Machine Modes

**Pipe mode** (default) - each incoming byte/line is piped to the command as stdin. The command runs, produces output, and exits.

**Stream mode** - creates a persistent named pipe (FIFO) on the guest filesystem. The command stays alive and bytes stream through continuously. This is how stateful commands like `awk` or `sort` work without restarting on every byte.

**Input mode** - choose whether bytes arrive as stdin or as command arguments.

**Auto-run** - execute immediately on simulation start, for commands that don't need input (like `date`).

### The VM Under the Hood

The v86 emulator runs a full x86 CPU in JavaScript/WebAssembly, booting a real Linux kernel with a real filesystem. Each Shell machine gets its own shell session with an independent working directory - just like having multiple terminal windows open.

## Controls

| Action | Input |
|--------|-------|
| Place item | Left click (in Place mode) |
| Paint belts | Left click + drag |
| Erase | Right click or drag |
| Pan camera | Ctrl + left drag |
| Zoom | Scroll wheel |
| Select mode | `1` |
| Erase mode | `2` |
| Place mode | `3` |
| Rotate direction | `R` |
| Toggle simulation | `Space` |
| Open machine picker | `E` |
| Configure machine | Click in Select mode |

### Machine Shortcuts (Place mode)

| Key | Machine | | Key | Machine |
|-----|---------|-|-----|---------|
| `Q` | Belt | | `P` | Packer |
| `W` | Splitter | | `U` | Unpacker |
| `F` | Shell | | `H` | Router |
| `S` | Sink | | `I` | Gate |
| `A` | Display | | `J` | Wireless |
| `X` | Null | | `L` | Replace |
| `C` | Linefeed | | `M` | Math |
| `V` | Flipper | | `O` | Clock |
| `D` | Duplicator | | `Y` | Latch |
| `T` | Constant | | `Z` | 7-Segment |
| `G` | Filter | | | Drum (picker only) |
| `N` | Counter | | | Tone (picker only) |
| `B` | Delay | | | Merger (picker only) |
| `K` | Keyboard | | | |

During simulation, press the keyboard button to enter **passthrough mode** - keystrokes go directly to Keyboard machines. Press `Esc` to exit.

## Machines

### Sources
- **Source** - emits configured text, one character at a time
- **Constant** - loops text forever at a set interval
- **Keyboard** - emits real keypresses during simulation
- **Linefeed** - emits `\n` on a timer
- **Clock** - emits a configurable byte on a timer

### Routing
- **Belt** - directional conveyor that carries packets
- **Splitter** - alternates packets between two output directions (2-cell machine)
- **Flipper** - rotates output direction clockwise on each byte received
- **Duplicator** - sends same byte to all adjacent output belts simultaneously
- **Router** - matching bytes go one direction, everything else goes another
- **Gate** - data passes only when a control signal opens it (dual-input)
- **Wireless** - broadcasts to all same-channel wireless machines instantly
- **Merger** - combines multiple input flows into one output

### Processing
- **Shell** - executes real Unix commands via the VM (pipe or stream mode)
- **Filter** - passes or blocks a specific byte value
- **Counter** - counts bytes, emits the count on a trigger byte
- **Delay** - holds packets for a configured duration
- **Packer** - accumulates bytes until a delimiter, then emits them as one multi-char packet
- **Unpacker** - receives a packet and re-emits each character individually
- **Replace** - byte substitution (a -> b)
- **Math** - byte arithmetic (add/sub/mul/mod/xor/and/or/not), clamped 0-255
- **Latch** - stores a data byte, emits it when a control signal arrives (dual-input)

### Output
- **Sink** - collects output and displays it as text in the sidebar
- **Display** - shows complete lines as speech bubbles above the machine
- **Null** - silently discards packets
- **7-Segment** - visual hex display of the last byte received
- **Drum** - plays a drum sound based on the byte value, passes it through
- **Tone** - synthesizer that maps byte values to audio frequencies (configurable waveform)

## Development

### Prerequisites

- Node.js
- [pnpm](https://pnpm.io/)

### Setup

```sh
pnpm install
pnpm setup          # download BIOS images
pnpm build:rootfs   # build Alpine Linux rootfs (requires Docker)
pnpm build:state    # boot the VM and save a pre-booted snapshot
pnpm dev            # dev server with HMR
```

`pnpm build` does a production build (tsc + vite + astro).

#### Rebuilding v86

The v86 emulator (`libv86.mjs` + `v86.wasm`) is built from source and vendored into the repo, so most developers don't need to rebuild it. If you do need to:

```sh
pnpm build:v86   # requires Rust (wasm32-unknown-unknown), Clang, Java
```

This builds from the `.v86-tools` checkout (pinned to a known-good commit) and copies artifacts to `packages/bashtorio-core/vendor/v86/` and `apps/web/public/v86/`.

### Project Structure

```
bashtorio/
├── packages/bashtorio-core/   # Core game library (TypeScript)
│   └── src/
│       ├── game/              # Types, grid, simulation, machines, packets
│       ├── render/            # Canvas renderer
│       ├── ui/                # Components, modals, editor, toolbar
│       ├── vm/                # v86 Linux VM integration
│       ├── audio/             # Sound + tone synthesis
│       ├── events/            # Typed event bus
│       ├── util/              # Themes, save/load, presets, settings
│       └── index.ts           # mount() entry point
└── apps/web/                  # Astro frontend (thin shell)
    └── src/
        ├── pages/index.astro
        └── scripts/game.ts    # Calls mount()
```

The core library exports a `mount()` function. The Astro app calls it and serves static assets (VM images, sounds).

### VM Assets

The v86 JS module is vendored at `packages/bashtorio-core/vendor/v86/libv86.mjs` (committed to git). The remaining runtime files go in `apps/web/public/v86/` (gitignored):
- `v86.wasm` - emulator WebAssembly (built by `pnpm build:v86`)
- `seabios.bin`, `vgabios.bin` - BIOS images (downloaded by `pnpm setup`)
- `alpine-fs.json` + `alpine-rootfs-flat/` - filesystem (built by `pnpm build:rootfs`)
- `alpine-state.bin` - pre-booted VM snapshot (built by `pnpm build:state`)

For Cloudflare Pages deployment, `alpine-state.bin` (73MB) is served from R2 via the `PUBLIC_STATE_URL` environment variable.

### Adding a New Machine Type

You'll need to touch: `types.ts`, `machines.ts`, `simulation.ts`, `renderer.ts`, `editor.ts`, `placeableButton.ts`, `saveload.ts`, `themes.ts`, and optionally a config modal + keyboard shortcut.

## Credits

- [v86](https://copy.sh/v86/) - x86 emulator in JavaScript/WebAssembly
- [Alpine Linux](https://alpinelinux.org/) - minimal Linux distribution
- Inspired by [Factorio](https://factorio.com/)
