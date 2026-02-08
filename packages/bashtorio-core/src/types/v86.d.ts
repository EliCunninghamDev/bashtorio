/** Type declarations for v86 emulator */

export interface V86Config {
  wasm_path: string;
  memory_size: number;
  vga_memory_size: number;
  screen_container: HTMLElement | null;
  bios: { url: string };
  vga_bios: { url: string };
  cdrom?: { url: string };
  hda?: { url: string };
  autostart: boolean;
  network_relay_url?: string;
  initial_state?: { url: string };
  filesystem?: { baseurl: string; basefs?: string } | Record<string, never>;
  bzimage_initrd_from_filesystem?: boolean;
  cmdline?: string;
}

export interface V86Emulator {
  add_listener(event: string, callback: (data: number) => void): void;
  remove_listener(event: string, callback: (data: number) => void): void;
  serial0_send(data: string): void;
  keyboard_send_scancodes(scancodes: number[]): void;
  keyboard_set_status(enabled: boolean): void;
  is_running(): boolean;
  stop(): void;
  restart(): void;
  destroy(): void;
  save_state(): Promise<ArrayBuffer>;
  restore_state(state: ArrayBuffer): Promise<void>;
  create_file(path: string, data: Uint8Array): Promise<void>;
  read_file(path: string): Promise<Uint8Array>;
}
