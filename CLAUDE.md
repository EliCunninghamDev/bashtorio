# CLAUDE.md - Bashtorio Development Instructions

## Project Overview

Bashtorio is a Factorio-inspired browser game where players build conveyor belt factories that process data through real Unix commands running in an in-browser Linux VM. Monorepo with two packages:

- `packages/bashtorio-core/` - Core TypeScript library (game logic, renderer, UI, VM integration)
- `apps/web/` - Thin Astro frontend that calls `mount()` and serves assets

## Build & Verify

```sh
pnpm install          # install deps
pnpm build            # tsc + vite (core) → astro build (web)
pnpm dev              # dev server with HMR
pnpm --filter bashtorio-core typecheck   # type-check core without building
```

**Always run `pnpm --filter bashtorio-core typecheck` after making changes.** There are no tests - the type checker is the primary verification tool. Fix all type errors before considering work complete.

## Architecture - Singleton Modules

The game uses **module-level singletons** instead of dependency injection. Do NOT create new singleton instances or duplicate state. Import from these canonical locations:

| Module | Owns | Import as |
|--------|------|-----------|
| `game/machines.ts` | `machines: Machine[]`, sink ID counter | `import { machines } from './machines'` |
| `game/grid.ts` | ChunkedGrid (cell data) | `import { getCell, ... } from './grid'` |
| `game/camera.ts` | x, y, scale, canvas size | `import * as cam from './game/camera'` |
| `game/clock.ts` | `now()`, `delta()`, `tick()` | `import { now, delta } from './clock'` |
| `game/vm.ts` | LinuxVM instance | `import * as vm from './game/vm'` |
| `events/bus.ts` | Event listeners map | `import { emitGameEvent, onGameEvent } from '../events/bus'` |

## Event Bus - Use It

The event bus (`events/bus.ts`) is the **primary coupling mechanism** between subsystems. All cross-module communication should go through it.

**Rules:**
1. When adding new behavior that responds to user actions or simulation events, **wire it through the event bus** - don't call functions directly across module boundaries.
2. When adding a new feature that other modules might need to react to, **define a new event** in `GameEventMap` with a descriptive name and typed payload.
3. Events are grouped by owning module (commented sections in `GameEventMap`). Add new events under the correct section, or create a new section with a comment.
4. Pattern: `onGameEvent('eventName', handler)` to subscribe, `emitGameEvent('eventName', payload)` to publish.
5. If you're unsure whether something warrants a new event, **propose the event** in your plan before implementing.

**Current event categories:** editor actions, pointer/keyboard input, toolbar controls, camera, simulation lifecycle, machine I/O, save/load, modals/UI.

## Type Architecture - Discriminated Unions

`Machine` is a **discriminated union** (25 variants) with `type: MachineType` as the discriminant. Related unions and guards:

- `BufferingMachine` - subset of machines with `outputBuffer: string`
- `EmittingMachine` - subset with `emitInterval` / `lastEmitTime`
- `hasOutputBuffer(m): m is BufferingMachine` - type guard
- `hasEmitTimer(m): m is EmittingMachine` - type guard

**Rules:**
1. Never use `any` or type assertions to work around the union. Use narrowing (`switch`, `if`, type guards).
2. When adding a variant, update ALL unions and guards it belongs to.
3. `PlaceableType` is a separate union of types the player can place - update it too.
4. Exhaustive switches: if you switch on `machine.type`, handle every case or use a `default` with `never` check.

## Adding a New Machine Type

This is the most common change. You **must** touch all of these files - missing any will cause bugs or type errors:

1. **`game/types.ts`** - Add to `MachineType` enum → create interface extending `MachineBase` (+ `EmitTimer` if timer-based) → add to `Machine` union → add to `PlaceableType` → add to `BufferingMachine` / `EmittingMachine` if applicable
2. **`game/machines.ts`** - Add defaults function + case in `createMachine()`
3. **`game/simulation.ts`** - Add to `deliverToMachine()`, `emitFromMachine()`, `updateSimulation()` loop, `startSimulation()` reset
4. **`render/renderer.ts`** - Add to `MACHINE_COLORS`, `drawMachine()` label switch, `drawPlacementPreview()` switch. The visual design should express the machine's function and buffer state (e.g. show fill level, directional flow, active/idle).
5. **`ui/editor.ts`** - **CRITICAL:** Add entry to `PLACEABLE_TO_MACHINE` map (without this, the machine won't be placeable). Add to `CONFIG_ON_PLACE` if it should open a config modal on placement.
6. **`ui/placeableButton.ts`** - Add to `PLACEABLE_COLUMNS` (this also feeds the machine picker)
7. **`ui/` (modals)** - Add keyboard shortcut in `editorInput.ts` if a key is available, config modal if needed
8. **`util/saveload.ts`** - Add to `SerializedMachine`, `serializeMachine()`, `deserializeMachine()`
9. **`util/themes.ts`** - Add color in `fromPalette()` AND `MIDNIGHT` default theme
10. **`index.ts`** - Add modal element + event wiring (only if machine has a config modal)

Emit relevant **game events** from new machines (e.g. `machineReceive` when receiving a byte).

## Code Style

- **TypeScript strict mode** - no `any`, no implicit returns, no unused variables
- **2-space indent**, no semicolons in some files (follow the existing file's convention)
- **Named exports** - no default exports
- **camelCase** for functions/variables, **PascalCase** for types/classes/enums
- **`type` imports** for type-only imports: `import type { Foo } from './bar'`
- Section dividers: `// ----------- Section Name -----------`
- Minimal comments - only where logic isn't self-evident
- Prefer editing existing files over creating new ones

## Patterns to Follow

- **Machines that receive + re-emit** (FLIPPER, COMMAND, FILTER, etc.) need both `deliverToMachine` AND `emitFromMachine` handling
- **Direction-aware delivery:** `deliverToMachine()` has a `fromDir?: Direction` param for dual-input machines (GATE, LATCH)
- **Output finding:** `findMachineOutput()` returns first belt in R/D/L/U order; `findFlipperOutputs()` returns ALL adjacent belts
- **Config modals** extend `BaseModal` - follow existing modal patterns in `ui/modals/`
- **Emit delay machines** use `outputBuffer` + the shared emit timer in `updateSimulation()`
- **Timer machines** (SOURCE, LINEFEED, CONSTANT, CLOCK) use `EmitTimer` and emit on their own interval

## UI Components

- **`<bt-event-button>`** (`ui/eventButton.ts`) - Use this for any UI button that only needs to emit a void game event on click. Set the `event` attribute to the event name. Don't create custom button elements or inline click handlers when an EventButton would suffice.

## Things to Avoid

- Don't create wrapper classes around singleton modules
- Don't add new global state outside the established singleton modules
- Don't bypass the event bus with direct cross-module function calls for UI↔simulation communication
- Don't use string literals for machine types - always use `MachineType.X`
- Don't add npm dependencies without asking - the core has only `lit-html` as a runtime dep
- Don't modify the v86 VM integration (`vm/LinuxVM.ts`) without understanding the FIFO streaming architecture
- Don't create test files (there's no test framework set up)

## Key Files Reference

| Purpose | Path |
|---------|------|
| All types + enums | `game/types.ts` |
| Machine instances | `game/machines.ts` |
| Grid data | `game/grid.ts` + `game/ChunkedGrid.ts` |
| Grid editing (place/clear) | `game/edit.ts` |
| Simulation loop | `game/simulation.ts` |
| Packet creation/helpers | `game/packets.ts` |
| Event bus | `events/bus.ts` |
| Canvas renderer | `render/renderer.ts` |
| Save/load | `util/saveload.ts` |
| Themes | `util/themes.ts` |
| Presets | `util/presets.ts` |
| Main entry + mount | `index.ts` |

All paths relative to `packages/bashtorio-core/src/`.

