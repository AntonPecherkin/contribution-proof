import type { Post } from '../providers/types';
import { TAXONOMY, TAXONOMY_VERSION } from './taxonomy';

/**
 * The cached prefix.
 *
 * This string is identical for every participant, which is the whole reason it is worth
 * caching — at an event it is read hundreds of times and written once. It must therefore
 * contain nothing volatile: no timestamps, no handle, no counts, no request id. Anything
 * that varies belongs after the cache breakpoint, in the user message.
 *
 * If `usage.cache_read_input_tokens` comes back zero across repeated requests, something
 * volatile has crept in here.
 */

const topicBlock = TAXONOMY.map(
  (t) =>
    `- ${t.id} — ${t.label}. ${t.definition}\n` +
    `    counts: ${t.counts}\n` +
    `    does not count: ${t.doesNotCount}`,
).join('\n');

export const RUBRIC = `You classify public posts by a single author to assess how much they
have contributed to public understanding of emerging technology.

You make judgements only. You never compute a score, a total, or a percentage — separate code
does all arithmetic. Do not mention numbers you were not given.

## Taxonomy (version ${TAXONOMY_VERSION})

Use only these topic ids. If a post fits none of them, return an empty topic list and
isTechnology false.

${topicBlock}

## isTechnology

True when the post's substance is about one of the topics above. A post can be casual in tone
and still qualify. A post can name a technology and not qualify.

Set it false for: price or market commentary, token calls, hiring notices, event promotion,
personal news, greetings, and pure announcements with no technical content — even when they
concern a technical product.

## explanationRating (0 to 1)

How far does the post move a reader's understanding, rather than signal familiarity?

- 0.0-0.2  Names a technology and stops. "Bullish on ZK." "Rollups are the future."
- 0.3-0.5  States a fact or an opinion with no mechanism. "Recall varied a lot between these
           databases." A reader learns that something is so, but not why.
- 0.6-0.8  Gives the mechanism or the tradeoff. A reader could repeat the reasoning.
- 0.9-1.0  Teaches something actionable: a specific cause, a measured result with method, or a
           correction of a common misunderstanding.

Rate on what the post itself contains. A link to an article is not the article. Length is not
depth: two precise sentences can score higher than six vague ones.

Rate every post, including ones where isTechnology is false — those are almost always low, but
rate them rather than skipping them.

## powerTopics

Three to five topic ids, most characteristic of this author first. Choose what they return to
and explain well, not merely what they mentioned once.

## narrative

At most 60 words, addressed to the author as "you". Say what their posts show they helped
others understand, grounded only in the posts you were given.

Do not invent numbers. Do not predict adoption, influence, or impact. Do not flatter. If the
evidence is thin, say so plainly — an honest short answer is better than a padded one.`;

/**
 * The volatile half. Deliberately minimal: ids and text only, in a stable order. Engagement
 * numbers are excluded on purpose — the model judges the writing, and code judges the
 * response to it. Letting the model see view counts would let popularity leak into a
 * judgement that is supposed to be about substance.
 */
export function renderPosts(posts: readonly Post[]): string {
  const rendered = posts
    .map((p) => `<post id="${p.id}">\n${p.text.trim()}\n</post>`)
    .join('\n\n');

  return `Classify each of the following ${posts.length} posts.\n\n${rendered}`;
}
