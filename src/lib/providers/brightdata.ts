import 'server-only';

import { mapProfileRow, type RawProfile } from './mapping';
import type { PostProvider, ProfileResult, ProviderErrorClass } from './types';

/**
 * Bright Data X profile dataset. Each profile comes back with an embedded posts array.
 *
 * Collection is asynchronous and slow — measured at 85-127 seconds. `fetchRecentPosts`
 * triggers and hands back a snapshot id immediately; `resolveSnapshot` checks progress once
 * and downloads when ready. There is deliberately no polling loop in here: the analysis row
 * is the job, and the caller drives it.
 */

const TRIGGER_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;

type Config = { baseUrl: string; apiKey: string; datasetId: string };

/** Read at call time, not module load, so tests can set the environment. */
function config(): Config | null {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const datasetId = process.env.BRIGHTDATA_X_PROFILE_DATASET;
  if (!apiKey || !datasetId) return null;
  return {
    baseUrl: process.env.BRIGHTDATA_BASE_URL ?? 'https://api.brightdata.com',
    apiKey,
    datasetId,
  };
}

const failure = (errorClass: ProviderErrorClass): ProfileResult => ({ ok: false, errorClass });

async function request(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | 'timeout' | 'network'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    return (error as Error)?.name === 'AbortError' ? 'timeout' : 'network';
  } finally {
    clearTimeout(timer);
  }
}

/** One retry for 429 and 5xx, honouring Retry-After. One. Not a loop. */
async function requestWithOneRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | 'timeout' | 'network'> {
  const first = await request(url, init, timeoutMs);
  if (first === 'timeout') return first;
  if (first !== 'network' && first.status !== 429 && first.status < 500) return first;

  if (first !== 'network') {
    const after = Number(first.headers.get('retry-after'));
    if (Number.isFinite(after) && after > 0 && after <= 30) {
      await new Promise((resolve) => setTimeout(resolve, after * 1000));
    }
  }
  return request(url, init, timeoutMs);
}

async function parseJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const brightDataProvider: PostProvider = {
  name: 'brightdata',

  async fetchRecentPosts(handle: string): Promise<ProfileResult> {
    const cfg = config();
    // A missing key is our misconfiguration, not the participant's bad handle.
    if (!cfg) return failure('provider');

    const url =
      `${cfg.baseUrl}/datasets/v3/trigger` +
      `?dataset_id=${encodeURIComponent(cfg.datasetId)}&include_errors=true`;

    const response = await requestWithOneRetry(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ url: `https://x.com/${handle}` }]),
      },
      TRIGGER_TIMEOUT_MS,
    );

    if (response === 'timeout') return failure('timeout');
    if (response === 'network' || !response.ok) return failure('provider');

    const body = (await parseJson(response)) as { snapshot_id?: string } | null;
    if (!body?.snapshot_id) return failure('provider');

    return { ok: false, pending: true, snapshotId: body.snapshot_id };
  },

  async resolveSnapshot(snapshotId: string): Promise<ProfileResult> {
    const cfg = config();
    if (!cfg) return failure('provider');

    const headers = { Authorization: `Bearer ${cfg.apiKey}` };

    const progress = await requestWithOneRetry(
      `${cfg.baseUrl}/datasets/v3/progress/${encodeURIComponent(snapshotId)}`,
      { headers },
      TRIGGER_TIMEOUT_MS,
    );
    if (progress === 'timeout') return failure('timeout');
    if (progress === 'network' || !progress.ok) return failure('provider');

    const status = ((await parseJson(progress)) as { status?: string } | null)?.status;
    if (status === 'failed') return failure('provider');
    // Still collecting. Hand the ticket back; the caller decides whether to keep waiting.
    if (status !== 'ready') return { ok: false, pending: true, snapshotId };

    const download = await requestWithOneRetry(
      `${cfg.baseUrl}/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
      { headers },
      DOWNLOAD_TIMEOUT_MS,
    );
    if (download === 'timeout') return failure('timeout');
    if (download === 'network' || !download.ok) return failure('provider');

    const rows = await parseJson(download);
    const row = Array.isArray(rows) ? (rows[0] as RawProfile | undefined) : undefined;
    if (!row || typeof row !== 'object') return failure('provider');

    return mapProfileRow(row, 20);
  },
};
