import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is the tool that runs the app while we develop and builds it for the web.
export default defineConfig({
  // GitHub Pages serves the app at https://peanotbutter.github.io/brainer/
  // so every file path must start with /brainer/. We use the same path
  // during development so nothing surprises us after deploying.
  base: '/brainer/',
  plugins: [react()],
});
