# AGENTS.md

The brief for every agent working in this repository. Read it before touching a file.

## What this repo is

**Contribution Proof**, by ContentDC. A standalone event application: an attendee submits one public X handle and receives an
evidence-bounded 0–1000 Technology Contribution Result. Built in 48 hours, and
**intended to become a public open-source repository.**

**`docs/SPEC.md` is the product specification** — what to build, and what was deliberately
left out. Read it before any task that touches product behaviour. If a summary of this
project disagrees with it, the file wins.

## Hard boundaries — non-negotiable

1. **This repository must be publishable as-is.** Everything you commit — code, comments,
   docs, commit messages, test fixtures — enters permanent git history that outsiders will
   read. Write accordingly from the first commit. A history scan before opening the repo
   is far too late to fix a leak cheaply.
2. **Do not copy code, data, prompts, taxonomies, model weights, or datasets from any
   private repository.** Recalling the shape of a third-party HTTP API is fine — that is
   public knowledge. Pasting in a file from elsewhere is not. Every module here is written
   fresh. If you have seen a private implementation of something you are asked to build,
   build it from the public API documentation instead.
3. **Raw post text is never persisted.** Fetch it, classify it, derive counts from it,
   discard it. Only derived values reach the database.
4. **No database credential ever reaches the browser.** The Supabase client is server-only.
   There is no anon key, no `NEXT_PUBLIC_SUPABASE_*` variable, no client-side database
   access. Everything the browser sees comes through an API route that serializes an
   explicit allowlist of fields.
5. **Never commit a secret.** All credentials are environment variables. `.env.example`
   holds names only.

## Frozen contracts

These types are the seam between tasks. **They are frozen.** If your task appears to need
one changed, stop and say so in your PR rather than editing it — other agents are building
against the current shape, in parallel, right now.

```ts
// src/lib/providers/types.ts
export type Post = {
  id: string;
  text: string;
  createdAt: string;        // ISO 8601
  views: number | null;     // null means "not reported". NEVER coerce to 0.
  replies: number | null;
  reposts: number | null;
  likes: number | null;
  isReply: boolean;
  isRepost: boolean;
  isQuote: boolean;
};

export type ProfileResult =
  | { ok: true; handle: string; displayName: string; followers: number | null; posts: Post[] }
  | { ok: false; errorClass: 'invalid_handle' | 'private' | 'empty' | 'provider' | 'timeout' }
  | { ok: false; pending: true; snapshotId: string };

export interface PostProvider {
  name: 'brightdata' | 'twitterapi' | 'mock';
  fetchRecentPosts(handle: string, limit: number): Promise<ProfileResult>;
  resolveSnapshot?(snapshotId: string): Promise<ProfileResult>;
}

// src/lib/scoring.ts
export type Components = { relevance: number; explanation: number; consistency: number; response: number };
export type ScoreInput = {
  eligibleCount: number;
  relevantCount: number;
  explanationRatings: number[];     // 0..1, one per relevant post
  activeWeeks: number;
  relevantCountsByWeek: number[];
  viewsTotal: number | null;
  conversationsTotal: number | null;
};

// src/lib/llm/schema.ts
export type Classification = {
  posts: Array<{ id: string; isTechnology: boolean; explanationRating: number; topics: string[] }>;
  powerTopics: string[];
  narrative: string;
};
```

## Who owns what

Two agents work here in parallel. **Every file has exactly one owner.** Do not edit a file
outside your task's list — not even to fix something obviously broken. Note it in your PR
description instead.

| Scope | Owner |
|---|---|
| Repo scaffold, CI, migrations | Codex |
| Contracts, fixtures, and the failing tests | Claude |
| `src/lib/scoring.ts`, `normalize.ts`, `evidence.ts` | Codex — one task each |
| `src/lib/providers/{brightdata,twitterapi}.ts` | Codex — one task each |
| `src/lib/{settings,ratelimit,analytics,catalog}.ts` | Codex — one task each |
| `scripts/prewarm.mjs`, `src/app/api/share/[id]/` | Codex |
| `tests/**` — Playwright smoke | Codex |
| `src/lib/providers/types.ts`, `mock.ts` | Claude — frozen seam |
| `src/lib/llm/**` — prompt, taxonomy, rubric, client | Claude |
| `src/app/**` pages, and `src/app/api/**` except `share` | Claude |
| Score calibration | Claude + human |
| Integration, hostile-path QA, release | Claude |

Rationale, so it is not mistaken for arbitrary: the **spec-complete leaf work** fans out to
parallel sandboxes, where a mechanical acceptance criterion is a strength. The **judgement
work** — what the score means, what the taxonomy contains, what the copy says — and the
**integration** stay with the agent holding the whole plan in context. Splitting on
"frontend vs backend" instead would put taste in a sandbox and integration in the narrowest
view available.

## Review is mutual

Neither agent merges its own PR.

- **Claude reviews Codex's PRs** against the task brief: does it satisfy the acceptance
  tests, does it stay inside its file list, did it change a frozen contract.
- **Codex reviews Claude's PRs** for data correctness, privacy leaks, API misuse, and test
  coverage. Specifically worth hunting for: a `null` rendered as `0`, a field leaking into
  the board payload, a provider result mis-mapped, a query without a bound.

Each of us is the other's best reviewer precisely where we are individually weakest.

## Conventions

- TypeScript strict. No `any`. No `as` casts to force a shape — model the real one.
- Pure modules (`scoring`, `normalize`, `evidence`, `catalog`) import **types only**. No
  network, no database, no clock, no randomness. Testable with zero setup.
- A missing provider value is `null` and stays `null`. `null` is not `0`. Rendering it as
  `0` is a correctness bug, not a formatting choice.
- Errors are values at module boundaries — return the discriminated union, don't throw
  across a seam.
- Match the surrounding file's style. No new dependency without saying so in the PR.

## Workspace

Use a separate branch, and a separate worktree where your tooling supports it. Two agents
editing one checkout is the most common way this goes wrong.

```bash
git worktree add ../tcc-<task-id> -b task/<task-id>-<slug>
```

One task, one branch, one PR. Branch name `task/<id>-<slug>`, e.g. `task/c1-scoring`.
Keep the diff reviewable in one sitting. Commit in small steps, not one final squash.

## Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npx vitest run                     # all unit + contract tests
npx vitest run tests/<file>        # just yours
MOCK=1 npm run dev                 # entirely on fixtures — no network, no keys
```

`MOCK=1` is how you work without credentials. **You should never need a real API key.** If
a task seems to require one, say so in the PR rather than asking for a secret.

## Definition of done

- [ ] Your test suite is un-skipped and passing.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run lint` clean.
- [ ] `npx vitest run` green — the whole suite, not only yours.
- [ ] You touched only the files your brief lists.
- [ ] No secret, no private-repo content, no raw post text persisted.
- [ ] PR description says what you did and flags every assumption you had to make.

Product spec: `docs/SPEC.md`. Dispatch: `docs/DISPATCH.md`. Task briefs: `docs/tasks/`.
