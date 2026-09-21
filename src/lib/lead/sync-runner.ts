import "server-only";

import { CampusGroupsExportClient } from "@/lib/lead/campusgroups";
import { getAdminSyncSettings, getCurrentReport, getDataOverview, ingestCampusGroupsRows, runDemoCampusGroupsSync } from "@/lib/lead/mock-database";
import { syncResources, type AdminSyncSettings, type SyncResource } from "@/lib/lead/types";

export type SyncTrigger = "admin" | "scheduled";
export type SyncExecution = {
  mode: "live" | "demo";
  trigger: SyncTrigger;
  resources: SyncResource[];
  received: number;
  report: Awaited<ReturnType<typeof getCurrentReport>>;
  overview: Awaited<ReturnType<typeof getDataOverview>>;
};

function syncWindow(lookbackDays: number) {
  const updatedEnd = new Date().toISOString();
  const updatedStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  return { updatedStart, updatedEnd };
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
    return { mode: "demo", trigger, resources: ["events", "rsvp", "checkins"], received: 62, ...data };
  }
  if (!process.env.CG_SCHOOL_CODE || !process.env.CG_API_SECRET) throw new Error("CampusGroups is not configured. Add CG_SCHOOL_CODE and CG_API_SECRET.");
  const client = CampusGroupsExportClient.fromEnvironment();
  const window = syncWindow(settings.lookbackDays);
  let received = 0;
  for (const resource of settings.resources) {
    const rows = await client.exportAll<Record<string, unknown>>(resource, window);
    received += rows.length;
    await ingestCampusGroupsRows(resource, rows);
  }
  return { mode: "live", trigger, resources: settings.resources, received, report: await getCurrentReport(), overview: await getDataOverview() };
}

export async function runSavedSchedule(trigger: SyncTrigger) {
  const settings = await getAdminSyncSettings();
  return runConfiguredSync({ ...settings, resources: settings.resources.filter((resource): resource is SyncResource => syncResources.includes(resource)) }, trigger);
}
