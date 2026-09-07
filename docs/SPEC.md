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
- Up to the **latest 20 eligible public posts**. The intent is original posts, thread roots
  and quote posts, with replies and reposts excluded — but the provider exposes no such
  indicator, so this is approximated and disclosed rather than guaranteed.
- **No language model, and no external service beyond the post provider.** Every judgement
  is a pure function of the text: reproducible, inspectable, free, and measured at 3–9 ms.
- An experimental **0–1000** score from four public components.
- **Four headline cards** with the score decomposed into visible component bars, a Power
  Topics section, fun stats, three contribution opportunities, and a downloadable share
  image.
- A **Profile Signal** for accounts whose posts the provider will not return.
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

4. Result         score, evidence, four cards, Power Topics, fun stats,
                  three opportunities, share card
                  — or a Profile Signal when there are no posts to read
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

A separate state exists for accounts the provider cannot read at all: no score, and copy that
makes clear the limitation is ours, not theirs.

Always display the real analyzed count. Zero eligible posts must never render as a score of 0.

### Score

Experimental. Four components worth 250 each are summed to a raw 0–1000, then mapped onto
**100–1000** and rounded to the nearest 10. Every component is capped independently, so none
can run away with the total.

**One scale, two non-overlapping ranges.** A Profile Score tops out at 100; a Contribution
Score starts there. Every card reads the same way and shows a bare number, yet a bio can
never appear to beat twenty analysed posts, and nobody has to be told their number belongs
to a different system. A full analysis with zero technology posts scores 100 — last among
analyses, still ahead of an account we could not read at all.

**One gate applies first: with zero technology posts, all four components return 0** —
including reach. Without it, a popular non-technology account would collect points for
attention its contribution never earned.

#### 1. Topics — how much of what you post is about technology

```
250 × (technology posts ÷ eligible posts)
```

Post text is matched against a 17-topic keyword taxonomy; one hit makes a post technology.
Keywords of four characters or fewer must match as standalone words — without that rule,
"did" matches "did we just", and it did.

A **proportion, not a count**: nine technology posts out of twenty beats nine out of a
hundred. It measures focus.

#### 2. Depth — do you explain, or just mention

```
250 × mean depth of your technology posts
```

Each post scores 0–1:

| Signal | Adds |
|---|---|
| Length, saturating at 250 characters | up to 0.35 |
| Explanatory words — because, why, how, tradeoff, which means | 0.30 |
| A measured claim — `40%`, `p95`, `2.3x`, `120ms` | 0.20 |
| Thread marker — `1/6`, 🧵 | 0.15 |

Two overrides: a link-only post scores 0.05, and anything under 50 characters is capped at
0.15 — a remark stays a remark however many keywords it contains.

These are proxies for explanation, not comprehension. A well-written short post will
underscore and a long rambling one will overscore. That is the accepted cost of a measure
anyone can check by hand.

#### 3. Streak — did you keep at it

```
250 × (longest run of consecutive weeks ÷ 4), capped at 4
```

Consecutive calendar weeks containing at least one technology post.

This replaced a spread measure that gave four posts scattered across four years full marks,
because perfectly spread is arithmetically perfect consistency. A streak cannot be gamed
that way, and reads better on a card than an evenness index.

#### 4. Reach — did it land

```
250 × (0.7 × views + 0.3 × replies)
```

Each log-scaled against a ceiling — 500,000 views, 2,000 replies — so a tenfold jump moves
the score by a few points, not hundreds. One viral post cannot dominate.

Totals span **technology posts only**, not the account.

**A metric the provider did not report scores 0.35, not 0.** Views are absent on posts from
before 2023 and present on essentially all posts since; treating absence as "nobody saw it"
would punish people for a gap in our data.

### Four cards (v1)

Technology Contribution Score · Technology posts · Public views · Active weeks, with the
four components shown as bars so the total is always decomposable on screen.

Power Topics is a separate wide section beneath them, not a fifth tile.

### Fun stats

The entertaining half, all plain facts about the posts we read — no judgement, nothing to
argue with, and the part people screenshot:

window analyzed · posts analyzed · longest streak · busiest weekday · median post length ·
longest post · thread starts · link share rate · question rate · best post · total and
median views.

### Profile Signal — the result when there are no posts

Roughly a third of accounts return a null posts array, concentrated in accounts that have
posted less often. At a developer event that is most of the room, so this is a first-class
result, not an error page.

It carries a **Profile Score of up to 100**, on the same visible scale the Contribution Score
starts from. Rendered bare, like every score here.

The bands are deliberately warm at the bottom: an earlier set handed a real account a 19,
which is a rough thing to give someone at their own event. Showing up with an account clears
the first band of every component; the top bands still take real scale to reach.

Four components of 25, weighted toward size and activity:

| Component | Bands |
|---|---|
| **Audience** | followers: 0 · 50 · 250 · 1k · 5k · 20k |
| **Output** | total posts: 0 · 50 · 300 · 1.5k · 8k |
| **Activity** | posts per year: 0 · 6 · 30 · 100 · 350 |
| **Topics** | technical areas in the bio: 1 · 2 · 3 |

Stepped bands rather than a log curve, because a log scale is far too generous at the bottom:
186 followers against a 10,000 ceiling still returns 0.57, so a small account collected most
of a component it had not earned. Below the first band a component scores zero.

An earlier version paid a quarter of the score for tenure and a quarter for bio keywords, so
a dormant six-year-old account posting seventeen times a year scored 82. **Age and vocabulary
are not contribution.** Audience, output and rate are at least evidence of it.

A missing fact scores 0 for its part rather than blocking the score — we would rather hand
someone 41 from three parts than nothing from four. Both directions of the follower ratio
earn equal credit: being followed is reach, following widely is participation, and neither
is a shortfall.

A headline — `Class of 2020`, else the top bio topic, else `New around here` — and badges
drawn from the profile: Verified, Long hauler / Established / Fresh start, Prolific /
Steady hand / Selective, Carries / Curious, Range / Focused, Ships things, On the map.
Topics come from the bio, read through the same taxonomy the posts use.

**No signal may be a deficit.** 186 followers against 587 following is "Curious — follows
more people than follow back", never "only 186". Posting seventeen times a year is
"Selective — posts when there is something to say". A test asserts the copy contains no
shortfall language. If a fact cannot be said warmly and truthfully, it is left out.

The accompanying note names the provider as the limit and ends "Nothing about your account
is wrong", because the failure is ours and should read that way.

## Latency

Collection is asynchronous and slow, and it is the only slow thing left. Measured against
our own account: **85–127 seconds** to trigger, poll and download one profile — and **3–9
milliseconds** for everything after it, because everything after it is a pure function.

| Lane | When | Total |
|---|---|---|
| **Warm** | handle already in the 24h cache | ~1–2 s |
| **Cold** | anything else | ~90–140 s |

Hard failure at **180 seconds**, with a retry offered.

There is no fast lane. Everything that makes this bearable is pre-computation:

1. **Pre-warm the event's known handles the night before.** One trigger takes thousands of
   URLs, which is the provider's genuine strength. This is not an optimisation; without it
   most participants wait over two minutes.
2. **Publish the link before the event**, so early scans warm their own entries.
3. **Start collection at the handle step**, not after the email step, so the 15–20 seconds
   someone spends typing an email is time already spent.

### The Analysis Journey

Four stages advancing on real events, minimum 900 ms dwell, then honest escalation:

- **10 s** — `Collecting your public posts. This usually takes a minute or two.`
- **60 s** — `Still collecting — you can leave this page open, we'll finish.`
- **180 s** — fail, with a retry button.

**No countdown timer and no playful filler.** A progress bar implying a duration the system
cannot honour is the one failure people do not forgive, and here we genuinely cannot predict
it. Say what is happening and let it take the time it takes.

### Two limits the result must disclose

**Not every account can be read.** The provider returns a profile with a null posts array for
small accounts — measured on an account with 97 posts and 186 followers, three times running,
while large accounts returned 98 and 100 posts. At a developer event this is a common outcome,
not an edge case. It gets its own result state (`no_posts_available`) and copy that blames the
tooling rather than the person: their account is fine, we could not read it.

**Eligibility is approximate.** The provider carries no reply, repost, or quote indicator. A
leading `@mention` catches most replies; nothing identifies a repost or a quote. So the stated
rule — original posts, thread roots and quotes only — is not enforceable, and the result must
say that plainly instead of implying a precision we do not have.

---

## Architecture

- Next.js App Router on Vercel; Postgres owned only by this product.
- A swappable `PostProvider` interface; the primary is chosen at runtime, not at build time.
- **No model call.** Classification, depth, scoring and stats are pure functions over the
  provider's response, so an analysis cannot fail for a reason outside this repository.
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
| A second post provider alongside the first | One provider, disclosed limits | Two providers means two eligibility semantics and two result qualities in the same room. One honest limitation beats two inconsistent ones. |
| A language model judging posts | Keyword topics plus heuristic depth | The model read intent better, but cost a key, a credit balance, ~10 s, and a class of failures outside this repo. Deterministic scoring is reproducible, inspectable and free — and at a booth, being able to show which words matched beats a subtler judgement nobody can check. |
| Denominators on either score | Bare numbers everywhere | `82/100` beside `660/1000` invites percentage arithmetic across two measurements that are not comparable. No slash, no invitation. |

---

## Definition of done

- End-to-end production flow works against real providers.
- `MOCK=1` runs the whole application from fixtures, with no network and no credentials.
- The full test suite passes with an entirely empty environment (`env -i`).
- An account whose posts come back null receives a Profile Signal, not an error.
- Lint, strict typecheck, all unit and contract tests, and the smoke test pass.
- Invalid, private, empty, slow, and malformed-provider cases each behave correctly, and zero
  eligible posts yields no score rather than a score of zero.
- A duplicate handle does not inflate board totals; concurrent duplicates produce one fetch.
- A non-opted handle appears nowhere in any public payload.
- No raw post text is persisted; no secret is committed.
- Repository history contains nothing copied from a private repository.
- Pre-computed demo results are cached and verified before the event.
- The kill switches have each been flipped, from a phone, against production.
