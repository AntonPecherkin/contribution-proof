# C2 — Normalization and evidence bands

**Wave:** 1 · **Blocked by:** C0, contracts · **Est:** 1–2h

## Goal

Two small pure modules: turning messy user input into a canonical handle, and turning a post
count into an honesty label. Test files exist and are skipped — un-skip and make them pass.

## Files

- Create: `src/lib/normalize.ts`, `src/lib/evidence.ts`
- Modify: `tests/normalize.test.ts`, `tests/evidence.test.ts` — **only** to remove `.skip`.

## Produces

```ts
export function normalizeHandle(raw: string): string | null;   // null when unsalvageable
export function normalizeEmail(raw: string): string | null;
export function isEligible(post: Post): boolean;
export function evidenceBand(eligibleCount: number): 'good' | 'limited' | 'directional' | null;
```

## Spec

**`normalizeHandle`** — people paste anything. All of these are the same account and must
return `"jack"`:

```
jack   @jack   @JACK   " jack "   x.com/jack   https://x.com/jack
twitter.com/jack   https://www.x.com/jack?s=21   x.com/jack/status/123
```

Return `null` for: empty input, something with no extractable handle, or a handle failing X's
rules (1–15 chars, `[A-Za-z0-9_]` only). **Reject Unicode lookalikes** — a Cyrillic `а` in
`jаck` is a different string that renders identically, so normalize confusables or reject.
Lowercase the result. Never throw; return `null`.

**`normalizeEmail`** — trim, lowercase, validate shape. Return `null` if invalid. Do **not**
strip Gmail dots or `+` tags: two addresses that differ are two leads, and silently merging
people is worse than a duplicate.

**`isEligible`** — `true` for original posts, thread roots, and quote posts. `false` for
replies and reposts. Given the contract, that is `!post.isReply && !post.isRepost` — quotes
stay eligible. Write it so the intent survives someone reading it later.

**`evidenceBand`** — `15–20 → 'good'`, `5–14 → 'limited'`, `1–4 → 'directional'`, `0 → null`.
`null` means no score may be shown at all. Counts above 20 are `'good'`.

## Acceptance

```bash
npx vitest run tests/normalize.test.ts tests/evidence.test.ts
```

## Constraints

- **Pure.** Type imports only.
- Never throw on user input — every failure is a `null` return.
- No regex so clever the next reader cannot tell what it rejects. Prefer a short parse over
  one long pattern.
