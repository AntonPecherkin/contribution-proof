# Task briefs

One file per task. Each is self-contained — paste it whole into a fresh agent session; it
should not require reading anything else except `AGENTS.md`.

## Waves

Tasks in the same wave are **independent** and touch disjoint files. Dispatch them together.

| Wave | When | Tasks | Blocked by |
|---|---|---|---|
| 0 | H0–2 | C0 scaffold | nothing |
| 0 | H0–6 | *(Claude: contracts, fixtures, failing tests)* | nothing |
| 1 | H6 | C1, C2, C3, C4, C5, C6 | C0 + Claude's Wave 0 |
| 2 | H18 | C7 catalog, C8 prewarm | C1, C3, and the taxonomy |
| 3 | H28 | C9 share card, C10 Playwright smoke | the participant routes |

Wave 2 and 3 briefs are written once their inputs are settled — writing them now would
mean guessing at a taxonomy and a result shape that do not exist yet.

## Reading a brief

**Consumes** lists what already exists that you may import. **Produces** lists the exact
names other tasks will import from you — these are a contract, so do not rename them.
**Acceptance** is mechanical: the tests either pass or they do not.
