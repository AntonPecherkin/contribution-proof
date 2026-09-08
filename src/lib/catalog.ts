import { TAXONOMY } from './taxonomy';

/**
 * Who to talk to at the event.
 *
 * These are the speakers and the projects they work on, matched to a participant by topic
 * overlap. That reframing matters: "go contribute to this repository" is advice someone
 * acts on next month, whereas "Nikki from Superteam MY is here and works on what you post
 * about" is advice they can act on in the next ten minutes, in the room they are standing
 * in.
 *
 * Matching is deterministic topic overlap with no hidden boost. A sponsor is labelled and
 * otherwise competes on the same terms; a booth is exactly where a rigged recommendation
 * would be noticed.
 *
 * Topics are assigned from each project's public purpose and its workshop subject. Entries
 * marked `unverified` were inferred and should be confirmed before the event - see the note
 * at the bottom of this file.
 */

export type Project = {
  id: string;
  /** The project or company. */
  name: string;
  /** The person representing it at the event. */
  speaker: string;
  /** Their session, verbatim from the schedule where there is one. */
  session: string;
  /** The project's site. Empty where we have not confirmed one. */
  url: string;
  /**
   * The speaker's X profile, without the @.
   *
   * Preferred over the website on the card: this is an X-based event, the participant is
   * already thinking in handles, and "go find this person" is more actionable at a booth
   * than a corporate homepage. Only handles confirmed by the organiser are listed.
   */
  handle?: string;
  /** Topic ids from the taxonomy. */
  topics: string[];
  sponsor: boolean;
  /** True where the topic mapping is inferred rather than confirmed. */
  unverified?: boolean;
};

export type Match = {
  project: Project;
  /** Topic ids shared with the participant. Shown so the match explains itself. */
  overlap: string[];
  strength: 'strong' | 'good' | 'possible';
};

export const CATALOG_VERSION = '1.0.0-borneo';

export const CATALOG: readonly Project[] = [
  { id: 'elfa', name: 'Elfa AI', speaker: 'Tristan & Ming Yang',
    session: 'Finding real problems — user research & market framing',
    url: 'https://elfa.ai', sponsor: false,
    topics: ['language-models', 'data', 'prediction', 'creator-economy'] },

  { id: 'superteam-my', handle: 'nikkideyy', name: 'Superteam MY', speaker: 'Nikki',
    session: 'Contentmaxxing', url: 'https://superteam.fun', sponsor: false,
    topics: ['open-source', 'creator-economy', 'devtools'] },

  { id: 'meteora', name: 'Meteora', speaker: 'Vesper',
    session: 'Meteora Ecosystem — Opportunities for Everyone',
    url: 'https://meteora.ag', sponsor: false,
    topics: ['mechanism-design', 'smart-contracts', 'scaling'] },

  { id: 'monkedao', handle: 'jemmmyjemm', name: 'MonkeDAO', speaker: 'Jemmy',
    session: 'MonkeDAO — community-led building',
    url: 'https://monkedao.io', sponsor: false,
    topics: ['open-source', 'consensus', 'mechanism-design', 'creator-economy'] },

  { id: 'sanctum', handle: 'NicFury', name: 'Sanctum', speaker: 'Nic',
    session: 'Sanctum', url: 'https://sanctum.so', sponsor: false,
    topics: ['consensus', 'mechanism-design', 'payments'] },

  { id: 'getblock', handle: 'GetVasily', name: 'GetBlock', speaker: 'Vasily',
    session: 'GetBlock', url: 'https://getblock.io', sponsor: false,
    topics: ['scaling', 'devtools', 'data'] },

  { id: 'virtuals', name: 'Virtuals', speaker: 'Joey',
    session: 'Building the Agent Economy — AI agents & autonomous payments via EconomyOS',
    url: 'https://virtuals.io', sponsor: false,
    topics: ['agents', 'language-models', 'payments', 'mechanism-design'] },

  { id: 'rarible', name: 'Impossible Finance / Rarible', speaker: 'Shuen Rui',
    session: 'Go-to-market done right', url: 'https://rarible.com', sponsor: false,
    topics: ['smart-contracts', 'creator-economy'] },

  { id: 'kyzzen', handle: 'OhMeOhMy_Sol', name: 'Kyzzen', speaker: 'OhMeOhMy',
    session: 'Kyzzen', url: 'https://www.kyzzen.io', sponsor: false,
    topics: ['data', 'creator-economy', 'mechanism-design'] },

  { id: 'cradle', name: 'Cradle', speaker: 'Faiz',
    session: 'Cradle', url: 'https://cradle.com.my', sponsor: false,
    // Malaysia's government startup funding agency: grants, ecosystem, hackathons.
    topics: ['open-source', 'mechanism-design'] },

  { id: 'content', name: 'Content', speaker: 'Joyce',
    session: 'Contentmaxxing', url: '', sponsor: false, unverified: true,
    topics: ['creator-economy', 'prediction'] },

  { id: 'superscrypt', name: 'Superscrypt', speaker: 'Jacob',
    session: 'What investors look for — what kills a pitch in 30 seconds',
    url: 'https://superscrypt.xyz', sponsor: false,
    topics: ['open-source', 'mechanism-design'] },

  { id: 'no-limit', name: 'No Limit Holdings', speaker: 'Chris',
    // Anatoly judges for them too, per the tracks page.
    session: 'No Limit Holdings', url: 'https://nlh.xyz', sponsor: false, unverified: true,
    topics: ['mechanism-design', 'open-source'] },
  { id: 'socoe', name: 'SOCOE', speaker: 'Sam',
    session: 'Sustainability track — judging',
    url: 'https://www.linkedin.com/company/socoe', sponsor: true,
    // Kuching-based; runs Startup Village Borneo with the Solana Foundation and Superteam.
    topics: ['sustainability', 'open-source', 'identity'] },

  { id: 'solana-foundation', name: 'Solana Foundation', speaker: 'Chaerin',
    session: 'Judging & mentoring', url: 'https://solana.org', sponsor: false,
    topics: ['scaling', 'consensus', 'open-source', 'devtools'] },

  { id: 'redotpay', name: 'RedotPay', speaker: 'RedotPay',
    session: 'Card quiz — virtual cards', url: 'https://redotpay.com', sponsor: true,
    topics: ['payments', 'identity'] },

] as const;

/*
 * BEFORE THE EVENT
 *
 * Confirm the entries marked `unverified` — Cradle, Kyzzen, Content, No Limit Holdings —
 * where the topic mapping was inferred from a name and a session title alone. A wrong
 * mapping sends someone to the wrong table, which is worse than sending them nowhere.
 *
 * Fill the empty `url` fields, and set `sponsor: true` on whoever is actually sponsoring.
 * Nothing here reads sponsorship from anywhere else.
 *
 * STILL TO CONFIRM: two entries have no link at all - Content (Joyce) and No Limit Holdings
 * (Chris) - and their topics remain inferred from a name and a session title. A card with no
 * link is a dead end at a booth, and a wrong topic sends someone to the wrong table. Both are
 * a two-minute fix for anyone who knows the line-up.
 *
 * Speaker handles come from the organiser's own list rather than from searching, which is why
 * only five are present. Adding the remaining eight would make every card land on a person.
 *
 * COVERAGE: 14 of 18 topics have someone to talk to. Nobody covers cryptography and
 * zero-knowledge, machine learning systems, security and auditing, or hardware and
 * performance. A participant whose power topics fall entirely in that gap receives no
 * opportunities at all - honest, but a blank space on their result page.
 */
const KNOWN = new Set(TAXONOMY.map((t) => t.id));

/**
 * Where a card should send someone.
 *
 * The speaker's X profile wins: this is an X-based event, the participant arrived by typing
 * a handle, and "go find this person" is a more actionable instruction at a booth than a
 * corporate homepage. Returns null rather than a dead card when we have neither.
 */
export function linkFor(project: Project): string | null {
  if (project.handle) return `https://x.com/${project.handle}`;
  return project.url || null;
}

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
