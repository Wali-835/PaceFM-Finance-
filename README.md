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

This is a fully self-hosted stack — no third-party backend-as-a-service. You
run your own Postgres database and your own API server.

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

### 1. Set up PostgreSQL

Install PostgreSQL locally (or point at any Postgres instance you have —
Docker, a managed DB, etc). On Debian/Ubuntu:

```bash
sudo apt install postgresql
sudo service postgresql start
sudo -u postgres psql -c "CREATE ROLE pacefm LOGIN PASSWORD 'pacefm' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE pacefm_finance OWNER pacefm;"
```

(`CREATEDB` is needed so Prisma Migrate can create its shadow database in
dev. If you don't want to grant that, run migrations with `prisma migrate
deploy` instead of `migrate dev`.)

### 2. Configure and start the server

```bash
cd server
cp .env.example .env   # edit DATABASE_URL / JWT_SECRET if needed
npm install
npm run prisma:migrate # creates tables
npm run dev             # starts the API on http://localhost:4000
```

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
