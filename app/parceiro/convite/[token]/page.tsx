import type { Metadata } from "next";
import { Suspense } from "react";
import PartnerInviteClient from "@/components/PartnerInviteClient";

export const metadata: Metadata = {
  title: "Convite de Parceiro",
  description:
    "Aceite seu convite exclusivo para o Programa de Parceiros Artigen.",
  robots: {
    index: false,
    follow: false,
  },
};

async function InviteLoader({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PartnerInviteClient token={token} />;
}

export default function PartnerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070B16] text-sm text-slate-300">
          Carregando convite de parceria…
        </div>
      }
    >
      <InviteLoader params={params} />
    </Suspense>
  );
}
