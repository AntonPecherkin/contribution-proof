# C3 — X post provider (Bright Data)

**Wave:** 1 · **Blocked by:** C0, contracts, fixtures · **Est:** 3–4h · **Critical path**

Everything below was measured against our own account on 2026-09-07, not read from
documentation. Where the two disagree, this file is right.

## Goal

Implement `PostProvider` against Bright Data's X **profile** dataset, which returns each
profile with an embedded `posts[]` array. Collection is asynchronous.

## Files

- Create: `src/lib/providers/brightdata.ts`, `src/lib/providers/index.ts`
- Create: `tests/providers/brightdata.test.ts`

## Consumes

`Post`, `ProfileResult`, `ProviderErrorClass`, `PostProvider` from
`src/lib/providers/types.ts` (frozen). Fixtures in `fixtures/brightdata/`.

## Produces

```ts
export const brightDataProvider: PostProvider;   // name: 'brightdata'
export function getProvider(): PostProvider;     // index.ts, per settings.primary_provider
```

## The call

```
POST {BRIGHTDATA_BASE_URL}/datasets/v3/trigger
       ?dataset_id={BRIGHTDATA_X_PROFILE_DATASET}&include_errors=true
Authorization: Bearer {BRIGHTDATA_API_KEY}
body: [{ "url": "https://x.com/<handle>" }]
-> { "snapshot_id": "sd_..." }

GET  /datasets/v3/progress/{snapshot_id}      -> { "status": "running" | "ready" | "failed" }
GET  /datasets/v3/snapshot/{snapshot_id}?format=json  -> [ profile, ... ]
```

**There is no synchronous path worth using.** `fetchRecentPosts` triggers and returns
`{ ok: false, pending: true, snapshotId }` immediately. `resolveSnapshot` polls progress once
and downloads when ready, returning `pending` again while it is still running. **Do not loop
inside the provider** — the caller polls, because the analysis row is the job.

Measured collection time: **85–127 seconds.** Budget accordingly; do not add a short timeout
that guarantees failure.

## Profile row -> ProfileResult

The row's `posts` field is the whole game:

| Row state | Result |
|---|---|
| `posts` is an array with usable entries | `ok: true` |
| **`posts` is `null`** | `errorClass: 'no_posts_available'` |
| `posts` is `[]` | `errorClass: 'empty'` |
| `error_code: 'dead_page'` / user not found | `errorClass: 'invalid_handle'` |
| `error_code: 'protected_account'` | `errorClass: 'private'` |
| snapshot `status: 'failed'`, HTTP 5xx, network, unparseable | `errorClass: 'provider'` |

**`posts: null` is the single most important case in this task.** It is not an error and not
an empty account — the profile came back fine, reporting a real `posts_count`, and the posts
array is null anyway. Measured: it happens reliably for small accounts. One test account with
97 posts and 186 followers returned null three times running, while two large accounts
returned 98 and 100 posts. **At a developer event, small accounts are the common case**, so
this path will fire often and must produce a clear, non-blaming message rather than looking
like "we couldn't find you".

## Embedded post -> Post

| `Post` | Source | Note |
|---|---|---|
| `id` | `post_id`, else the id in `post_url` | `post_id` is sometimes `null` while the URL still carries `/status/<id>` |
| `text` | `description` | |
| `createdAt` | `date_posted` | ISO already; normalize anyway |
| `views` | `views` | **Present on only 28–50% of posts.** Absent -> `null`, never `0`. |
| `replies` / `reposts` / `likes` | `replies` / `reposts` / `likes` | absent -> `null` |
| `isReply` | **heuristic** — text matches `/^\s*@\w/` | see below |
| `isRepost` | always `false` | no indicator exists |
| `isQuote` | always `false` | no indicator exists |

**Drop any post with no `description` or no `date_posted`.** Measured: the first embedded post
frequently carries only `post_url` and `views`, everything else null. There is nothing to
classify and no week to place it in, so it is not evidence.

**The eligibility rule cannot be implemented faithfully.** The dataset carries no reply,
repost, or quote indicator of any kind. A leading `@mention` catches most replies; nothing
identifies a repost or a quote. This is weaker than the product's stated rule, so the result
must disclose it — see `docs/SPEC.md`. Do not invent a cleverer heuristic; a wrong guess
silently corrupts the score, and a stated limitation does not.

## `index.ts`

Read `settings.primary_provider` and return `brightdata` or `mock`. On an unrecognized value
fall back to `brightdata` rather than throwing — a typo in a settings row must not take the
product down mid-event.

## Acceptance

```bash
npx vitest run tests/providers/brightdata.test.ts
```

Stub `fetch`; **no live network in tests.** Cover:

- trigger returns a snapshot id -> `pending: true` with that id
- `running.json` -> `resolveSnapshot` returns `pending` again, same id
- `rich.json` -> `ok: true`; the blank first post is dropped; `createdAt` ISO
- **a post with `views: null` -> `views === null`, not `0`**
- a post whose `post_id` is null but whose `post_url` has `/status/<id>` -> id recovered
- `looksLikeReply` marks `@someone …` as a reply and leaves normal text alone
- **`no_posts.json` -> `errorClass: 'no_posts_available'`** (not `empty`, not `invalid_handle`)
- `empty.json` -> `errorClass: 'empty'`
- `not_found.json` -> `errorClass: 'invalid_handle'`
- `private.json` -> `errorClass: 'private'`
- `malformed.json` -> `errorClass: 'provider'`, no throw
- HTTP 500 on trigger -> one retry, then `errorClass: 'provider'`
- `getProvider()` honours the setting and falls back safely on an unknown value

## Constraints

- Read config from `process.env` **at call time**, not module load — tests set it.
- No polling loop inside the provider. One progress check per `resolveSnapshot` call.
- One retry for network errors / `429` / `5xx`, honouring `Retry-After`. Not a loop.
- Never throw across the boundary. Every failure is a returned `ProfileResult`.
