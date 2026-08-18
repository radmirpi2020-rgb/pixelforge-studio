import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

const app = new App({
  target: document.getElementById('app') as HTMLElement
});

export default app;