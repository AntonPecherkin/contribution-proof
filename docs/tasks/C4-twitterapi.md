# C4 — twitterapi.io fallback provider

**Wave:** 1 · **Blocked by:** C0, contracts, fixtures · **Est:** 45m

## Goal

A second `PostProvider` implementation. It is a **fire extinguisher**: built, tested, and
deliberately not routed to. If the primary provider rate-limits during the event, someone
flips a database setting and this takes over with no deploy.

## Files

- Create: `src/lib/providers/twitterapi.ts`
- Create: `tests/providers/twitterapi.test.ts`

## Produces

```ts
export const twitterApiProvider: PostProvider;   // name: 'twitterapi'
```

## Spec

`GET` twitterapi.io's **Get User Last Tweets** endpoint — tweets by username, newest first,
20 per page. Header `x-api-key: $TWITTERAPI_KEY`. One page is exactly the window we need, so
do not paginate.

Map the response into `Post[]` with the same discipline as C3: absent metric → `null`, never
`0`. Same `errorClass` mapping — 404/not-found → `invalid_handle`, protected → `private`,
zero posts → `empty`, 5xx/network/malformed → `provider`.

This provider is **always synchronous**. It has no snapshot lane, so do not implement
`resolveSnapshot` — leave the optional method off.

One retry on network error / `429` / `5xx`, honouring `Retry-After`.

## Acceptance

```bash
npx vitest run tests/providers/twitterapi.test.ts
```

Cover: success mapping, empty, private, 404, malformed body, absent metric → `null`, and one
retry on 500. Stub `fetch`; no live network in tests.

## Constraints

- Read `TWITTERAPI_KEY` at call time, not module load.
- Do not wire this into provider selection — C5's settings module and the selection logic are
  someone else's files. Export the provider and stop.
