import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Deploy base — IIS / Cloudflare Pages serve the app at /olympussnap/
const APP_BASE = '/olympussnap';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				runes: true
			}
		})
	],
	base: `${APP_BASE}/`,
	server: {
		https: false,
		proxy: {
			'/api': {
				target: 'http://localhost:6101',
				changeOrigin: true
			}
		}
	}
});
