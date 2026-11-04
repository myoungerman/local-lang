import { defineConfig } from 'vite';
import htmlInclude from 'vite-plugin-html-include';

// https://vitejs.dev/config
export default defineConfig({
plugins: [
    htmlInclude()
  ]
});
