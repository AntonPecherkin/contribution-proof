import type { Match } from './catalog';
import type { Components } from './scoring';
import type { FunStats } from './stats';
import type { ProfileSignal } from './signal';
import type { ProviderErrorClass } from './providers/types';

/**
 * What the API returns. One discriminated union so the UI has a single shape to switch on
 * and never has to infer which kind of result it received.
 *
 * The two success kinds are peers, not a success and a fallback. `profile` is what most
 * accounts at a developer event will get, and it must render with the same care.
 */

export type AnalysisStage = 'queued' | 'fetching' | 'scoring' | 'complete' | 'failed';

export type ScoredResult = {
  kind: 'analysis';
  handle: string;
  displayName: string;
  /** 100-1000. Rendered bare, never with a denominator. */
  score: number;
  components: Components;
  evidence: 'good' | 'limited' | 'directional';
  eligibleCount: number;
  technologyCount: number;
  /** Topic ids, most characteristic first. Label them with labelForTopic. */
  powerTopics: string[];
  /**
   * Likes + reposts + replies across the technology posts. An upper bound on distinct
   * people, so render it approximate. Null means the provider reported none of the three.
   */
  peopleEngaged: number | null;
  /** Whole days since the account joined. Null when the provider omitted the join date. */
  daysBuilding: number | null;
  stats: FunStats;
  opportunities: Match[];
};

export type ProfileResultPayload = {
  kind: 'profile';
  handle: string;
  displayName: string;
  /** Up to 100 — below where the Contribution Score starts, so the two cannot be confused. */
  score: number;
  signal: ProfileSignal;
  opportunities: Match[];
};

export type PublicResult = ScoredResult | ProfileResultPayload;

export type AnalysisStatus =
  | { status: 'queued' | 'fetching' | 'scoring'; stage: AnalysisStage }
  | { status: 'complete'; stage: 'complete'; result: PublicResult }
  | { status: 'failed'; stage: 'failed'; errorClass: ProviderErrorClass | 'llm' };
