// Import all modal elements (registers custom elements as side effects)
import './LinefeedModal';
import './FlipperModal';
import './DelayModal';
import './WirelessModal';
import './SinkModal';
import './FilterModal';
import './CounterModal';
import './PackerModal';
import './RouterModal';
import './ClockModal';
import './ReplaceModal';
import './GateModal';
import './LatchModal';
import './MathModal';
import './ConstantModal';
import './SourceModal';
import './CommandModal';
import './ToneModal';
import './SpeakModal';
import './ScreenModal';
import './ByteModal';
import './HelpModal';
import './ManualModal';
import './AcknowledgementsModal';
import './PresetsModal';
import './NetworkModal';
import './SettingsModal';

import { MachineType, type Machine } from '../../game/types';
import { emitGameEvent, onGameEvent } from '../../events/bus';
import type { LinefeedModal } from './LinefeedModal';
import type { FlipperModal } from './FlipperModal';
import type { DelayModal } from './DelayModal';
import type { WirelessModal } from './WirelessModal';
import type { SinkModal } from './SinkModal';
import type { FilterModal } from './FilterModal';
import type { CounterModal } from './CounterModal';
import type { PackerModal } from './PackerModal';
import type { RouterModal } from './RouterModal';
import type { ClockModal } from './ClockModal';
import type { ReplaceModal } from './ReplaceModal';
import type { GateModal } from './GateModal';
import type { LatchModal } from './LatchModal';
import type { MathModal } from './MathModal';
import type { ConstantModal } from './ConstantModal';
import type { SourceModal } from './SourceModal';
import type { CommandModal } from './CommandModal';
import type { ToneModal } from './ToneModal';
import type { SpeakModal } from './SpeakModal';
import type { ScreenModal } from './ScreenModal';
import type { ByteModal } from './ByteModal';
import type { HelpModal } from './HelpModal';
import type { ManualModal } from './ManualModal';
import type { AcknowledgementsModal } from './AcknowledgementsModal';
import type { PresetsModal } from './PresetsModal';
import type { NetworkModal } from './NetworkModal';
import type { SettingsModal } from './SettingsModal';

export interface ModalHandles {
  openNetwork: () => void;
  openPresets: () => void;
  openSettings: () => void;
  openHelp: () => void;
  openManual: () => void;
  updateNetworkUI: () => void;
}

export function setupModals(
  container: HTMLElement,
  acknowledgements: { name: string; version: string; license: string; author?: string; url?: string }[],
): ModalHandles {
  const root = container.querySelector('.bashtorio-root') as HTMLElement;
  const systembar = container.querySelector('.bashtorio-systembar') as HTMLElement;

  // Query custom elements
  const commandModal = container.querySelector('bt-command-modal') as CommandModal;
  const sourceModal = container.querySelector('bt-source-modal') as SourceModal;
  const linefeedModal = container.querySelector('bt-linefeed-modal') as LinefeedModal;
  const flipperModal = container.querySelector('bt-flipper-modal') as FlipperModal;
  const constantModal = container.querySelector('bt-constant-modal') as ConstantModal;
  const filterModal = container.querySelector('bt-filter-modal') as FilterModal;
  const counterModal = container.querySelector('bt-counter-modal') as CounterModal;
  const delayModal = container.querySelector('bt-delay-modal') as DelayModal;
  const packerModal = container.querySelector('bt-packer-modal') as PackerModal;
  const routerModal = container.querySelector('bt-router-modal') as RouterModal;
  const gateModal = container.querySelector('bt-gate-modal') as GateModal;
  const wirelessModal = container.querySelector('bt-wireless-modal') as WirelessModal;
  const replaceModal = container.querySelector('bt-replace-modal') as ReplaceModal;
  const mathModal = container.querySelector('bt-math-modal') as MathModal;
  const clockModal = container.querySelector('bt-clock-modal') as ClockModal;
  const latchModal = container.querySelector('bt-latch-modal') as LatchModal;
  const toneModal = container.querySelector('bt-tone-modal') as ToneModal;
  const speakModal = container.querySelector('bt-speak-modal') as SpeakModal;
  const screenModal = container.querySelector('bt-screen-modal') as ScreenModal;
  const byteModal = container.querySelector('bt-byte-modal') as ByteModal;
  const sinkModal = container.querySelector('bt-sink-modal') as SinkModal;
  const networkModal = container.querySelector('bt-network-modal') as NetworkModal;
  const presetsModal = container.querySelector('bt-presets-modal') as PresetsModal;
  const settingsModal = container.querySelector('bt-settings-modal') as SettingsModal;
  const helpModal = container.querySelector('bt-help-modal') as HelpModal;
  const manualModal = container.querySelector('bt-manual-modal') as ManualModal;
  const ackModal = container.querySelector('bt-acknowledgements-modal') as AcknowledgementsModal;

  // Initialize dependencies
  networkModal.init({ systembar });
  settingsModal.init({ root });
  ackModal.init({ data: acknowledgements });

  // Wire acknowledgements button in settings to open ack modal
  settingsModal.ackOpenBtn.addEventListener('click', () => ackModal.open());

  // Route configureMachine events to the correct modal
  onGameEvent('configureMachine', ({ machine }) => {
    emitGameEvent('configureStart');
    openMachineConfig(machine);
  });

  function openMachineConfig(machine: Machine) {
    switch (machine.type) {
      case MachineType.COMMAND:
        commandModal.configure(machine);
        break;
      case MachineType.SOURCE:
        sourceModal.configure(machine);
        break;
      case MachineType.LINEFEED:
        linefeedModal.configure(machine);
        break;
      case MachineType.FLIPPER:
        flipperModal.configure(machine);
        break;
      case MachineType.CONSTANT:
        constantModal.configure(machine);
        break;
      case MachineType.FILTER:
        filterModal.configure(machine);
        break;
      case MachineType.COUNTER:
        counterModal.configure(machine);
        break;
      case MachineType.DELAY:
        delayModal.configure(machine);
        break;
      case MachineType.PACKER:
        packerModal.configure(machine);
        break;
      case MachineType.ROUTER:
        routerModal.configure(machine);
        break;
      case MachineType.GATE:
        gateModal.configure(machine);
        break;
      case MachineType.WIRELESS:
        wirelessModal.configure(machine);
        break;
      case MachineType.REPLACE:
        replaceModal.configure(machine);
        break;
      case MachineType.MATH:
        mathModal.configure(machine);
        break;
      case MachineType.CLOCK:
        clockModal.configure(machine);
        break;
      case MachineType.LATCH:
        latchModal.configure(machine);
        break;
      case MachineType.SINK:
        sinkModal.configure(machine);
        break;
      case MachineType.TONE:
        toneModal.configure(machine);
        break;
      case MachineType.SPEAK:
        speakModal.configure(machine);
        break;
      case MachineType.SCREEN:
        screenModal.configure(machine);
        break;
      case MachineType.BYTE:
        byteModal.configure(machine);
        break;
    }
  }

  return {
    openNetwork: () => networkModal.open(),
    openPresets: () => presetsModal.open(),
    openSettings: () => settingsModal.open(),
    openHelp: () => helpModal.open(),
    openManual: () => manualModal.open(),
    updateNetworkUI: () => networkModal.updateNetworkUI(),
  };
}
