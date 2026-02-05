# 🏭 Bashtorio

**A Unix Pipe Factory Game** - Factorio meets Bash

Build conveyor belt pipelines that process data through real Unix commands running in a Linux VM in your browser!

## Features

- **Real Linux VM** - Uses v86 to run actual Alpine Linux in your browser
- **Real Commands** - `cat`, `tr`, `grep`, `sed`, `awk`, and more
- **Visual Pipeline** - Watch data flow through your factory
- **UTF-8 Display** - See emoji and unicode in speech bubbles

## Quick Start

```bash
# Install dependencies (includes v86)
npm install

# Setup v86 files (copies + downloads ~30MB Linux image)
npm run setup

# Start local server
npx serve public

# Open http://localhost:3000
```

## Deploy to Cloudflare Pages

```bash
npm run deploy
```

Or connect GitHub and set:
- Build command: `npm run build`
- Output directory: `public`

**Note:** The `_headers` file sets required CORS headers for SharedArrayBuffer.

## Controls

| Key | Action |
|-----|--------|
| 1-7 | Select tool |
| R | Rotate direction |
| Space | Run/Stop simulation |
| Left Click | Place item |
| Right Click | Delete item |
| Drag | Paint belts |

## Tools

- **Belt** - Conveyor belt, moves packets in a direction
- **Splitter** - Alternates packets between two outputs
- **SRC** - Source, emits your input text as packets
- **CMD** - Command machine, processes data through a real Unix command
- **SINK** - Collects output and displays it
- **UTF8** - Displays complete lines as speech bubbles
- **DEL** - Eraser

## Example Pipelines

### Uppercase Converter
```
[SRC] → → → [tr a-z A-Z] → → → [SINK]
```

### Filter + Transform
```
[SRC] → → → [grep hello] → → → [tr a-z A-Z] → → → [SINK]
```

### Splitter Demo
```
                    → → [tr a-z A-Z] → → 
                   ↗                      ↘
[SRC] → → [SPLIT]                          [SINK]
                   ↘                      ↗
                    → → → [cat] → → → → → 
```

## Available Commands

All standard Unix coreutils are available:

- **Text:** `cat`, `head`, `tail`, `rev`, `tr`, `cut`, `sort`, `uniq`
- **Search:** `grep`, `sed`, `awk`
- **Encode:** `base64`, `md5sum`, `sha256sum`
- **Count:** `wc`, `nl`
- **And more!**

## Architecture

```
┌─────────────────────────────────────────────┐
│                Browser                       │
│  ┌─────────────────────────────────────┐    │
│  │         Game UI (Canvas)             │    │
│  │   Belts → Packets → Machines         │    │
│  └─────────────────────────────────────┘    │
│                    │                         │
│                    ▼                         │
│  ┌─────────────────────────────────────┐    │
│  │        v86 Emulator (WASM)           │    │
│  │   ┌─────────────────────────────┐   │    │
│  │   │       Alpine Linux           │   │    │
│  │   │   BusyBox + Coreutils        │   │    │
│  │   └─────────────────────────────┘   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Credits

- [v86](https://copy.sh/v86/) - x86 emulator in JavaScript
- [Alpine Linux](https://alpinelinux.org/) - Minimal Linux distribution
- Inspired by [Factorio](https://factorio.com/)

## License

MIT
