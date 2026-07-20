import { mount } from 'svelte';
import '@fontsource/press-start-2p/400.css';
import App from './App.svelte';
import './global.css';

const app = mount(App, {
	target: /** @type {HTMLElement} */ (document.getElementById('app'))
});

export default app;
