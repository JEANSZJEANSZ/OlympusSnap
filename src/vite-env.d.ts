/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ADMIN_PIN?: string;
	readonly VITE_PUBLIC_ORIGIN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
