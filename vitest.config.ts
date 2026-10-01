import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { LOCAL_DATABASE_URL } from './tests/local-db.ts';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
      CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_dGVzdC13ZWJob29rLXNlY3JldC0zMi1ieXRlcy1sb25nIQ==',
    },
  },
});
