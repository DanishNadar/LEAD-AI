import { buildWeeklyPulse } from "./weekly-report";
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
    sourceStatus: [
      { source: "Event", state: "connected" }, { source: "RSVP", state: "connected" }, { source: "Check-in", state: "connected" },
      { source: "Survey", state: "pilot" }, { source: "Badge", state: "pilot" }, { source: "Announcement", state: "pending" },
      { source: "Budget", state: "pending" }, { source: "Academic experience", state: "pending" }, { source: "Work experience", state: "pending" },
    ],
    headline: {
      attendanceRate: percentage(checkins, rsvps),
      surveyCompletion: percentage(data.surveys.length, data.surveyInvitations),
      badgeCompletion: percentage(new Set(data.badgeCompletions.map((badge) => badge.userId)).size, data.cohortSize),
      crossCampusOfficers: officers,
    },
    ordinance: { complete: data.events.length - ordinanceMissing.length, total: data.events.length, missing: ordinanceMissing },
    leadership: {
      engagement: percentage(checkins, eventCapacity), application: percentage(membersWithInitiatives, data.cohortSize), reflection: percentage(reflections, data.cohortSize),
      note: "Cohort-level signals only. Individual interpretation requires consent, context, and human review.",
    },
    footprint: { internal: academic + studentLife + career, external: community, campusAreas: new Set(data.events.map((event) => event.campusArea)).size, partnerships: 4 },
    themes,
    // The qualitative read from committee check-ins travels with the quantitative report.
    weeklyPulse: buildWeeklyPulse(data.individualReports),
    goals: data.goals, events: data.events, lastSyncedAt: data.lastSyncedAt,
  };
}
