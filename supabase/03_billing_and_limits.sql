-- =============================================================================
-- 03. Assinaturas Cakto (Pix/Cartão/Boleto), Limites Mensais e Pagamentos (BRL)
-- Dependências: 01_extensions_and_users.sql
-- =============================================================================

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (
    plan in ('free', 'starter', 'pro', 'agencia', 'custom')
  ),
  billing_cycle text not null default 'monthly' check (
    billing_cycle in ('monthly', 'yearly')
  ),
  active_package text not null default 'free',
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  cakto_customer_email text,
  cakto_subscription_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'starter', 'pro', 'agencia', 'custom'));
alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly';
alter table public.subscriptions
  add column if not exists cakto_customer_email text;
alter table public.subscriptions
  add column if not exists cakto_subscription_id text;
alter table public.subscriptions
  add column if not exists stripe_customer_id text;
alter table public.subscriptions
  add column if not exists stripe_subscription_id text;

create table if not exists public.usage_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  article_credits integer not null default 0 check (article_credits >= 0),
  articles_generated_total integer not null default 0 check (articles_generated_total >= 0),
  monthly_articles_used integer not null default 0 check (monthly_articles_used >= 0),
  monthly_articles_limit integer not null default 2 check (monthly_articles_limit > 0),
  reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month')
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id text not null default 'starter',
  articles_granted integer not null default 5 check (articles_granted > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency in ('BRL')),
  status text not null default 'paid',
  cakto_order_id text unique,
  payment_method text,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  stripe_invoice_id text unique,
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists cakto_order_id text;
alter table public.payments
  add column if not exists payment_method text;
alter table public.payments
  add column if not exists stripe_session_id text;
alter table public.payments
  add column if not exists stripe_payment_intent_id text;
alter table public.payments
  add column if not exists stripe_invoice_id text;
create unique index if not exists idx_payments_cakto_order_id
  on public.payments (cakto_order_id)
  where cakto_order_id is not null;
create unique index if not exists idx_payments_stripe_session_id
  on public.payments (stripe_session_id)
  where stripe_session_id is not null;
create unique index if not exists idx_payments_stripe_invoice_id
  on public.payments (stripe_invoice_id)
  where stripe_invoice_id is not null;
