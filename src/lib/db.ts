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

function requiredEnvironmentVariable(name: 'SUPABASE_URL'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

/**
 * Supabase renamed its keys: `anon` became Publishable and `service_role` became Secret.
 * Both names are accepted so a project created before or after the change works without
 * anyone having to notice which era their dashboard is from.
 *
 * Either way this is the privileged key. It bypasses row-level security, which is correct
 * here because the browser never touches the database — and is exactly why it must never
 * appear in client code or behind a NEXT_PUBLIC_ prefix.
 */
function secretKey(): string {
  const value =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error(
      'Missing required server environment variable: SUPABASE_SECRET_KEY ' +
        '(the "Secret" key in Project Settings → API, not the Publishable one)',
    );
  }

  return value;
}

export function getDb(): SupabaseClient {
  if (client) return client;

  client = createClient(
    requiredEnvironmentVariable('SUPABASE_URL'),
    secretKey(),
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
