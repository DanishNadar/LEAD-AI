import { NextRequest, NextResponse } from "next/server";
import { CampusGroupsExportClient, type ExportResource } from "@/lib/lead/campusgroups";
import { ingestCampusGroupsRows, runDemoCampusGroupsSync, type CampusGroupsResource } from "@/lib/lead/mock-database";

export const runtime = "nodejs";
export const maxDuration = 300;

const allowedResources: ExportResource[] = [
  "events", "rsvp", "checkins", "badge_completions", "survey_submissions", "announcements", "budgets", "academic_experiences", "work_experiences", "members",
];

const normalizableResources = ["events", "rsvp", "checkins", "badge_completions", "members"] as const;

function canNormalize(resource: ExportResource): resource is Exclude<CampusGroupsResource, "survey_submissions"> {
  return normalizableResources.includes(resource as Exclude<CampusGroupsResource, "survey_submissions">);
}

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
    const resource = body.resource ?? "events";
    if (!allowedResources.includes(resource)) {
      return NextResponse.json({ error: "Unsupported export resource." }, { status: 400 });
    }
    const updatedStart = body.updatedStart ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const updatedEnd = body.updatedEnd ?? new Date().toISOString();
    const client = CampusGroupsExportClient.fromEnvironment();
    const results = await client.exportAll(resource, { updatedStart, updatedEnd });

    if (!canNormalize(resource)) {
      return NextResponse.json({
        resource, window: { updatedStart, updatedEnd }, received: results.length,
        nextStep: "This source is available from CampusGroups but has no approved reporting mapping yet.",
      });
    }
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
