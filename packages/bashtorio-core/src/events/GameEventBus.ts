import type { CursorMode, PlaceableType, Direction } from '../game/types';

export interface GameEventMap {
  place: undefined;
  erase: undefined;
  select: undefined;
  simulationStart: undefined;
  simulationEnd: undefined;
  configureStart: undefined;
  machineReceive: { char: string };
  sinkReceive: { char: string };
  modeChange: { mode: CursorMode };
  placeableChange: { placeable: PlaceableType };
  directionChange: { dir: Direction };
  speedChange: { speed: number };
  toast: { message: string };
  keyPress: { char: string };
  commandStart: { machineId: string; command: string; input: string; stream?: boolean };
  commandComplete: { machineId: string; command: string; output: string; durationMs: number; error: boolean; stream?: boolean };
  streamWrite: { machineId: string; bytes: number };
  pack: { machineId: string; length: number };
  saveLoaded: { source: string };
}

export type GameEvent = keyof GameEventMap;

type Callback<E extends GameEvent> = GameEventMap[E] extends undefined
  ? () => void
  : (payload: GameEventMap[E]) => void;

export class GameEventBus {
  private listeners = new Map<GameEvent, Set<Function>>();

  emit<E extends GameEvent>(
    ...args: GameEventMap[E] extends undefined ? [event: E] : [event: E, payload: GameEventMap[E]]
  ): void {
    const [event, payload] = args;
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      cb(payload);
    }
  }

  on<E extends GameEvent>(event: E, callback: Callback<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => {
      set!.delete(callback);
    };
  }

  destroy(): void {
    this.listeners.clear();
  }
}
