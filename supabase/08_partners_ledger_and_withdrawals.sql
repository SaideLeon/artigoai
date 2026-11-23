-- =============================================================================
-- 08. Tabelas, Índices e RLS: Saques, Livro-Caixa em Centavos e Auditoria
-- Dependências: 07_partners_system.sql
-- =============================================================================

-- 1) Pedidos de saque dos parceiros
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  valor_centavos integer not null check (valor_centavos > 0),
  saldo_no_momento_centavos integer not null,
  metodo text not null check (metodo in ('pix', 'outro')),
  pix_tipo_chave text check (
    pix_tipo_chave is null
    or pix_tipo_chave in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')
  ),
  dados_pagamento text not null check (char_length(trim(dados_pagamento)) >= 3),
  status text not null default 'solicitado' check (
    status in ('solicitado', 'em_analise', 'pago', 'recusado')
  ),
  comprovativo_ref text,
  motivo_recusa text,
  solicitado_em timestamptz not null default now(),
  analisado_em timestamptz,
  pago_em timestamptz,
  recusado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_withdrawal_requests_partner_solicitado
  on public.withdrawal_requests (partner_id, solicitado_em desc);

create index if not exists idx_withdrawal_requests_status_solicitado
  on public.withdrawal_requests (status, solicitado_em desc);

-- Garante no banco que só pode existir 1 pedido de saque aberto por parceiro
create unique index if not exists idx_withdrawal_one_open_per_partner
  on public.withdrawal_requests (partner_id)
  where status in ('solicitado', 'em_analise');

-- 2) Evolução da tabela commissions para centavos inteiros, 5 estados e garantia
alter table public.commissions
  add column if not exists valor_base_centavos integer;

alter table public.commissions
  add column if not exists valor_comissao_centavos integer;

alter table public.commissions
  add column if not exists base_calculo text not null default 'valor_bruto';

alter table public.commissions
  add column if not exists disponivel_em timestamptz;

alter table public.commissions
  add column if not exists withdrawal_request_id uuid references public.withdrawal_requests (id) on delete set null;

alter table public.commissions
  add column if not exists estornada_em timestamptz;

-- Preenche colunas novas para registos legados caso existam
update public.commissions
   set valor_base_centavos = coalesce(valor_base_centavos, round(valor_bruto * 100)::integer),
       valor_comissao_centavos = coalesce(valor_comissao_centavos, round(valor_comissao * 100)::integer),
       disponivel_em = coalesce(disponivel_em, criado_em + interval '7 days')
 where valor_base_centavos is null
    or valor_comissao_centavos is null
    or disponivel_em is null;

alter table public.commissions
  alter column valor_base_centavos set default 0,
  alter column valor_comissao_centavos set default 0,
  alter column disponivel_em set default (now() + interval '7 days');

-- Atualiza CHECK de status da tabela commissions para os 5 estados oficiais
do $chk_status$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'commissions'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%status%'
   limit 1;

  if v_constraint_name is not null then
    execute format('alter table public.commissions drop constraint %I', v_constraint_name);
  end if;
end $chk_status$;

alter table public.commissions
  drop constraint if exists commissions_status_check;

alter table public.commissions
  add constraint commissions_status_check
  check (status in ('pendente', 'disponivel', 'em_saque', 'paga', 'estornada'));

alter table public.commissions
  drop constraint if exists commissions_base_calculo_check;

alter table public.commissions
  add constraint commissions_base_calculo_check
  check (base_calculo in ('valor_bruto', 'valor_liquido'));

create index if not exists idx_commissions_status_disponivel_em
  on public.commissions (status, disponivel_em);

create index if not exists idx_commissions_withdrawal_request_id
  on public.commissions (withdrawal_request_id)
  where withdrawal_request_id is not null;

-- 3) Livro-caixa de lançamentos em centavos (créditos, reservas, compensações e estornos)
create table if not exists public.partner_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  commission_id uuid references public.commissions (id) on delete set null,
  withdrawal_request_id uuid references public.withdrawal_requests (id) on delete set null,
  settled_withdrawal_id uuid references public.withdrawal_requests (id) on delete set null,
  tipo text not null check (
    tipo in (
      'comissao_pendente',
      'liberacao_disponivel',
      'reserva_saque',
      'pagamento_saque',
      'liberacao_saque_recusado',
      'estorno_comissao',
      'ajuste_estorno_pos_pagamento',
      'credito_troco_saque'
    )
  ),
  valor_centavos integer not null,
  saldo_afetado text not null check (
    saldo_afetado in ('pendente', 'disponivel', 'em_saque', 'pago', 'compensacao')
  ),
  descricao text not null default '',
  criado_em timestamptz not null default now()
);

create index if not exists idx_partner_ledger_partner_criado
  on public.partner_ledger_entries (partner_id, criado_em desc);

create index if not exists idx_partner_ledger_open_adjustments
  on public.partner_ledger_entries (partner_id, tipo)
  where settled_withdrawal_id is null;

-- 4) Auditoria completa de mudanças de estado (quem, quando, antes e depois)
create table if not exists public.partner_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('commission', 'withdrawal_request')),
  entidade_id uuid not null,
  partner_id uuid not null references public.partners (id) on delete cascade,
  actor_type text not null check (
    actor_type in ('webhook', 'cron', 'partner', 'admin', 'system')
  ),
  actor_id uuid,
  actor_email text not null default '',
  acao text not null,
  estado_anterior jsonb,
  estado_novo jsonb,
  motivo text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_partner_audit_logs_partner_criado
  on public.partner_audit_logs (partner_id, criado_em desc);

create index if not exists idx_partner_audit_logs_entidade
  on public.partner_audit_logs (entidade, entidade_id, criado_em desc);

-- 5) RLS nas novas tabelas
alter table public.withdrawal_requests enable row level security;
alter table public.partner_ledger_entries enable row level security;
alter table public.partner_audit_logs enable row level security;

drop policy if exists "withdrawal_requests_partner_select" on public.withdrawal_requests;
create policy "withdrawal_requests_partner_select"
  on public.withdrawal_requests for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = withdrawal_requests.partner_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "partner_ledger_entries_partner_select" on public.partner_ledger_entries;
create policy "partner_ledger_entries_partner_select"
  on public.partner_ledger_entries for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = partner_ledger_entries.partner_id
        and p.user_id = auth.uid()
    )
  );
