# C1 — `computeScore`

**Wave:** 1 · **Blocked by:** C0, contracts · **Est:** 1–2h

## Goal

Implement the pure scoring function. The test file already exists and is skipped. Un-skip
it and make it pass.

## Files

- Modify: `src/lib/scoring.ts` - replace the stub body; **keep the exported signatures**
- Modify: `tests/scoring.test.ts` — **only** to remove `.skip`. Do not change an assertion.

## Consumes

`ScoreInput`, `Components` from the frozen contracts (see `AGENTS.md`).

## Produces

```ts
export function computeScore(input: ScoreInput): { components: Components; total: number };
```

## Spec

Four components, each independently capped at **250**. Total is their sum, rounded to the
nearest 10.

- **relevance** — `250 × (relevantCount / max(1, eligibleCount))`
- **explanation** — `250 × mean(explanationRatings)`; `0` when there are no relevant posts
- **consistency** — `250 × (min(activeWeeks, 4) / 4) × spreadFactor`, where `spreadFactor`
  is 0..1 measuring how evenly `relevantCountsByWeek` is distributed (1 = perfectly even,
  approaching 0 when everything lands in one week). A single active week is 1 by definition.
  Normalized entropy or a normalized Gini both work; pick one and comment why.
- **response** — `250 × (0.7 × reach(viewsTotal, 500_000) + 0.3 × reach(conversationsTotal, 2_000))`
  where `reach` is a saturating log scale, clamped to 1.

**The `null` rule, which one test targets directly:** a `null` provider value means "not
reported", not "zero". It must receive neutral partial credit (start at `0.35`), never `0`.
Someone whose view count the provider failed to return has not thereby been shown to have
no reach.

## Acceptance

```bash
npx vitest run tests/scoring.test.ts
```

All six tests pass. They cover: an all-zero input scoring 0; every component capping at 250;
consistency ignoring active weeks beyond 4; a 10× view increase moving `response` by less
than 40 points; the total being a multiple of 10; and `null` views scoring differently from
`0` views.

## Constraints

- **Pure.** Type imports only. No network, no database, no `Date.now()`, no randomness.
  Same input, same output, forever.
- Export the constants (`CAP`, `NEUTRAL`, the ceilings) as named exports — they get tuned
  against real accounts later and must be findable.
- Do not change a test assertion. If you believe one is wrong, say so in the PR and leave it.
