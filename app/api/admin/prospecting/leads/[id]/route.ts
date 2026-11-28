import { NextRequest, NextResponse } from "next/server";
import {
  generatePersonalizedOutreachDraft,
  isValidPublicContactEmail,
  type AdminProspectLeadRow,
  type ProspectLeadStatus,
} from "@/lib/admin-prospecting";
import { requireSupremeAdmin } from "@/lib/partners-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_MUTABLE_STATUSES = new Set<ProspectLeadStatus>([
  "rascunho_pronto",
  "aprovado",
  "ignorado",
  "sem_email",
]);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  let body: {
    action?: unknown;
    instrucaoExtra?: unknown;
    emailSelecionado?: unknown;
    assuntoRascunho?: unknown;
    corpoRascunho?: unknown;
    status?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Corpo JSON inválido." }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await auth.admin
    .from("admin_prospect_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ erro: fetchErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json(
      { erro: "Lead de prospecção não encontrado." },
      { status: 404 }
    );
  }

  const lead = existing as AdminProspectLeadRow;

  if (body.action === "regenerate") {
    try {
      const { data: camp } = await auth.admin
        .from("admin_prospect_campaigns")
        .select("nicho")
        .eq("id", lead.campaign_id)
        .maybeSingle();

      const draft = await generatePersonalizedOutreachDraft({
        nomeSite: lead.nome_site,
        dominio: lead.dominio,
        url: lead.url,
        categoriaInicial: lead.categoria,
        nichoCampanha: camp?.nicho || "conteúdo e blogs",
        descricaoSite: lead.descricao_site,
        excerptSite: lead.descricao_site,
        redesSociais: Array.isArray(lead.redes_sociais) ? lead.redes_sociais : [],
        instrucaoExtra:
          typeof body.instrucaoExtra === "string"
            ? body.instrucaoExtra.slice(0, 400)
            : undefined,
      });

      const { data: updated, error: updErr } = await auth.admin
        .from("admin_prospect_leads")
        .update({
          categoria: draft.categoria,
          motivo_aderencia: draft.motivoAderencia,
          assunto_rascunho: draft.assunto,
          corpo_rascunho: draft.corpo,
          status:
            lead.status === "enviado"
              ? "enviado"
              : lead.email_selecionado
              ? "rascunho_pronto"
              : "sem_email",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updErr || !updated) {
        return NextResponse.json(
          { erro: updErr?.message || "Erro ao salvar novo rascunho." },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, lead: updated });
    } catch (err) {
      return NextResponse.json(
        {
          erro:
            err instanceof Error
              ? err.message
              : "Falha ao regenerar convite com Gemini.",
        },
        { status: 500 }
      );
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.emailSelecionado === "string") {
    const cleanEmail = body.emailSelecionado.trim().toLowerCase();
    if (cleanEmail && !isValidPublicContactEmail(cleanEmail)) {
      return NextResponse.json(
        { erro: "Formato de e-mail inválido para contato." },
        { status: 400 }
      );
    }
    patch.email_selecionado = cleanEmail || null;
    if (cleanEmail && lead.status === "sem_email") {
      patch.status = "rascunho_pronto";
    } else if (!cleanEmail && lead.status !== "enviado" && lead.status !== "ignorado") {
      patch.status = "sem_email";
    }
  }

  if (typeof body.assuntoRascunho === "string") {
    patch.assunto_rascunho = body.assuntoRascunho.trim().slice(0, 200);
  }

  if (typeof body.corpoRascunho === "string") {
    patch.corpo_rascunho = body.corpoRascunho.trim().slice(0, 8000);
  }

  if (
    typeof body.status === "string" &&
    lead.status !== "enviado" &&
    ALLOWED_MUTABLE_STATUSES.has(body.status as ProspectLeadStatus)
  ) {
    patch.status = body.status;
  }

  const { data: updated, error: updErr } = await auth.admin
    .from("admin_prospect_leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { erro: updErr?.message || "Erro ao atualizar lead." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, lead: updated });
}
