import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30s for network calls
    hookTimeout: 10000,
    include: ['tests/**/*.test.ts'],
    reporters: ['verbose'],
  },
});
