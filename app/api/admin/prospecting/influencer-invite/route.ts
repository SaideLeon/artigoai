import { NextRequest, NextResponse } from "next/server";
import {
  embedInviteLinkInMessage,
  generateInfluencerInviteFromScreenshot,
  type InfluencerTone,
} from "@/lib/admin-prospecting";
import { DEFAULT_PARTNER_COMMISSION_PERCENT } from "@/lib/partners";
import {
  createPartnerInviteRecord,
  getPublicSiteOrigin,
  requireSupremeAdmin,
} from "@/lib/partners-server";

export async function POST(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: {
    imageBase64?: unknown;
    imageMimeType?: unknown;
    canalUrl?: unknown;
    nomeManual?: unknown;
    notasAdmin?: unknown;
    tom?: unknown;
    criarLinkParceiro?: unknown;
    inviteUrlExistente?: unknown;
    percentualComissao?: unknown;
    validadeDias?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { erro: "Corpo JSON inválido." },
      { status: 400 }
    );
  }

  const imageBase64 =
    typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
  const imageMimeType =
    typeof body.imageMimeType === "string" ? body.imageMimeType : undefined;
  const canalUrl =
    typeof body.canalUrl === "string" ? body.canalUrl.trim() : undefined;
  const nomeManual =
    typeof body.nomeManual === "string" ? body.nomeManual.trim() : undefined;
  const notasAdmin =
    typeof body.notasAdmin === "string" ? body.notasAdmin.trim() : undefined;
  const tom: InfluencerTone =
    body.tom === "direto" || body.tom === "consultivo" ? body.tom : "amigavel";

  if (imageBase64 && imageBase64.length > 8_500_000) {
    return NextResponse.json(
      {
        erro: "A imagem do print está muito grande. Recorte ou envie uma captura de até 6 MB.",
      },
      { status: 400 }
    );
  }

  const rawPercent = Number(
    body.percentualComissao ?? DEFAULT_PARTNER_COMMISSION_PERCENT
  );
  const percentualComissao =
    Number.isFinite(rawPercent) && rawPercent >= 0 && rawPercent <= 100
      ? Math.round(rawPercent * 100) / 100
      : DEFAULT_PARTNER_COMMISSION_PERCENT;

  const rawDays = Number(body.validadeDias ?? 30);
  const validadeDias =
    Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 365
      ? Math.round(rawDays)
      : 30;

  const criarLinkParceiro = body.criarLinkParceiro !== false;
  const inviteUrlExistente =
    typeof body.inviteUrlExistente === "string" &&
    /^https?:\/\/\S+/i.test(body.inviteUrlExistente.trim())
      ? body.inviteUrlExistente.trim()
      : "";

  try {
    const generated = await generateInfluencerInviteFromScreenshot({
      imageBase64,
      imageMimeType,
      canalUrl,
      nomeManual,
      notasAdmin,
      tom,
      percentualComissao,
    });

    const origin = getPublicSiteOrigin(req.nextUrl.origin);
    let inviteUrl = inviteUrlExistente || `${origin}/parceiro`;
    let inviteId: string | null = null;
    let inviteExpiresAt: string | null = null;
    let linkCriadoAutomaticamente = false;
    let avisoLink: string | null = null;

    if (!inviteUrlExistente && criarLinkParceiro) {
      const nomeSugerido = `${generated.draft.nomeCanal} (${generated.draft.plataforma})`.slice(
        0,
        100
      );
      const created = await createPartnerInviteRecord(auth.admin, {
        origin,
        adminEmail: auth.user.email ?? "",
        nomeSugerido,
        percentualComissao,
        validadeDias,
      });

      if (created.ok) {
        inviteUrl = created.inviteUrl;
        inviteId = created.invite.id;
        inviteExpiresAt = created.invite.expira_em;
        linkCriadoAutomaticamente = true;
      } else {
        avisoLink = `Mensagem gerada, mas não foi possível registrar o token exclusivo (${created.error}). Link padrão de parceiros aplicado.`;
      }
    }

    const mensagemCurta = embedInviteLinkInMessage(
      generated.draft.mensagemCurta,
      inviteUrl
    );
    const mensagemEmailCurta = embedInviteLinkInMessage(
      generated.draft.mensagemEmailCurta,
      inviteUrl
    );

    return NextResponse.json({
      ok: true,
      modelo: generated.modelo,
      inviteUrl,
      inviteId,
      inviteExpiresAt,
      percentualComissao,
      linkCriadoAutomaticamente,
      avisoLink,
      draft: {
        ...generated.draft,
        mensagemCurta,
        mensagemEmailCurta,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Não foi possível gerar o convite a partir do print.";
    return NextResponse.json({ erro: message }, { status: 400 });
  }
}
