import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        rollupOptions: {
            external:['better-sqlite3', '@huggingface/hub', '@huggingface/transformers', '@xenova/transformers', 'sf'],
        }
    }
});
