import { V86Bridge } from './bridge';
import { ShellInstance } from './shell';
import { createLogger } from '../util/logger';

const log = createLogger('VM');

export interface VMConfig {
	/** Base URL for v86 assets (wasm, bios, etc.) */
	vmAssetsUrl: string;
	/** VM state snapshot identifier (URL or filename relative to vmAssetsUrl) */
	vmStateUrl: string;
	/** Base URL for the 9p rootfs flat directory */
	rootfsBaseUrl?: string;
	/** 9p rootfs JSON manifest filename */
	rootfsManifest: string;
	/** Container element for the VGA screen */
	screenContainer: HTMLElement;
	/** Pre-downloaded ArrayBuffers keyed by URL (from preload progress bar) */
	preloadBuffers?: Record<string, ArrayBuffer>;
	/** Status callback during boot */
	onStatus?: (status: string) => void;
}

/**
 * Facade composing V86Bridge + ShellInstance creation.
 * Preserves the public API surface that game/vm.ts consumes.
 */
export class LinuxVM {
	private bridge = new V86Bridge();

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	async init(config: VMConfig): Promise<void> {
		await this.bridge.init(config);
	}

	destroy(): void {
		this.bridge.destroy();
	}

	// ---------------------------------------------------------------------------
	// Shell lifecycle
	// ---------------------------------------------------------------------------

	async createShell(initialCwd?: string): Promise<ShellInstance> {
		const shell = new ShellInstance(this.bridge);
		await shell.start(initialCwd);
		return shell;
	}

	// ---------------------------------------------------------------------------
	// State / keyboard
	// ---------------------------------------------------------------------------

	async saveState(): Promise<ArrayBuffer> {
		return this.bridge.saveState();
	}

	async downloadState(filename?: string): Promise<void> {
		return this.bridge.downloadState(filename);
	}

	setKeyboardEnabled(enabled: boolean): void {
		this.bridge.setKeyboardEnabled(enabled);
	}

	// ---------------------------------------------------------------------------
	// VM test
	// ---------------------------------------------------------------------------

	async test(): Promise<boolean> {
		let shell: ShellInstance | null = null;
		try {
			shell = new ShellInstance(this.bridge, '_test');
			await shell.start('/');
			await new Promise(r => setTimeout(r, 1000));
			shell.write('echo test123\n');
			for (let i = 0; i < 20; i++) {
				await new Promise(r => setTimeout(r, 1000));
				const output = await shell.read();
				if (output.includes('test123')) {
					log.info('Test: PASS');
					return true;
				}
			}
			log.warn('Test: FAIL (no output after 20s)');
			return false;
		} catch (e) {
			log.error('Test failed:', e);
			return false;
		} finally {
			await shell?.stop();
		}
	}

	// ---------------------------------------------------------------------------
	// Accessors (delegate to bridge)
	// ---------------------------------------------------------------------------

	get ready(): boolean { return this.bridge.ready; }
	get fs9pReady(): boolean { return this.bridge.fs9pReady; }
	get networkRelay(): string | null { return this.bridge.networkRelay; }
}
