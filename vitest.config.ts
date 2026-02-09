import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60s for network calls + workflow polling
    hookTimeout: 10000,
    include: ['tests/**/*.test.ts'],
    reporters: ['verbose'],
  },
});
