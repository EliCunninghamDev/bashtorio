import { Direction, CellType, MachineType, type CursorMode, type PlaceableType, type MachineCell } from '../game/types';
import type { GameState } from '../game/state';
import { getCell, placeBelt, placeSplitter, placeMachine, clearCell, initGrid } from '../game/grid';
import { startSimulation, stopSimulation } from '../game/simulation';
import type { Renderer } from '../render/renderer';
import type { GameEventBus } from '../events/GameEventBus';

export interface InputCallbacks {
  onModeChange?: (mode: CursorMode) => void;
  onPlaceableChange?: (placeable: PlaceableType) => void;
  onDirectionChange?: (dir: Direction) => void;
  onSpeedChange?: (speed: number) => void;
  onRunningChange?: (running: boolean) => void;
  onMachineClick?: (machine: { x: number; y: number; command: string; autoStart: boolean; cwd: string }) => void;
  onLinefeedClick?: (machine: { x: number; y: number; emitInterval: number }) => void;
  onFlipperClick?: (machine: { x: number; y: number; flipperTrigger: string }) => void;
  onSourceTextChange?: (text: string) => void;
  onToast?: (message: string) => void;
}

export class InputHandler {
  private state: GameState;
  private renderer: Renderer;
  private callbacks: InputCallbacks;
  private canvas: HTMLCanvasElement;
  private events: GameEventBus;
  private rightMouseDown = false;
  private rightDragCellType: CellType | null = null;
  private rightDragMachineType: MachineType | null = null;

  constructor(state: GameState, renderer: Renderer, canvas: HTMLCanvasElement, events: GameEventBus, callbacks: InputCallbacks = {}) {
    this.state = state;
    this.renderer = renderer;
    this.callbacks = callbacks;
    this.canvas = canvas;
    this.events = events;
  }

  init(): void {
    // Canvas mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', () => { this.state.mouseDown = false; this.rightMouseDown = false; });
    this.canvas.addEventListener('mouseleave', () => { this.state.mouseDown = false; this.rightMouseDown = false; });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Note: Keyboard events are handled externally via handleKeyDown() to coordinate with v86 blocking
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
  }

  selectMode(mode: CursorMode): void {
    this.state.currentMode = mode;
    this.callbacks.onModeChange?.(mode);
  }

  selectPlaceable(placeable: PlaceableType): void {
    this.state.currentPlaceable = placeable;
    this.callbacks.onPlaceableChange?.(placeable);
  }

  rotateDirection(): void {
    this.state.currentDir = ((this.state.currentDir + 1) % 4) as Direction;
    this.callbacks.onDirectionChange?.(this.state.currentDir);
  }

  setSpeed(speed: number): void {
    this.state.timescale = speed;
    this.callbacks.onSpeedChange?.(speed);
  }

  toggleSimulation(): void {
    if (this.state.running) {
      stopSimulation(this.state);
    } else {
      startSimulation(this.state);
    }
    this.callbacks.onRunningChange?.(this.state.running);
  }

  startSim(): void {
    if (!this.state.running) {
      startSimulation(this.state);
      this.callbacks.onRunningChange?.(true);
    }
  }

  stopSim(): void {
    if (this.state.running) {
      stopSimulation(this.state);
      this.callbacks.onRunningChange?.(false);
    }
  }

  clearAll(): void {
    if (this.state.running) {
      stopSimulation(this.state);
      this.callbacks.onRunningChange?.(false);
    }

    this.state.machines = [];
    this.state.packets = [];
    initGrid(this.state, this.state.gridCols, this.state.gridRows);
  }

  setSourceText(text: string): void {
    this.state.sourceText = text;
    this.callbacks.onSourceTextChange?.(text);
  }

  handleKeyDown(e: KeyboardEvent): void {
    // Don't handle if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      // Mode selection
      case '1':
        this.selectMode('select');
        break;
      case '2':
        this.selectMode('erase');
        break;
      case '3':
        this.selectMode('machine');
        break;

      // Placeable selection (when in machine mode)
      case 'q':
      case 'Q':
        if (this.state.currentMode === 'machine') this.selectPlaceable('belt');
        break;
      case 'w':
      case 'W':
        if (this.state.currentMode === 'machine') this.selectPlaceable('splitter');
        break;
      // E is reserved for machine picker popup
      case 'f':
      case 'F':
        if (this.state.currentMode === 'machine') this.selectPlaceable('command');
        break;
      case 's':
      case 'S':
        if (this.state.currentMode === 'machine') this.selectPlaceable('sink');
        break;
      case 'a':
      case 'A':
        if (this.state.currentMode === 'machine') this.selectPlaceable('display');
        break;
      case 'z':
      case 'Z':
        if (this.state.currentMode === 'machine') this.selectPlaceable('emoji');
        break;
      case 'x':
      case 'X':
        if (this.state.currentMode === 'machine') this.selectPlaceable('null');
        break;
      case 'c':
      case 'C':
        if (this.state.currentMode === 'machine') this.selectPlaceable('linefeed');
        break;
      case 'v':
      case 'V':
        if (this.state.currentMode === 'machine') this.selectPlaceable('flipper');
        break;

      case 'r':
      case 'R':
        this.rotateDirection();
        break;
      case ' ':
        e.preventDefault();
        this.toggleSimulation();
        break;
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    const pos = this.renderer.getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    if (e.button === 0) {
      // Left click
      this.state.mouseDown = true;
      this.handlePlace(pos.x, pos.y);
    } else if (e.button === 2) {
      // Right click - erase and start drag-to-delete matching cells
      const cell = getCell(this.state, pos.x, pos.y);
      if (cell && cell.type !== CellType.EMPTY) {
        this.rightDragCellType = cell.type;
        this.rightDragMachineType = cell.type === CellType.MACHINE ? (cell as MachineCell).machine.type : null;
        clearCell(this.state, pos.x, pos.y);
        this.events.emit('erase');
        this.rightMouseDown = true;
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const pos = this.renderer.getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    // Right-click drag-to-delete matching cells only
    if (this.rightMouseDown) {
      const cell = getCell(this.state, pos.x, pos.y);
      if (cell && cell.type === this.rightDragCellType) {
        if (cell.type !== CellType.MACHINE || (cell as MachineCell).machine.type === this.rightDragMachineType) {
          clearCell(this.state, pos.x, pos.y);
          this.events.emit('erase');
        }
      }
      return;
    }

    if (!this.state.mouseDown) return;

    // Drag painting: erase mode always, machine mode only for belts
    if (this.state.currentMode === 'erase') {
      this.handlePlace(pos.x, pos.y);
    } else if (this.state.currentMode === 'machine' && this.state.currentPlaceable === 'belt') {
      this.handlePlace(pos.x, pos.y);
    }
  }

  private handlePlace(x: number, y: number): void {
    const cell = getCell(this.state, x, y);
    if (!cell) return;

    switch (this.state.currentMode) {
      case 'select':
        // In select mode, clicking a machine opens its config
        if (cell.type === CellType.MACHINE) {
          const machineCell = cell as MachineCell;
          const machine = machineCell.machine;
          if (machine.type === MachineType.COMMAND) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onMachineClick?.({
                x: machine.x,
                y: machine.y,
                command: machine.command,
                autoStart: machine.autoStart,
                cwd: machine.cwd,
              });
            }
          } else if (machine.type === MachineType.LINEFEED) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onLinefeedClick?.({
                x: machine.x,
                y: machine.y,
                emitInterval: machine.emitInterval,
              });
            }
          } else if (machine.type === MachineType.FLIPPER) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onFlipperClick?.({
                x: machine.x,
                y: machine.y,
                flipperTrigger: machine.flipperTrigger,
              });
            }
          }
        }
        break;

      case 'erase':
        if (cell.type !== CellType.EMPTY) {
          clearCell(this.state, x, y);
          this.events.emit('erase');
        }
        break;

      case 'machine':
        this.placeCurrentItem(x, y, cell);
        break;
    }
  }

  private placeCurrentItem(x: number, y: number, cell: ReturnType<typeof getCell>): void {
    if (!cell) return;

    // Special handling for command machine placement/editing
    if (this.state.currentPlaceable === 'command') {
      // If clicking existing command machine, open config instead of replacing
      if (cell.type === CellType.MACHINE) {
        const machineCell = cell as MachineCell;
        const machine = machineCell.machine;
        if (machine.type === MachineType.COMMAND && !this.state.running) {
          this.callbacks.onMachineClick?.({
            x: machine.x,
            y: machine.y,
            command: machine.command,
            autoStart: machine.autoStart,
            cwd: machine.cwd,
          });
          return;
        }
      }
      // Place new command machine (only on empty cells)
      if (cell.type === CellType.EMPTY) {
        const machine = placeMachine(this.state, x, y, MachineType.COMMAND);
        if (machine) {
          this.callbacks.onMachineClick?.({
            x: machine.x,
            y: machine.y,
            command: machine.command,
            autoStart: machine.autoStart,
            cwd: machine.cwd,
          });
          this.events.emit('place');
        }
      }
      return;
    }

    // Only place on empty cells
    if (cell.type !== CellType.EMPTY) return;

    switch (this.state.currentPlaceable) {
      case 'belt':
        placeBelt(this.state, x, y, this.state.currentDir);
        break;
      case 'splitter':
        placeSplitter(this.state, x, y, this.state.currentDir);
        break;
      case 'source':
        placeMachine(this.state, x, y, MachineType.SOURCE);
        break;
      case 'sink':
        placeMachine(this.state, x, y, MachineType.SINK);
        break;
      case 'display':
        placeMachine(this.state, x, y, MachineType.DISPLAY);
        break;
      case 'emoji':
        placeMachine(this.state, x, y, MachineType.EMOJI);
        break;
      case 'null':
        placeMachine(this.state, x, y, MachineType.NULL);
        break;
      case 'linefeed':
        placeMachine(this.state, x, y, MachineType.LINEFEED);
        break;
      case 'flipper':
        const flipperMachine = placeMachine(this.state, x, y, MachineType.FLIPPER);
        if (flipperMachine) {
          flipperMachine.flipperDir = this.state.currentDir;
          flipperMachine.flipperState = this.state.currentDir;
          this.callbacks.onFlipperClick?.({
            x: flipperMachine.x,
            y: flipperMachine.y,
            flipperTrigger: flipperMachine.flipperTrigger,
          });
        }
        break;
    }

    this.events.emit('place');
  }

  // Method to update machine config (called from UI after modal)
  updateMachineConfig(x: number, y: number, command: string, autoStart: boolean): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine) {
      machine.command = command || 'cat';
      machine.autoStart = autoStart;
    }
  }

  updateLinefeedConfig(x: number, y: number, emitInterval: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine) {
      machine.emitInterval = emitInterval;
    }
  }

  updateFlipperConfig(x: number, y: number, flipperTrigger: string): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine) {
      machine.flipperTrigger = flipperTrigger || '\n';
    }
  }
}
