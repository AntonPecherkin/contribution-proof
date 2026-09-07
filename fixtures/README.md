# Fixtures

Recorded provider responses. They let every task be built and tested with no network and no
credentials (`MOCK=1`).

## Built from an observed response, 2026-09-07

`brightdata/` mirrors the real structure of the X profile dataset: a profile row carrying an
embedded `posts[]` array. Content is invented; only the shape is real. That is the right trade
for a repository that becomes public — we need the structure, not a stranger's posts.

The quirks below are all observed, not imagined, and each has a fixture:

| Fixture | What it captures |
|---|---|
| `rich.json` | An established account. **The first post carries only a URL and a view count** — everything else null. `views` is absent on most of the rest. |
| `thin.json` | Three posts: a directional result. |
| `no_posts.json` | **The important one.** The profile comes back fine, reporting 97 posts, and `posts` is `null` anyway. Measured to happen reliably for small accounts. |
| `empty.json` | An account that genuinely has nothing. Different from the above and different copy. |
| `not_found.json` / `private.json` | Row-level `error_code`. |
| `pending.json` / `running.json` | The async trigger and an in-progress snapshot. |
| `malformed.json` | Truncated JSON. |

## What these fixtures cannot express

The dataset carries **no reply, repost or quote indicator**. Eligibility is approximated by a
leading-mention heuristic and disclosed in the result. If you are tempted to add such a field
to a fixture, it does not exist upstream and the code must not learn to expect it.
