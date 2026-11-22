import { NextResponse } from "next/server";
import { isCaktoConfigured } from "@/lib/cakto";

export async function GET() {
  return NextResponse.json({
    configured: isCaktoConfigured(),
    provider: "cakto",
    methods: ["pix", "credit_card", "boleto"],
  });
}
