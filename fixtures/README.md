# Fixtures

Recorded provider responses. They let every task be built and tested with no network and no
credentials (`MOCK=1`).

## Recorded from a real response, 2026-09-07

`twitterapi/` matches an actual observed response, not the published schema. **The two differ**
— the documentation shows `tweets` at the top level; in reality they are nested under `data`:

```json
{ "status": "success", "code": 0, "msg": "success",
  "data": { "pin_tweet": null, "tweets": [ ... ] },
  "has_next_page": false, "next_cursor": "..." }
```

Content is invented; only the structure is real. That is the correct trade for a repository
that becomes public: we need the shape, not a stranger's posts.

## The one thing these fixtures cannot express

`empty.json` and `not_found.json` are **byte-identical on purpose.** A handle that does not
exist and an account that has never posted produce exactly the same response. Distinguishing
them needs a second call to the user-info endpoint, which is why `C4` specifies one on the
empty path. If you find yourself "fixing" the duplicate fixtures, read that section first.
