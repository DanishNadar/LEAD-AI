import { committees, type Committee, type IndividualReportSubmission } from "@/lib/lead/types";

/* ==========================================================================
   Intake for the weekly individual report and the committee check-in form.

   The two forms ask the same questions with slightly different labels, so both
   normalize into one submission shape here. Word limits mirror the published
   form exactly, and the reporting week is always snapped to its Monday so that
   submissions from different days land in the same week.
   ========================================================================== */

export const wordLimits = { project: 500, updates: 500, nextSteps: 1000, issues: 1000 } as const;

/** The published forms spell some committees differently; map every spelling to one canonical value. */
const COMMITTEE_ALIASES: Record<string, Committee> = {
  "co-chairs": "Co-chairs",
  "cochairs": "Co-chairs",
  "co chairs": "Co-chairs",
  "chairs": "Co-chairs",
  "chair": "Co-chairs",
  "scholar news": "Scholar News",
  "news": "Scholar News",
  "community": "Community",
  "events": "Events",
  "web and social media": "Web and Social Media",
  "web & social media": "Web and Social Media",
  "web and social": "Web and Social Media",
  "social media": "Web and Social Media",
  "web": "Web and Social Media",
  "free agents": "Free Agents",
  "free agent": "Free Agents",
};

export function toCommittee(value: string): Committee | undefined {
  return COMMITTEE_ALIASES[value.trim().toLowerCase().replace(/\s+/g, " ")];
}

/** Short, stable committee code used inside report IDs such as IR-260921-SN-1. */
export const committeeCode: Record<Committee, string> = { "Co-chairs": "CC", "Scholar News": "SN", Community: "CM", Events: "EV", "Web and Social Media": "WS", "Free Agents": "FA" };

export function scholarKey(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ");
}

/** Monday of the week containing `value`, in YYYY-MM-DD. */
export function mondayOf(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

export function weekLabel(weekOf: string) {
  const date = new Date(`${weekOf}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return `Week of ${weekOf}`;
  return `Week of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)}`;
}

export function shiftWeek(weekOf: string, weeks: number) {
  const date = new Date(`${weekOf}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function words(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Accepts the raw form payload and returns either the normalized submission or the first problem with it. */
export function normalizeSubmission(body: Record<string, unknown>): { submission: IndividualReportSubmission } | { error: string } {
  const scholarName = typeof body.scholarName === "string" ? body.scholarName.trim() : "";
  if (scholarName.length < 2 || scholarName.length > 90) return { error: "Enter the scholar's name." };

  const rawCommittees = Array.isArray(body.committees) ? body.committees : [];
  const memberships = [...new Set(rawCommittees.filter((value): value is string => typeof value === "string").map(toCommittee).filter((value): value is Committee => Boolean(value)))];
  if (memberships.length === 0) return { error: "Select at least one committee." };
  if (memberships.length > 6) return { error: "Select up to six committees." };

  const reportingFor = typeof body.reportingFor === "string" ? toCommittee(body.reportingFor) : undefined;
  if (!reportingFor) return { error: "Choose the committee this check-in reports on." };
  // Free Agents report on the committee they helped, so the reporting committee need not be a membership.
  if (!memberships.includes(reportingFor) && !memberships.includes("Free Agents")) return { error: "The reporting committee must be one you are a member of, unless you are reporting as a Free Agent." };

  if (!isDate(body.weekOf)) return { error: "Enter the Monday of the reporting week." };
  if (!isDate(body.submittedOn)) return { error: "Enter today's date." };
  if (body.lastMeetingOn !== undefined && body.lastMeetingOn !== null && body.lastMeetingOn !== "" && !isDate(body.lastMeetingOn)) return { error: "Enter a valid date for the last committee meeting." };

  type TextResult = { value: string } | { error: string };
  const text = (key: keyof typeof wordLimits, label: string): TextResult => {
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (!value) return { error: `${label} is required.` };
    if (words(value) > wordLimits[key]) return { error: `${label} must be ${wordLimits[key]} words or fewer.` };
    return { value };
  };
  const project = text("project", "The project or task");
  if ("error" in project) return project;
  const updates = text("updates", "The new updates");
  if ("error" in updates) return updates;
  const nextSteps = text("nextSteps", "Next steps");
  if ("error" in nextSteps) return nextSteps;
  const issues = text("issues", "The issues answer");
  if ("error" in issues) return issues;

  const documentLinks = (Array.isArray(body.documentLinks) ? body.documentLinks : [])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\/\S+$/i.test(value) && value.length <= 500)
    .slice(0, 10);

  const kinds: IndividualReportSubmission["attachments"][number]["kind"][] = ["meeting report", "deliverable", "file"];
  const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
    .map((value) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {}))
    .map((value) => ({ name: typeof value.name === "string" ? value.name.trim().slice(0, 160) : "", kind: kinds.includes(value.kind as never) ? (value.kind as IndividualReportSubmission["attachments"][number]["kind"]) : ("file" as const) }))
    .filter((attachment) => attachment.name.length > 0)
    .slice(0, 10);

  const submission: IndividualReportSubmission = {
    scholarName,
    committees: memberships,
    reportingFor,
    weekOf: mondayOf(body.weekOf as string),
    submittedOn: body.submittedOn as string,
    project: project.value,
    updates: updates.value,
    nextSteps: nextSteps.value,
    issues: issues.value,
    documentLinks,
    attachments,
  };
  if (isDate(body.lastMeetingOn)) submission.lastMeetingOn = body.lastMeetingOn as string;
  return { submission };
}

export const committeeOptions = committees;
