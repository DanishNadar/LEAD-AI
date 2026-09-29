import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { demoProgramData } from "@/lib/lead/demo-data";
import { buildProgramReport } from "@/lib/lead/metrics";
import { committeeCode, scholarKey } from "@/lib/lead/report-intake";
import { buildWeeklyReport, latestWeekOf, listWeeks, summarize, viewOf } from "@/lib/lead/weekly-report";
import type { AdminSyncSettings, Committee, DataOverview, EventRecord, IndividualReport, IndividualReportSubmission, IndividualReportSummary, IndividualReportView, ProgramData, ProgramReport, ReportingTableName, TouchpointInput, WeekIndexEntry, WeeklyReport } from "@/lib/lead/types";

type DatabaseEvent = Omit<EventRecord, "rsvps" | "checkins"> & { externalId?: string };
type DatabaseRsvp = { id: string; eventId: string; status: string; externalId?: string };
type DatabaseCheckin = { id: string; eventId: string; active: boolean; externalId?: string };
type SyncRun = DataOverview["syncRuns"][number];

type MockDatabase = Omit<ProgramData, "events" | "badgeCompletions"> & {
  version: 1;
  events: DatabaseEvent[];
  rsvps: DatabaseRsvp[];
  checkins: DatabaseCheckin[];
  badgeCompletions: ProgramData["badgeCompletions"];
  syncRuns: SyncRun[];
  adminSyncSettings: AdminSyncSettings;
};

type CampusGroupsRow = Record<string, unknown>;
export type CampusGroupsResource = "events" | "rsvp" | "checkins" | "members" | "badge_completions" | "survey_submissions";

const directory = join(process.cwd(), ".lead-ai");
const databasePath = join(directory, "reporting-store.json");
let writeQueue = Promise.resolve();

/**
 * The JSON file store only runs where the project directory is writable. A serverless
 * host such as Vercel mounts a read-only filesystem outside /tmp, and /tmp is not shared
 * between instances, so there the same data lives in memory for the life of the instance:
 * the demo stays fully interactive, but a write does not outlive a cold start and is not
 * visible to other instances. Point `readDatabase`/`persist` at an approved database
 * before treating any of this as durable evidence.
 */
let usesFileStore = !process.env.VERCEL;
let memoryDatabase: MockDatabase | undefined;

export function storageKind(): DataOverview["storage"] {
  return usesFileStore ? "local-demo" : "ephemeral-demo";
}

const defaultAdminSyncSettings: AdminSyncSettings = {
  enabled: false,
  mode: "live",
  cadence: "daily",
  startHourUtc: 6,
  resources: ["events", "rsvp", "checkins", "members", "badge_completions"],
  lookbackDays: 7,
};

function seedDatabase(): MockDatabase {
  return {
    version: 1,
    reportingPeriod: demoProgramData.reportingPeriod,
    cohortSize: demoProgramData.cohortSize,
    events: demoProgramData.events.map((event) => ({ id: event.id, title: event.title, date: event.date, type: event.type, campusArea: event.campusArea, expected: event.expected, feedbackScore: event.feedbackScore, owner: event.owner, hasAgenda: event.hasAgenda, hasOutcome: event.hasOutcome })),
    rsvps: demoProgramData.events.flatMap((event) => Array.from({ length: event.rsvps }, (_, index) => ({ id: `${event.id}-rsvp-${index + 1}`, eventId: event.id, status: "attending" }))),
    checkins: demoProgramData.events.flatMap((event) => Array.from({ length: event.checkins }, (_, index) => ({ id: `${event.id}-checkin-${index + 1}`, eventId: event.id, active: true }))),
    surveys: demoProgramData.surveys,
    surveyInvitations: demoProgramData.surveyInvitations,
    badgeCompletions: demoProgramData.badgeCompletions,
    members: demoProgramData.members,
    goals: demoProgramData.goals,
    individualReports: demoProgramData.individualReports,
    lastSyncedAt: demoProgramData.lastSyncedAt,
    syncRuns: [{ id: "seed", source: "campusgroups-demo", resource: "initial reporting tables", received: demoProgramData.events.length, completedAt: demoProgramData.lastSyncedAt }],
    adminSyncSettings: defaultAdminSyncSettings,
  };
}

function migrateDatabase(database: Partial<MockDatabase>): MockDatabase {
  const seed = seedDatabase();
  return {
    ...seed,
    ...database,
    version: 1,
    individualReports: database.individualReports ?? seed.individualReports,
    syncRuns: database.syncRuns ?? seed.syncRuns,
    adminSyncSettings: { ...defaultAdminSyncSettings, ...database.adminSyncSettings },
  };
}

function toProgramData(database: MockDatabase): ProgramData {
  return {
    reportingPeriod: database.reportingPeriod,
    cohortSize: database.cohortSize,
    events: database.events.map((event) => ({
      ...event,
      rsvps: database.rsvps.filter((rsvp) => rsvp.eventId === event.id && rsvp.status !== "declined").length,
      checkins: database.checkins.filter((checkin) => checkin.eventId === event.id && checkin.active).length,
    })),
    surveys: database.surveys,
    surveyInvitations: database.surveyInvitations,
    badgeCompletions: database.badgeCompletions,
    members: database.members,
    goals: database.goals,
    individualReports: database.individualReports,
    lastSyncedAt: database.lastSyncedAt,
  };
}

async function readDatabase(): Promise<MockDatabase> {
  if (!usesFileStore) return (memoryDatabase ??= seedDatabase());
  try {
    return migrateDatabase(JSON.parse(await readFile(databasePath, "utf8")) as Partial<MockDatabase>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const database = seedDatabase();
    await persist(database);
    return database;
  }
}

async function persist(database: MockDatabase) {
  if (!usesFileStore) {
    memoryDatabase = database;
    return;
  }
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(databasePath, JSON.stringify(database, null, 2), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Any read-only host, not just Vercel, degrades to the in-memory store.
    if (code !== "EROFS" && code !== "EACCES" && code !== "EPERM") throw error;
    usesFileStore = false;
    memoryDatabase = database;
  }
}

async function mutate<T>(change: (database: MockDatabase) => T | Promise<T>): Promise<T> {
  let value!: T;
  writeQueue = writeQueue.then(async () => {
    const database = await readDatabase();
    value = await change(database);
    await persist(database);
  });
  await writeQueue;
  return value;
}

function appendSyncRun(database: MockDatabase, run: Omit<SyncRun, "id" | "completedAt">) {
  const completedAt = new Date().toISOString();
  database.lastSyncedAt = completedAt;
  database.syncRuns = [{ id: randomUUID(), ...run, completedAt }, ...database.syncRuns].slice(0, 12);
}

function makeOverview(database: MockDatabase): DataOverview {
  const tables: { name: ReportingTableName; label: string; count: number; description: string }[] = [
    { name: "events", label: "events", count: database.events.length, description: "CampusGroups Event rows normalized for reporting." },
    { name: "rsvps", label: "rsvps", count: database.rsvps.length, description: "RSVP rows joined to each reporting touchpoint." },
    { name: "checkins", label: "check-ins", count: database.checkins.length, description: "Attendance evidence joined by event ID." },
    { name: "members", label: "members", count: database.members.length, description: "Cohort membership and approved officer signals." },
    { name: "badgeCompletions", label: "badge completions", count: database.badgeCompletions.length, description: "Learning-validation completions." },
    { name: "surveys", label: "survey responses", count: database.surveys.length, description: "De-identified feedback used for themes." },
    { name: "goals", label: "program goals", count: database.goals.length, description: "Program-owned targets and improvement actions." },
    { name: "individualReports", label: "committee check-ins", count: database.individualReports.length, description: "Individual weekly reports, stored verbatim and retrievable by ID." },
  ];
  const production = process.env.NODE_ENV === "production";
  return {
    storage: storageKind(),
    demoActions: {
      // The public sync route fails closed in production and a browser cannot send the service
      // token, so scheduled and admin-authenticated runs are the only production sync paths.
      sync: !production,
      reset: !production || Boolean(process.env.LEAD_ALLOW_DEMO_RESET),
      write: !production || Boolean(process.env.LEAD_ALLOW_DEMO_WRITES),
    },
    tables,
    lastSyncedAt: database.lastSyncedAt,
    syncRuns: database.syncRuns.slice(0, 5),
  };
}

export async function getCurrentReport(): Promise<ProgramReport> {
  return buildProgramReport(toProgramData(await readDatabase()));
}

export async function getDataOverview(): Promise<DataOverview> {
  return makeOverview(await readDatabase());
}

export async function getAdminSyncSettings(): Promise<AdminSyncSettings> {
  return (await readDatabase()).adminSyncSettings;
}

export async function updateAdminSyncSettings(settings: AdminSyncSettings): Promise<AdminSyncSettings> {
  return mutate((database) => {
    database.adminSyncSettings = settings;
    return database.adminSyncSettings;
  });
}

export async function createTouchpoint(input: TouchpointInput) {
  return mutate((database) => {
    const id = `manual-${randomUUID()}`;
    database.events.push({ id, title: input.title, date: input.date, type: input.type, campusArea: input.campusArea, expected: input.expected, feedbackScore: undefined, owner: input.owner, hasAgenda: input.hasAgenda, hasOutcome: input.hasOutcome });
    database.rsvps.push(...Array.from({ length: input.rsvps }, (_, index) => ({ id: `${id}-rsvp-${index + 1}`, eventId: id, status: "attending" })));
    database.checkins.push(...Array.from({ length: input.checkins }, (_, index) => ({ id: `${id}-checkin-${index + 1}`, eventId: id, active: true })));
    appendSyncRun(database, { source: "manual", resource: "touchpoint", received: 1 });
    return { report: buildProgramReport(toProgramData(database)), overview: makeOverview(database) };
  });
}

export async function resetDemoDatabase() {
  return mutate((database) => {
    Object.assign(database, seedDatabase());
    database.lastSyncedAt = new Date().toISOString();
    database.syncRuns = [{ id: randomUUID(), source: "campusgroups-demo", resource: "seed reset", received: database.events.length, completedAt: database.lastSyncedAt }];
    return { report: buildProgramReport(toProgramData(database)), overview: makeOverview(database) };
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function dateOnly(value: unknown) {
  const date = stringValue(value);
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function eventType(value: unknown): EventRecord["type"] {
  const name = stringValue(value)?.toLowerCase() ?? "";
  if (name.includes("community") || name.includes("meeting")) return "Community meeting";
  if (name.includes("partner") || name.includes("career")) return "Campus partnership";
  if (name.includes("service") || name.includes("off-campus")) return "Off-campus engagement";
  return "Leadership lab";
}

function campusArea(row: CampusGroupsRow): EventRecord["campusArea"] {
  const context = [row.locationType, row.locationName, row.cohostingGroupNames, row.shortDescription, row.description].map(stringValue).filter(Boolean).join(" ").toLowerCase();
  if (context.includes("off-campus") || context.includes("community") || context.includes("service")) return "Community";
  if (context.includes("career") || context.includes("work")) return "Career";
  if (context.includes("student") || context.includes("life")) return "Student life";
  return "Academic";
}

function upsert<T extends { externalId?: string }>(rows: T[], row: T) {
  const index = row.externalId ? rows.findIndex((entry) => entry.externalId === row.externalId) : -1;
  if (index >= 0) rows[index] = { ...rows[index], ...row };
  else rows.push(row);
}

/** Maps the documented export rows into only the reporting fields this app is allowed to use. */
export async function ingestCampusGroupsRows(resource: CampusGroupsResource, rows: CampusGroupsRow[]) {
  return mutate((database) => {
    if (resource === "events") {
      rows.forEach((row) => {
        const externalId = stringValue(row.id);
        if (!externalId || row.deleted === true) return;
        const id = `cg-event-${externalId}`;
        const existing = database.events.find((event) => event.externalId === externalId);
        upsert(database.events, {
          id: existing?.id ?? id,
          externalId,
          title: stringValue(row.name) ?? "Untitled CampusGroups event",
          date: dateOnly(row.startDate),
          type: eventType(typeof row.type === "object" && row.type ? (row.type as CampusGroupsRow).name : row.type),
          campusArea: campusArea(row),
          expected: numberValue(row.capacity) ?? existing?.expected ?? 0,
          feedbackScore: existing?.feedbackScore,
          owner: stringValue(row.cohostingGroupNames) ?? "CampusGroups import",
          hasAgenda: Boolean(row.description || row.shortDescription),
          hasOutcome: existing?.hasOutcome ?? false,
        });
      });
    }
    if (resource === "rsvp") {
      rows.forEach((row) => {
        const externalId = stringValue(row.id);
        const eventId = stringValue(row.eventId);
        if (!externalId || !eventId) return;
        upsert(database.rsvps, { id: `cg-rsvp-${externalId}`, externalId, eventId: `cg-event-${eventId}`, status: row.deleted === true ? "declined" : stringValue(row.rsvp) ?? "attending" });
      });
    }
    if (resource === "checkins") {
      rows.forEach((row) => {
        const externalId = stringValue(row.id);
        const eventId = stringValue(row.eventId);
        if (!externalId || !eventId) return;
        upsert(database.checkins, { id: `cg-checkin-${externalId}`, externalId, eventId: `cg-event-${eventId}`, active: row.deleted !== true });
      });
    }
    if (resource === "members") {
      rows.forEach((row) => {
        const externalId = stringValue(row.id);
        if (!externalId) return;
        const id = `cg-member-${externalId}`;
        const index = database.members.findIndex((member) => member.id === id);
        const member = { id, cohort: database.reportingPeriod.split(" · ")[0], isActive: row.deleted !== true && row.member !== 0, officerRoles: stringValue(row.officerStatus) === "current_officer" ? 1 : 0, initiativeCount: index >= 0 ? database.members[index].initiativeCount : 0, hasImpactReflection: index >= 0 ? database.members[index].hasImpactReflection : false };
        if (index >= 0) database.members[index] = member;
        else database.members.push(member);
      });
      database.cohortSize = database.members.filter((member) => member.isActive).length;
    }
    if (resource === "badge_completions") {
      rows.forEach((row) => {
        const userId = stringValue(row.userId);
        const externalId = stringValue(row.id);
        if (!userId || !externalId || row.deleted === true) return;
        const index = database.badgeCompletions.findIndex((completion) => completion.userId === `cg-user-${userId}` && completion.badge === "CampusGroups badge");
        const completion = { userId: `cg-user-${userId}`, badge: "CampusGroups badge", completedAt: dateOnly(row.createdOn) };
        if (index >= 0) database.badgeCompletions[index] = completion;
        else database.badgeCompletions.push(completion);
      });
    }
    appendSyncRun(database, { source: "campusgroups", resource, received: rows.length });
    return { report: buildProgramReport(toProgramData(database)), overview: makeOverview(database) };
  });
}

/** A deterministic local batch that follows the same event -> RSVP -> check-in import order as the live API. */
export async function runDemoCampusGroupsSync() {
  const eventId = 9801;
  const now = new Date().toISOString();
  await ingestCampusGroupsRows("events", [{ id: eventId, name: "Leadership Lab: Collaboration", startDate: "2026-09-10T17:00:00Z", type: { name: "Leadership lab" }, capacity: 36, cohostingGroupNames: "Leadership Academy, Career Services", shortDescription: "Applied collaboration practice", updatedOn: now }]);
  await ingestCampusGroupsRows("rsvp", Array.from({ length: 32 }, (_, index) => ({ id: 70000 + index, eventId, rsvp: "attending", updatedOn: now })));
  return ingestCampusGroupsRows("checkins", Array.from({ length: 29 }, (_, index) => ({ id: 80000 + index, eventId, userId: 50000 + index, action: "checkin", updatedOn: now })));
}

/* ==========================================================================
   Committee check-ins: write, retrieve, roll up.

   Individual reports are stored verbatim. The weekly roll-up is always derived
   on read from the stored submissions, never cached as a separate record, so a
   report and its evidence can never drift apart.
   ========================================================================== */

function nextReportId(database: MockDatabase, submission: IndividualReportSubmission) {
  const prefix = `IR-${submission.weekOf.slice(2).replace(/-/g, "")}-${committeeCode[submission.reportingFor]}`;
  let sequence = database.individualReports.filter((report) => report.id.startsWith(`${prefix}-`)).length + 1;
  while (database.individualReports.some((report) => report.id === `${prefix}-${sequence}`)) sequence += 1;
  return `${prefix}-${sequence}`;
}

/**
 * A scholar re-filing for the same week and committee is correcting the record,
 * not adding a second report, so the submission replaces the earlier one and
 * keeps its ID. Anything already citing that ID still resolves.
 */
export async function createIndividualReport(submission: IndividualReportSubmission) {
  return mutate((database) => {
    const key = scholarKey(submission.scholarName);
    const index = database.individualReports.findIndex((entry) => entry.scholarKey === key && entry.weekOf === submission.weekOf && entry.reportingFor === submission.reportingFor);
    const record: IndividualReport = { ...submission, scholarKey: key, id: index >= 0 ? database.individualReports[index].id : nextReportId(database, submission), receivedAt: new Date().toISOString() };
    if (index >= 0) database.individualReports[index] = record;
    else database.individualReports.push(record);
    appendSyncRun(database, { source: "manual", resource: "committee check-in", received: 1 });
    return {
      report: buildProgramReport(toProgramData(database)),
      overview: makeOverview(database),
      individual: viewOf(record),
      weekly: buildWeeklyReport(record.weekOf, database.individualReports),
      replaced: index >= 0,
    };
  });
}

export type IndividualReportFilter = { week?: string; committee?: Committee; scholar?: string; query?: string };

export async function listIndividualReports(filter: IndividualReportFilter = {}): Promise<IndividualReportSummary[]> {
  const database = await readDatabase();
  const query = filter.query?.trim().toLowerCase();
  const scholar = filter.scholar ? scholarKey(filter.scholar) : undefined;
  return database.individualReports
    .filter((report) => (!filter.week || report.weekOf === filter.week)
      && (!filter.committee || report.reportingFor === filter.committee)
      && (!scholar || report.scholarKey.includes(scholar))
      && (!query || [report.scholarName, report.project, report.updates, report.nextSteps, report.issues, report.id].join(" ").toLowerCase().includes(query)))
    .sort((a, b) => b.weekOf.localeCompare(a.weekOf) || a.reportingFor.localeCompare(b.reportingFor) || a.scholarName.localeCompare(b.scholarName))
    .map(summarize);
}

export async function getIndividualReport(id: string): Promise<IndividualReportView | undefined> {
  const database = await readDatabase();
  const report = database.individualReports.find((entry) => entry.id === id);
  return report ? viewOf(report) : undefined;
}

export async function getWeekIndex(): Promise<WeekIndexEntry[]> {
  return listWeeks((await readDatabase()).individualReports);
}

/** Omit `weekOf` for the most recent week that has submissions. */
export async function getWeeklyReport(weekOf?: string): Promise<WeeklyReport | null> {
  const { individualReports } = await readDatabase();
  const week = weekOf ?? latestWeekOf(individualReports);
  return week ? buildWeeklyReport(week, individualReports) : null;
}
