import { emitGameEvent, onGameEvent } from '../events/bus';

// ---------------------------------------------------------------------------
// Speech Engine - Web SpeechSynthesis wrapper for SPEAK machines
// ---------------------------------------------------------------------------

let muted = false;
let voicesAvailable = false;

function checkVoices(): void {
  if (typeof speechSynthesis === 'undefined') return;
  voicesAvailable = speechSynthesis.getVoices().length > 0;
}

export function hasVoices(): boolean {
  return voicesAvailable;
}

function cancelAll(): void {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel();
  }
}

export function connectSpeechEvents(): void {
  checkVoices();
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.addEventListener('voiceschanged', checkVoices);
  }

  onGameEvent('speak', ({ text, rate, pitch }) => {
    if (muted) return;
    if (typeof speechSynthesis === 'undefined' || !voicesAvailable) {
      const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
      emitGameEvent('toast', { message: `No speech voices available: "${preview}"` });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    speechSynthesis.speak(utterance);
  });

  onGameEvent('speakCancel', () => {
    cancelAll();
  });

  onGameEvent('muteChanged', ({ muted: m }) => {
    muted = m;
    if (m) cancelAll();
  });

  onGameEvent('simulationEnded', () => {
    cancelAll();
  });
}

export function destroySpeech(): void {
  cancelAll();
}
