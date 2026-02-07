import { Direction, CellType, MachineType, type CursorMode, type PlaceableType, type MachineCell, type Machine, type SinkMachine } from '../game/types';
import type { GameState } from '../game/state';
import { getCell, placeBelt, placeSplitter, placeMachine, clearCell, initGrid, getSplitterSecondary } from '../game/grid';
import { startSimulation, stopSimulation } from '../game/simulation';
import type { Renderer } from '../render/renderer';
import type { GameEventBus } from '../events/GameEventBus';

export interface InputCallbacks {
  onModeChange?: (mode: CursorMode) => void;
  onPlaceableChange?: (placeable: PlaceableType) => void;
  onDirectionChange?: (dir: Direction) => void;
  onSpeedChange?: (speed: number) => void;
  onRunningChange?: (running: boolean) => void;
  onMachineClick?: (machine: { x: number; y: number; command: string; autoStart: boolean; stream: boolean; inputMode: 'pipe' | 'args'; cwd: string }) => void;
  onLinefeedClick?: (machine: { x: number; y: number; emitInterval: number }) => void;
  onFlipperClick?: (machine: { x: number; y: number; flipperDir: number }) => void;
  onConstantClick?: (machine: { x: number; y: number; constantText: string; emitInterval: number }) => void;
  onFilterClick?: (machine: { x: number; y: number; filterByte: string; filterMode: 'pass' | 'block' }) => void;
  onCounterClick?: (machine: { x: number; y: number; counterTrigger: string }) => void;
  onDelayClick?: (machine: { x: number; y: number; delayMs: number }) => void;
  onSourceClick?: (machine: { x: number; y: number; sourceText: string; emitInterval: number }) => void;
  onPackerClick?: (machine: { x: number; y: number; packerDelimiter: string; preserveDelimiter: boolean }) => void;
  onRouterClick?: (machine: { x: number; y: number; routerByte: string; routerMatchDir: number; routerElseDir: number }) => void;
  onGateClick?: (machine: { x: number; y: number; gateDataDir: number; gateControlDir: number }) => void;
  onWirelessClick?: (machine: { x: number; y: number; wirelessChannel: number }) => void;
  onReplaceClick?: (machine: { x: number; y: number; replaceFrom: string; replaceTo: string }) => void;
  onMathClick?: (machine: { x: number; y: number; mathOp: string; mathOperand: number }) => void;
  onClockClick?: (machine: { x: number; y: number; clockByte: string; emitInterval: number }) => void;
  onLatchClick?: (machine: { x: number; y: number; latchDataDir: number; latchControlDir: number }) => void;
  onSinkClick?: (machine: SinkMachine) => void;
  onMachineDelete?: (machine: Machine) => void;
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
  private panning = false;
  private panStartScreenX = 0;
  private panStartScreenY = 0;
  private panStartCamX = 0;
  private panStartCamY = 0;

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
    this.canvas.addEventListener('mouseup', () => {
      this.state.mouseDown = false;
      this.rightMouseDown = false;
      this.stopPan();
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.state.mouseDown = false;
      this.rightMouseDown = false;
      this.stopPan();
    });
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
    this.state.orphanedPackets = [];
    initGrid(this.state, this.state.gridCols, this.state.gridRows);
  }

  updateSourceConfig(x: number, y: number, sourceText: string, emitInterval: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.SOURCE) {
      machine.sourceText = sourceText;
      machine.emitInterval = emitInterval;
    }
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
      case 'd':
      case 'D':
        if (this.state.currentMode === 'machine') this.selectPlaceable('duplicator');
        break;
      case 't':
      case 'T':
        if (this.state.currentMode === 'machine') this.selectPlaceable('constant');
        break;
      case 'g':
      case 'G':
        if (this.state.currentMode === 'machine') this.selectPlaceable('filter');
        break;
      case 'n':
      case 'N':
        if (this.state.currentMode === 'machine') this.selectPlaceable('counter');
        break;
      case 'b':
      case 'B':
        if (this.state.currentMode === 'machine') this.selectPlaceable('delay');
        break;
      case 'k':
      case 'K':
        if (this.state.currentMode === 'machine') this.selectPlaceable('keyboard');
        break;
      case 'p':
      case 'P':
        if (this.state.currentMode === 'machine') this.selectPlaceable('packer');
        break;
      case 'u':
      case 'U':
        if (this.state.currentMode === 'machine') this.selectPlaceable('unpacker');
        break;
      case 'h':
      case 'H':
        if (this.state.currentMode === 'machine') this.selectPlaceable('router');
        break;
      case 'i':
      case 'I':
        if (this.state.currentMode === 'machine') this.selectPlaceable('gate');
        break;
      case 'j':
      case 'J':
        if (this.state.currentMode === 'machine') this.selectPlaceable('wireless');
        break;
      case 'l':
      case 'L':
        if (this.state.currentMode === 'machine') this.selectPlaceable('replace');
        break;
      case 'm':
      case 'M':
        if (this.state.currentMode === 'machine') this.selectPlaceable('math');
        break;
      case 'o':
      case 'O':
        if (this.state.currentMode === 'machine') this.selectPlaceable('clock');
        break;
      case 'y':
      case 'Y':
        if (this.state.currentMode === 'machine') this.selectPlaceable('latch');
        break;
      case 'z':
      case 'Z':
        if (this.state.currentMode === 'machine') this.selectPlaceable('sevenseg');
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
    // Ctrl+left-click: start panning
    if (e.button === 0 && e.ctrlKey) {
      this.panning = true;
      this.panStartScreenX = e.clientX;
      this.panStartScreenY = e.clientY;
      this.panStartCamX = this.state.camera.x;
      this.panStartCamY = this.state.camera.y;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

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
        if (cell.type === CellType.MACHINE) {
          this.callbacks.onMachineDelete?.((cell as MachineCell).machine);
        }
        clearCell(this.state, pos.x, pos.y);
        this.events.emit('erase');
        this.rightMouseDown = true;
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    // Panning: update camera from screen-space delta
    if (this.panning) {
      const cam = this.state.camera;
      const dx = e.clientX - this.panStartScreenX;
      const dy = e.clientY - this.panStartScreenY;
      cam.x = this.panStartCamX - dx / cam.scale;
      cam.y = this.panStartCamY - dy / cam.scale;
      return;
    }

    const pos = this.renderer.getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    // Right-click drag-to-delete matching cells only
    if (this.rightMouseDown) {
      const cell = getCell(this.state, pos.x, pos.y);
      if (cell && cell.type === this.rightDragCellType) {
        if (cell.type !== CellType.MACHINE || (cell as MachineCell).machine.type === this.rightDragMachineType) {
          if (cell.type === CellType.MACHINE) {
            this.callbacks.onMachineDelete?.((cell as MachineCell).machine);
          }
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
                stream: machine.stream,
                inputMode: machine.inputMode,
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
                flipperDir: machine.flipperDir,
              });
            }
          } else if (machine.type === MachineType.CONSTANT) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onConstantClick?.({
                x: machine.x,
                y: machine.y,
                constantText: machine.constantText,
                emitInterval: machine.emitInterval,
              });
            }
          } else if (machine.type === MachineType.FILTER) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onFilterClick?.({
                x: machine.x,
                y: machine.y,
                filterByte: machine.filterByte,
                filterMode: machine.filterMode,
              });
            }
          } else if (machine.type === MachineType.COUNTER) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onCounterClick?.({
                x: machine.x,
                y: machine.y,
                counterTrigger: machine.counterTrigger,
              });
            }
          } else if (machine.type === MachineType.DELAY) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onDelayClick?.({
                x: machine.x,
                y: machine.y,
                delayMs: machine.delayMs,
              });
            }
          } else if (machine.type === MachineType.SOURCE) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onSourceClick?.({
                x: machine.x,
                y: machine.y,
                sourceText: machine.sourceText,
                emitInterval: machine.emitInterval,
              });
            }
          } else if (machine.type === MachineType.PACKER) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onPackerClick?.({
                x: machine.x,
                y: machine.y,
                packerDelimiter: machine.packerDelimiter,
                preserveDelimiter: machine.preserveDelimiter,
              });
            }
          } else if (machine.type === MachineType.ROUTER) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onRouterClick?.({
                x: machine.x,
                y: machine.y,
                routerByte: machine.routerByte,
                routerMatchDir: machine.routerMatchDir,
                routerElseDir: machine.routerElseDir,
              });
            }
          } else if (machine.type === MachineType.GATE) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onGateClick?.({
                x: machine.x,
                y: machine.y,
                gateDataDir: machine.gateDataDir,
                gateControlDir: machine.gateControlDir,
              });
            }
          } else if (machine.type === MachineType.WIRELESS) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onWirelessClick?.({
                x: machine.x,
                y: machine.y,
                wirelessChannel: machine.wirelessChannel,
              });
            }
          } else if (machine.type === MachineType.REPLACE) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onReplaceClick?.({
                x: machine.x,
                y: machine.y,
                replaceFrom: machine.replaceFrom,
                replaceTo: machine.replaceTo,
              });
            }
          } else if (machine.type === MachineType.MATH) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onMathClick?.({
                x: machine.x,
                y: machine.y,
                mathOp: machine.mathOp,
                mathOperand: machine.mathOperand,
              });
            }
          } else if (machine.type === MachineType.CLOCK) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onClockClick?.({
                x: machine.x,
                y: machine.y,
                clockByte: machine.clockByte,
                emitInterval: machine.emitInterval,
              });
            }
          } else if (machine.type === MachineType.LATCH) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onLatchClick?.({
                x: machine.x,
                y: machine.y,
                latchDataDir: machine.latchDataDir,
                latchControlDir: machine.latchControlDir,
              });
            }
          } else if (machine.type === MachineType.SINK) {
            if (this.state.running) {
              this.callbacks.onToast?.('Stop the simulation to edit machines!');
            } else {
              this.callbacks.onSinkClick?.(machine as SinkMachine);
            }
          }
        }
        break;

      case 'erase':
        if (cell.type !== CellType.EMPTY) {
          if (cell.type === CellType.MACHINE) {
            this.callbacks.onMachineDelete?.((cell as MachineCell).machine);
          }
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
            stream: machine.stream,
            inputMode: machine.inputMode,
            cwd: machine.cwd,
          });
          return;
        }
      }
      // Place new command machine (only on empty cells)
      if (cell.type === CellType.EMPTY) {
        const machine = placeMachine(this.state, x, y, MachineType.COMMAND);
        if (machine && machine.type === MachineType.COMMAND) {
          this.callbacks.onMachineClick?.({
            x: machine.x,
            y: machine.y,
            command: machine.command,
            autoStart: machine.autoStart,
            stream: machine.stream,
            inputMode: machine.inputMode,
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
      case 'splitter': {
        const sec = getSplitterSecondary({ dir: this.state.currentDir, x, y });
        const secCell = getCell(this.state, sec.x, sec.y);
        if (!secCell || secCell.type !== CellType.EMPTY) return;
        placeSplitter(this.state, x, y, this.state.currentDir);
        break;
      }
      case 'source': {
        const sourceMachine = placeMachine(this.state, x, y, MachineType.SOURCE);
        if (sourceMachine && sourceMachine.type === MachineType.SOURCE) {
          this.callbacks.onSourceClick?.({
            x: sourceMachine.x,
            y: sourceMachine.y,
            sourceText: sourceMachine.sourceText,
            emitInterval: sourceMachine.emitInterval,
          });
        }
        break;
      }
      case 'sink':
        placeMachine(this.state, x, y, MachineType.SINK);
        break;
      case 'display':
        placeMachine(this.state, x, y, MachineType.DISPLAY);
        break;
      case 'null':
        placeMachine(this.state, x, y, MachineType.NULL);
        break;
      case 'linefeed':
        placeMachine(this.state, x, y, MachineType.LINEFEED);
        break;
      case 'flipper': {
        const flipperMachine = placeMachine(this.state, x, y, MachineType.FLIPPER);
        if (flipperMachine && flipperMachine.type === MachineType.FLIPPER) {
          flipperMachine.flipperDir = this.state.currentDir;
          flipperMachine.flipperState = this.state.currentDir;
          this.callbacks.onFlipperClick?.({
            x: flipperMachine.x,
            y: flipperMachine.y,
            flipperDir: flipperMachine.flipperDir,
          });
        }
        break;
      }
      case 'duplicator':
        placeMachine(this.state, x, y, MachineType.DUPLICATOR);
        break;
      case 'constant': {
        const constantMachine = placeMachine(this.state, x, y, MachineType.CONSTANT);
        if (constantMachine && constantMachine.type === MachineType.CONSTANT) {
          this.callbacks.onConstantClick?.({
            x: constantMachine.x,
            y: constantMachine.y,
            constantText: constantMachine.constantText,
            emitInterval: constantMachine.emitInterval,
          });
        }
        break;
      }
      case 'filter': {
        const filterMachine = placeMachine(this.state, x, y, MachineType.FILTER);
        if (filterMachine && filterMachine.type === MachineType.FILTER) {
          this.callbacks.onFilterClick?.({
            x: filterMachine.x,
            y: filterMachine.y,
            filterByte: filterMachine.filterByte,
            filterMode: filterMachine.filterMode,
          });
        }
        break;
      }
      case 'counter': {
        const counterMachine = placeMachine(this.state, x, y, MachineType.COUNTER);
        if (counterMachine && counterMachine.type === MachineType.COUNTER) {
          this.callbacks.onCounterClick?.({
            x: counterMachine.x,
            y: counterMachine.y,
            counterTrigger: counterMachine.counterTrigger,
          });
        }
        break;
      }
      case 'delay': {
        const delayMachine = placeMachine(this.state, x, y, MachineType.DELAY);
        if (delayMachine && delayMachine.type === MachineType.DELAY) {
          this.callbacks.onDelayClick?.({
            x: delayMachine.x,
            y: delayMachine.y,
            delayMs: delayMachine.delayMs,
          });
        }
        break;
      }
      case 'keyboard':
        placeMachine(this.state, x, y, MachineType.KEYBOARD);
        break;
      case 'unpacker':
        placeMachine(this.state, x, y, MachineType.UNPACKER);
        break;
      case 'packer': {
        const packerMachine = placeMachine(this.state, x, y, MachineType.PACKER);
        if (packerMachine && packerMachine.type === MachineType.PACKER) {
          packerMachine.packerDir = this.state.currentDir;
          this.callbacks.onPackerClick?.({
            x: packerMachine.x,
            y: packerMachine.y,
            packerDelimiter: packerMachine.packerDelimiter,
            preserveDelimiter: packerMachine.preserveDelimiter,
          });
        }
        break;
      }
      case 'router': {
        const routerMachine = placeMachine(this.state, x, y, MachineType.ROUTER);
        if (routerMachine && routerMachine.type === MachineType.ROUTER) {
          this.callbacks.onRouterClick?.({
            x: routerMachine.x,
            y: routerMachine.y,
            routerByte: routerMachine.routerByte,
            routerMatchDir: routerMachine.routerMatchDir,
            routerElseDir: routerMachine.routerElseDir,
          });
        }
        break;
      }
      case 'gate': {
        const gateMachine = placeMachine(this.state, x, y, MachineType.GATE);
        if (gateMachine && gateMachine.type === MachineType.GATE) {
          this.callbacks.onGateClick?.({
            x: gateMachine.x,
            y: gateMachine.y,
            gateDataDir: gateMachine.gateDataDir,
            gateControlDir: gateMachine.gateControlDir,
          });
        }
        break;
      }
      case 'wireless': {
        const wirelessMachine = placeMachine(this.state, x, y, MachineType.WIRELESS);
        if (wirelessMachine && wirelessMachine.type === MachineType.WIRELESS) {
          this.callbacks.onWirelessClick?.({
            x: wirelessMachine.x,
            y: wirelessMachine.y,
            wirelessChannel: wirelessMachine.wirelessChannel,
          });
        }
        break;
      }
      case 'replace': {
        const replaceMachine = placeMachine(this.state, x, y, MachineType.REPLACE);
        if (replaceMachine && replaceMachine.type === MachineType.REPLACE) {
          this.callbacks.onReplaceClick?.({
            x: replaceMachine.x,
            y: replaceMachine.y,
            replaceFrom: replaceMachine.replaceFrom,
            replaceTo: replaceMachine.replaceTo,
          });
        }
        break;
      }
      case 'math': {
        const mathMachine = placeMachine(this.state, x, y, MachineType.MATH);
        if (mathMachine && mathMachine.type === MachineType.MATH) {
          this.callbacks.onMathClick?.({
            x: mathMachine.x,
            y: mathMachine.y,
            mathOp: mathMachine.mathOp,
            mathOperand: mathMachine.mathOperand,
          });
        }
        break;
      }
      case 'clock': {
        const clockMachine = placeMachine(this.state, x, y, MachineType.CLOCK);
        if (clockMachine && clockMachine.type === MachineType.CLOCK) {
          this.callbacks.onClockClick?.({
            x: clockMachine.x,
            y: clockMachine.y,
            clockByte: clockMachine.clockByte,
            emitInterval: clockMachine.emitInterval,
          });
        }
        break;
      }
      case 'latch': {
        const latchMachine = placeMachine(this.state, x, y, MachineType.LATCH);
        if (latchMachine && latchMachine.type === MachineType.LATCH) {
          this.callbacks.onLatchClick?.({
            x: latchMachine.x,
            y: latchMachine.y,
            latchDataDir: latchMachine.latchDataDir,
            latchControlDir: latchMachine.latchControlDir,
          });
        }
        break;
      }
      case 'merger':
        placeMachine(this.state, x, y, MachineType.MERGER);
        break;
      case 'sevenseg':
        placeMachine(this.state, x, y, MachineType.SEVENSEG);
        break;
    }

    this.events.emit('place');
  }

  private stopPan(): void {
    if (this.panning) {
      this.panning = false;
      this.renderer.updateCursor(this.state.currentMode);
    }
  }

  // Method to update machine config (called from UI after modal)
  updateMachineConfig(x: number, y: number, command: string, autoStart: boolean): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.COMMAND) {
      machine.command = command || 'cat';
      machine.autoStart = autoStart;
    }
  }

  updateLinefeedConfig(x: number, y: number, emitInterval: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.LINEFEED) {
      machine.emitInterval = emitInterval;
    }
  }

  updateFlipperConfig(x: number, y: number, flipperDir: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.FLIPPER) {
      machine.flipperDir = flipperDir;
      machine.flipperState = flipperDir;
    }
  }

  updateConstantConfig(x: number, y: number, constantText: string, emitInterval: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.CONSTANT) {
      machine.constantText = constantText || 'hello\n';
      machine.emitInterval = emitInterval;
    }
  }

  updateFilterConfig(x: number, y: number, filterByte: string, filterMode: 'pass' | 'block'): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.FILTER) {
      machine.filterByte = filterByte || '\n';
      machine.filterMode = filterMode;
    }
  }

  updateCounterConfig(x: number, y: number, counterTrigger: string): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.COUNTER) {
      machine.counterTrigger = counterTrigger || '\n';
    }
  }

  updateDelayConfig(x: number, y: number, delayMs: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.DELAY) {
      machine.delayMs = delayMs;
    }
  }

  updatePackerConfig(x: number, y: number, packerDelimiter: string, preserveDelimiter: boolean): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.PACKER) {
      machine.packerDelimiter = packerDelimiter || '\n';
      machine.preserveDelimiter = preserveDelimiter;
    }
  }

  updateRouterConfig(x: number, y: number, routerByte: string, routerMatchDir: number, routerElseDir: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.ROUTER) {
      machine.routerByte = routerByte || '\n';
      machine.routerMatchDir = routerMatchDir;
      machine.routerElseDir = routerElseDir;
    }
  }

  updateGateConfig(x: number, y: number, gateDataDir: number, gateControlDir: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.GATE) {
      machine.gateDataDir = gateDataDir;
      machine.gateControlDir = gateControlDir;
    }
  }

  updateWirelessConfig(x: number, y: number, wirelessChannel: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.WIRELESS) {
      machine.wirelessChannel = wirelessChannel;
    }
  }

  updateReplaceConfig(x: number, y: number, replaceFrom: string, replaceTo: string): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.REPLACE) {
      machine.replaceFrom = replaceFrom || 'a';
      machine.replaceTo = replaceTo || 'b';
    }
  }

  updateMathConfig(x: number, y: number, mathOp: string, mathOperand: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.MATH) {
      machine.mathOp = mathOp as any;
      machine.mathOperand = Math.max(0, Math.min(255, mathOperand));
    }
  }

  updateClockConfig(x: number, y: number, clockByte: string, emitInterval: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.CLOCK) {
      machine.clockByte = clockByte || '*';
      machine.emitInterval = emitInterval;
    }
  }

  updateLatchConfig(x: number, y: number, latchDataDir: number, latchControlDir: number): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.LATCH) {
      machine.latchDataDir = latchDataDir;
      machine.latchControlDir = latchControlDir;
    }
  }

  updateSinkConfig(x: number, y: number, name: string): void {
    const machine = this.state.machines.find(m => m.x === x && m.y === y);
    if (machine && machine.type === MachineType.SINK) {
      machine.name = name || `Sink ${machine.sinkId}`;
    }
  }
}
