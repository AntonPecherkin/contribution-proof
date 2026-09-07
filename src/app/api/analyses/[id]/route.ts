import { NextResponse } from 'next/server';

import { reviveIfStale } from '../../../../lib/analysis-runner';
import { getDb } from '../../../../lib/db';
import type { AnalysisStatus, PublicResult } from '../../../../lib/result';

/**
 * Poll one analysis.
 *
 * Doing double duty as the scheduler: it resolves a snapshot that is still collecting and
 * restarts a row whose work was dropped. No cron, no queue - the participant's own polling
 * drives the job forward.
 */

type Row = {
  id: string;
  status: string;
  error_class: string | null;
  started_at: string | null;
  provider_snapshot_id: string | null;
  result: PublicResult | null;
  cache_expires_at: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  const { data } = await getDb()
    .from('analyses')
    .select('id,status,error_class,started_at,provider_snapshot_id,result,cache_expires_at')
    .eq('id', id)
    .maybeSingle();

  const row = data as Row | null;
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (row.status === 'complete' && row.result) {
    const body: AnalysisStatus = { status: 'complete', stage: 'complete', result: row.result };
    return NextResponse.json(body);
  }

  if (row.status === 'failed') {
    const body: AnalysisStatus = {
      status: 'failed',
      stage: 'failed',
      errorClass: (row.error_class ?? 'provider') as never,
    };
    return NextResponse.json(body);
  }

  reviveIfStale(row);

  const stage = row.status === 'queued' ? 'queued' : row.status === 'scoring' ? 'scoring' : 'fetching';
  const body: AnalysisStatus = { status: stage, stage } as AnalysisStatus;
  return NextResponse.json(body);
}
