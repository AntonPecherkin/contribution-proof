import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from '../../src/app/api/analyses/[id]/route';
import { POST as postAnalysis } from '../../src/app/api/analyses/route';
import { resetMockApiForTests } from '../../src/app/api/_mock';
import { POST as postParticipant } from '../../src/app/api/participants/route';

const analysisRequest = (body: unknown) =>
  new Request('http://t/api/analyses', { method: 'POST', body: JSON.stringify(body) });

const participantRequest = (body: unknown) =>
  new Request('http://t/api/participants', { method: 'POST', body: JSON.stringify(body) });

const getAnalysis = (id: string) => GET(new Request(`http://t/api/analyses/${id}`), {
  params: Promise.resolve({ id }),
});

async function start(handle: string) {
  const response = await postAnalysis(analysisRequest({ handle, consentVersion: 'v1' }));
  expect(response.status).toBe(200);
  return (await response.json()) as { id: string; cached: boolean };
}

beforeEach(() => {
  process.env.MOCK = '1';
  resetMockApiForTests();
});

afterEach(() => {
  delete process.env.MOCK;
  resetMockApiForTests();
});

describe('MOCK=1 participant API flow', () => {
  it('runs a scored analysis without database credentials', async () => {
    const { id, cached } = await start('devbuilder');

    expect(cached).toBe(false);

    const response = await getAnalysis(id);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'complete',
      stage: 'complete',
      result: {
        kind: 'analysis',
        handle: 'devbuilder',
        evidence: 'good',
      },
    });
    expect(body.result.stats.bestPost).toBeNull();
  });

  it('returns the profile result as a first-class complete result', async () => {
    const { id } = await start('smallbuilder');

    const response = await getAnalysis(id);

    expect(await response.json()).toMatchObject({
      status: 'complete',
      stage: 'complete',
      result: {
        kind: 'profile',
        handle: 'smallbuilder',
      },
    });
  });

  it('keeps the slow fixture in fetching for timeout UI testing', async () => {
    const { id } = await start('slowbuilder');

    const first = await getAnalysis(id);
    const second = await getAnalysis(id);

    expect(await first.json()).toEqual({ status: 'fetching', stage: 'fetching' });
    expect(await second.json()).toEqual({ status: 'fetching', stage: 'fetching' });
  });

  it('surfaces answer failures from fixtures', async () => {
    const cases = [
      ['lockedaccount', 'private'],
      ['emptybuilder', 'empty'],
    ];

    for (const [handle, errorClass] of cases) {
      const { id } = await start(handle);
      const response = await getAnalysis(id);
      expect(await response.json()).toEqual({ status: 'failed', stage: 'failed', errorClass });
    }
  });

  it('registers a participant after validation without storing anything in the database', async () => {
    const { id } = await start('@devbuilder');

    const response = await postParticipant(participantRequest({
      analysisId: id,
      email: 'Person@Example.com',
      consentVersion: 'v1',
      boardOptIn: true,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('keeps existing validation boundaries in mock mode', async () => {
    await expect(postAnalysis(analysisRequest({ handle: 'x.com/home', consentVersion: 'v1' })))
      .resolves.toMatchObject({ status: 400 });

    await expect(postAnalysis(analysisRequest({ handle: 'devbuilder' })))
      .resolves.toMatchObject({ status: 400 });

    await expect(postParticipant(participantRequest({
      analysisId: 'missing',
      email: 'bad email',
      consentVersion: 'v1',
    }))).resolves.toMatchObject({ status: 400 });
  });
});
