import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  /**
   * Self-hosted on a VPS rather than a serverless platform.
   *
   * `standalone` emits a server bundle with only the dependencies actually reached, so the
   * runtime image carries no node_modules tree. It also means `after()` runs in a long-lived
   * process: the work simply finishes instead of racing a function freeze, which is the
   * failure the stale-row revival exists to catch.
   */
  output: 'standalone',
};

export default nextConfig;
