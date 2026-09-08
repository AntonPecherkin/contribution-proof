# Review — F1 participant UI

Branch `task/f1-simple-ui`, reviewed at `fe50253` against the live database, the real
provider and the deployed board. Not merged.

The brief asked for less noise and a clear path through. It got both. What follows is
ordered by whether it changes behaviour, not by how easy it is to fix.

---

## What is right, and should not be lost in a refactor

**The landing page is three lines of JSX.** It went from 112 words of chrome to a field, a
label and a button. Everything below is smaller than this.

**The Profile Score renders as a peer, not a failure.** Its own title, its own tiles —
followers, posts, posts per year — its own badges, its own note. This was the subtlest ask
in the brief and it is the thing most likely to be flattened by a later "simplification".
A third of attendees land here. It is not an edge case and must never look like one.

**Error copy blames the tooling, not the person.** "We couldn't find that handle" rather
than "invalid input".

**Progressive disclosure.** The score arrives alone; everything else is behind *Explore my
result*. That is the right shape for someone holding a phone at a booth.

**Consent as the button label** — `Analyze my public posts`, recorded as
`explicit-analysis-button-v1`. A deviation from the brief's checkbox, and a defensible one:
it removes a control from the landing screen and the action is unambiguous. Keep it, but
keep it deliberately.

---

## Fixed during review — do not reintroduce

### `boardOptIn` was hardcoded `false`

The room board could never receive a single person. An entire feature, deployed and public,
with no path to data.

Now an unchecked checkbox on the register step. **Unchecked is the requirement, not a
preference** — appearing on a public screen in a public room is a choice. Verified end to
end: opting in moves a handle into `justIn` and `topToday`.

### Opportunities rendered `project.needs`

That field stopped existing when the catalog became the Startup Village Borneo speakers
mid-flight. Cards now name the **person and their session** — "Jemmy · MonkeDAO", "MonkeDAO
— community-led building" — and fall back to a non-link where a speaker has no public URL.

The reframing matters: the point is not "contribute to this repository some day", it is
"this person is in the building and works on what you post about".

### `no_posts_available` could reach an error screen

Reported in review, fixed in `analysis-runner.ts`. That class now **always** completes as a
Profile Score, even when the provider returns no profile at all — the runner synthesises
what it knows rather than degrading to a failure.

**This is a product rule, not an implementation detail: an account whose posts we cannot
read is a success with positive framing, never an error.** It is our limitation and roughly
a third of accounts. There is now a test asserting it cannot fail.

Nothing is needed in the UI for this, but `errorCopy` should not grow a `no_posts_available`
case — if one is ever needed, the bug is upstream.

---

## For the quality pass

### 1. Mock handlers live inside the production route files

`src/app/api/_mock.ts` is imported by three real routes and gated on `MOCK === '1'`. It is
safe and it makes offline work possible, but it puts a development fork in the request path
of every production call. Worth moving behind the provider seam, where `mock.ts` already
lives and where nothing in `src/app/api` needs to know it exists.

### 2. The analyzing screen has not been seen against a real slow fetch

Every test so far hit a cached row and returned in milliseconds. The real path is **90–140
seconds**. The escalation ladder — 10s, 60s, 180s — has never actually run. Watch a cold
handle all the way through on a phone before the event; it is the screen people will spend
the most time looking at, and the only one where the copy is doing emotional work.

### 3. Nothing has been checked at 360 px

The brief asked for it and the review was at desktop width. Attendees are on phones.

### 4. The board opt-in is invisible to anyone who does not read

One quiet line at the bottom of the register step. That is the correct weight for a privacy
choice, but it means the board will fill slowly. Worth watching in the first hour rather
than assuming; if nobody opts in, the board is a blank screen for the whole event.

### 5. `evidence` reads `20 posts · Good evidence`

Accurate, but "Good evidence" is our internal band name. Consider whether it means anything
to someone who has never seen the scoring model.

---

## Not blocking, worth knowing

- The result page never states the **date window** it analysed. The provider returns nothing
  newer than roughly a month old, so "your recent posts" is doing quiet work it cannot fully
  support. `stats.from` and `stats.to` are already in the payload.
- The share card is still to come, and the brief's word budgets have not been re-counted
  since the last change.

---

## Verified during this review

- All four routes return 200 against the live Supabase project.
- The warm lane returns `cached: true` for an existing handle and starts no new work.
- The result page renders `@nikkideyy` at **710** — the real score, from the real provider.
- 125 tests pass, typecheck and lint clean.
