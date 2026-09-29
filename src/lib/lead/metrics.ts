import { buildWeeklyPulse } from "./weekly-report";
import { exportResourceLabels, exportResources } from "./export-resources";
import type { ProgramData, ProgramReport } from "./types";

const percentage = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);

const wordMatches = (value: string, terms: string[]) =>
  terms.some((term) => value.toLowerCase().includes(term));

export function buildProgramReport(data: ProgramData): ProgramReport {
  const rsvps = data.events.reduce((total, event) => total + event.rsvps, 0);
  const checkins = data.events.reduce((total, event) => total + event.checkins, 0);
  const eventCapacity = data.events.reduce((total, event) => total + event.expected, 0);
  const eventsWithFeedback = data.events.filter((event) => event.feedbackScore !== undefined).length;
  const officers = data.members.filter((member) => member.officerRoles > 0).length;
  const membersWithInitiatives = data.members.filter((member) => member.initiativeCount > 0).length;
  const reflections = data.members.filter((member) => member.hasImpactReflection).length;
  const academic = data.events.filter((event) => event.campusArea === "Academic").length;
  const studentLife = data.events.filter((event) => event.campusArea === "Student life").length;
  const career = data.events.filter((event) => event.campusArea === "Career").length;
  const community = data.events.filter((event) => event.campusArea === "Community").length;
  const ordinanceMissing = [
    ...data.events.filter((event) => !event.hasAgenda).map((event) => `${event.title}: agenda`),
    ...data.events.filter((event) => !event.hasOutcome).map((event) => `${event.title}: outcome reflection`),
    ...(eventsWithFeedback < data.events.length ? ["feedback collection"] : []),
  ];
  const completeTouchpoints = data.events.filter((event) => event.hasAgenda && event.hasOutcome && event.feedbackScore !== undefined).length;
  const evidenceHygiene = percentage(completeTouchpoints, data.events.length);
  const sourceStatus = data.sourcePulls.length > 0
    ? exportResources.map((resource) => ({
      source: exportResourceLabels[resource],
      state: data.sourcePulls.some((pull) => pull.resource === resource) ? "connected" as const : "pending" as const,
    }))
    : [
      { source: "Event", state: "connected" as const }, { source: "RSVP", state: "connected" as const }, { source: "Check-in", state: "connected" as const },
      { source: "Survey", state: "pilot" as const }, { source: "Badge", state: "pilot" as const }, { source: "Announcement", state: "pending" as const },
      { source: "Budget", state: "pending" as const }, { source: "Academic experience", state: "pending" as const }, { source: "Work experience", state: "pending" as const },
    ];

  const themes = [
    { label: "Application", terms: ["used", "apply", "initiative", "practice"], tone: "positive" as const },
    { label: "Belonging", terms: ["team", "group", "community", "partner"], tone: "positive" as const },
    { label: "Career connection", terms: ["career", "readiness"], tone: "positive" as const },
    { label: "More practice time", terms: ["more time", "time to"], tone: "watch" as const },
  ].map((theme) => ({
    label: theme.label,
    mentions: data.surveys.filter((response) => wordMatches(response.comment, theme.terms)).length,
    tone: theme.tone,
  }));

  return {
    period: data.reportingPeriod,
    generatedAt: new Date().toISOString(),
    sourceStatus,
    headline: {
      attendanceRate: percentage(checkins, rsvps),
      surveyCompletion: percentage(data.surveys.length, data.surveyInvitations),
      badgeCompletion: percentage(new Set(data.badgeCompletions.map((badge) => badge.userId)).size, data.cohortSize),
      crossCampusOfficers: officers,
    },
    ordinance: { complete: completeTouchpoints, total: data.events.length, missing: ordinanceMissing },
    leadership: {
      engagement: percentage(checkins, eventCapacity), application: percentage(membersWithInitiatives, data.cohortSize), reflection: percentage(reflections, data.cohortSize),
      indicators: [
        { id: "engagement", label: "Engagement", detail: "Check-ins against scheduled capacity", value: percentage(checkins, eventCapacity), unit: "%" },
        { id: "attendance", label: "Attendance", detail: "Check-ins against RSVPs", value: percentage(checkins, rsvps), unit: "%" },
        { id: "learning-validation", label: "Learning validation", detail: "Cohort members with a completed badge", value: percentage(new Set(data.badgeCompletions.map((badge) => badge.userId)).size, data.cohortSize), unit: "%" },
        { id: "officer-involvement", label: "Officer involvement", detail: "Verified current officer roles", value: officers, unit: "count" },
        { id: "application", label: "Application", detail: "Members advancing an initiative", value: percentage(membersWithInitiatives, data.cohortSize), unit: "%" },
        { id: "reflection", label: "Reflection", detail: "Impact reflections filed", value: percentage(reflections, data.cohortSize), unit: "%" },
        { id: "evidence-hygiene", label: "Evidence hygiene", detail: "Touchpoints with required evidence", value: evidenceHygiene, unit: "%" },
        { id: "source-coverage", label: "Source coverage", detail: "CampusGroups resources retrieved", value: data.sourcePulls.length, unit: "sources" },
      ],
      note: "Cohort-level signals only. Individual interpretation needs consent, context, human review.",
    },
    footprint: { internal: academic + studentLife + career, external: community, campusAreas: new Set(data.events.map((event) => event.campusArea)).size, partnerships: 4 },
    themes,
    // The qualitative read from committee check-ins travels with the quantitative report.
    weeklyPulse: buildWeeklyPulse(data.individualReports),
    goals: data.goals, events: data.events, lastSyncedAt: data.lastSyncedAt,
  };
}
