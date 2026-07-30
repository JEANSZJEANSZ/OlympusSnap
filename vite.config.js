import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Same Vite deploy recipe as Training/FrontEnd
export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				runes: true
			}
		})
	],
	base: '/olympussnap/',
	server: {
		https: false
	}
});
