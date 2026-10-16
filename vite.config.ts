import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // portable: works at domain root and under /repo-name/ (GitHub Pages)
  server: { port: 5173 },
  build: { target: 'es2020' },
});
