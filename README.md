# PaceFM Finance

A financial platform for tracking company income/expenses, budgets, clients,
and invoices, with a dashboard and reports.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Postgres + Auth) for the backend
- TanStack Query for data fetching
- React Router
- Recharts for charts

## Features

- **Auth & workspaces** — email/password sign-in; each user can create a
  company workspace, and all data is scoped and access-controlled per company
  via Postgres row-level security.
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

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com/dashboard).

### 2. Run the database migration

In the Supabase dashboard, open the SQL editor and run the contents of
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).
This creates all tables, enums, and row-level security policies.

If you use the Supabase CLI instead:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase
project's API settings.

### 4. Install and run

```bash
npm install
npm run dev
```

Open the app, sign up, confirm your email (Supabase sends a confirmation
link by default), sign in, and create your company workspace.

## Data model

Every financial record belongs to a `company`. Users are linked to companies
via `company_members` with a role (`owner`/`admin`/`member`). Row-level
security policies enforce that a user can only read or write data for
companies they belong to.

Core tables: `companies`, `company_members`, `accounts`, `categories`,
`transactions`, `budgets`, `clients`, `invoices`, `invoice_items`, plus an
`invoice_totals` view that computes subtotal/tax/total from line items.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint
