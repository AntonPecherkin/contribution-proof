import { TAXONOMY } from './taxonomy';

/**
 * Contribution opportunities.
 *
 * Matching is deterministic topic overlap — no ranking model, no hidden boost. A sponsored
 * entry is labelled and otherwise competes on the same terms as everything else; a booth is
 * exactly where a rigged recommendation would be noticed.
 *
 * The entries below are a WORKING EXAMPLE SET. Replace them with the event's real projects
 * before the day: these are placeholders chosen to exercise the matcher across the taxonomy,
 * and the "needs" are generic rather than researched. Shipping them as-is would put claims
 * about other people's projects in front of attendees.
 */

export type Project = {
  id: string;
  name: string;
  url: string;
  /** Topic ids from the taxonomy. */
  topics: string[];
  /** What contributors can actually do. Kept short; it is read at a glance. */
  needs: string;
  sponsor: boolean;
};

export type Match = {
  project: Project;
  /** Topic ids shared with the participant. Shown so the match explains itself. */
  overlap: string[];
  strength: 'strong' | 'good' | 'possible';
};

export const CATALOG_VERSION = '0.1.0-example';

export const CATALOG: readonly Project[] = [
  { id: 'p-zk', name: 'Example ZK Toolkit', url: 'https://example.org/zk',
    topics: ['cryptography', 'smart-contracts'], needs: 'Docs and worked examples', sponsor: false },
  { id: 'p-scale', name: 'Example Rollup Explorer', url: 'https://example.org/rollup',
    topics: ['scaling', 'consensus', 'devtools'], needs: 'Frontend and API work', sponsor: false },
  { id: 'p-agents', name: 'Example Agent Harness', url: 'https://example.org/agents',
    topics: ['agents', 'language-models', 'devtools'], needs: 'Evaluation harnesses', sponsor: false },
  { id: 'p-data', name: 'Example Vector Bench', url: 'https://example.org/vector',
    topics: ['data', 'ml-systems', 'performance'], needs: 'Benchmarks and datasets', sponsor: false },
  { id: 'p-sec', name: 'Example Audit Commons', url: 'https://example.org/audit',
    topics: ['security', 'smart-contracts'], needs: 'Review and write-ups', sponsor: false },
  { id: 'p-pay', name: 'Example Payments SDK', url: 'https://example.org/pay',
    topics: ['payments', 'identity'], needs: 'SDK examples and integrations', sponsor: true },
  { id: 'p-creator', name: 'Example Creator Index', url: 'https://example.org/creator',
    topics: ['creator-economy', 'prediction'], needs: 'Data collection and analysis', sponsor: false },
  { id: 'p-os', name: 'Example Spec Registry', url: 'https://example.org/spec',
    topics: ['open-source', 'devtools'], needs: 'Specification review', sponsor: false },
] as const;

const KNOWN = new Set(TAXONOMY.map((t) => t.id));

function strengthOf(overlapCount: number, participantTopics: number): Match['strength'] {
  if (overlapCount >= 3 || (overlapCount >= 2 && participantTopics <= 3)) return 'strong';
  if (overlapCount === 2) return 'good';
  return 'possible';
}

/**
 * Three opportunities, most overlapping first.
 *
 * Ties break on catalog order rather than anything derived, so the same participant always
 * sees the same three — a result that reshuffles on refresh reads as arbitrary.
 */
export function matchProjects(powerTopics: readonly string[], limit = 3): Match[] {
  const wanted = new Set(powerTopics.filter((t) => KNOWN.has(t)));
  if (wanted.size === 0) return [];

  return CATALOG.map((project) => {
    const overlap = project.topics.filter((t) => wanted.has(t));
    return { project, overlap, strength: strengthOf(overlap.length, wanted.size) };
  })
    .filter((m) => m.overlap.length > 0)
    .sort((a, b) => b.overlap.length - a.overlap.length)
    .slice(0, limit);
}
