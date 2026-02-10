import { CellType, MachineType, Direction, type Cell, type MachineCell, type Machine, type PlaceableType } from '../game/types';
import type { GameState } from '../game/state';
import { getCell } from '../game/grid';
import { getSplitterSecondary } from '../game/edit';
import { placeBelt, placeSplitter, placeMachine, clearCell } from '../game/edit';
import { emitGameEvent, onGameEvent, type GameEventMap } from '../events/bus';

/** Maps PlaceableType names (excluding belt/splitter which have special placement) to MachineType */
const PLACEABLE_TO_MACHINE: Partial<Record<PlaceableType, MachineType>> = {
    source: MachineType.SOURCE,
    sink: MachineType.SINK,
    command: MachineType.COMMAND,
    display: MachineType.DISPLAY,
    null: MachineType.NULL,
    linefeed: MachineType.LINEFEED,
    duplicator: MachineType.DUPLICATOR,

    filter: MachineType.FILTER,
    counter: MachineType.COUNTER,
    delay: MachineType.DELAY,
    keyboard: MachineType.KEYBOARD,
    flipper: MachineType.FLIPPER,
    packer: MachineType.PACKER,
    unpacker: MachineType.UNPACKER,
    router: MachineType.ROUTER,
    gate: MachineType.GATE,
    wireless: MachineType.WIRELESS,
    replace: MachineType.REPLACE,
    math: MachineType.MATH,
    clock: MachineType.CLOCK,
    latch: MachineType.LATCH,

    sevenseg: MachineType.SEVENSEG,
    drum: MachineType.DRUM,
    tone: MachineType.TONE,
    speak: MachineType.SPEAK,
    screen: MachineType.SCREEN,
    byte: MachineType.BYTE,
    punchcard: MachineType.PUNCHCARD,
    tnt: MachineType.TNT,
    button: MachineType.BUTTON,
};

/** Machines that open their config modal immediately on placement */
const CONFIG_ON_PLACE = new Set<MachineType>([
    MachineType.COMMAND,
    MachineType.SOURCE,
    MachineType.FLIPPER,

    MachineType.FILTER,
    MachineType.COUNTER,
    MachineType.DELAY,
    MachineType.PACKER,
    MachineType.ROUTER,
    MachineType.GATE,
    MachineType.WIRELESS,
    MachineType.REPLACE,
    MachineType.MATH,
    MachineType.CLOCK,
    MachineType.LATCH,
    MachineType.DRUM,
    MachineType.TONE,
    MachineType.SPEAK,
    MachineType.SCREEN,
    MachineType.BYTE,
    MachineType.PUNCHCARD,
    MachineType.BUTTON,
]);

export class Editor {
    private state: GameState;

    private erasingType: CellType | null = null;
    private placing = false;

    constructor(state: GameState) {
        this.state = state;

        onGameEvent('rotate', this.rotate.bind(this));
        onGameEvent('+erase', this.startErase.bind(this));
        onGameEvent('-erase', this.stopErase.bind(this));
        onGameEvent('+place', this.startPlace.bind(this));
        onGameEvent('-place', this.stopPlace.bind(this));
        onGameEvent('gridMouseMove', this.handleGridMouseMove.bind(this));
        onGameEvent('selectPlaceable', this.handleSelectPlaceable.bind(this));
        onGameEvent('modeChange', this.handleModeChange.bind(this));
    }

    // --- State changes ---

    private rotate() {
        this.state.currentDir = ((this.state.currentDir + 1) % 4) as Direction;
        emitGameEvent('directionChange', { dir: this.state.currentDir });
    }

    private handleModeChange({ mode }: GameEventMap['modeChange']) {
        this.state.currentMode = mode;
    }

    private handleSelectPlaceable({ placeable }: GameEventMap['selectPlaceable']) {
        this.state.currentPlaceable = placeable;
        emitGameEvent('placeableChange', { placeable });
    }

    // --- Erase ---

    private startErase({ grid_x, grid_y }: GameEventMap['+erase']) {
        const cell = getCell(grid_x, grid_y);
        if (cell.type === CellType.EMPTY) {
            this.erasingType = null;
            return;
        }

        if (cell.type === CellType.MACHINE && this.state.running) {
            emitGameEvent('editFailed', { message: 'Stop the simulation to remove machines' });
            this.erasingType = null;
            return;
        }

        if (cell.type === CellType.MACHINE) {
            emitGameEvent('machineDelete', { machine: (cell as MachineCell).machine });
        }
        this.erasingType = cell.type;
        clearCell(grid_x, grid_y);
        emitGameEvent('erase');
    }

    private stopErase() {
        this.erasingType = null;
    }

    // --- Place ---

    private startPlace({ grid_x, grid_y }: GameEventMap['+place']) {
        this.placing = true;
        this.handlePlace(grid_x, grid_y);
    }

    private stopPlace() {
        this.placing = false;
    }

    private handlePlace(x: number, y: number): void {
        const cell = getCell(x, y);

        switch (this.state.currentMode) {
            case 'select':
                this.handleSelect(cell);
                break;
            case 'erase':
                if (cell.type !== CellType.EMPTY) {
                    if (cell.type === CellType.MACHINE && this.state.running) {
                        emitGameEvent('editFailed', { message: 'Stop the simulation to remove machines' });
                        break;
                    }
                    if (cell.type === CellType.MACHINE) {
                        emitGameEvent('machineDelete', { machine: (cell as MachineCell).machine });
                    }
                    clearCell(x, y);
                    emitGameEvent('erase');
                }
                break;
            case 'machine':
                this.placeCurrentItem(x, y, cell);
                break;
        }
    }

    private handleSelect(cell: Cell): void {
        if (cell.type !== CellType.MACHINE) return;
        const machine = (cell as MachineCell).machine;

        if (this.state.running) {
            emitGameEvent('machineInteract', { machine });
            return;
        }

        emitGameEvent('configureMachine', { machine });
    }

    private placeCurrentItem(x: number, y: number, cell: Cell): void {
        // Clicking an existing machine in machine mode - configure if it's the same type
        if (cell.type === CellType.MACHINE) {
            const machine = (cell as MachineCell).machine;
            if (this.state.currentPlaceable === 'command' && machine.type === MachineType.COMMAND && !this.state.running) {
                emitGameEvent('configureMachine', { machine });
            }
            return;
        }

        if (cell.type !== CellType.EMPTY) return;

        // Machines can only be placed while the simulation is stopped
        if (this.state.currentPlaceable !== 'belt' && this.state.running) {
            emitGameEvent('editFailed', { message: 'Stop the simulation to place machines' });
            return;
        }

        const placed = this.placeItem(x, y);
        // placeItem returns null for belts (success) and failed placements;
        // check the cell to distinguish.
        if (placed || getCell(x, y).type !== CellType.EMPTY) {
            emitGameEvent('place');
        }
        if (placed && CONFIG_ON_PLACE.has(placed.type)) {
            emitGameEvent('configureMachine', { machine: placed });
        }
    }

    private placeItem(x: number, y: number): Machine | null {
        const dir = this.state.currentDir;

        switch (this.state.currentPlaceable) {
            case 'belt':
                placeBelt(x, y, dir);
                return null;

            case 'splitter': {
                const sec = getSplitterSecondary({ dir, x, y });
                const secCell = getCell(sec.x, sec.y);
                if (secCell.type !== CellType.EMPTY) return null;
                return placeSplitter(x, y, dir);
            }

            default: {
                const mt = PLACEABLE_TO_MACHINE[this.state.currentPlaceable];
                if (mt != null) return placeMachine(x, y, mt, dir);
                return null;
            }
        }
    }

    // --- Grid mouse move (drag paint / drag erase) ---

    private handleGridMouseMove({ gridX, gridY }: GameEventMap['gridMouseMove']) {
        // Drag-erase: delete cells matching the type of the first erased cell
        if (this.erasingType) {
            const cell = getCell(gridX, gridY);
            if (cell.type === this.erasingType) {
                if (cell.type === CellType.MACHINE && this.state.running) return;
                if (cell.type === CellType.MACHINE) {
                    emitGameEvent('machineDelete', { machine: (cell as MachineCell).machine });
                }
                clearCell(gridX, gridY);
                emitGameEvent('erase');
            }
        }

        // Drag-paint: belts in machine mode, or any cell in erase mode
        if (this.placing) {
            if (this.state.currentMode === 'machine' && this.state.currentPlaceable === 'belt') {
                this.handlePlace(gridX, gridY);
            } else if (this.state.currentMode === 'erase') {
                this.handlePlace(gridX, gridY);
            }
        }
    }
}
