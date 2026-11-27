-- =============================================================================
-- 15. Caixa de E-mail Administrativa (Threads e Mensagens Recebidas / Respondidas)
-- Dependências: 01_extensions_and_users.sql, 13_superadmin_roles.sql
-- =============================================================================

create table if not exists public.admin_email_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '(Sem assunto)',
  normalized_subject text not null default '',
  participant_email text not null,
  participant_name text not null default '',
  source text not null default 'resend_inbound'
    check (source in ('resend_inbound', 'contact_form', 'outbound')),
  folder text not null default 'inbox'
    check (folder in ('inbox', 'sent', 'starred', 'archived', 'trash')),
  is_read boolean not null default false,
  is_starred boolean not null default false,
  snippet text not null default '',
  message_count integer not null default 1 check (message_count >= 1),
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_email_threads_folder_last_msg
  on public.admin_email_threads (folder, last_message_at desc);

create index if not exists idx_admin_email_threads_unread
  on public.admin_email_threads (is_read, folder, last_message_at desc);

create index if not exists idx_admin_email_threads_participant
  on public.admin_email_threads (participant_email, normalized_subject);

create table if not exists public.admin_email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.admin_email_threads (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  source text not null default 'resend_inbound'
    check (source in ('resend_inbound', 'contact_form', 'admin_reply')),
  resend_email_id text unique,
  rfc_message_id text,
  in_reply_to text,
  from_email text not null,
  from_name text not null default '',
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  reply_to text,
  subject text not null default '',
  text_body text not null default '',
  html_body text,
  attachments jsonb not null default '[]'::jsonb,
  sent_by_admin_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_email_messages_thread_created
  on public.admin_email_messages (thread_id, created_at asc);

create index if not exists idx_admin_email_messages_rfc_id
  on public.admin_email_messages (rfc_message_id)
  where rfc_message_id is not null;

alter table public.admin_email_threads enable row level security;
alter table public.admin_email_messages enable row level security;

drop policy if exists "admin_email_threads_superadmin_select" on public.admin_email_threads;
create policy "admin_email_threads_superadmin_select"
  on public.admin_email_threads for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

drop policy if exists "admin_email_messages_superadmin_select" on public.admin_email_messages;
create policy "admin_email_messages_superadmin_select"
  on public.admin_email_messages for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

notify pgrst, 'reload schema';
