import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/lead/admin-auth";
import { getAdminSyncSettings, updateAdminSyncSettings } from "@/lib/lead/mock-database";
import { syncResources, type AdminSyncSettings, type SyncCadence } from "@/lib/lead/types";

export const runtime = "nodejs";
const cadences: SyncCadence[] = ["hourly", "every_6_hours", "daily", "weekdays"];

async function requireAdmin() { return getAdminSession(); }

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  return NextResponse.json({ email: session.email, settings: await getAdminSyncSettings() });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const body = await request.json() as Partial<AdminSyncSettings>;
    if (typeof body.enabled !== "boolean" || (body.mode !== "live" && body.mode !== "demo") || !cadences.includes(body.cadence as SyncCadence) || !Number.isInteger(body.startHourUtc) || (body.startHourUtc ?? -1) < 0 || (body.startHourUtc ?? 24) > 23 || !Number.isInteger(body.lookbackDays) || (body.lookbackDays ?? 0) < 1 || (body.lookbackDays ?? 32) > 31 || !Array.isArray(body.resources) || body.resources.length === 0 || body.resources.some((resource) => !syncResources.includes(resource))) {
      return NextResponse.json({ error: "Review the sync schedule settings and try again." }, { status: 400 });
    }
    const settings: AdminSyncSettings = { enabled: body.enabled, mode: body.mode, cadence: body.cadence as SyncCadence, startHourUtc: body.startHourUtc!, lookbackDays: body.lookbackDays!, resources: body.resources };
    return NextResponse.json({ settings: await updateAdminSyncSettings(settings) });
  } catch { return NextResponse.json({ error: "Settings must be valid JSON." }, { status: 400 }); }
}
