-- PaceFM Finance schema
-- Multi-tenant: every financial record belongs to a company; access is
-- granted via company_members. Run this in the Supabase SQL editor or via
-- `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create type member_role as enum ('owner', 'admin', 'member');

create table company_members (
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- security-definer helper so RLS policies can check membership without
-- recursing on company_members' own policy
create function is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from company_members
    where company_id = target_company_id and user_id = auth.uid()
  );
$$;

create function is_company_admin(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from company_members
    where company_id = target_company_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

alter table companies enable row level security;
alter table company_members enable row level security;

create policy "members can view their companies"
  on companies for select
  using (is_company_member(id));

create policy "authenticated users can create companies"
  on companies for insert
  with check (auth.uid() = created_by);

create policy "admins can update their company"
  on companies for update
  using (is_company_admin(id));

create policy "members can view company roster"
  on company_members for select
  using (is_company_member(company_id));

create policy "admins can manage members"
  on company_members for insert
  with check (is_company_admin(company_id));

create policy "admins can update members"
  on company_members for update
  using (is_company_admin(company_id));

create policy "admins can remove members"
  on company_members for delete
  using (is_company_admin(company_id));

-- automatically make the creator the owner
create function handle_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into company_members (company_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_company_created
  after insert on companies
  for each row execute function handle_new_company();

-- ---------------------------------------------------------------------
-- Chart of accounts, categories
-- ---------------------------------------------------------------------

create type account_type as enum ('cash', 'bank', 'credit_card', 'other');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  type account_type not null default 'bank',
  opening_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create type category_kind as enum ('income', 'expense');

create table categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  kind category_kind not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (company_id, name, kind)
);

alter table accounts enable row level security;
alter table categories enable row level security;

create policy "members can view accounts" on accounts for select using (is_company_member(company_id));
create policy "members can manage accounts" on accounts for insert with check (is_company_member(company_id));
create policy "members can update accounts" on accounts for update using (is_company_member(company_id));
create policy "members can delete accounts" on accounts for delete using (is_company_member(company_id));

create policy "members can view categories" on categories for select using (is_company_member(company_id));
create policy "members can manage categories" on categories for insert with check (is_company_member(company_id));
create policy "members can update categories" on categories for update using (is_company_member(company_id));
create policy "members can delete categories" on categories for delete using (is_company_member(company_id));

-- ---------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  account_id uuid references accounts (id) on delete set null,
  category_id uuid references categories (id) on delete set null,
  kind category_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  description text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index transactions_company_date_idx on transactions (company_id, occurred_on desc);

alter table transactions enable row level security;

create policy "members can view transactions" on transactions for select using (is_company_member(company_id));
create policy "members can add transactions" on transactions for insert with check (is_company_member(company_id));
create policy "members can update transactions" on transactions for update using (is_company_member(company_id));
create policy "members can delete transactions" on transactions for delete using (is_company_member(company_id));

-- ---------------------------------------------------------------------
-- Budgets (per category, per calendar month)
-- ---------------------------------------------------------------------

create table budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  month date not null, -- first day of the month
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (company_id, category_id, month)
);

alter table budgets enable row level security;

create policy "members can view budgets" on budgets for select using (is_company_member(company_id));
create policy "members can manage budgets" on budgets for insert with check (is_company_member(company_id));
create policy "members can update budgets" on budgets for update using (is_company_member(company_id));
create policy "members can delete budgets" on budgets for delete using (is_company_member(company_id));

-- ---------------------------------------------------------------------
-- Clients & Invoicing
-- ---------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  invoice_number text not null,
  status invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date not null default (current_date + interval '30 days'),
  notes text not null default '',
  tax_rate numeric(5, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, invoice_number)
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  position integer not null default 0
);

alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

create policy "members can view clients" on clients for select using (is_company_member(company_id));
create policy "members can manage clients" on clients for insert with check (is_company_member(company_id));
create policy "members can update clients" on clients for update using (is_company_member(company_id));
create policy "members can delete clients" on clients for delete using (is_company_member(company_id));

create policy "members can view invoices" on invoices for select using (is_company_member(company_id));
create policy "members can manage invoices" on invoices for insert with check (is_company_member(company_id));
create policy "members can update invoices" on invoices for update using (is_company_member(company_id));
create policy "members can delete invoices" on invoices for delete using (is_company_member(company_id));

create policy "members can view invoice items" on invoice_items for select
  using (is_company_member((select company_id from invoices where invoices.id = invoice_id)));
create policy "members can manage invoice items" on invoice_items for insert
  with check (is_company_member((select company_id from invoices where invoices.id = invoice_id)));
create policy "members can update invoice items" on invoice_items for update
  using (is_company_member((select company_id from invoices where invoices.id = invoice_id)));
create policy "members can delete invoice items" on invoice_items for delete
  using (is_company_member((select company_id from invoices where invoices.id = invoice_id)));

-- convenience view: invoice totals computed from line items
create view invoice_totals with (security_invoker = true) as
select
  i.id as invoice_id,
  coalesce(sum(li.quantity * li.unit_price), 0) as subtotal,
  coalesce(sum(li.quantity * li.unit_price), 0) * (i.tax_rate / 100) as tax_amount,
  coalesce(sum(li.quantity * li.unit_price), 0) * (1 + i.tax_rate / 100) as total
from invoices i
left join invoice_items li on li.invoice_id = i.id
group by i.id, i.tax_rate;
