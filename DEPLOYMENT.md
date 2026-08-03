# Deploying Phase 1 to rosterduel.com

Backend + Postgres (+ optional Redis) on Railway, frontend on Vercel. Written
for PowerShell on Windows. Everything here was prepared and dry-run tested
from a sandboxed session that cannot reach Railway's or Vercel's APIs
directly (its network policy blocks `backboard.railway.com` and
`api.vercel.com`) — that's why this is a runbook for you to execute rather
than something run automatically. See "What was actually tested" at the
bottom for exactly what was and wasn't verified before you run this.

## Step 0: Set a Railway spending limit — do this before provisioning anything

Right after creating your Railway account, before adding Postgres, Redis, or
the API service: set a spending limit or usage alert on the account so a
misconfiguration can't run up a surprise bill. Look under **Account
Settings → Usage/Billing** (this is Railway's current general area for
spend controls, but I couldn't confirm the exact current menu wording —
Railway's own docs were unreachable from this session for the same network-policy
reason described at the bottom of this file, so verify the precise path in
their dashboard/docs when you're there).

This is precautionary, not because anything here is expected to be
expensive: at this scale (one small API service, one Postgres instance, a
handful of playtesters) you'd expect to land on Railway's ~$5/month Hobby
tier. The point of the limit is just to make sure a mistake — an infinite
loop, a runaway build, whatever — can't turn into an unexpected charge
before you notice.

## 0. One-time prerequisites

```powershell
cd path\to\Roster-Duel
git checkout claude/rosterduel-phase-1-mvp-5xt803
git pull

npm install -g @railway/cli vercel
```

Both `railway login` and `vercel login` below open your default browser for
auth — neither one asks you to paste a token anywhere.

---

## 1. Railway — backend + Postgres (+ optional Redis)

### 1a. Login and create the project

```powershell
railway login

# From the REPO ROOT, not apps/api -- npm workspaces need the root
# package.json/package-lock.json present, and railway.json (already
# committed at repo root) tells Railway where the API's Dockerfile lives.
railway init --name roster-duel
```

### 1b. Provision Postgres (and, if you want it, Redis)

```powershell
railway add --database postgres
```

**Redis note:** the spec's tech stack lists Redis, but nothing in the
current codebase actually reads `REDIS_URL` yet (grepped the whole of
`apps/api/src` — zero references). It's wired into local dev's
`docker-compose.yml` for future use, not used today. Skip it for now unless
you want it provisioned ahead of when it's needed:

```powershell
railway add --database redis   # optional, currently unused by any code path
```

### 1c. Create the API service and deploy it

```powershell
railway add --service api
railway up --service api --ci
```

`railway.json` at the repo root points this deploy at `apps/api/Dockerfile`
and sets `/health` as the healthcheck path. **If `railway up` doesn't pick
up that Dockerfile automatically** (I could not test this exact CLI flow
against the real network from my sandboxed session — see the note at the
bottom), open the `api` service in the Railway dashboard → **Settings** →
**Build**, and manually set:
- Root Directory: `/` (repo root — leave blank)
- Dockerfile Path: `apps/api/Dockerfile`

then trigger a redeploy from there.

### 1d. Wire up environment variables

Railway auto-injects `PORT` — the app already reads `process.env.PORT`, no
action needed. Check whether `DATABASE_URL` was auto-linked from the
Postgres plugin:

```powershell
railway variable list --service api
```

If `DATABASE_URL` isn't already there, add it as a reference to the
Postgres plugin's own connection string (adjust `Postgres` below to
whatever your Postgres service is actually named — check with
`railway service list`):

```powershell
railway variable set "DATABASE_URL=`${{Postgres.DATABASE_URL}}" --service api --skip-deploys
```

Then set the one secret only you have — needed for the "newspaper" recap
feature (game still works without it, recap generation is skipped):

```powershell
railway variable set ANTHROPIC_API_KEY=your-key-here --service api
```

(This is entering a secret into Railway's own variable store via its CLI —
not pasting it into our chat, which is the thing you asked to avoid.)

### 1e. Give the API its own domain

```powershell
railway domain api.rosterduel.com --service api
```

This **prints the exact DNS record Railway wants** for that hostname —
copy it into your registrar (see Part 3 below for the general shape, but
Railway's own printed output at this step is authoritative over what I
write here, since it's generated per-deployment).

### 1f. Migrate + seed the database

This runs from **your own machine**, against Railway's Postgres, using its
**public** connection string (the one reachable from outside Railway's
private network — the plain `DATABASE_URL` Railway gives other Railway
services is often the *internal* one and won't be reachable from your
Windows machine).

```powershell
railway variable list --service postgres --kv
```

Look for `DATABASE_PUBLIC_URL` (or whatever Railway's Postgres plugin
labels its external/proxy connection string as — the exact key name can
vary by plugin version, hence "look for" rather than a fixed name). Copy
that value, then:

```powershell
$env:DATABASE_URL = "<the public connection string you just copied>"
npm run prisma:deploy -w apps/api
npm run db:seed -w apps/api
```

- `prisma:deploy` runs `prisma migrate deploy` — applies all 8 existing
  migrations in order, tracked in `_prisma_migrations` so it's safe even if
  you ever need to run it again.
- `db:seed` reuses the existing `apps/api/prisma/seed.ts` — the same script
  that seeds local dev, writing all 12 teams and 84 player stints via
  `upsert`, so it's also safe to re-run without duplicating data.

Unset it afterward so you don't accidentally point local dev at production:

```powershell
Remove-Item Env:\DATABASE_URL
```

---

## 2. Vercel — frontend

Since `apps/web` has **zero dependency on the workspace packages**
(`packages/sim-engine`/`shared-types` — confirmed, nothing in `apps/web`
imports `@roster-duel/*`), the simplest and most reliable setup treats
`apps/web` as a standalone project, sidestepping monorepo root-directory
configuration entirely:

```powershell
cd apps\web
vercel login
vercel link       # creates/links a new Vercel project, confirm "apps/web" as the root when prompted
```

Set the env var that points the frontend at Railway's backend — this is
the **only** one needed. The frontend's WebSocket connection
(`DraftRoomClient.tsx`) reuses this exact same URL via Socket.IO, which
negotiates `wss://` automatically from an `https://` base — there is no
separate WebSocket URL to configure:

```powershell
vercel env add NEXT_PUBLIC_API_URL production --value "https://api.rosterduel.com" --yes
```

Deploy:

```powershell
vercel --prod
```

Point your custom domain at it:

```powershell
vercel domains add rosterduel.com
```

---

## 3. DNS records for rosterduel.com

Add these at your registrar (you're keeping registrar access yourself, so
these are for you to enter manually):

| Type | Host | Value | Purpose |
|---|---|---|---|
| A | `@` (root) | `76.76.21.21` | Vercel — standard documented value, but **confirm against what `vercel domains inspect rosterduel.com` prints** after step 2, since Vercel occasionally updates this |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel, www subdomain |
| CNAME | `api` | *(whatever `railway domain api.rosterduel.com --service api` printed in step 1e)* | Railway backend |

Propagation is typically minutes, occasionally longer depending on your
registrar's TTL.

---

## 4. Final verification — do this yourself, on the live URL

Same rigor as the earlier friend-link verification, but against
`https://rosterduel.com` instead of localhost, from two actually separate
browsers/devices (not two tabs sharing a profile — the app keys identity
off `localStorage`, so two tabs in the same browser profile would share a
session):

1. On device/browser A: open `https://rosterduel.com`, create a match, copy
   the room link.
2. On device/browser B (different browser or a private/incognito window on
   a different device): open that link, confirm it joins as the second
   player.
3. Draft a full 6-player roster on both sides independently, lock both in.
4. Confirm the sim runs automatically and both sides land on
   GameCast → box score → newspaper without a manual refresh.

Once you've got a live URL and this passes, come back and I'll do a final
pass with you — happy to re-run the same two-browser Playwright check
against the real domain instead of localhost, the way I did for the local
verification.

---

## What was actually tested vs. not

I could not reach Railway's or Vercel's APIs from my session (both are
blocked by this environment's network policy — confirmed via direct `curl`,
not assumed), so nothing above involving those platforms' actual servers
was exercised end-to-end. What I *did* verify directly, in this repo,
before writing this:

- **The exact CLI commands above** — checked against each command's own
  `--help` output on both CLIs (installed locally, only their network
  calls are blocked here), not recalled from memory.
- **The whole Docker build sequence** (`npm ci` → `npm run prisma:generate`
  → `npm run build -w apps/api` → start), replicated command-by-command
  against a clean copy of the repo with the same exclusions
  `.dockerignore` applies (no `node_modules`, no `.env`) — this is what
  caught and fixed a real bug: `apps/api/package.json`'s `start:prod`
  script pointed at `dist/main`, but the actual compiled entry is
  `dist/src/main.js` (never caught before since local dev only ever used
  `nest start`, not the production build). Fixed and reverified.
- **The compiled app actually booting** with only `DATABASE_URL`/`PORT`
  env vars set, both against a live local Postgres (succeeds, binds
  `0.0.0.0`, `/health` responds) and with Postgres unreachable (fails
  loudly and immediately with a clear `P1001` connection error, rather
  than hanging or silently limping along) — worth knowing going in: the app
  connects to Postgres **eagerly at boot** (`PrismaService.onModuleInit`),
  so if Railway starts the API before `DATABASE_URL` is correctly wired,
  expect a crash-loop until it's fixed, not a silently broken app.
- Actually building the **Docker image itself** — could not, no Docker
  daemon available in this sandbox (nested containers aren't permitted
  here). The one specific risk I couldn't verify this way: Prisma's query
  engine needs OpenSSL on Alpine Linux, which the Dockerfile installs
  (`apk add openssl`) as a known, well-documented gotcha — but if the
  container still crashes on boot with a `libssl`/engine-load error, that's
  the first thing to check.
