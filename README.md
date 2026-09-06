# Tech Contribution Check

An event application: an attendee submits one public X handle and receives an
evidence-bounded **Technology Contribution Result** — an experimental 0–1000 score
built from their recent public posts, with the evidence behind it stated plainly.

Built for a 48-hour event. Public by intent.

## What it does

1. You give it one X handle (self-declared — **ownership is not verified**).
2. It reads up to your latest 20 eligible public posts — original posts, thread roots,
   and quote posts. No replies, no reposts.
3. A language model classifies each post for topic relevance and whether it *explains*
   something rather than merely mentioning it. Deterministic code does all the arithmetic.
4. You get a score, four headline metrics, your Power Topics, a short narrative, and
   three contribution opportunities.

## What it is not

This is an **experimental, directional measure of public technical communication**, not a
measure of engineering skill, seniority, or worth. It reads public posts and nothing else.
Someone who builds constantly and posts rarely will score low, and that is a property of
the instrument, not of them.

Scores are always shown with the evidence behind them: how many posts were actually
analyzed, and how confident the result is at that sample size.

## Privacy

- Raw post text is **never stored**. It is fetched, classified, reduced to counts, discarded.
- Appearing on the public event board is **opt-in**, off by default, and separate from the
  consent to analyze.
- No database credential ever reaches the browser. Every value the page shows comes through
  a server route that serializes an explicit allowlist of fields.

## Repository boundary

This repository is standalone. It contains no code, data, prompts, taxonomies, model
weights, or datasets copied from any private repository. The scoring heuristics, topic
taxonomy, classification prompt, and project catalog here were all written for this
repository and are public.

## Development

```bash
npm install
cp .env.example .env.local     # fill in your own keys
MOCK=1 npm run dev             # runs entirely on fixtures — no keys, no network
```

See `AGENTS.md` for the contracts, file ownership, and conventions.
Task briefs live in `docs/tasks/`.

## Licence

MIT for the code — see `LICENSE`. Name and marks are excluded — see `NOTICE`.
