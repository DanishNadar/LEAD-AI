import { NextResponse } from "next/server";
import { getDataOverview } from "@/lib/lead/mock-database";

export const runtime = "nodejs";

/** Metadata only: table counts and recent syncs, never individual student rows. */
export async function GET() {
  return NextResponse.json(await getDataOverview(), { headers: { "Cache-Control": "no-store" } });
}
