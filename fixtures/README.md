# Fixtures

Recorded provider responses. They let every task be built and tested with no network and no
credentials (`MOCK=1`).

## Provisional — shaped from documentation, not yet recorded

`twitterapi/` matches the documented response schema for **Get User Last Tweets**: the
envelope (`tweets`, `has_next_page`, `next_cursor`, `status`, `message`) and the tweet fields
we consume (`id`, `text`, `createdAt`, `viewCount`, `replyCount`, `retweetCount`, `likeCount`,
`isReply`, `quoted_tweet`, `retweeted_tweet`, `author`).

That is a much stronger position than the previous provider's fixtures, which were guessed and
turned out to describe a response that does not exist. But it is still documentation rather
than observation.

**Once a key exists, record one real response and reconcile**: call the endpoint for an account
you control, save the raw JSON, drop every field the code does not read, and diff it against
`rich.json`. Fix any mismatch before trusting the provider tests.

## Sanitizing

Fixtures are committed to a repository that becomes public. Keep only fields the code reads.
Handles and post text must be invented, never a real person's.
