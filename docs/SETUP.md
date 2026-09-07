# Setup

About fifteen minutes, mostly clicking. Nothing here needs schema design — the migrations
are written and validated.

## 1. Supabase — the database

1. Create a project at [supabase.com](https://supabase.com). Any region near the event.
2. Open **SQL Editor**, paste the whole of **`supabase/schema.sql`**, and run it once.
   That is every migration in order. Running it twice fails loudly rather than silently
   duplicating, which is deliberate.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** → `SUPABASE_URL`
   - Under **Secret keys**, the `default` one → **Reveal** → `SUPABASE_SECRET_KEY`.
     It begins `sb_secret_`.

**Take the Secret key, not the Publishable one.** Supabase renamed these — `anon` is now
Publishable and `service_role` is now Secret. The page shows both, and the Publishable key
will connect without error and then silently return nothing, because it has no privileges.

**The Secret key bypasses row-level security.** That is correct here — the browser never
touches the database, and every read goes through an API route that serializes an allowlist
— but it means the key must never appear in client code or in any variable prefixed
`NEXT_PUBLIC_`.

A project created before the rename can use `SUPABASE_SERVICE_ROLE_KEY` instead; the code
accepts either.

### Why this project needs a database at all

The analysis row *is* the job. Without it there is no polling to drive, no 24-hour cache, no
leads, no kill switches and no board. Serverless functions do not share memory, so two
requests from the same person land on different machines; in-process state cannot work.

## 2. Local

Add to `.env.local` — the file is gitignored and already has the other keys:

```
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

**Paste with your editor, not the terminal.** A command echoes into the session transcript,
and a malformed line has already leaked one key that way. No spaces around the `=`.

Then:

```bash
npm run dev          # real database
MOCK=1 npm run dev   # fixtures, no database, no keys
```

## 3. Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. **Settings → Environment Variables**, for all environments:

   | Name | |
   |---|---|
   | `SUPABASE_URL` | |
   | `SUPABASE_SECRET_KEY` | the Secret key, not Publishable |
   | `BRIGHTDATA_API_KEY` | |
   | `BRIGHTDATA_X_PROFILE_DATASET` | `gd_lwxmeb2u1cniijd7t4` |

   **Never prefix any of these `NEXT_PUBLIC_`** — that ships the value to every visitor.

3. Deploy.

## 4. Check it

```
/api/events/hackathon-2026/board     → JSON, not an error
/board/hackathon-2026                → the room board
```

An empty board with `0 builders` is success: the database answered and the room is empty.

## Event day

The `settings` table is the control panel, editable from a phone in the Supabase dashboard.
Changes take effect within 30 seconds, no redeploy:

| Key | |
|---|---|
| `analysis_enabled` | `false` pauses new analyses |
| `primary_provider` | `"mock"` serves fixtures if collection fails |
| `demo_mode` | `true` serves seeded results |
| `max_analyses_per_event` | provider budget cap |
| `per_ip_hourly_cap` | |

Have this page open on your phone before the doors open.
