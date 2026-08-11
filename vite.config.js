import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Deploy base — IIS / Cloudflare Pages serve the app at /olympussnap/
const APP_BASE = '/olympussnap';

const DEV_API = 'http://localhost:6101';
const PROD_API = 'https://sfapi.smartfactory.forum';

export default defineConfig(({ mode }) => {
	// Optional override via OS env or .env — not required for normal use
	const fileEnv = loadEnv(mode, process.cwd(), '');
	const apiBase =
		fileEnv.VITE_API_BASE ||
		process.env.VITE_API_BASE ||
		(mode === 'development' ? DEV_API : PROD_API);

	return {
		define: {
			'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase)
		},
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
					target: DEV_API,
					changeOrigin: true
				}
			}
		}
	};
});
