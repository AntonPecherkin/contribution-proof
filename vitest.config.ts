import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // scripts/ holds harnesses that make real, paid API calls. They are run by hand.
    // .next/standalone contains a full node_modules tree once a production build has run
    // locally, and vitest happily collects third-party test files out of it.
    exclude: ['node_modules/**', '.next/**', 'scripts/**'],
  },
});
