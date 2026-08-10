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

The API server is self-hosted (you run it), but the database can be any
Postgres — including a free hosted one like [Neon](https://neon.tech), which
means no local Postgres install is required.

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
database, [Render](https://render.com) hosts the API, and
[Cloudflare Pages](https://pages.cloudflare.com) hosts the frontend as a
static site. All three have free tiers with no credit card required.

Render's free tier sleeps the API after 15 minutes of no traffic — the next
request takes ~30–50 seconds to wake it back up. Fine for occasional/small
team use; if that's a problem later, upgrading Render to a paid instance
removes it.

### 1. Create the Neon database

Follow "1. Create a Neon Postgres database" below to get a `DATABASE_URL`.

### 2. Deploy the API to Render

1. Sign up at [render.com](https://render.com) with GitHub.
2. **New +** → **Web Service** → pick this repo.
3. Set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Add environment variables (Render's "Environment" tab):
   - `DATABASE_URL` — your Neon connection string
   - `JWT_SECRET` — any long random string
   - `NODE_ENV` — `production`
   - `CLIENT_ORIGIN` — leave a placeholder like `https://placeholder.pages.dev`
     for now, you'll fix this in step 4
5. Deploy. Once it's live, copy the URL Render gives you (e.g.
   `https://pacefm-api.onrender.com`) — you'll need it next.
   (`npm start` runs `prisma migrate deploy` automatically before starting,
   so the database schema is applied on first deploy.)

### 3. Deploy the frontend to Cloudflare Pages

1. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com) with
   GitHub.
2. **Create a project** → **Connect to Git** → pick this repo.
3. Set:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (the repo root — leave default)
4. Add an environment variable: `VITE_API_URL` = the Render URL from step 2
   (e.g. `https://pacefm-api.onrender.com`).
5. Deploy. Copy the `*.pages.dev` URL Cloudflare gives you.

### 4. Connect the two

Go back to Render → your service → Environment, and set `CLIENT_ORIGIN` to
the exact Cloudflare Pages URL from step 3 (e.g.
`https://pacefm-finance.pages.dev`, no trailing slash). Save — Render
redeploys automatically. Once that finishes, open the Cloudflare Pages URL,
sign up, and create your company workspace.

Every push to this branch will auto-redeploy both services.

## Local development

### 1. Create a Neon Postgres database

1. Sign up at [neon.tech](https://neon.tech) (free tier, no credit card).
2. Create a project — this gives you a database automatically (default name
   `neondb`; you can rename it or create a new one called `pacefm_finance`
   from the Neon dashboard's SQL editor: `CREATE DATABASE pacefm_finance;`).
3. In the dashboard, open **Connection Details** and copy the connection
   string. Use the **direct** (non-pooled) connection — the pooled one has
   `-pooler` in the hostname; avoid that one for now to keep things simple.
   It looks like:
   `postgresql://user:password@ep-xxxx.region.aws.neon.tech/pacefm_finance?sslmode=require`

No local Postgres install is needed — Prisma only needs network access to
this connection string, so this works fine even on an older machine that
can't run a modern Postgres server locally.

### 2. Configure and start the server

```bash
cd server
cp .env.example .env    # paste your Neon connection string into DATABASE_URL
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
- `npm run dev` — start the API with hot reload
- `npm run build` — compile TypeScript
- `npm start` — run the compiled server
- `npm run prisma:migrate` — create/apply a migration in dev
- `npm run prisma:studio` — browse the database in Prisma Studio
