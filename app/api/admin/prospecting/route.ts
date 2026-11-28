import { NextRequest, NextResponse } from "next/server";
import { listProspectingWorkspace } from "@/lib/admin-prospecting";
import { getEmailServiceSummary } from "@/lib/email";
import { requireSupremeAdmin } from "@/lib/partners-server";

export async function GET(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { erro: auth.error, ...(auth.diag ? { diag: auth.diag } : {}) },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") || undefined;

  try {
    const workspace = await listProspectingWorkspace(auth.admin, { campaignId });
    return NextResponse.json({
      ok: true,
      campaigns: workspace.campaigns,
      leads: workspace.leads,
      counts: workspace.counts,
      migrationPending: workspace.migrationPending,
      emailService: getEmailServiceSummary(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Erro ao carregar dados de prospecção.",
      },
      { status: 500 }
    );
  }
}
