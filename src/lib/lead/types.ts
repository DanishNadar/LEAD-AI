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
  goals: ProgramGoal[];
  events: EventRecord[];
  lastSyncedAt: string;
};

export type ReportingTableName = "events" | "rsvps" | "checkins" | "members" | "badgeCompletions" | "surveys" | "goals";

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
