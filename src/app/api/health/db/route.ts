import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ok: true,
        status: "up",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[Health][DB] check failed", error);

    return NextResponse.json(
      {
        ok: false,
        status: "down",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
