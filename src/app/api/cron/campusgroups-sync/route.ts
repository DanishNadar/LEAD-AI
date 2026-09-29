import { NextRequest, NextResponse } from "next/server";
import { getAdminSyncSettings } from "@/lib/lead/mock-database";
import { isSyncDue, runConfiguredSync } from "@/lib/lead/sync-runner";

export const runtime = "nodejs";
// A complete CampusGroups export can poll for readiness and page through results.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  const settings = await getAdminSyncSettings();
  if (!isSyncDue(settings)) return NextResponse.json({ ok: true, ran: false, reason: settings.enabled ? "not-due" : "schedule-disabled" });
  try {
    const result = await runConfiguredSync(settings, "scheduled");
    return NextResponse.json({ ok: result.complete, ran: true, ...result }, { status: result.complete ? 200 : 502 });
  } catch (error) { return NextResponse.json({ ok: false, ran: true, error: error instanceof Error ? error.message : "Scheduled sync failed." }, { status: 502 }); }
}
