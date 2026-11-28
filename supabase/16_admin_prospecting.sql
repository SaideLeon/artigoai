-- =============================================================================
-- 16. Central de Prospecção Inteligente (Campanhas, Leads e Convites)
-- Dependências: 01_extensions_and_users.sql, 13_superadmin_roles.sql, 15_admin_email_inbox.sql
-- =============================================================================

create table if not exists public.admin_prospect_campaigns (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  nicho text not null,
  perfis text[] not null default '{"blogs"}',
  regiao text not null default 'Brasil',
  idioma text not null default 'Português (Brasil)',
  criterios text not null default '',
  quantidade_alvo integer not null default 8 check (quantidade_alvo between 1 and 25),
  status text not null default 'concluida'
    check (status in ('em_andamento', 'concluida', 'erro')),
  resumo_busca text not null default '',
  criado_por_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_prospect_campaigns_created
  on public.admin_prospect_campaigns (created_at desc);

create table if not exists public.admin_prospect_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_prospect_campaigns (id) on delete cascade,
  nome_site text not null,
  dominio text not null,
  url text not null,
  categoria text not null default 'blog'
    check (categoria in ('blog', 'portal', 'agencia', 'saas', 'criador', 'outro')),
  descricao_site text not null default '',
  motivo_aderencia text not null default '',
  emails_encontrados text[] not null default '{}',
  email_selecionado text,
  redes_sociais jsonb not null default '[]'::jsonb,
  assunto_rascunho text not null default '',
  corpo_rascunho text not null default '',
  status text not null default 'rascunho_pronto'
    check (
      status in (
        'descoberto',
        'rascunho_pronto',
        'sem_email',
        'aprovado',
        'enviado',
        'ignorado',
        'erro'
      )
    ),
  erro_detalhe text,
  thread_id uuid references public.admin_email_threads (id) on delete set null,
  resend_email_id text,
  enviado_em timestamptz,
  enviado_por_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_prospect_leads_campaign
  on public.admin_prospect_leads (campaign_id, created_at desc);

create index if not exists idx_admin_prospect_leads_dominio
  on public.admin_prospect_leads (dominio);

create index if not exists idx_admin_prospect_leads_email
  on public.admin_prospect_leads (email_selecionado)
  where email_selecionado is not null;

create index if not exists idx_admin_prospect_leads_status
  on public.admin_prospect_leads (status, created_at desc);

alter table public.admin_prospect_campaigns enable row level security;
alter table public.admin_prospect_leads enable row level security;

drop policy if exists "admin_prospect_campaigns_superadmin_select" on public.admin_prospect_campaigns;
create policy "admin_prospect_campaigns_superadmin_select"
  on public.admin_prospect_campaigns for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

drop policy if exists "admin_prospect_leads_superadmin_select" on public.admin_prospect_leads;
create policy "admin_prospect_leads_superadmin_select"
  on public.admin_prospect_leads for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

notify pgrst, 'reload schema';
