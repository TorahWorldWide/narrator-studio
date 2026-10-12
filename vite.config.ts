/// <reference types="vitest/config" />
import { writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react(), { name: 'nojekyll', closeBundle() { writeFileSync('docs/.nojekyll', ''); } }],
  base: '/narrator-studio/',
  build: { outDir: 'docs', emptyOutDir: true, target: 'es2020' },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
