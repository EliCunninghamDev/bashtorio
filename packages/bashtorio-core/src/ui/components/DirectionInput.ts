// ---------------------------------------------------------------------------
// DirectionInput – D-pad style direction picker with radio inputs
// ---------------------------------------------------------------------------

import { Direction } from '../../game/types'

export type DirectionVariant = 'outward' | 'inward'

export interface DirectionInputOptions {
  value?: number
  variant?: DirectionVariant
  onChange?: (dir: number) => void
}

let instanceCounter = 0

// Outward arrows: point away from center
const OUTWARD_ARROWS: Record<Direction, string> = {
  [Direction.UP]: '\u2191',
  [Direction.RIGHT]: '\u2192',
  [Direction.DOWN]: '\u2193',
  [Direction.LEFT]: '\u2190',
}

// Inward arrows: point toward center
const INWARD_ARROWS: Record<Direction, string> = {
  [Direction.UP]: '\u2193',
  [Direction.RIGHT]: '\u2190',
  [Direction.DOWN]: '\u2191',
  [Direction.LEFT]: '\u2192',
}

const GRID_AREAS: Record<Direction, string> = {
  [Direction.UP]: 'up',
  [Direction.RIGHT]: 'right',
  [Direction.DOWN]: 'down',
  [Direction.LEFT]: 'left',
}

export class DirectionInput {
  readonly el: HTMLElement
  private currentValue: number
  private onChange: ((dir: number) => void) | undefined
  private radios: HTMLInputElement[] = []

  constructor(options?: DirectionInputOptions) {
    this.currentValue = options?.value ?? Direction.RIGHT
    this.onChange = options?.onChange
    this.el = this.buildDOM(options?.variant ?? 'outward')
    this.syncChecked()
  }

  getValue(): number {
    return this.currentValue
  }

  setValue(dir: number): void {
    this.currentValue = dir
    this.syncChecked()
  }

  focus(): void {
    const checked = this.radios.find(r => r.checked)
    ;(checked ?? this.radios[0])?.focus()
  }

  // -----------------------------------------------------------------------
  // DOM
  // -----------------------------------------------------------------------

  private buildDOM(variant: DirectionVariant): HTMLElement {
    const root = document.createElement('div')
    root.className = 'dir-input'

    const name = `dir-${instanceCounter++}`
    const arrows = variant === 'inward' ? INWARD_ARROWS : OUTWARD_ARROWS

    for (const dir of [Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT]) {
      const label = document.createElement('label')
      label.className = 'dir-input-btn'
      label.style.gridArea = GRID_AREAS[dir]

      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = name
      radio.value = String(dir)

      const span = document.createElement('span')
      span.textContent = arrows[dir]

      label.appendChild(radio)
      label.appendChild(span)
      root.appendChild(label)

      radio.addEventListener('change', () => {
        this.currentValue = dir
        this.onChange?.(dir)
      })

      this.radios.push(radio)
    }

    return root
  }

  private syncChecked(): void {
    for (const radio of this.radios) {
      radio.checked = parseInt(radio.value) === this.currentValue
    }
  }
}
