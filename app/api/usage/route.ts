import { NextResponse } from "next/server";
import { getUserUsageSnapshotForRequest } from "@/lib/usage-enforcement";

export async function GET() {
  try {
    const snapshot = await getUserUsageSnapshotForRequest();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Falha ao consultar limites de utilização.",
      },
      { status: 500 }
    );
  }
}
