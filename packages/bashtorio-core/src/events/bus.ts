import type { CursorMode as editorTool, PlaceableType, Direction, Machine, SinkMachine } from '../game/types';

export interface GameEventMap {
  // -- editor.ts (grid editing actions) --
  select: undefined;
  place: undefined;
  erase: undefined;
  machineDelete: { machine: Machine };
  configureMachine: { machine: Machine };
  directionChange: { dir: Direction };
  placeableChange: { placeable: PlaceableType };

  // -- editorInput.ts (pointer & keyboard → events) --
  '+place': { grid_x: number; grid_y: number };
  '-place': undefined;
  '+erase': { grid_x: number; grid_y: number };
  '-erase': undefined;
  '+pan': { screenX: number; screenY: number };
  panMove: { screenX: number; screenY: number };
  '-pan': undefined;
  gridMouseMove: { gridX: number; gridY: number };
  selectPlaceable: { placeable: PlaceableType };
  modeChange: { mode: editorTool };
  rotate: undefined;

  // -- index.ts (keyboard router / focus) --
  editorKeyPress: { key: string; preventDefault: () => void };
  simulationKeyPress: { char: string };
  focusModeChange: { mode: 'editor' | 'simulationPassthrough' | 'virtualMachine' };
  panHold: { held: boolean };

  // -- toolbar.ts (toolbar UI controls + bt-event-button children) --
  zoomIn: undefined;
  zoomOut: undefined;
  zoomSet: { scale: number };
  speedSet: { speed: number };
  beltSpeedSet: { beltSpeed: number };
  startSimulation: undefined;
  endSimulation: undefined;
  clearAll: undefined;
  muteToggle: undefined;
  requestSave: undefined;
  requestLoad: undefined;
  requestCopyLink: undefined;
  requestKeyboardFocus: undefined;
  cameraToFactory: undefined;
  openNetwork: undefined;
  openPresets: undefined;
  openSettings: undefined;
  openHelp: undefined;
  openManual: undefined;

  // -- camera.ts --
  zoomChanged: { scale: number };

  // -- commands.ts (command handler responses) --
  speedChanged: { speed: number };
  beltSpeedChanged: { beltSpeed: number };
  muteChanged: { muted: boolean };

  // -- simulation.ts --
  simulationStarted: undefined;
  simulationEnded: undefined;
  vmStatusChange: { status: 'ready' | 'busy' | 'error' };
  machineReceive: { char: string };
  sinkReceive: { char: string };
  sinkOutput: { sink: SinkMachine; content: string };
  commandStart: { machineId: string; command: string; input: string; inputMode?: 'pipe' | 'args'; stream?: boolean };
  commandComplete: { machineId: string; command: string; output: string; durationMs: number; error: boolean; stream?: boolean };
  streamWrite: { machineId: string; bytes: number };
  pack: { machineId: string; length: number };
  drumHit: { sample: number };
  toneNote: { machineId: string; byte: number; waveform: OscillatorType };
  speak: { text: string; rate: number; pitch: number };
  speakCancel: undefined;

  // -- saveload.ts --
  saveLoaded: { source: string };
  loadPresetByName: { id: string };
  requestLoadURL: undefined;

  // -- editor.ts --
  editFailed: { message: string };

  // -- modals --
  configureStart: undefined;
  toast: { message: string };
  sinkRename: { machine: SinkMachine };

}

export type GameEvent = keyof GameEventMap;

type Callback<E extends GameEvent> = GameEventMap[E] extends undefined
  ? () => void
  : (payload: GameEventMap[E]) => void;

const listeners = new Map<GameEvent, Set<Function>>();

export function emitGameEvent<E extends GameEvent>(
  ...args: GameEventMap[E] extends undefined ? [event: E] : [event: E, payload: GameEventMap[E]]
): void {
  const [event, payload] = args;
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) {
    cb(payload);
  }
}

export function onGameEvent<E extends GameEvent>(event: E, callback: Callback<E>): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
  };
}

export function destroyGameEvents(): void {
  listeners.clear();
}
