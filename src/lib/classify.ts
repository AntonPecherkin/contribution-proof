import type { Post } from './providers/types';
import { TAXONOMY } from './taxonomy';

/**
 * Deterministic classification. No model, no network, no credit balance.
 *
 * Every judgement here is reproducible and explainable: the same post always yields the same
 * topics and the same depth, and we can show a curious participant exactly which words
 * matched. That is worth more at a booth than a subtler judgement nobody can check.
 */

export type PostJudgement = {
  id: string;
  isTechnology: boolean;
  /** 0..1 — how far the post looks like an explanation rather than a remark. */
  explanationRating: number;
  topics: string[];
  /** The words that matched, so the result can show its working. */
  matched: string[];
};

export type Classification = {
  posts: PostJudgement[];
  powerTopics: string[];
};

/**
 * Short keywords are ordinary English before they are jargon: "did", "token", "spec".
 * Anything under four characters must be a full standalone word, which keeps the useful
 * acronyms ("zk", "mev", "llm", "did") without matching "did we just".
 */
function hasKeyword(haystack: string, keyword: string): boolean {
  if (keyword.length < 4 && !/^[a-z]+$/.test(keyword)) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Short tokens must stand alone on both sides; longer ones may prefix-match so that
  // "vulnerab" catches "vulnerability" and "vulnerable".
  const pattern =
    keyword.length <= 4
      ? `\\b${escaped}\\b`
      : /[a-z0-9]$/.test(keyword)
        ? `\\b${escaped}`
        : escaped;
  return new RegExp(pattern).test(haystack);
}

/**
 * Signals that a post explains rather than remarks. Each is a cheap proxy, and the
 * combination is more honest than any one of them: length alone rewards rambling, and
 * connectives alone reward the word "because".
 */
const EXPLANATORY = /\b(because|why|how|the reason|which means|turns out|tradeoff|trade-off|so that|in other words|the problem is|under the hood)\b/;
const MEASURED = /(\d+(\.\d+)?\s?(%|x|ms|s\b|gb|mb|kb|tps|k\b|m\b))|\bp\d{2}\b/;
const THREAD = /(\b1\/\d+|\b1\/\b|🧵)/;
const ONLY_LINK = /^\s*(https?:\/\/\S+\s*)+$/;

export function depthOf(text: string): number {
  const t = text.trim();
  if (t.length === 0 || ONLY_LINK.test(t)) return 0.05;

  const lower = t.toLowerCase();
  // Length is the base but saturates: past a few hundred characters, more words stop being
  // more explanation.
  // Saturates at 250 characters: these are short-form posts, and 400 was a blog target
  // that compressed every real score into the bottom third of the range.
  let score = 0.35 * Math.min(1, t.length / 250);
  if (EXPLANATORY.test(lower)) score += 0.3;
  if (MEASURED.test(lower)) score += 0.2;
  if (THREAD.test(t)) score += 0.15;

  // A remark is a remark however many keywords it contains.
  if (t.length < 50) score = Math.min(score, 0.15);

  return Math.min(1, Number(score.toFixed(3)));
}

export function topicsOf(text: string): { topics: string[]; matched: string[] } {
  const lower = text.toLowerCase();
  const topics: string[] = [];
  const matched: string[] = [];

  for (const topic of TAXONOMY) {
    const hits = topic.keywords.filter((k) => hasKeyword(lower, k));
    if (hits.length > 0) {
      topics.push(topic.id);
      matched.push(...hits);
    }
  }

  return { topics, matched };
}

export function classify(posts: readonly Post[]): Classification {
  const judged = posts.map((post) => {
    const { topics, matched } = topicsOf(post.text);
    return {
      id: post.id,
      isTechnology: topics.length > 0,
      explanationRating: depthOf(post.text),
      topics,
      matched: [...new Set(matched)],
    };
  });

  // Power topics: most frequent across technology posts, ties broken by taxonomy order so
  // the same input always produces the same list.
  const counts = new Map<string, number>();
  for (const j of judged) {
    for (const t of j.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const order = new Map(TAXONOMY.map((t, i) => [t.id, i]));
  const powerTopics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .slice(0, 5)
    .map(([id]) => id);

  return { posts: judged, powerTopics };
}
