import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { Server } from './src/infrastructure/http/Server';
import { GeminiAdapter } from './src/infrastructure/adapters/GeminiAdapter';
import { config } from './src/config';

let expressServerStarted = false;

function expressBackendPlugin(): Plugin {
  return {
    name: 'express-backend',
    configureServer() {
      if (!expressServerStarted) {
        expressServerStarted = true;
        const gemini = new GeminiAdapter(config.geminiApiKey || process.env.GEMINI_API_KEY || '');
        const apiServer = new Server(3001, '0.0.0.0', gemini);
        try {
          apiServer.start();
          console.log('[RL.SYS] Express API server auto-initialized on port 3001.');
        } catch (e) {
          console.log('[RL.SYS] Express API server already active on port 3001.', e);
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), expressBackendPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
