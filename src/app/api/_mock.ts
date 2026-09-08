import { NextResponse } from 'next/server';

import { toScoreInput } from '../../lib/analysis';
import { matchProjects } from '../../lib/catalog';
import { classify } from '../../lib/classify';
import { evidenceBand } from '../../lib/evidence';
import { isEligible, normalizeEmail, normalizeHandle } from '../../lib/normalize';
import { mockProvider } from '../../lib/providers/mock';
import type { Post, ProfileResult, ProfileSummary, ProviderErrorClass } from '../../lib/providers/types';
import type { AnalysisStatus, PublicResult } from '../../lib/result';
import { computeScore } from '../../lib/scoring';
import { profileSignal } from '../../lib/signal';
import { daysBuilding, funStats, peopleEngagedInTech } from '../../lib/stats';

type MockAnalysis = {
  id: string;
  handle: string;
  status: AnalysisStatus['status'];
  stage: AnalysisStatus['stage'];
  result: PublicResult | null;
  errorClass: ProviderErrorClass | null;
  snapshotId: string | null;
  polls: number;
};

type MockStore = {
  analyses: Map<string, MockAnalysis>;
  nextId: number;
};

declare global {
  var __contributionProofMockApi: MockStore | undefined;
}

const store = globalThis.__contributionProofMockApi ??= {
  analyses: new Map<string, MockAnalysis>(),
  nextId: 1,
};

export function isMockApi(): boolean {
  return process.env.MOCK === '1';
}

function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, init);
}

function buildScored(handle: string, profile: ProfileSummary, posts: Post[]): PublicResult | null {
  const classification = classify(posts);
  const input = toScoreInput(posts, classification);
  const band = evidenceBand(input.eligibleCount);
  if (band === null) return null;

  const { components, total } = computeScore(input);
  const stats = funStats(posts);
  if (stats === null) return null;

  return {
    kind: 'analysis',
    handle,
    displayName: profile.displayName || handle,
    score: total,
    components,
    evidence: band,
    eligibleCount: input.eligibleCount,
    technologyCount: input.relevantCount,
    powerTopics: classification.powerTopics,
    peopleEngaged: peopleEngagedInTech(posts, classification),
    daysBuilding: daysBuilding(profile.joinedAt),
    stats: { ...stats, bestPost: null },
    opportunities: matchProjects(classification.powerTopics),
  };
}

function buildProfile(handle: string, profile: ProfileSummary): PublicResult {
  const signal = profileSignal(profile);
  return {
    kind: 'profile',
    handle,
    displayName: profile.displayName || handle,
    score: signal.profileScore,
    signal,
    opportunities: matchProjects(signal.topics),
  };
}

function completeFromResult(row: MockAnalysis, result: ProfileResult): void {
  if (!result.ok && 'pending' in result) {
    row.status = 'fetching';
    row.stage = 'fetching';
    row.snapshotId = result.snapshotId;
    return;
  }

  if (!result.ok) {
    if (result.errorClass === 'no_posts_available' && result.profile) {
      row.result = buildProfile(row.handle, result.profile);
      row.status = 'complete';
      row.stage = 'complete';
      return;
    }

    row.errorClass = result.errorClass;
    row.status = 'failed';
    row.stage = 'failed';
    return;
  }

  const scored = buildScored(row.handle, result.profile, result.posts.filter(isEligible));
  if (scored) {
    row.result = scored;
    row.status = 'complete';
    row.stage = 'complete';
    return;
  }

  row.errorClass = 'empty';
  row.status = 'failed';
  row.stage = 'failed';
}

async function startMockAnalysis(handle: string): Promise<MockAnalysis> {
  const existing = [...store.analyses.values()].find(
    (row) => row.handle === handle && row.status !== 'failed',
  );
  if (existing) return existing;

  const row: MockAnalysis = {
    id: `mock-analysis-${store.nextId}`,
    handle,
    status: 'queued',
    stage: 'queued',
    result: null,
    errorClass: null,
    snapshotId: null,
    polls: 0,
  };
  store.nextId += 1;
  store.analyses.set(row.id, row);

  row.status = 'fetching';
  row.stage = 'fetching';
  completeFromResult(row, await mockProvider.fetchRecentPosts(handle, 20));

  return row;
}

export async function mockPostAnalysis(request: Request): Promise<NextResponse> {
  let body: { handle?: unknown; consentVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const handle = typeof body.handle === 'string' ? normalizeHandle(body.handle) : null;
  if (!handle) return json({ error: 'invalid_handle' }, { status: 400 });
  if (typeof body.consentVersion !== 'string' || !body.consentVersion) {
    return json({ error: 'consent_required' }, { status: 400 });
  }

  const existing = [...store.analyses.values()].find(
    (row) => row.handle === handle && row.status !== 'failed',
  );
  const row = existing ?? (await startMockAnalysis(handle));
  return json({ id: row.id, cached: Boolean(existing) });
}

export async function mockGetAnalysis(id: string): Promise<NextResponse> {
  const row = store.analyses.get(id);
  if (!row) return json({ error: 'not_found' }, { status: 404 });

  if (row.status === 'fetching' && row.snapshotId) {
    row.polls += 1;
    if (row.handle !== 'slowbuilder') {
      completeFromResult(row, await mockProvider.resolveSnapshot(row.snapshotId));
    }
  }

  if (row.status === 'complete' && row.result) {
    const body: AnalysisStatus = { status: 'complete', stage: 'complete', result: row.result };
    return json(body);
  }

  if (row.status === 'failed') {
    const body: AnalysisStatus = {
      status: 'failed',
      stage: 'failed',
      errorClass: row.errorClass ?? 'provider',
    };
    return json(body);
  }

  if (row.status === 'queued' || row.status === 'fetching' || row.status === 'scoring') {
    const body: AnalysisStatus = { status: row.status, stage: row.status };
    return json(body);
  }

  return json({ error: 'provider' }, { status: 500 });
}

export async function mockPostParticipant(request: Request): Promise<NextResponse> {
  let body: {
    analysisId?: unknown;
    email?: unknown;
    consentVersion?: unknown;
    boardOptIn?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : null;
  if (!email) return json({ error: 'invalid_email' }, { status: 400 });
  if (typeof body.consentVersion !== 'string' || !body.consentVersion) {
    return json({ error: 'consent_required' }, { status: 400 });
  }
  if (typeof body.analysisId !== 'string') {
    return json({ error: 'invalid_analysis' }, { status: 400 });
  }
  if (!store.analyses.has(body.analysisId)) return json({ error: 'not_found' }, { status: 404 });

  return json({ ok: true });
}

export function resetMockApiForTests(): void {
  store.analyses.clear();
  store.nextId = 1;
}
