# Fixtures

Recorded provider responses. They let every task be built and tested with no network and
no credentials (`MOCK=1`).

## PROVISIONAL — read before implementing C3

The files in `brightdata/` are **shaped from public sample data, not recorded from our
account.** The field names are plausible but unverified.

**Before dispatching C3, replace them with one real recorded response**, sanitized:

1. Call the scraper once for an account you control.
2. Save the raw JSON.
3. Remove every field the application does not consume, and any field naming a third party.
4. Derive the other fixtures from that real shape.

If C3 is implemented against a guessed shape, it will pass its tests and fail against the
live API — the worst possible outcome, because the tests will say it works.

`twitterapi/` is in the same position and gates C4.

## Sanitizing

Fixtures are committed to a repository that becomes public. Keep only fields the code
reads. Handles and post text in fixtures should be invented, not real people's.
