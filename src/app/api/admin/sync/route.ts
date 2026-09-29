import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/lead/admin-auth";
import { getAdminSyncSettings } from "@/lib/lead/mock-database";
import { runConfiguredSync } from "@/lib/lead/sync-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const result = await runConfiguredSync(await getAdminSyncSettings(), "admin");
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed." }, { status: 502 }); }
}
