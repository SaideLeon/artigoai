-- =============================================================================
-- 09. RPC: Rotina automática diária para maturar comissões (pendente -> disponivel)
-- Dependências: 08_partners_ledger_and_withdrawals.sql
-- =============================================================================

create or replace function public.maturar_comissoes_pendentes(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn_maturar$
declare
  v_ref_time timestamptz := coalesce(p_now, now());
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, partner_id, valor_comissao_centavos, disponivel_em
      from public.commissions
     where status = 'pendente'
       and disponivel_em <= v_ref_time
     for update skip locked
  loop
    update public.commissions
       set status = 'disponivel'
     where id = v_row.id;

    insert into public.partner_ledger_entries (
      partner_id,
      commission_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      descricao
    ) values (
      v_row.partner_id,
      v_row.id,
      'liberacao_disponivel',
      v_row.valor_comissao_centavos,
      'disponivel',
      'Prazo de garantia concluído: comissão liberada para saque.'
    );

    insert into public.partner_audit_logs (
      entidade,
      entidade_id,
      partner_id,
      actor_type,
      actor_email,
      acao,
      estado_anterior,
      estado_novo,
      motivo
    ) values (
      'commission',
      v_row.id,
      v_row.partner_id,
      'cron',
      'system:cron',
      'maturada',
      jsonb_build_object('status', 'pendente', 'disponivel_em', v_row.disponivel_em),
      jsonb_build_object('status', 'disponivel'),
      'Liberação automática após prazo de garantia.'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn_maturar$;

revoke all on function public.maturar_comissoes_pendentes(timestamptz) from public;
grant execute on function public.maturar_comissoes_pendentes(timestamptz) to service_role;
