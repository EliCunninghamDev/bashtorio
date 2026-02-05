import { mount, type BashtorioInstance } from 'bashtorio-core';

declare global {
  interface Window {
    bashtorio?: BashtorioInstance;
  }
}

const app = document.getElementById('app');

if (app) {
  mount({
    container: app,
    assetsPath: '/v86',
    soundAssetsUrl: '/sounds',
    basefs: 'alpine-fs.json',
    stateImage: 'alpine-state.bin',
    onBootStatus: (status) => console.log('[Boot]', status),
    onReady: () => console.log('Game ready!'),
    onError: (err) => console.error('Boot error:', err),
  }).then(instance => {
    window.bashtorio = instance;
    console.log('Dev tip: Run window.bashtorio.downloadState() to save VM state');
  });
}
