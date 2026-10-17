import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = `http://localhost:${env.PORT || 3001}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Proxy to the Node server so development is same-origin, like production
      proxy: {
        '/api': apiTarget,
      },
    },
  };
});
