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

## 3. Deploy to the VPS

Self-hosted rather than serverless, and not only for cost. Bright Data collection takes
85-140 seconds, and `after()` on a long-lived process simply finishes its work instead of
racing a function freeze - which is the failure the stale-row revival exists to catch.

On the server, matching the shape used for the other services here:

```bash
git clone https://github.com/AntonPecherkin/contribution-proof.git
cd contribution-proof
```

Create `.env` beside `docker-compose.yml` - compose reads it automatically:

```
SUPABASE_URL=
SUPABASE_SECRET_KEY=
BRIGHTDATA_API_KEY=
BRIGHTDATA_X_PROFILE_DATASET=gd_lwxmeb2u1cniijd7t4
```

Then:

```bash
docker compose up -d --build
curl -s localhost:3020/api/events/hackathon-2026/board   # should be JSON
```

Add `nginx.conf` to the site config, point a subdomain at it, and issue a certificate:

```bash
sudo certbot --nginx -d proof.contentdao.app
sudo nginx -t && sudo systemctl reload nginx
```

**The proxy timeouts in `nginx.conf` are load-bearing.** A default 60-second `proxy_read_timeout`
cuts the first request of every cold analysis, because collection routinely runs past it.

**`X-Forwarded-For` is also load-bearing** - the rate limiter hashes it, and without the header
every visitor shares one bucket and the tenth person of the day is refused.

### Redeploying

```bash
git pull --ff-only && docker compose up -d --no-deps --build contribution-proof
```

The image carries no secrets: every key is read at call time, so the same image runs
anywhere and rebuilding never bakes a credential in.

## 4. Check it

```
https://proof.contentdao.app/api/events/hackathon-2026/board   → JSON
https://proof.contentdao.app/board/hackathon-2026              → the room board
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
