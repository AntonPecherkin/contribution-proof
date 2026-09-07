/**
 * Calibration harness. Runs the real pipeline over a saved provider snapshot and prints the
 * numbers a human needs in order to say "that ordering is wrong".
 *
 *   SNAPSHOT=/path/to/rows.json \
 *     npx vitest run scripts/calibrate.test.ts --exclude 'node_modules/**'
 *
 * It reads a saved snapshot and makes no network calls at all.
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
const { classify } = await import('../src/lib/classify');
const { toScoreInput } = await import('../src/lib/analysis');
const { computeScore } = await import('../src/lib/scoring');
const { evidenceBand } = await import('../src/lib/evidence');
const { labelForTopic } = await import('../src/lib/taxonomy');
const { funStats } = await import('../src/lib/stats');
const { profileSignal } = await import('../src/lib/signal');

const SNAPSHOT = process.env.SNAPSHOT;

it('calibrate', { timeout: 900_000, skip: !SNAPSHOT }, async () => {
  const rows = JSON.parse(readFileSync(SNAPSHOT!, 'utf8')) as unknown[];

  for (const row of rows as Record<string, unknown>[]) {
    const handle = String(row.id ?? row.url ?? '?');
    const mapped = mapProfileRow(row, 20);

    if (!mapped.ok) {
      const why = 'errorClass' in mapped ? mapped.errorClass : 'pending';
      console.log(`\n@${handle}  ->  ${why}`);
      if ('profile' in mapped && mapped.profile) {
        const r = profileSignal(mapped.profile);
        console.log(`  PROFILE SIGNAL — "${r.headline}"`);
        for (const sig of r.signals) console.log(`    ${sig.label.padEnd(14)} ${sig.detail}`);
        console.log(`    topics from bio: ${r.topics.map(labelForTopic).join(', ') || '(none)'}`);
      }
      continue;
    }

    const t0 = Date.now();
    const classification = classify(mapped.posts);
    const ms = Date.now() - t0;

    const input = toScoreInput(mapped.posts, classification);
    const { components, total } = computeScore(input);
    const stats = funStats(mapped.posts);
    const dates = mapped.posts.map((p) => p.createdAt.slice(0, 10)).sort();

    console.log(`\n@${handle}   SCORE ${total}   (${ms}ms, no network)`);
    console.log(`  window     ${dates[0]} .. ${dates[dates.length - 1]}`);
    console.log(`  evidence   ${input.eligibleCount} eligible of ${mapped.posts.length} -> ${evidenceBand(input.eligibleCount)}`);
    console.log(`  technology ${input.relevantCount}   streak ${input.longestStreakWeeks}w   views ${input.viewsTotal}   convos ${input.conversationsTotal}`);
    console.log(`  components rel=${components.relevance} exp=${components.explanation} con=${components.consistency} res=${components.response}`);
    console.log(`  topics     ${classification.powerTopics.map(labelForTopic).join(', ') || '(none)'}`);
    console.log(`  streak ${stats?.longestStreakWeeks}wk  busiest ${stats?.busiestWeekday}  median ${stats?.medianLength} chars  threads ${stats?.threadStarts}  links ${stats?.linkShareRate}`);

    for (const j of classification.posts.filter((p) => p.isTechnology).slice(0, 4)) {
      const text = mapped.posts.find((p) => p.id === j.id)?.text.replace(/\s+/g, ' ').slice(0, 90);
      console.log(`    ${j.explanationRating.toFixed(2)}  [${j.matched.slice(0, 3).join(' ')}]  ${text}`);
    }
  }
});
