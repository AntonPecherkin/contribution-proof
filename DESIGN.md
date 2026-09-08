# Design

## Source of truth
Draft · refreshed 2026-09-08. Participant handle → email → analysis → result.
Evidence: `docs/SPEC.md`, `docs/reviews/F1-participant-ui.md`, `src/app/_ui/`,
`src/app/globals.css`, and the user's approved ContentDC mockup direction.
User decisions: minimal copy, no mascot, topics inside the result card, richer share badge later.

## Brand
Friendly, understated web3. Use the supplied ContentDC logo and Inter.
Avoid mascots, hype, fake progress and unearned claims about skill.

## Product goals
Get an attendee from handle to an understandable result with little reading.
Success: a usable mobile journey and a result worth sharing. No new scoring or account features.

## Personas and jobs
Event attendees on phones, often on slow venue Wi-Fi: submit, understand, explore, share.

## Information architecture
One field per entry screen. Result reveals the score first; Explore reveals four metrics
and topics in one card. Share follows immediately, then optional explanations and speakers.

## Design principles
Keep the main action obvious. Group related facts. Reveal detail on demand.
Prefer small CSS improvements over a new animation or component dependency.

## Visual language
Dark #171717; purple #4f00af, green #07db71, blue #58b8fe, yellow #dbbd07.
Inter, 24px page gutters, 8px grid gaps, rounded cards. Quiet entrance motion under 500ms.
Never animate fabricated score values or imply a predictable fetch duration.

## Components
Reuse Shell, EntryForm, Journey and Result. Result owns its metrics and topic group;
three topics appear initially, the remainder expand inside the card. Both analysis and
profile results retain their own labels, values and explanations.

## Accessibility
Maintain keyboard access, visible focus and readable contrast. Explore transfers focus to
Share without scrolling. Reduced motion disables transitions and animation. No hover-only actions.

## Responsive behavior
Check 360px and larger. Two-column metrics, wrapping topic chips, no horizontal overflow.
Keep all meaningful content available at larger text sizes; no fixed card height.

## Interaction states
Loading: truthful API stages and 10s/60s reassurance; retry at 180s.
Offline: bounded polling requests and reconnection. Errors blame the tooling.
Success: score, then details on request. Sharing: disabled while preparing, retryable on error.
Missing metrics remain unavailable; no-post provider fallback is a positive Profile Score.

## Content voice
Short and concrete. Evidence count and date window stay visible. Board inclusion remains
an explicit unchecked choice. Ownership disclosure belongs with results.

## Implementation constraints
Next.js and existing CSS; no new dependencies. Keep frozen API contracts and privacy rules.
Validate both result types, sharing, keyboard focus and mobile screenshots. Keep work a draft.

## Later improvements
- **Share badge preview (medium, roughly 1–2 development days including browser QA):**
  a short designed image directly below the result. ContentDC logo, handle, large score,
  exact score type, up to three topics, small evidence/date and experimental/ownership note.
  Preview and downloaded PNG must use the same renderer. Keep one Share / Save action;
  test native sharing on iOS and Android, long handles/topics and missing profile values.
- **Score-to-tile morph (medium, roughly half to one day including reduced-motion QA):**
  preserve the score's visual position while the other tiles appear; use a supported-browser
  transition with a plain fallback. Current staggered entrance is the inexpensive draft.
- **Live event validation:** cold provider run on a physical phone; observe board opt-in uptake.
  Provider-seam mock cleanup remains a separate backend task.

## Open questions
- [ ] Confirm share badge format: square for posts, or an additional portrait export.
  Default next iteration: square only to bound cost.
- [ ] Decide whether a share badge needs a public link; public result pages remain out of v1 scope.

Effort estimates are rough, not commitments. No badge preview or richer export is implemented in this pass.
