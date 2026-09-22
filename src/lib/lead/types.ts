export type EvidenceSource =
  | "Event"
  | "RSVP"
  | "Check-in"
  | "Survey"
  | "Badge"
  | "Announcement"
  | "Budget"
  | "Academic experience"
  | "Work experience";

export type EventRecord = {
  id: string;
  title: string;
  date: string;
  type: "Leadership lab" | "Community meeting" | "Campus partnership" | "Off-campus engagement";
  campusArea: "Academic" | "Student life" | "Community" | "Career";
  expected: number;
  rsvps: number;
  checkins: number;
  feedbackScore?: number;
  owner: string;
  hasAgenda: boolean;
  hasOutcome: boolean;
};

export type SurveyResponse = {
  id: string;
  eventId: string;
  rating: number;
  comment: string;
  completedAt: string;
};

export type BadgeCompletion = { userId: string; badge: string; completedAt: string };

export type MemberProfile = {
  id: string;
  cohort: string;
  isActive: boolean;
  officerRoles: number;
  initiativeCount: number;
  hasImpactReflection: boolean;
};

export type ProgramGoal = {
  id: string;
  statement: string;
  measure: string;
  target: number;
  actual: number;
  unit: "%" | "events" | "areas";
  evidence: string;
  action: string;
};

export type ProgramData = {
  reportingPeriod: string;
  cohortSize: number;
  events: EventRecord[];
  surveys: SurveyResponse[];
  surveyInvitations: number;
  badgeCompletions: BadgeCompletion[];
  members: MemberProfile[];
  goals: ProgramGoal[];
  individualReports: IndividualReport[];
  lastSyncedAt: string;
};

export type ProgramReport = {
  period: string;
  generatedAt: string;
  sourceStatus: { source: EvidenceSource; state: "connected" | "pilot" | "pending" }[];
  headline: {
    attendanceRate: number;
    surveyCompletion: number;
    badgeCompletion: number;
    crossCampusOfficers: number;
  };
  ordinance: { complete: number; total: number; missing: string[] };
  leadership: {
    engagement: number;
    application: number;
    reflection: number;
    note: string;
  };
  footprint: { internal: number; external: number; campusAreas: number; partnerships: number };
  themes: { label: string; mentions: number; tone: "positive" | "watch" }[];
  /** Latest committee check-in week, so the program view carries the qualitative read too. */
  weeklyPulse: WeeklyPulse;
  goals: ProgramGoal[];
  events: EventRecord[];
  lastSyncedAt: string;
};

export type ReportingTableName = "events" | "rsvps" | "checkins" | "members" | "badgeCompletions" | "surveys" | "goals" | "individualReports";

export type DataOverview = {
  storage: "local-demo" | "ephemeral-demo";
  /** Which demo actions the server will actually accept, so the UI never offers a call that fails closed. */
  demoActions: { sync: boolean; reset: boolean; write: boolean };
  tables: { name: ReportingTableName; label: string; count: number; description: string }[];
  lastSyncedAt: string;
  syncRuns: { id: string; source: "manual" | "campusgroups-demo" | "campusgroups"; resource: string; received: number; completedAt: string }[];
};

export type TouchpointInput = {
  title: string;
  date: string;
  type: EventRecord["type"];
  campusArea: EventRecord["campusArea"];
  expected: number;
  rsvps: number;
  checkins: number;
  owner: string;
  hasAgenda: boolean;
  hasOutcome: boolean;
};

export const syncResources = ["events", "rsvp", "checkins", "members", "badge_completions"] as const;
export type SyncResource = (typeof syncResources)[number];
export type SyncCadence = "hourly" | "every_6_hours" | "daily" | "weekdays";

export type AdminSyncSettings = {
  enabled: boolean;
  mode: "live" | "demo";
  cadence: SyncCadence;
  startHourUtc: number;
  resources: SyncResource[];
  lookbackDays: number;
};

/* ==========================================================================
   Committee check-ins: individual weekly reports and their weekly roll-up.

   An individual report is a scholar's own account of committee work. It is a
   work product submitted for reporting, not a student record, so it is stored
   verbatim and retrievable by ID — the weekly roll-up never replaces it, and
   every aggregate claim can be traced back to the submissions behind it.
   ========================================================================== */

export const committees = ["Co-chairs", "Scholar News", "Community", "Events", "Web and Social Media", "Free Agents"] as const;
export type Committee = (typeof committees)[number];

/** The intake form's raw answers, kept in submission order and wording. */
export type IndividualReportSubmission = {
  scholarName: string;
  /** Every committee the scholar belongs to; the form allows up to six. */
  committees: Committee[];
  /** The committee this check-in reports on. Free Agents pick the committee they helped. */
  reportingFor: Committee;
  /** Monday of the reporting week, YYYY-MM-DD. */
  weekOf: string;
  /** "What date is it today?" */
  submittedOn: string;
  /** "When was your last committee meeting?" */
  lastMeetingOn?: string;
  project: string;
  updates: string;
  nextSteps: string;
  issues: string;
  /** Documents shared for editing access. */
  documentLinks: string[];
  /** Files and meeting reports uploaded with the submission. */
  attachments: { name: string; kind: "meeting report" | "deliverable" | "file" }[];
};

export type IndividualReport = IndividualReportSubmission & {
  id: string;
  /** Case- and spacing-insensitive name key, so a scholar's weeks link up. */
  scholarKey: string;
  receivedAt: string;
};

export type Momentum = "shipped" | "advancing" | "planning" | "stalled" | "blocked";

export type BlockerKind =
  | "waiting-on-others"
  | "editing-access"
  | "capacity"
  | "attendance"
  | "direction"
  | "timeline"
  | "funding"
  | "tooling"
  | "coordination";

export type Blocker = {
  kind: BlockerKind;
  label: string;
  severity: "high" | "medium" | "low";
  /** The scholar's own sentence, so a reader can check the interpretation. */
  quote: string;
  recommendedAction: string;
};

export type Commitment = {
  /** The next step, trimmed to its action. */
  text: string;
  /** A due phrase found in the sentence, e.g. "by Friday" or "before Oct 3". */
  due?: string;
  /** Someone named as responsible alongside the writer. */
  owner?: string;
};

/**
 * Everything derived from the free-text answers. Derived on read rather than
 * stored, so improving the extraction improves past weeks too; `method`
 * records how a reading was reached so a reviewer can audit or override it.
 */
export type ReportSignals = {
  words: number;
  momentum: Momentum;
  momentumReason: string;
  /** 0-100: how concrete the submission is (named artifacts, counts, dates, links). */
  specificity: number;
  evidence: { numbers: string[]; dates: string[]; artifacts: string[]; collaborators: string[]; links: number; attachments: number; meetingHeld: boolean; score: number };
  blockers: Blocker[];
  commitments: Commitment[];
  delivered: string[];
  themes: { label: string; mentions: number; tone: "positive" | "watch" }[];
  /** The most report-worthy sentences, chosen extractively and quoted verbatim. */
  quotes: string[];
  /** Vague or thin answers worth a follow-up rather than a metric. */
  followUps: string[];
};

export type IndividualReportView = IndividualReport & { signals: ReportSignals };

/** Index row for the retrieval list: enough to choose a report without loading every narrative. */
export type IndividualReportSummary = {
  id: string;
  scholarName: string;
  reportingFor: Committee;
  weekOf: string;
  submittedOn: string;
  project: string;
  headline: string;
  momentum: Momentum;
  specificity: number;
  blockerCount: number;
  commitmentCount: number;
  themes: string[];
  attachments: number;
  documentLinks: number;
};

/** One project followed across weeks, assembled from the reports that mention it. */
export type ProjectThread = {
  key: string;
  title: string;
  committees: Committee[];
  contributors: string[];
  weeks: string[];
  momentum: Momentum;
  latestUpdate: string;
  latestWeek: string;
  reportIds: string[];
  /** Weeks since the thread last showed delivered work. */
  weeksSinceDelivery: number;
};

/** Did last week's stated next step actually happen? */
export type CarryOver = {
  commitment: string;
  committee: Committee;
  scholarName: string;
  fromWeek: string;
  status: "kept" | "restated" | "dropped";
  evidence?: string;
  reportId: string;
};

export type WeeklyReport = {
  weekOf: string;
  label: string;
  generatedAt: string;
  participation: {
    reports: number;
    scholars: number;
    committeesReporting: Committee[];
    committeesSilent: { committee: Committee; lastReportedWeek?: string }[];
    meetingsHeld: number;
  };
  momentum: Record<Momentum, number>;
  delivered: { committee: Committee; scholarName: string; text: string; reportId: string }[];
  risks: {
    kind: BlockerKind;
    label: string;
    severity: Blocker["severity"];
    committees: Committee[];
    quotes: { scholarName: string; committee: Committee; quote: string; reportId: string }[];
    recommendedAction: string;
  }[];
  themes: { label: string; mentions: number; committees: Committee[]; tone: "positive" | "watch" }[];
  highlights: { scholarName: string; committee: Committee; quote: string; reportId: string; reason: string }[];
  projects: ProjectThread[];
  collaboration: { committees: Committee[]; basis: string }[];
  carryOver: CarryOver[];
  followThrough: { kept: number; restated: number; dropped: number; rate: number };
  evidence: { reportIds: string[]; documentLinks: number; attachments: number; averageSpecificity: number };
  /** Assembled prose. Internal is candid; showcase omits blockers and names no one critically. */
  narrative: { internal: string[]; showcase: string[] };
  followUps: { scholarName: string; committee: Committee; note: string; reportId: string }[];
};

export type WeekIndexEntry = {
  weekOf: string;
  label: string;
  reports: number;
  committeesReporting: number;
  blockers: number;
  delivered: number;
  followThroughRate: number;
};

/** A compact check-in read for the main program dashboard. */
export type WeeklyPulse = {
  weekOf: string;
  label: string;
  reports: number;
  committeesReporting: number;
  committeesTotal: number;
  shipped: number;
  atRisk: number;
  followThroughRate: number;
  topRisk?: { label: string; recommendedAction: string };
  topTheme?: { label: string; mentions: number };
} | null;
