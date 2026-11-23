-- =============================================================================
-- 12. RPC Atómica: Estornar comissão (com compensação automática se já paga)
-- Dependências: 08_partners_ledger_and_withdrawals.sql
-- =============================================================================

create or replace function public.reverse_partner_commission(
  p_commission_id uuid,
  p_actor_type text,
  p_actor_email text,
  p_motivo text default 'Reembolso ou chargeback confirmado pela Cakto.'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_reverse_comm$
declare
  v_comm public.commissions%rowtype;
  v_old_status text;
  v_old_withdrawal_id uuid;
  v_open_withdrawal public.withdrawal_requests%rowtype;
  v_remaining_cents integer := 0;
begin
  select *
    into v_comm
    from public.commissions
   where id = p_commission_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Comissão não encontrada.');
  end if;

  if v_comm.status = 'estornada' then
    return jsonb_build_object('ok', true, 'alreadyReversed', true);
  end if;

  v_old_status := v_comm.status;
  v_old_withdrawal_id := v_comm.withdrawal_request_id;

  update public.commissions
     set status = 'estornada',
         estornada_em = now(),
         withdrawal_request_id = null
   where id = p_commission_id;

  if v_old_status = 'paga' then
    insert into public.partner_ledger_entries (
      partner_id,
      commission_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      settled_withdrawal_id,
      descricao
    ) values (
      v_comm.partner_id,
      v_comm.id,
      'ajuste_estorno_pos_pagamento',
      -abs(v_comm.valor_comissao_centavos),
      'compensacao',
      null,
      'Estorno pós-pagamento: saldo negativo a compensar nos próximos ganhos.'
    );
  else
    insert into public.partner_ledger_entries (
      partner_id,
      commission_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      descricao
    ) values (
      v_comm.partner_id,
      v_comm.id,
      'estorno_comissao',
      -abs(v_comm.valor_comissao_centavos),
      case when v_old_status = 'em_saque' then 'em_saque' else v_old_status end,
      coalesce(p_motivo, 'Comissão estornada antes do pagamento.')
    );

    if v_old_status = 'em_saque' and v_old_withdrawal_id is not null then
      select *
        into v_open_withdrawal
        from public.withdrawal_requests
       where id = v_old_withdrawal_id
       for update;

      if found and v_open_withdrawal.status in ('solicitado', 'em_analise') then
        v_remaining_cents := v_open_withdrawal.valor_centavos - abs(v_comm.valor_comissao_centavos);
        if v_remaining_cents <= 0 then
          update public.withdrawal_requests
             set status = 'recusado',
                 motivo_recusa = 'Comissão vinculada estornada antes do pagamento.',
                 recusado_em = now(),
                 atualizado_em = now()
           where id = v_open_withdrawal.id;

          update public.commissions
             set status = 'disponivel',
                 withdrawal_request_id = null
           where withdrawal_request_id = v_open_withdrawal.id
             and status = 'em_saque';

          delete from public.partner_ledger_entries
           where withdrawal_request_id = v_open_withdrawal.id
             and tipo = 'credito_troco_saque';

          update public.partner_ledger_entries
             set settled_withdrawal_id = null
           where settled_withdrawal_id = v_open_withdrawal.id;
        else
          update public.withdrawal_requests
             set valor_centavos = v_remaining_cents,
                 atualizado_em = now()
           where id = v_open_withdrawal.id;
        end if;
      end if;
    end if;
  end if;

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
    v_comm.id,
    v_comm.partner_id,
    coalesce(nullif(p_actor_type, ''), 'webhook'),
    coalesce(p_actor_email, ''),
    'estornada',
    jsonb_build_object('status', v_old_status, 'withdrawal_request_id', v_old_withdrawal_id),
    jsonb_build_object('status', 'estornada', 'compensacao_pendente', v_old_status = 'paga'),
    coalesce(p_motivo, 'Estorno confirmado.')
  );

  return jsonb_build_object(
    'ok', true,
    'oldStatus', v_old_status,
    'negativeOffsetApplied', (v_old_status = 'paga')
  );
end;
$fn_reverse_comm$;

revoke all on function public.reverse_partner_commission(uuid, text, text, text) from public;
grant execute on function public.reverse_partner_commission(uuid, text, text, text) to service_role;
