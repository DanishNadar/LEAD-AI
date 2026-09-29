import { demoIndividualReports } from "./committee-reports-demo";
import type { ProgramData } from "./types";

export const demoProgramData: ProgramData = {
  reportingPeriod: "Fall 2026 · Weeks 1–6",
  cohortSize: 38,
  individualReports: demoIndividualReports,
  lastSyncedAt: "2026-09-29T09:15:00.000Z",
  events: [
    { id: "e-107", title: "Mid-Cycle Initiative Review", date: "2026-09-28", type: "Leadership lab", campusArea: "Academic", expected: 38, rsvps: 34, checkins: 31, feedbackScore: 4.6, owner: "Officer Mentors", hasAgenda: true, hasOutcome: true },
    { id: "e-101", title: "Leadership Lab: Influence", date: "2026-09-03", type: "Leadership lab", campusArea: "Academic", expected: 38, rsvps: 36, checkins: 33, feedbackScore: 4.7, owner: "Programs", hasAgenda: true, hasOutcome: true },
    { id: "e-102", title: "Cohort Council Meeting", date: "2026-09-02", type: "Community meeting", campusArea: "Student life", expected: 38, rsvps: 31, checkins: 29, feedbackScore: 4.4, owner: "Cohort Council", hasAgenda: true, hasOutcome: true },
    { id: "e-103", title: "Career Services Partner Sprint", date: "2026-08-28", type: "Campus partnership", campusArea: "Career", expected: 24, rsvps: 25, checkins: 21, feedbackScore: 4.5, owner: "Career Team", hasAgenda: true, hasOutcome: true },
    { id: "e-104", title: "Neighborhood Service Initiative", date: "2026-08-25", type: "Off-campus engagement", campusArea: "Community", expected: 30, rsvps: 28, checkins: 25, feedbackScore: 4.8, owner: "Service Team", hasAgenda: true, hasOutcome: true },
    { id: "e-105", title: "Leadership Lab: Decision-Making", date: "2026-08-20", type: "Leadership lab", campusArea: "Academic", expected: 38, rsvps: 35, checkins: 30, feedbackScore: 4.6, owner: "Programs", hasAgenda: true, hasOutcome: false },
    { id: "e-106", title: "Student Organization Exchange", date: "2026-08-14", type: "Campus partnership", campusArea: "Student life", expected: 32, rsvps: 30, checkins: 27, feedbackScore: 4.3, owner: "Engagement", hasAgenda: false, hasOutcome: true },
  ],
  surveys: [
    { id: "s-1", eventId: "e-101", rating: 5, comment: "I used the stakeholder map in my officer team the next day.", completedAt: "2026-09-03" },
    { id: "s-2", eventId: "e-101", rating: 4, comment: "Practical examples made conflict navigation feel more manageable.", completedAt: "2026-09-03" },
    { id: "s-3", eventId: "e-102", rating: 4, comment: "The meeting gave us a clear way to turn ideas into initiatives.", completedAt: "2026-09-02" },
    { id: "s-4", eventId: "e-103", rating: 5, comment: "Helpful connection between leadership practice and career readiness.", completedAt: "2026-08-28" },
    { id: "s-5", eventId: "e-104", rating: 5, comment: "The community partner feedback was meaningful and direct.", completedAt: "2026-08-25" },
    { id: "s-6", eventId: "e-105", rating: 4, comment: "I would like more time to apply the decision framework in groups.", completedAt: "2026-08-20" },
  ],
  surveyInvitations: 7,
  badgeCompletions: Array.from({ length: 27 }, (_, index) => ({ userId: `m-${index + 1}`, badge: "Leadership Foundations", completedAt: "2026-09-01" })),
  members: Array.from({ length: 38 }, (_, index) => ({
    id: `m-${index + 1}`,
    cohort: "Fall 2026",
    isActive: index < 36,
    officerRoles: index < 15 ? 1 : 0,
    initiativeCount: index < 26 ? (index % 3) + 1 : 0,
    hasImpactReflection: index < 29,
  })),
  goals: [
    { id: "g-1", statement: "Deliver a consistent, high-quality leadership learning experience.", measure: "Average check-in rate", target: 80, actual: 89, unit: "%", evidence: "196 check-ins across 7 tracked touchpoints", action: "Keep RSVP reminders and add a recovery plan for absences." },
    { id: "g-2", statement: "Help fellows translate learning into visible leadership practice.", measure: "Members advancing an initiative", target: 55, actual: 68, unit: "%", evidence: "26 members documented an initiative; 31 reviewed one with an officer mentor at the mid-cycle review", action: "Pair every unassigned initiative with a named officer mentor, before the second half of the cycle." },
    { id: "g-3", statement: "Extend the Academy’s campus and community reach.", measure: "Campus areas activated", target: 4, actual: 4, unit: "areas", evidence: "Academic, student life, career, and community represented", action: "Name one outcome owner for every partnership." },
    { id: "g-4", statement: "Validate core leadership learning.", measure: "Foundations badge completion", target: 70, actual: 71, unit: "%", evidence: "27 of 38 fellows completed the badge", action: "Use a two-week completion nudge for the remaining cohort." },
  ],
};
