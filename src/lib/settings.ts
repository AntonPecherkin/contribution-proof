import 'server-only';

import { getDb } from './db';

export type Settings = {
  analysisEnabled: boolean;
  turnstileEnabled: boolean;
  primaryProvider: 'twitterapi' | 'mock';
  demoMode: boolean;
  maxAnalysesPerEvent: number;
  perIpHourlyCap: number;
};

const CACHE_TTL_MS = 30_000;

const DEFAULTS: Settings = {
  analysisEnabled: true,
  turnstileEnabled: false,
  primaryProvider: 'twitterapi',
  demoMode: false,
  maxAnalysesPerEvent: 500,
  perIpHourlyCap: 10,
};

let cache: { value: Settings; expiresAt: number } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  return fallback;
}

function parseNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function parseProvider(value: unknown): Settings['primaryProvider'] {
  if (typeof value !== 'string') return DEFAULTS.primaryProvider;
  const normalized = value.trim().toLowerCase();
  return normalized === 'twitterapi' || normalized === 'mock'
    ? normalized
    : DEFAULTS.primaryProvider;
}

function parseSettings(data: unknown): Settings {
  if (!Array.isArray(data)) return { ...DEFAULTS };

  const values = new Map<string, unknown>();
  for (const row of data) {
    if (isRecord(row) && typeof row.key === 'string') values.set(row.key, row.value);
  }

  return {
    analysisEnabled: parseBoolean(
      values.get('analysis_enabled'), DEFAULTS.analysisEnabled,
    ),
    turnstileEnabled: parseBoolean(
      values.get('turnstile_enabled'), DEFAULTS.turnstileEnabled,
    ),
    primaryProvider: parseProvider(values.get('primary_provider')),
    demoMode: parseBoolean(values.get('demo_mode'), DEFAULTS.demoMode),
    maxAnalysesPerEvent: parseNonNegativeInteger(
      values.get('max_analyses_per_event'), DEFAULTS.maxAnalysesPerEvent,
    ),
    perIpHourlyCap: parseNonNegativeInteger(
      values.get('per_ip_hourly_cap'), DEFAULTS.perIpHourlyCap,
    ),
  };
}

function storeCache(value: Settings): Settings {
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;

  try {
    const { data, error } = await getDb().from('settings').select('key,value');
    if (error) return storeCache({ ...DEFAULTS });
    return storeCache(parseSettings(data));
  } catch {
    return storeCache({ ...DEFAULTS });
  }
}

export function clearSettingsCache(): void {
  cache = null;
}
