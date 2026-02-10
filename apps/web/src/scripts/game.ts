import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import { mount, setLogLevel, type BashtorioInstance } from 'bashtorio-core';

const STATE_BASE_PATH = import.meta.env.PUBLIC_STATE_BASE_PATH;
const STATE_FILENAME = import.meta.env.PUBLIC_STATE_FILENAME || 'alpine-state.bin';
const STATE_URL = STATE_BASE_PATH ? `${STATE_BASE_PATH}/${STATE_FILENAME}` : STATE_FILENAME;

if (import.meta.env.DEV) setLogLevel('debug');

declare global {
  interface Window {
    bashtorio?: BashtorioInstance;
  }
}

const app = document.getElementById('app');

if (app) {
  mount({
    container: app,
    vmAssetsUrl: '/v86',
    assets: { soundsUrl: '/sounds', spritesUrl: '/sprites' },
    rootfsManifest: 'alpine-fs.json',
    vmStateUrl: STATE_URL,
    onBootStatus: (status) => console.log('[Boot]', status),
    onReady: () => console.log('Game ready!'),
    onError: (err) => console.error('Boot error:', err),
  }).then(instance => {
    window.bashtorio = instance;
    console.log('Dev tip: Run window.bashtorio.downloadState() to save VM state');
  });
}
