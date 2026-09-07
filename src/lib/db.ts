import 'server-only';

import { createClient } from '@supabase/supabase-js';

function requiredEnvironmentVariable(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export const db = createClient(
  requiredEnvironmentVariable('SUPABASE_URL'),
  requiredEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
