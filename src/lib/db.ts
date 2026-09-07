import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only database access.
 *
 * The client is built on first use rather than at module load. That is deliberate: modules
 * that import this one — settings, rate limiting, analytics — must be testable with no
 * credentials present, and a module-load throw fires before any test can set `process.env`.
 * Same rule the provider adapters follow: read configuration at call time.
 */

let client: SupabaseClient | null = null;

function requiredEnvironmentVariable(
  name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY',
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getDb(): SupabaseClient {
  if (client) return client;

  client = createClient(
    requiredEnvironmentVariable('SUPABASE_URL'),
    requiredEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return client;
}

/** Tests only — drops the memoized client so a later call re-reads the environment. */
export function resetDbForTests(): void {
  client = null;
}
