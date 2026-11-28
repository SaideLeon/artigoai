import { NextRequest, NextResponse } from "next/server";
import {
  runProspectingDiscovery,
  type ProspectProfileType,
} from "@/lib/admin-prospecting";
import { requireSupremeAdmin } from "@/lib/partners-server";

const ALLOWED_PROFILES = new Set<ProspectProfileType>([
  "blogs",
  "agencias",
  "saas",
  "criadores",
]);

export async function POST(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { erro: auth.error, ...(auth.diag ? { diag: auth.diag } : {}) },
      { status: auth.status }
    );
  }

  let body: {
    nicho?: unknown;
    perfis?: unknown;
    regiao?: unknown;
    idioma?: unknown;
    criterios?: unknown;
    quantidadeAlvo?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Corpo JSON inválido." }, { status: 400 });
  }

  const nicho = typeof body.nicho === "string" ? body.nicho.trim() : "";
  if (nicho.length < 3) {
    return NextResponse.json(
      { erro: "Informe um nicho ou assunto com pelo menos 3 caracteres." },
      { status: 400 }
    );
  }

  const perfisRaw = Array.isArray(body.perfis) ? body.perfis : [];
  const perfis = perfisRaw.filter(
    (p): p is ProspectProfileType =>
      typeof p === "string" && ALLOWED_PROFILES.has(p as ProspectProfileType)
  );

  const regiao =
    typeof body.regiao === "string" && body.regiao.trim()
      ? body.regiao.trim().slice(0, 80)
      : "Brasil";
  const idioma =
    typeof body.idioma === "string" && body.idioma.trim()
      ? body.idioma.trim().slice(0, 60)
      : "Português (Brasil)";
  const criterios =
    typeof body.criterios === "string" ? body.criterios.trim().slice(0, 600) : "";
  const quantidadeAlvo =
    typeof body.quantidadeAlvo === "number" ? body.quantidadeAlvo : 8;

  try {
    const result = await runProspectingDiscovery(auth.admin, {
      nicho: nicho.slice(0, 140),
      perfis: perfis.length > 0 ? perfis : ["blogs"],
      regiao,
      idioma,
      criterios,
      quantidadeAlvo,
      adminEmail: auth.user.email ?? "admin@artificializar.site",
    });

    return NextResponse.json({
      ok: true,
      campaign: result.campaign,
      leads: result.leads,
      modeloBusca: result.modeloBusca,
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Erro ao executar busca discriminada com Gemini.",
      },
      { status: 500 }
    );
  }
}
