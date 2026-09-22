import { NextResponse } from "next/server";
import { getCurrentReport } from "@/lib/lead/mock-database";

export const runtime = "nodejs";

/**
 * Read-only aggregate report contract. Raw source rows stay in the repository;
 * this endpoint is safe for the dashboard's refresh path.
 */
export async function GET() {
  return NextResponse.json(await getCurrentReport(), {
    headers: { "Cache-Control": "no-store" },
  });
}
