# PaceFM Finance

A financial platform for tracking company income/expenses, budgets, clients,
and invoices, with a dashboard and reports.

## Stack

**Client** (repo root)
- React + TypeScript + Vite
- Tailwind CSS v4
- TanStack Query for data fetching
- React Router
- Recharts for charts

**Server** (`server/`)
- Node.js + Express + TypeScript
- PostgreSQL via Prisma
- JWT auth in an httpOnly cookie (bcrypt-hashed passwords)

The API can run either as a normal persistent Node process (local dev, or
any traditional host) or as Vercel serverless functions (see "Deploying"
below) — same Express app either way. The database is Postgres, and can be
a free hosted instance like [Neon](https://neon.tech), so no local install
of anything beyond Node is required.

## Features

- **Auth & workspaces** — email/password sign-up/sign-in; each user can
  create a company workspace. All API routes check company membership before
  returning or mutating data for that company.
- **Transactions** — log income and expenses, categorize them, assign to an
  account.
- **Budgets** — set a monthly spending limit per category and track progress.
- **Clients & Invoices** — manage clients and create invoices with line
  items, tax, status tracking (draft/sent/paid/overdue/void), and a print
  view.
- **Dashboard** — cash balance, monthly income/expense KPIs, a 6-month
  income-vs-expense chart, budget progress, and recent activity.
- **Reports** — profit & loss for a custom date range with an expense
  breakdown by category.

## Deploying (no local machine required)

The whole app can run without installing anything locally: Neon hosts the
database, and [Vercel](https://vercel.com) hosts both the frontend (as a
static site) and the API (as serverless functions) — as two separate Vercel
projects from the same repo. Both have free tiers with no credit card
required.

Serverless functions are stateless and only run while handling a request —
there's no persistent process, so no "sleeping" like some other free
hosts. Cold starts (the first request after a while) take a second or two,
not tens of seconds.

### 1. Create the Neon database

Follow "1. Create a Neon Postgres database" below — you need both the
pooled and direct connection strings.

### 2. Deploy the API to Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub.
2. **Add New** → **Project** → import this repo.
3. Set:
   - **Root Directory**: `server`
   - Framework preset: **Other** (Vercel will detect the `api/` folder and
     `vercel.json` automatically — no build/output settings needed)
4. Add environment variables:
   - `DATABASE_URL` — your Neon **pooled** connection string
   - `DIRECT_URL` — your Neon **direct** connection string
   - `JWT_SECRET` — any long random string
   - `NODE_ENV` — `production`
   - `CLIENT_ORIGIN` — leave a placeholder like `https://placeholder.vercel.app`
     for now, you'll fix this in step 4
5. Deploy. Once it's live, copy the URL Vercel gives you (e.g.
   `https://pacefm-api.vercel.app`) — you'll need it next.
   (The `vercel-build` script runs `prisma generate && prisma migrate
   deploy` automatically, so the database schema is applied on every
   deploy.)

### 3. Deploy the frontend to Vercel

1. **Add New** → **Project** → import this repo again (a second, separate
   project).
2. Set:
   - **Root Directory**: `/` (the repo root — leave default)
   - Framework preset: **Vite** (auto-detected)
3. Add an environment variable: `VITE_API_URL` = the API URL from step 2
   (e.g. `https://pacefm-api.vercel.app`).
4. Deploy. Copy the URL Vercel gives you (e.g.
   `https://pacefm-finance.vercel.app`).

### 4. Connect the two

Go back to the **API** project → Settings → Environment Variables, and set
`CLIENT_ORIGIN` to the exact frontend URL from step 3 (no trailing slash).
Redeploy that project (Vercel doesn't auto-redeploy on an env var change —
use the "Redeploy" button on the latest deployment). Once that finishes,
open the frontend URL, sign up, and create your company workspace.

Every push to this branch will auto-redeploy both projects going forward.

## Local development

### 1. Create a Neon Postgres database

1. Sign up at [neon.tech](https://neon.tech) (free tier, no credit card).
2. Create a project — this gives you a database automatically (default name
   `neondb`; you can rename it or create a new one called `pacefm_finance`
   from the Neon dashboard's SQL editor: `CREATE DATABASE pacefm_finance;`).
3. In the dashboard, open **Connection Details**. You need *both* variants
   of the connection string:
   - **Pooled** (hostname has `-pooler` in it) → goes in `DATABASE_URL`
   - **Direct** (no `-pooler`) → goes in `DIRECT_URL`

   They look like:
   ```
   postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/pacefm_finance?sslmode=require
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/pacefm_finance?sslmode=require
   ```
   The app uses the pooled one at runtime (important once this is deployed
   as serverless functions, which can open many concurrent connections);
   Prisma Migrate uses the direct one, since migrations need session-level
   features a transaction pooler doesn't support.

No local Postgres install is needed — Prisma only needs network access to
these connection strings, so this works fine even on an older machine that
can't run a modern Postgres server locally.

### 2. Configure and start the server

```bash
cd server
cp .env.example .env    # paste your Neon connection strings into DATABASE_URL / DIRECT_URL
npm install
npm run prisma:deploy   # applies the existing migration to your database
npm run dev              # starts the API on http://localhost:4000
```

(`prisma:deploy` runs `prisma migrate deploy`, which applies the migration
already committed in `server/prisma/migrations/` — no shadow database
needed. Only use `npm run prisma:migrate` — `prisma migrate dev` — later,
when you're changing the schema yourself; that one does need a shadow
database, which Neon can provide via a second database or branch if you get
there.)

### 3. Configure and start the client

In a separate terminal, from the repo root:

```bash
cp .env.example .env    # VITE_API_URL should point at the server
npm install
npm run dev              # starts the app on http://localhost:5173
```

Open the app, sign up, and create your company workspace.

## Data model

Every financial record belongs to a `Company`. Users are linked to companies
via `CompanyMember` with a role (`owner`/`admin`/`member`). Every API route
under `/api/companies/:companyId/...` runs through middleware that checks the
requesting user is a member of that company before touching any data — see
`server/src/middleware/auth.ts`.

Core tables (see `server/prisma/schema.prisma`): `User`, `Company`,
`CompanyMember`, `Account`, `Category`, `Transaction`, `Budget`, `Client`,
`Invoice`, `InvoiceItem`. Invoice totals (subtotal/tax/total) are computed
from line items in the API layer rather than stored.

## Scripts

**Client** (repo root)
- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint

**Server** (`server/`)
- `npm run dev` — start the API with hot reload (persistent process, for
  local development)
- `npm run build` — compile TypeScript (used when running as a persistent
  server, e.g. `npm start`)
- `npm start` — run the compiled server (applies pending migrations first)
- `npm run vercel-build` — what Vercel runs automatically on deploy
  (generates the Prisma client and applies migrations; no compile step,
  since Vercel's serverless builder compiles `api/index.ts` per-function)
- `npm run prisma:deploy` — apply already-committed migrations (no shadow
  database needed)
- `npm run prisma:migrate` — create a new migration in dev (needs a shadow
  database)
- `npm run prisma:studio` — browse the database in Prisma Studio

The server has two entry points: `src/index.ts` starts a normal persistent
Express server (`npm run dev` / `npm start`) for local development or any
traditional host. `api/index.ts` + `vercel.json` export the same Express
app as a Vercel serverless function — every request gets rewritten to it,
and Express's own router handles the path internally.
