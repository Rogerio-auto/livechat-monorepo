import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      ENCRYPTION_KEY: 'a5673efc2874e522ef961e1dd1323664da48595a3c65dc25c7d257a7d102fe86',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['src/**/*.{test,spec}.ts'],
  },
});
