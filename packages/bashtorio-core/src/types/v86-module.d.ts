/** Ambient module declaration for the vendored v86 build */
declare module '#v86' {
  import type { V86Config, V86Emulator } from './v86'
  export const V86: new (config: V86Config) => V86Emulator
}
