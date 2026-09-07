# Contribution Proof — product specification

The settled product decisions. `AGENTS.md` says how to work here; this says **what to build**
and, just as importantly, **what was deliberately left out**.

If a summary of this project disagrees with this file, this file wins. Re-read it rather than
working from a recollection of it — several decisions below reverse an earlier draft, and the
earlier draft is the version that tends to resurface.

---

## What it is

An attendee at an event submits one public X handle and receives an evidence-bounded
**Technology Contribution Result**: an experimental 0–1000 score derived from their recent
public posts, shown alongside the evidence it rests on. They may opt in to a live room board,
and are recorded as an early-access lead.

## What it is not

A measure of engineering skill, seniority, or worth. It reads public posts and nothing else.
Someone who builds constantly and posts rarely scores low, and that is a property of the
instrument rather than of them. Every surface must keep this honest — the score is always
shown with how many posts were actually analyzed and how confident that sample makes it.

---

## Scope

### In v1

- One self-declared X handle per submission. **Ownership is not verified**, and every surface
  showing a handle says so.
- Email registration with required consent, plus a **separate, unchecked** board opt-in.
- Up to the **latest 20 eligible public posts**: original posts, thread roots, and quote posts.
  No replies, no reposts.
- An experimental **0–1000** score from four public components.
- **Four headline cards**, a Power Topics section, a short narrative, three contribution
  opportunities, and a downloadable share image.
- One preconfigured event and one public, sanitized room board.
- A standalone Postgres database owned only by this product.

### Deferred to Phase 2

Market-intelligence enrichment (two further cards: market relevance and smart amplification,
plus market context in opportunity matching) · wallet / onchain analysis · multiple handles ·
X OAuth ownership verification · public result pages · an event builder · an admin UI ·
permanent raw-post storage.

**Nothing in this list may be built in v1.** The card grid must accept a fifth and sixth tile
later without a relayout; that is the only accommodation Phase 2 gets.

---

## Participant flow

The ordering is deliberate and is the single largest latency win in the design.

```
1. Landing        one handle field + a REQUIRED "analyze my public X posts" checkbox
                  → submitting starts the provider fetch immediately

2. Register       email + required early-access consent + UNCHECKED board opt-in
                  → the fetch has been running the whole time the person was typing

3. Analyzing      four truthful stages, polling

4. Result         score, evidence, four cards, Power Topics, narrative,
                  three opportunities, share card
```

Analysis consent sits on **step 1**, not step 2, so that consent still strictly precedes
analysis while the 15–20 seconds someone spends typing an email becomes fetch time nobody
pays for. Collecting the handle and the email on one screen, or starting the fetch after the
email, both forfeit this.

The known trade: a person who abandons at step 2 has cost a provider call and left no lead.
Rate limits and the 24-hour cache bound it. Accepted.

---

## Result model

### Evidence bands

| Eligible posts analyzed | Band |
|---|---|
| 15+ | `Good evidence` |
| 5–14 | `Limited evidence` |
| 1–4 | `Directional result` |
| 0 | **No score at all** — explain, offer retry |

Always display the real analyzed count. Zero eligible posts must never render as a score of 0.

### Score

Experimental, 0–1000, four components capped at 250 each, rounded to the nearest 10:

1. **Relevance** — share of eligible posts classified as emerging-technology content.
2. **Explanation** — mean rating for explaining rather than merely mentioning.
3. **Consistency** — spread of relevant posts across active weeks, capped at four weeks.
4. **Public response** — log-scaled, capped views and conversations, so one viral post cannot
   dominate.

Deterministic code owns every number. The language model classifies and writes prose; it never
computes an arithmetic result.

### Four cards (v1)

Technology Contribution Score · Technology posts · Public views · Active weeks.

Power Topics is a **separate wide section** beneath them, not a fifth tile.

### Narrative and opportunities

One structured model request returns per-post classification, topics, Power Topics, and a
short narrative. The narrative may only restate structured evidence — never invent a number,
never predict adoption or impact. Three opportunities come from a versioned public catalog,
matched on topic overlap and declared contribution needs. Sponsors are labelled and receive
no hidden ranking boost.

### Copy rules

- Score renders as a bare number: `820`, never `820/1000`.
- `Contribution opportunity` — never "predicted adoption", never "guaranteed impact".
- Missing provider values render `Not available`, never `0`.
- The result page states `We'll email you when early access opens.` **Nothing is sent during
  the event**; leads are exported afterwards.
- The board is headed `Top accounts analyzed in this room` with a permanently visible note
  that X ownership is not verified.

---

## Latency

The provider answers synchronously in well under a second, so the whole analysis is bounded by
the model call rather than by data collection.

| Step | p50 | p95 |
|---|---|---|
| Provider fetch | 0.8 s | 2.5 s |
| Eligibility filter, normalization | ~0 | ~0 |
| Classification + narrative (one call, cached prefix) | 5 s | 12 s |
| Score, catalog match | ~0 | ~0 |
| Persist | 0.2 s | 0.5 s |
| **Total** | **~7 s** | **~15 s** |

Hard failure at **25 seconds**, with a retry offered.

A handle already in the 24-hour cache returns in **~1 second**, which is why pre-warming the
event's known handles the night before is still worth doing — not because the live path is
slow, but because instant is better than fast.

### The Analysis Journey

Four stages advancing on **real events**, minimum 900 ms dwell each so it does not strobe.
Reassurance copy only if the job exceeds 8 seconds; failure at 25.

**No countdown timer, and no playful filler.** A progress bar implying a duration the system
cannot honour is the one failure people do not forgive. This matters even at seven seconds:
the temptation is to pad the wait to make the result feel earned, and padding is lying.

### A note on provider choice

An earlier draft named a different primary provider, chosen because the team already had an
account and knew its behaviour. Measurement showed it returns profile metadata but **no post
content at all** — a null posts array against a profile reporting 97 posts, on two separate
accounts, after 85–127 seconds. Its companion posts dataset requires individual post URLs and
cannot enumerate a timeline.

The lesson generalises past this project: *"we already use it and it works"* was true of the
transport and false of the payload, and nobody noticed because a neighbouring integration
against a different network succeeded. **Measure the specific thing you need, against your own
account, before building on it.** That is why the provider sits behind a swappable interface
and a runtime flag.

---

## Architecture

- Next.js App Router on Vercel; Postgres owned only by this product.
- A swappable `PostProvider` interface; the primary is chosen at runtime, not at build time.
- **One model call per analysis**, using a byte-stable cached prefix (taxonomy + rubric +
  examples) with the participant's posts appended after the cache breakpoint. The prefix is
  identical for every participant, which is what makes it worth caching.
- Server routes own every credential. Nothing reaches the browser but an allowlisted payload.

### The analysis row is the job

There is **no queue service and no signed job token.** A row in `analyses` is the unit of work:

- `POST` inserts the row and returns its id; work continues after the response.
- `GET` on that id polls it, and re-triggers work if the row has been live past a threshold.
- A **partial unique index** on `(event_id, x_handle_normalized)` over live statuses supplies
  idempotency and single-flight for free: a duplicate submission returns the existing row
  rather than paying a second provider bill.
- A completed row inside its cache window **is** the 24-hour derived cache. Expiry archives it
  out of the index so the handle can be analyzed again.

This survives a page refresh, a phone switching networks mid-analysis, and a redeploy.

### Runtime flags

Held in a `settings` table, read per request with a 30-second cache — **not** environment
variables, which need a redeploy:

`analysis_enabled` · `turnstile_enabled` · `primary_provider` · `demo_mode` ·
`max_analyses_per_event` · `per_ip_hourly_cap`

The point is operational: someone standing at a booth with a queue in front of them can swap
providers or disable the bot gate from a phone in fifteen seconds.

`demo_mode` serves pre-computed results for a handful of known handles, so the demo still works
if every provider is down at once.

---

## Privacy and data rules

- **Raw post text is never persisted.** Fetch, classify, reduce to counts, discard.
- **`null` is not `0`.** A metric the provider did not report is `null` everywhere — in the
  provider mapping, in the database, in the score, and on screen. Collapsing the two is a
  correctness bug, not a formatting choice.
- Board inclusion is **opt-in, off by default**, and separate from analysis consent. A
  non-opted handle must be absent from the board response payload itself, not merely hidden by
  the client.
- No database credential reaches the browser. No client-side database access.
- Aggregates count **one completed analysis per handle per event**, so several people
  requesting the same account cannot inflate the room totals.

---

## Rejected — do not reintroduce

These were considered and deliberately dropped. Each has resurfaced in at least one summary of
this project, which is why they are written down.

| Rejected | Instead | Why |
|---|---|---|
| A server-signed stateless pending token as the job handle | The `analyses` row is the job | The token was insurance against an async provider. It adds signing, expiry and clock-skew handling, does not survive a redeploy, and supplies none of the idempotency the index gives free. |
| An entertaining countdown during analysis | Four truthful stages with escalation | A countdown over a job whose duration is unknown is a lie the user catches. |
| Six cards / market-intelligence enrichment in v1 | Four cards; enrichment is Phase 2 | Costs a vendor dependency and build time the latency work needs more. |
| A 10-minute raw provider-data cache | No raw persistence at all | Directly contradicts the raw-text rule. The 24-hour **derived** cache is the whole caching story. |
| Handle → email → *then* analyze | Consent + handle first, email during the fetch | Forfeits 15–20 seconds of free fetch time per participant. |
| Realtime websockets for the board | 5-second polling | Venue Wi-Fi drops websockets; a reconnect bug on a projector is unrecoverable. |
| A job queue, Redis, an ORM, an analytics vendor | Postgres and the framework | Each is a plausible-looking day of work that buys nothing at this scale. |
| A scraping-dataset provider as the post source | A synchronous API that returns tweets | Measured: it returns profile metadata with a null posts array, takes 85-127 s, and its posts dataset cannot enumerate a timeline. |

---

## Definition of done

- End-to-end production flow works against real providers.
- `MOCK=1` runs the whole application from fixtures, with no network and no credentials.
- Lint, strict typecheck, all unit and contract tests, and the smoke test pass.
- Invalid, private, empty, slow, and malformed-provider cases each behave correctly, and zero
  eligible posts yields no score rather than a score of zero.
- A duplicate handle does not inflate board totals; concurrent duplicates produce one fetch.
- A non-opted handle appears nowhere in any public payload.
- No raw post text is persisted; no secret is committed.
- Repository history contains nothing copied from a private repository.
- Pre-computed demo results are cached and verified before the event.
- The kill switches have each been flipped, from a phone, against production.
