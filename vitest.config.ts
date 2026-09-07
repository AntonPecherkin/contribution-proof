import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // scripts/ holds harnesses that make real, paid API calls. They are run by hand.
    exclude: ['node_modules/**', 'scripts/**'],
  },
});
