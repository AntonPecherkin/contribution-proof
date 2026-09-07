# C4 — X post provider (twitterapi.io)

**Wave:** 1 · **Blocked by:** C0, contracts, fixtures · **Est:** 1–2h · **Critical path**

> Supersedes the withdrawn C3. An earlier draft used a different provider as primary;
> measurement showed it cannot return post content at all, so this task is now the only way
> the product gets its input. See `docs/SPEC.md`.

## Goal

Implement `PostProvider` against twitterapi.io. One synchronous call, one page of tweets.

## Files

- Create: `src/lib/providers/twitterapi.ts`
- Create: `src/lib/providers/index.ts`
- Create: `tests/providers/twitterapi.test.ts`

## Consumes

`Post`, `ProfileResult`, `ProviderErrorClass`, `PostProvider` from
`src/lib/providers/types.ts` (frozen). Fixtures in `fixtures/twitterapi/`: `rich.json`,
`thin.json`, `empty.json`, `private.json`, `not_found.json`, `malformed.json`.

## Produces

```ts
export const twitterApiProvider: PostProvider;      // twitterapi.ts, name: 'twitterapi'
export function getProvider(): PostProvider;        // index.ts, per settings.primary_provider
```

## Spec

`GET` the **Get User Last Tweets** endpoint with header `x-api-key: $TWITTERAPI_KEY`.
Query: `userName=<handle>`. Leave `includeReplies` at its default of `false`; still filter
defensively, because eligibility is our rule and not theirs. One page is 20 tweets, which is
exactly the window — **do not paginate**, and ignore `has_next_page` / `next_cursor`.

**Response envelope:** `{ tweets: [...], has_next_page, next_cursor, status, message }` where
`status` is `"success"` or `"error"`.

**Field mapping** — this table is the task:

| `Post` | Source | Note |
|---|---|---|
| `id` | `id` | |
| `text` | `text` | |
| `createdAt` | `createdAt` | Arrives as `"Tue Dec 10 07:00:30 +0000 2024"`. **Convert to ISO 8601.** |
| `views` | `viewCount` | **Absent → `null`.** Not every tweet reports impressions. |
| `replies` | `replyCount` | absent → `null` |
| `reposts` | `retweetCount` | absent → `null` |
| `likes` | `likeCount` | absent → `null` |
| `isReply` | `isReply` | boolean, first-class |
| `isRepost` | `retweeted_tweet !== null` | nested object or `null` |
| `isQuote` | `quoted_tweet !== null` | nested object or `null` |

**Never write `?? 0` for a metric.** A missing count and a zero count are different facts and
the scoring module treats them differently. `?? null` is the only correct default.

**Error mapping** — this is where the participant's experience is decided:

| Signal | `errorClass` |
|---|---|
| `status: "error"` with a not-found message, or HTTP 404 | `invalid_handle` |
| `status: "error"` with a protected/suspended message | `private` |
| `status: "success"` with `tweets: []` | `empty` |
| HTTP 5xx, network failure, unparseable body | `provider` |
| Request exceeded the timeout | `timeout` |

`invalid_handle`, `private`, and `empty` are **answers, not failures**. Never retry them and
never fall through to another provider on them.

**Timeout and retry:** abort at 10 seconds — this endpoint answers in well under a second, so
anything approaching ten is already wrong. One automatic retry for network errors, `429`, and
`5xx`, honouring `Retry-After`. One. Not a loop.

**`index.ts`:** read `settings.primary_provider` and return the matching provider
(`twitterapi` or `mock`). If the value is unrecognized, fall back to `twitterapi` rather than
throwing — a typo in a settings row must not take the product down mid-event.

## Acceptance

```bash
npx vitest run tests/providers/twitterapi.test.ts
```

Stub `fetch`; **no live network in tests.** Cover:

- `rich.json` → `ok: true`, 20 posts, `createdAt` ISO, metrics mapped
- the three eligibility flags map correctly, including a repost and a quote
- **a tweet with no `viewCount` → `views === null`, not `0`**
- `thin.json` → `ok: true`, 3 posts
- `empty.json` → `errorClass: 'empty'`
- `private.json` → `errorClass: 'private'`
- `not_found.json` → `errorClass: 'invalid_handle'`
- `malformed.json` → `errorClass: 'provider'`, no throw
- HTTP 500 → retried once, then `errorClass: 'provider'`
- `429` with `Retry-After` → waits, retries once
- `invalid_handle` is **not** retried
- `getProvider()` honours the setting and falls back safely on an unknown value

## Constraints

- Read `TWITTERAPI_KEY` from `process.env` **at call time**, not module load — tests set it.
- Never throw across the boundary. Every failure is a returned `ProfileResult`.
- No pagination, no caching, no rate-limit logic here. Caching is the analysis row's job and
  rate limiting is C5's.
