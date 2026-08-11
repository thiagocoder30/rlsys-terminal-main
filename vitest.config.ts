import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,js}', 'workspaces/app/tests/**/*.test.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
    },
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
});
