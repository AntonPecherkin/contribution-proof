import { defineConfig } from 'vitest/config';

/**
 * Calibration only. The default config excludes scripts/ because the harness there makes
 * real, paid API calls; this config exists so running it has to be deliberate.
 *
 *   SNAPSHOT=/path/to/rows.json npx vitest run -c vitest.calibrate.config.ts
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
    testTimeout: 900_000,
  },
});
