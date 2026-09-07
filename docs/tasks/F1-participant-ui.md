# F1 — Participant UI

**Owner:** frontend agent · **Blocked by:** nothing (the data layer is complete and mockable)

This brief describes **what the experience must do and feel like**. It does not prescribe
markup, component structure, animation library, or layout. Those are yours. Where this file
gives a number, treat it as a hard limit; everywhere else, use judgement.

## The situation you are designing for

A person is standing at a conference booth with a phone, possibly holding a drink, with
other people waiting behind them. They will give you **five seconds** to understand what
this is. They are not reading a landing page. They want to see their number and show a
friend.

Every decision follows from that.

## The flow

```
1. LANDING     one input, one button
2. REGISTER    email, while the fetch already runs
3. ANALYZING   progress, 90-140s
4. RESULT      the number, then everything else
```

### 1. Landing

One handle field. One consent checkbox. One button. Nothing else on the screen.

The fetch starts here, not after the email — that is why consent lives on this screen, and
it is the single most important structural fact in the flow. Do not move it.

### 2. Register

Email, a required consent, an unchecked board opt-in. Collection is already running behind
this screen; that is 15-20 seconds of latency the participant never experiences. Do not add
a "please wait" — they should not know anything is happening yet.

### 3. Analyzing

Ninety to a hundred and forty seconds. This is the hard screen, and the only one where
motion is doing real work rather than decoration.

Four stages, advancing on real events from the API, never on a timer. Minimum 900 ms per
stage so it does not strobe. Escalate honestly as time passes — at 10s say it takes a
minute or two, at 60s say they can leave the page open, at 180s fail with a retry.

**No countdown, no progress percentage, no fake filler.** We genuinely cannot predict the
duration, and a bar that implies we can is the one thing people do not forgive. Something
alive and non-committal — a pulse, a drift, a slow build — is honest where a bar is not.

### 4. Result

The number arrives first and alone. Everything else can follow it in, but nothing shares
the first moment with it.

Then, in this order: the four component bars, Power Topics, fun stats, opportunities, share.

**Two result types.** Most accounts get a Contribution Score (100-1000) from their posts.
Roughly a third get a Profile Score (up to 100) built from their profile, because the
provider would not return their posts. **The second must not look like a failure state.**
Same layout, same weight, same care — it has its own badges and headline, and its own
number on the same scale. Read `docs/SPEC.md` for both shapes.

## Rules

1. **One decision per screen.** If a screen asks two things, split it.
2. **Word budget: 25 words of chrome on landing, 30 on any other screen.** Chrome means
   everything that is not the participant's own data. The current build has 112 on the
   landing page alone. Count them.
3. **No explaining before the result.** Nobody reads how it works before they have a
   number. Afterwards they read everything. Put the explanation there.
4. **Never show a denominator.** `820`, never `820/1000`.
5. **A missing value reads `Not available`, never `0`.** They mean different things and the
   score treats them differently.
6. **Nothing on the Profile Signal may read as a shortfall.** The copy in the data layer
   already follows this; do not add copy that undoes it.

## Visual direction

Take the palette from the existing app, which the current build already extracted correctly:

```css
--background:#151515;  --panel:#202020;  --muted:#b2b2b2;
--line:#393939;        --purple:#a769ff; --yellow:#f0d600;
```

Dark, near-black, violet and yellow as accents. **Use Inter**, not Arial — the current build
has the wrong family. Large confident numerals; the score is the hero of the result screen
and should be sized like it.

Beyond that the visual language is yours.

## Motion

Animate **between** stages, not within them. Transitions should make the flow feel like one
continuous thing rather than four pages. The score arriving is the one moment worth a real
animation — count-up, reveal, whatever you think lands.

Respect `prefers-reduced-motion`.

## Delete from the current build

Named specifically because they are the noise:

- The three-step "how it works" section on the landing page
- The eyebrow labels (`YOUR IDEAS LEAVE A TRACE`, `START WITH YOUR HANDLE`)
- The `signal-strip` of three feature phrases
- The intro paragraph and the disclaimer beneath it
- The second heading on the form panel

The disclaimer is not gone, it moves: **below the result**, where someone who wants to argue
with their score can find it.

## Data

Everything is server-side and complete. `MOCK=1` runs the whole flow from fixtures with no
network and no credentials — build entirely against it.

Shapes: `ScoreInput` and `Components` in `src/lib/scoring.ts`, `FunStats` in
`src/lib/stats.ts`, `ProfileSignal` in `src/lib/signal.ts`, `ProfileSummary` and
`ProfileResult` in `src/lib/providers/types.ts`.

Real measured values to design against, so nothing is invented:

| | score | note |
|---|---|---|
| SuperteamMY | 780 | rel 213 · exp 76 · streak 250 · reach 212 |
| jemmmyjemm | 760 | 13 of 19 posts technical |
| nikkideyy | 710 | 5-week streak |
| naval | 460 | huge account, 1 technical post |
| ContentDC | 54 | profile only, 2 topics |
| AChuhnina | 26 | profile only, no bio topics |

**Design for the bottom of that range as carefully as the top.** A 26 will be handed to a
cofounder at their own event.

## Done when

- The flow works end to end under `MOCK=1`, on a 360 px phone.
- Both result types are reachable and neither reads as an error.
- Word budgets hold.
- Reduced motion is respected.
- `npm run lint`, `npx tsc --noEmit` and `npx vitest run` pass.
