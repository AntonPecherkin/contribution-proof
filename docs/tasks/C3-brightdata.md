# C3 — Bright Data provider

**Wave:** 1 · **Blocked by:** C0, contracts, fixtures · **Est:** 2–3h

## Goal

Implement `PostProvider` against Bright Data's X scraper, handling both the synchronous
lane and the asynchronous snapshot lane.

## Files

- Create: `src/lib/providers/brightdata.ts`
- Create: `tests/providers/brightdata.test.ts`

## Consumes

`Post`, `ProfileResult`, `PostProvider` from `src/lib/providers/types.ts` (frozen).
Recorded fixtures in `fixtures/brightdata/`: `rich.json`, `thin.json`, `empty.json`,
`private.json`, `pending.json`, `malformed.json`.

## Produces

```ts
export const brightDataProvider: PostProvider;   // name: 'brightdata'
```

## Spec

**Write this fresh from the API documentation.** Do not paste in an implementation you have
seen elsewhere — see boundary rule 2 in `AGENTS.md`.

**`fetchRecentPosts(handle, limit)`**

`POST https://api.brightdata.com/datasets/v3/scrape?dataset_id=$BRIGHTDATA_DATASET_ID`
with `Authorization: Bearer $BRIGHTDATA_API_KEY`, body `[{ "url": "https://x.com/<handle>" }]`.

Bright Data waits up to 60 seconds and then returns a `snapshot_id` instead of data. **Abort
at 25 seconds** with `AbortController` — a person is waiting, and we would rather move to the
snapshot lane than sit on their timeout. Three outcomes:

| Condition | Return |
|---|---|
| Posts returned | `{ ok: true, handle, displayName, followers, posts }` |
| Body carries `snapshot_id`, **or** the 25 s abort fires | `{ ok: false, pending: true, snapshotId }` |
| Otherwise | `{ ok: false, errorClass: ... }` |

When the abort fires with no `snapshot_id` in hand, return `errorClass: 'timeout'`.

**Error mapping** — this is where the UX is decided, so get it exact:

| Signal | `errorClass` |
|---|---|
| 404, or a body saying the user does not exist | `invalid_handle` |
| Protected / suspended / not accessible | `private` |
| Success with zero posts | `empty` |
| 5xx, network failure, malformed body | `provider` |

`invalid_handle`, `private`, and `empty` are **answers, not failures**. Never retry them and
never fall through to another provider on them.

**`resolveSnapshot(snapshotId)`** — fetch the snapshot. Still running → return `pending` again
with the same id. Ready → map exactly as above.

**Retry:** one automatic retry for network errors, `429`, and `5xx`, honouring `Retry-After`
when present. One. Not a loop.

**Mapping to `Post`:** `views`, `replies`, `reposts`, `likes` are `number | null`. If the
field is absent from the payload, it is `null`. **Do not default to `0`** — a missing metric
and a zero metric are different facts and the score treats them differently.

## Acceptance

```bash
npx vitest run tests/providers/brightdata.test.ts
```

Cover, against fixtures with `fetch` stubbed — no live network in tests:

- `rich.json` → `ok: true`, 20 posts, timestamps parsed to ISO, metrics mapped
- `thin.json` → `ok: true`, 3 posts
- `empty.json` → `errorClass: 'empty'`
- `private.json` → `errorClass: 'private'`
- 404 → `errorClass: 'invalid_handle'`
- `malformed.json` → `errorClass: 'provider'`, no throw
- `pending.json` → `pending: true` with the snapshot id
- pending → `resolveSnapshot` → `ok: true` round trip
- a payload with `views` absent → `views === null`, **not** `0`
- 500 → retried once, then `errorClass: 'provider'`
- 429 with `Retry-After` → waits, retries once

## Constraints

- Read config from `process.env` at call time, not module load — tests must be able to set it.
- No retry loop, no exponential backoff, no circuit breaker. One retry.
- Never throw across the boundary. Every failure is a returned `ProfileResult`.
