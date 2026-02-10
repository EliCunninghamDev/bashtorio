import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import { mount, setLogLevel, type BashtorioInstance } from 'bashtorio-core';

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
    vmSnapshot: import.meta.env.PUBLIC_STATE_URL || (import.meta.env.PUBLIC_STATE_FILE || 'alpine-state.bin'),
    onBootStatus: (status) => console.log('[Boot]', status),
    onReady: () => console.log('Game ready!'),
    onError: (err) => console.error('Boot error:', err),
  }).then(instance => {
    window.bashtorio = instance;
    console.log('Dev tip: Run window.bashtorio.downloadState() to save VM state');
  });
}
