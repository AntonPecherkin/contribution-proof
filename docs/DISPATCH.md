# Dispatch runbook

How the two agents work this repository in parallel without colliding.

## One-time setup

1. Grant your cloud agent access to this repository (it is private).
2. Environment setup command:

   ```bash
   npm ci || echo "no package.json yet — C0 has not landed"
   ```

   Tolerant on purpose: before C0 merges there is nothing to install, and a hard failure
   there blocks the very task that fixes it.

3. **No agent needs an API key.** `MOCK=1` runs the whole application on recorded fixtures.
   If a task appears to require a live credential, that is a bug in the brief — say so in
   the PR rather than asking for a secret.

## Orientation prompt — run once, before the first task

Cheap insurance. Read-only, no branch, no PR. If the answers come back wrong, the briefs
need fixing before six sandboxes act on them.

> Read `AGENTS.md`, then `docs/SPEC.md`, then `docs/tasks/README.md`, then every brief in
> `docs/tasks/`.
> Do not write any code or open a PR yet.
>
> Answer, briefly:
> 1. What are the five hard boundaries, and which one most constrains how you write a provider?
> 2. Which files may you edit for task C3, and which files are explicitly not yours?
> 3. In `ProfileResult`, what is the difference between `errorClass: 'empty'` and
>    `errorClass: 'provider'`, and why does one of them never get retried?
> 4. A provider payload has no `views` field. What value goes into `Post.views`, and why
>    does it matter downstream?
> 5. Name three things listed under "Rejected - do not reintroduce" in `docs/SPEC.md`,
>    and say what is built instead of each.
> 6. What is the definition of done, and who merges your PR?

Question 4 is the one that matters most. If it answers `0`, stop and re-read the brief with
it — that single mistake silently corrupts the score for every account whose metrics the
provider fails to return.

## Task dispatch

The briefs live in the repo, so a dispatch is two lines. Do not paste brief content into the
prompt — the repo is the context, and a pasted copy drifts from the committed one.

> Read `AGENTS.md`, then `docs/SPEC.md`, then `docs/tasks/<TASK>.md`. Implement that task exactly as specified.
> Work on branch `task/<id>-<slug>`. Run the acceptance commands, satisfy every item in the
> definition of done, and open a PR. Do not merge it.

## Order

C0 is a hard gate: nothing installs until it lands.

```
NOW      ├── Codex:  C0 scaffold
         └── Claude: contracts, fixtures, skipped test files
                     (disjoint files — genuinely parallel)

C0 in    └── Codex:  C5 settings/ratelimit  ┐ need only C0,
                     C6 analytics           ┘ not Claude's Wave 0

Wave 0   └── Codex:  C1 scoring       ┐
  in                 C2 normalize     ├ need Claude's tests + fixtures
                     C4 twitterapi    ┘ (critical path - the only provider)
```

C1, C2, C4, C5 and C6 all branch from the same commit and touch disjoint files, so they merge in any order.

## The one rule that keeps six parallel PRs mergeable

**No Wave 1 task may add a dependency.** C0 owns `package.json` and the lockfile. Six
sandboxes each running `npm install` produce six conflicting lockfiles, and resolving that
by hand costs more than every task saved.

If a task genuinely cannot be done with what C0 installed, stop and say so in the PR. Do not
install it.

## Review

Nobody merges their own PR.

- Claude reviews each Codex PR against its brief: acceptance tests satisfied, file list
  respected, no frozen contract edited, no `null` collapsed to `0`.
- Codex reviews each Claude PR for data correctness, privacy leaks, API misuse, and missing
  test coverage.

A PR that changed a frozen contract is rejected on sight, not negotiated — another agent is
building against it right now.
