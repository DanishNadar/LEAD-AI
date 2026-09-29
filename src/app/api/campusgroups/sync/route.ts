import { NextRequest, NextResponse } from "next/server";
import { CampusGroupsExportClient, exportResources, type ExportResource } from "@/lib/lead/campusgroups";
import { hasDurableStorage, ingestCampusGroupsRows, runDemoCampusGroupsSync } from "@/lib/lead/mock-database";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const expected = process.env.INTERNAL_SYNC_TOKEN;
  // Local development can validate the pipeline without requiring an additional token.
  // A deployed route fails closed until an explicit service token is configured.
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-lead-sync-token") === expected;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized sync request." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { resource?: ExportResource; updatedStart?: string; updatedEnd?: string; mode?: "demo" };
    if (body.mode === "demo") {
      if (process.env.NODE_ENV === "production" && !process.env.LEAD_ALLOW_DEMO_SYNC) {
        return NextResponse.json({ error: "Demo sync is disabled in production." }, { status: 403 });
      }
      const data = await runDemoCampusGroupsSync();
      return NextResponse.json({ mode: "demo", resource: "events, rsvp, checkins", received: 62, ...data });
    }
    if (!process.env.CG_SCHOOL_CODE || !process.env.CG_API_SECRET) {
      return NextResponse.json({
        error: "CampusGroups is not configured.",
        setup: "Add CG_SCHOOL_CODE and CG_API_SECRET to .env.local. Secrets are used server-side only.",
      }, { status: 503 });
    }
    if (process.env.NODE_ENV === "production" && !hasDurableStorage()) {
      return NextResponse.json({ error: "Live sync requires DATABASE_URL. Provision Neon in Vercel before running an export." }, { status: 503 });
    }
    if (process.env.NODE_ENV === "production" && !process.env.CG_REPORTING_GROUP_IDS) {
      return NextResponse.json({ error: "Live sync requires CG_REPORTING_GROUP_IDS so the report is scoped to the Leadership Academy." }, { status: 503 });
    }
    const resource = body.resource ?? "events";
    if (!exportResources.includes(resource)) {
      return NextResponse.json({ error: "Unsupported export resource." }, { status: 400 });
    }
    const updatedStart = body.updatedStart ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const updatedEnd = body.updatedEnd ?? new Date().toISOString();
    const client = CampusGroupsExportClient.fromEnvironment();
    const results = await client.exportAll(resource, { updatedStart, updatedEnd });

    const data = await ingestCampusGroupsRows(resource, results as Record<string, unknown>[]);
    return NextResponse.json({
      resource, window: { updatedStart, updatedEnd }, received: results.length,
      persisted: true, ...data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected export failure.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
