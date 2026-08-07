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

## Getting started

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
