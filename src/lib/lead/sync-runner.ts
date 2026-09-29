import "server-only";

import { CampusGroupsExportClient } from "@/lib/lead/campusgroups";
import { getAdminSyncSettings, getCurrentReport, getDataOverview, hasDurableStorage, ingestCampusGroupsRows, needsInitialCampusGroupsSync, runDemoCampusGroupsSync } from "@/lib/lead/mock-database";
import { syncResources, type AdminSyncSettings, type SyncResource } from "@/lib/lead/types";

export type SyncTrigger = "admin" | "scheduled";
export type SyncExecution = {
  mode: "live" | "demo";
  trigger: SyncTrigger;
  resources: SyncResource[];
  received: number;
  pulls: { resource: SyncResource; received: number; status: "completed" | "failed"; error?: string }[];
  complete: boolean;
  report: Awaited<ReturnType<typeof getCurrentReport>>;
  overview: Awaited<ReturnType<typeof getDataOverview>>;
};

function syncWindow(lookbackDays: number, initialSync: boolean) {
  const updatedEnd = new Date().toISOString();
  const configuredStart = initialSync ? process.env.CG_INITIAL_SYNC_START : undefined;
  const updatedStart = configuredStart && !Number.isNaN(Date.parse(configuredStart))
    ? new Date(configuredStart).toISOString()
    : new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  return { updatedStart, updatedEnd };
}

async function withConcurrency<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Vercel decides when the cron endpoint is called; this decides whether it should act.
 * Hobby crons run once per day and only land somewhere inside the scheduled hour, so the
 * check is hour-based and never requires an exact minute. Match the `crons` entry in
 * vercel.json to the hour you want, and on Hobby keep `startHourUtc` on that same hour.
 */
export function isSyncDue(settings: AdminSyncSettings, now = new Date()) {
  if (!settings.enabled) return false;
  const hour = now.getUTCHours();
  if (settings.cadence === "hourly") return true;
  if (settings.cadence === "every_6_hours") return hour % 6 === settings.startHourUtc % 6;
  if (settings.cadence === "weekdays") return now.getUTCDay() >= 1 && now.getUTCDay() <= 5 && hour === settings.startHourUtc;
  return hour === settings.startHourUtc;
}

export async function runConfiguredSync(settings: AdminSyncSettings, trigger: SyncTrigger): Promise<SyncExecution> {
  if (settings.mode === "demo") {
    if (process.env.NODE_ENV === "production" && !process.env.LEAD_ALLOW_DEMO_SYNC) throw new Error("Demo sync is disabled in production.");
    const data = await runDemoCampusGroupsSync();
    const demoResources: SyncResource[] = ["events", "rsvp", "checkins"];
    return {
      mode: "demo", trigger, resources: demoResources, received: 62,
      pulls: demoResources.map((resource) => ({ resource, received: resource === "events" ? 1 : resource === "rsvp" ? 32 : 29, status: "completed" as const })),
      complete: true, ...data,
    };
  }
  if (!process.env.CG_SCHOOL_CODE || !process.env.CG_API_SECRET) throw new Error("CampusGroups is not configured. Add CG_SCHOOL_CODE and CG_API_SECRET.");
  if (process.env.NODE_ENV === "production" && !process.env.CG_REPORTING_GROUP_IDS) throw new Error("Live sync requires CG_REPORTING_GROUP_IDS so Leadership Academy metrics are not calculated across the entire school.");
  if (process.env.NODE_ENV === "production" && !hasDurableStorage()) throw new Error("Live sync requires DATABASE_URL. Install the Neon Vercel Marketplace integration before enabling CampusGroups on a deployment.");
  const client = CampusGroupsExportClient.fromEnvironment();
  const window = syncWindow(settings.lookbackDays, await needsInitialCampusGroupsSync());
  const runPull = async (resource: SyncResource) => {
    try {
      const rows = await client.exportAll<Record<string, unknown>>(resource, window);
      await ingestCampusGroupsRows(resource, rows);
      return { resource, received: rows.length, status: "completed" as const };
    } catch (error) {
      return { resource, received: 0, status: "failed" as const, error: error instanceof Error ? error.message : "Unknown export error." };
    }
  };
  // Members and events establish the approved cohort and touchpoint boundaries.
  // Fetch them first so dependent exports can be minimized by user/event ID.
  const boundaryResources = settings.resources.filter((resource) => resource === "events" || resource === "members");
  const dependentResources = settings.resources.filter((resource) => resource !== "events" && resource !== "members");
  const boundaryPulls = [];
  for (const resource of boundaryResources) boundaryPulls.push(await runPull(resource));
  const pulls = [...boundaryPulls, ...await withConcurrency(dependentResources, 3, runPull)];
  return {
    mode: "live",
    trigger,
    resources: settings.resources,
    received: pulls.reduce((total, pull) => total + pull.received, 0),
    pulls,
    complete: pulls.every((pull) => pull.status === "completed"),
    report: await getCurrentReport(),
    overview: await getDataOverview(),
  };
}

export async function runSavedSchedule(trigger: SyncTrigger) {
  const settings = await getAdminSyncSettings();
  return runConfiguredSync({ ...settings, resources: settings.resources.filter((resource): resource is SyncResource => syncResources.includes(resource)) }, trigger);
}
