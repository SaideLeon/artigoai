-- =============================================================================
-- 11. RPC Atómica: Admin Supremo atualiza estado do saque (em_analise / pago / recusado)
-- Dependências: 08_partners_ledger_and_withdrawals.sql
-- =============================================================================

create or replace function public.admin_update_withdrawal_status(
  p_withdrawal_id uuid,
  p_action text,
  p_admin_user_id uuid,
  p_admin_email text,
  p_comprovativo_ref text default null,
  p_pago_em timestamptz default null,
  p_motivo_recusa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_admin_wd$
declare
  v_w public.withdrawal_requests%rowtype;
  v_pago_time timestamptz := coalesce(p_pago_em, now());
  v_comm record;
begin
  select *
    into v_w
    from public.withdrawal_requests
   where id = p_withdrawal_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Pedido de saque não encontrado.');
  end if;

  if v_w.status in ('pago', 'recusado') then
    return jsonb_build_object('ok', false, 'code', 'already_finalized', 'error', 'Este pedido de saque já foi finalizado.');
  end if;

  if p_action = 'em_analise' then
    if v_w.status <> 'solicitado' then
      return jsonb_build_object('ok', false, 'code', 'invalid_transition', 'error', 'Apenas pedidos solicitados podem ir para análise.');
    end if;

    update public.withdrawal_requests
       set status = 'em_analise',
           analisado_em = now(),
           atualizado_em = now()
     where id = p_withdrawal_id;

    insert into public.partner_audit_logs (
      entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
      acao, estado_anterior, estado_novo, motivo
    ) values (
      'withdrawal_request', v_w.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
      'saque_em_analise',
      jsonb_build_object('status', v_w.status),
      jsonb_build_object('status', 'em_analise'),
      'Pedido marcado em análise pelo administrador supremo.'
    );

    select * into v_w from public.withdrawal_requests where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'withdrawal', to_jsonb(v_w));
  end if;

  if p_action = 'pago' then
    update public.withdrawal_requests
       set status = 'pago',
           comprovativo_ref = nullif(trim(coalesce(p_comprovativo_ref, '')), ''),
           pago_em = v_pago_time,
           atualizado_em = now()
     where id = p_withdrawal_id;

    for v_comm in
      select id, status
        from public.commissions
       where withdrawal_request_id = p_withdrawal_id
         and status = 'em_saque'
       for update
    loop
      update public.commissions
         set status = 'paga',
             paga_em = v_pago_time
       where id = v_comm.id;

      insert into public.partner_audit_logs (
        entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
        acao, estado_anterior, estado_novo, motivo
      ) values (
        'commission', v_comm.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
        'paga',
        jsonb_build_object('status', v_comm.status, 'withdrawal_request_id', p_withdrawal_id),
        jsonb_build_object('status', 'paga', 'paga_em', v_pago_time),
        coalesce(nullif(trim(coalesce(p_comprovativo_ref, '')), ''), 'Saque marcado como pago.')
      );
    end loop;

    insert into public.partner_ledger_entries (
      partner_id, withdrawal_request_id, tipo, valor_centavos, saldo_afetado, descricao
    ) values (
      v_w.partner_id, v_w.id, 'pagamento_saque', v_w.valor_centavos, 'pago',
      coalesce(nullif(trim(coalesce(p_comprovativo_ref, '')), ''), 'Saque pago ao parceiro.')
    );

    insert into public.partner_audit_logs (
      entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
      acao, estado_anterior, estado_novo, motivo
    ) values (
      'withdrawal_request', v_w.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
      'saque_pago',
      jsonb_build_object('status', v_w.status),
      jsonb_build_object(
        'status', 'pago',
        'comprovativo_ref', nullif(trim(coalesce(p_comprovativo_ref, '')), ''),
        'pago_em', v_pago_time
      ),
      'Pagamento de saque confirmado pelo administrador supremo.'
    );

    select * into v_w from public.withdrawal_requests where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'withdrawal', to_jsonb(v_w));
  end if;

  if p_action = 'recusado' then
    if trim(coalesce(p_motivo_recusa, '')) = '' then
      return jsonb_build_object('ok', false, 'code', 'reason_required', 'error', 'Informe o motivo da recusa do saque.');
    end if;

    update public.withdrawal_requests
       set status = 'recusado',
           motivo_recusa = trim(p_motivo_recusa),
           recusado_em = now(),
           atualizado_em = now()
     where id = p_withdrawal_id;

    for v_comm in
      select id, status
        from public.commissions
       where withdrawal_request_id = p_withdrawal_id
         and status = 'em_saque'
       for update
    loop
      update public.commissions
         set status = 'disponivel',
             withdrawal_request_id = null
       where id = v_comm.id;

      insert into public.partner_audit_logs (
        entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
        acao, estado_anterior, estado_novo, motivo
      ) values (
        'commission', v_comm.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
        'devolvida_para_disponivel',
        jsonb_build_object('status', 'em_saque', 'withdrawal_request_id', p_withdrawal_id),
        jsonb_build_object('status', 'disponivel', 'withdrawal_request_id', null),
        trim(p_motivo_recusa)
      );
    end loop;

    delete from public.partner_ledger_entries
     where withdrawal_request_id = p_withdrawal_id
       and tipo = 'credito_troco_saque';

    update public.partner_ledger_entries
       set settled_withdrawal_id = null
     where settled_withdrawal_id = p_withdrawal_id;

    insert into public.partner_ledger_entries (
      partner_id, withdrawal_request_id, tipo, valor_centavos, saldo_afetado, descricao
    ) values (
      v_w.partner_id, v_w.id, 'liberacao_saque_recusado', v_w.valor_centavos, 'disponivel',
      trim(p_motivo_recusa)
    );

    insert into public.partner_audit_logs (
      entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
      acao, estado_anterior, estado_novo, motivo
    ) values (
      'withdrawal_request', v_w.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
      'saque_recusado',
      jsonb_build_object('status', v_w.status),
      jsonb_build_object('status', 'recusado', 'motivo_recusa', trim(p_motivo_recusa)),
      trim(p_motivo_recusa)
    );

    select * into v_w from public.withdrawal_requests where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'withdrawal', to_jsonb(v_w));
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_action', 'error', 'Ação de saque inválida.');
end;
$fn_admin_wd$;

revoke all on function public.admin_update_withdrawal_status(uuid, text, uuid, text, text, timestamptz, text) from public;
grant execute on function public.admin_update_withdrawal_status(uuid, text, uuid, text, text, timestamptz, text) to service_role;
