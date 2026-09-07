/**
 * Calibration harness. Runs the real pipeline over a saved provider snapshot and prints the
 * numbers a human needs in order to say "that ordering is wrong".
 *
 *   SNAPSHOT=/path/to/rows.json \
 *     npx vitest run scripts/calibrate.test.ts --exclude 'node_modules/**'
 *
 * It makes real, paid API calls, so vitest.config.ts excludes scripts/ from the normal
 * suite and running it requires the --exclude override above. That friction is deliberate.
 */
import { readFileSync } from 'node:fs';
import { it, vi } from 'vitest';

// Load .env.local inside the process. Never source it from the shell: one malformed line
// there echoes a secret into the terminal, which is exactly how one got exposed.
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
  if (m && m[2]) process.env[m[1]] = m[2];
}

vi.mock('server-only', () => ({}));

const { mapProfileRow } = await import('../src/lib/providers/mapping');
const { classify } = await import('../src/lib/llm/client');
const { toScoreInput } = await import('../src/lib/analysis');
const { computeScore } = await import('../src/lib/scoring');
const { evidenceBand } = await import('../src/lib/evidence');
const { labelForTopic } = await import('../src/lib/llm/taxonomy');

const SNAPSHOT = process.env.SNAPSHOT;

it('calibrate', { timeout: 900_000, skip: !SNAPSHOT }, async () => {
  const rows = JSON.parse(readFileSync(SNAPSHOT!, 'utf8')) as unknown[];

  for (const row of rows as Record<string, unknown>[]) {
    const handle = String(row.id ?? row.url ?? '?');
    const mapped = mapProfileRow(row, 20);

    if (!mapped.ok) {
      const why = 'errorClass' in mapped ? mapped.errorClass : 'pending';
      console.log(`\n@${handle}  ->  ${why}   (followers ${row.followers}, posts_count ${row.posts_count})`);
      continue;
    }

    const t0 = Date.now();
    const res = await classify(mapped.posts);
    const ms = Date.now() - t0;
    if (!res.ok) { console.log(`\n@${handle}  ->  classification failed`); continue; }

    const input = toScoreInput(mapped.posts, res.classification);
    const { components, total } = computeScore(input);
    const dates = mapped.posts.map((p) => p.createdAt.slice(0, 10)).sort();

    console.log(`\n@${handle}   SCORE ${total}   (${ms}ms, cache_read ${res.cacheReadTokens})`);
    console.log(`  window     ${dates[0]} .. ${dates[dates.length - 1]}`);
    console.log(`  evidence   ${input.eligibleCount} eligible of ${mapped.posts.length} -> ${evidenceBand(input.eligibleCount)}`);
    console.log(`  technology ${input.relevantCount}   weeks ${input.activeWeeks}   views ${input.viewsTotal}   convos ${input.conversationsTotal}`);
    console.log(`  components rel=${components.relevance} exp=${components.explanation} con=${components.consistency} res=${components.response}`);
    console.log(`  topics     ${res.classification.powerTopics.map(labelForTopic).join(', ') || '(none)'}`);
    console.log(`  narrative  ${res.classification.narrative}`);

    for (const j of res.classification.posts.filter((p) => p.isTechnology).slice(0, 4)) {
      const text = mapped.posts.find((p) => p.id === j.id)?.text.replace(/\s+/g, ' ').slice(0, 90);
      console.log(`    ${j.explanationRating.toFixed(2)}  ${text}`);
    }
  }
});
