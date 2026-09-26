import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    setupFiles: ['fake-indexeddb/auto'],
    // Several whole-season simulations take 4-5 s alone and hit the 5 s default when the machine is busy.
    testTimeout: 20_000,
  },
});
