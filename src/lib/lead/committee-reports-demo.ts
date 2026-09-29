import type { IndividualReport } from "@/lib/lead/types";

/* ==========================================================================
   Sample committee check-ins.

   Three consecutive weeks written the way scholars actually write them: some
   specific, some thin, one silent committee, and one commitment that quietly
   goes missing. The seed exists so the roll-up can be judged on real reading
   problems rather than on tidy input.
   ========================================================================== */

const report = (value: IndividualReport): IndividualReport => value;

export const demoIndividualReports: IndividualReport[] = [
  /* ---------- Week of 2026-09-07 ---------- */
  report({
    id: "IR-260907-SN-1", scholarKey: "ava whitfield", scholarName: "Ava Whitfield", committees: ["Scholar News"], reportingFor: "Scholar News",
    weekOf: "2026-09-07", submittedOn: "2026-09-11", lastMeetingOn: "2026-09-09", receivedAt: "2026-09-11T21:14:00.000Z",
    project: "Fall Scholar Spotlight newsletter — a six-profile issue introducing the new cohort to the wider Academy.",
    updates: "Drafted three of the six scholar profiles and interviewed Priya Raman and Marcus Lee for the feature section. Built the issue outline and set the section order with the rest of the committee at Wednesday's meeting.",
    nextSteps: "Finish the remaining three interviews by Friday and send the full draft to the co-chairs for approval.",
    issues: "None so far.",
    documentLinks: ["https://docs.example.edu/d/fall-spotlight-draft"], attachments: [{ name: "Scholar News meeting notes 09-09.pdf", kind: "meeting report" }],
  }),
  report({
    id: "IR-260907-WS-1", scholarKey: "marcus lee", scholarName: "Marcus Lee", committees: ["Web and Social Media"], reportingFor: "Web and Social Media",
    weekOf: "2026-09-07", submittedOn: "2026-09-12", lastMeetingOn: "2026-09-10", receivedAt: "2026-09-12T16:02:00.000Z",
    project: "Instagram relaunch and a six-week content calendar for the Academy account.",
    updates: "Built the six-week content calendar and designed four post templates in Canva so the committee can publish without waiting on a designer.",
    nextSteps: "Post the first three graphics next week and confirm editing access to the Academy website page.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/content-calendar"], attachments: [],
  }),
  report({
    id: "IR-260907-EV-1", scholarKey: "priya raman", scholarName: "Priya Raman", committees: ["Events"], reportingFor: "Events",
    weekOf: "2026-09-07", submittedOn: "2026-09-11", lastMeetingOn: "2026-09-08", receivedAt: "2026-09-11T19:41:00.000Z",
    project: "Leadership Lab: Collaboration — logistics, speaker, and run of show for the October session.",
    updates: "Booked the Hermann Hall room for October 8 and confirmed the speaker. Drafted the run of show with the committee.",
    nextSteps: "Send the invitation to the cohort by Friday and finalize the catering order.",
    issues: "None at this time.",
    documentLinks: [], attachments: [{ name: "Events run of show v1.docx", kind: "deliverable" }],
  }),
  report({
    id: "IR-260907-CM-1", scholarKey: "jordan ellis", scholarName: "Jordan Ellis", committees: ["Community"], reportingFor: "Community",
    weekOf: "2026-09-07", submittedOn: "2026-09-11", lastMeetingOn: "2026-09-09", receivedAt: "2026-09-11T22:30:00.000Z",
    project: "Peer check-in buddy system pairing every first-year scholar with a returning scholar.",
    updates: "Drafted the buddy pairing list for 36 scholars and discussed the matching rules at our meeting.",
    nextSteps: "Launch the pairings the week of September 14 and send each pair a welcome message.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/buddy-pairings"], attachments: [],
  }),
  report({
    id: "IR-260907-CC-1", scholarKey: "dana okafor", scholarName: "Dana Okafor", committees: ["Co-chairs"], reportingFor: "Co-chairs",
    weekOf: "2026-09-07", submittedOn: "2026-09-12", lastMeetingOn: "2026-09-07", receivedAt: "2026-09-12T14:08:00.000Z",
    project: "Committee charter and the weekly reporting standard for all five committees.",
    updates: "Wrote the first draft of the committee charter and circulated it to all five committees for comment.",
    nextSteps: "Collect charter comments by September 12 and approve the Scholar News newsletter draft.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/committee-charter"], attachments: [{ name: "Co-chairs meeting notes 09-07.pdf", kind: "meeting report" }],
  }),

  /* ---------- Week of 2026-09-14 ---------- */
  report({
    id: "IR-260914-SN-1", scholarKey: "ava whitfield", scholarName: "Ava Whitfield", committees: ["Scholar News"], reportingFor: "Scholar News",
    weekOf: "2026-09-14", submittedOn: "2026-09-18", lastMeetingOn: "2026-09-16", receivedAt: "2026-09-18T20:55:00.000Z",
    project: "Fall Scholar Spotlight newsletter — a six-profile issue introducing the new cohort.",
    updates: "Completed the last three interviews and sent the full six-profile draft to the co-chairs on Tuesday. Copy-edited all six profiles down to 180 words each.",
    nextSteps: "Publish the newsletter on September 22 and send the teaser copy to Web and Social Media for a matching graphic.",
    issues: "We are still waiting on the co-chairs to approve the draft and I have not heard back since Tuesday, so the publish date is at risk.",
    documentLinks: ["https://docs.example.edu/d/fall-spotlight-draft"], attachments: [{ name: "Scholar News meeting notes 09-16.pdf", kind: "meeting report" }],
  }),
  report({
    id: "IR-260914-WS-1", scholarKey: "marcus lee", scholarName: "Marcus Lee", committees: ["Web and Social Media"], reportingFor: "Web and Social Media",
    weekOf: "2026-09-14", submittedOn: "2026-09-19", lastMeetingOn: "2026-09-17", receivedAt: "2026-09-19T15:20:00.000Z",
    project: "Instagram relaunch and six-week content calendar for the Academy account.",
    updates: "Posted the first three graphics from the calendar and the follower count went from 412 to 447 over the week.",
    nextSteps: "Publish two reels next week and build the newsletter teaser graphic with Scholar News.",
    issues: "I still cannot edit the Academy website page. It is view only and I have been requesting access for two weeks.",
    documentLinks: [], attachments: [],
  }),
  report({
    id: "IR-260914-EV-1", scholarKey: "priya raman", scholarName: "Priya Raman", committees: ["Events"], reportingFor: "Events",
    weekOf: "2026-09-14", submittedOn: "2026-09-18", lastMeetingOn: "2026-09-15", receivedAt: "2026-09-18T18:12:00.000Z",
    project: "Leadership Lab: Collaboration — logistics, speaker, and run of show for the October session.",
    updates: "Sent the invitation to the full cohort and 31 RSVPs came in within four days. Finalized the run of show with the speaker.",
    nextSteps: "Confirm catering before October 1 and prepare the check-in sheet.",
    issues: "The catering quote came back over budget and we need approval on the spend before we can confirm the order.",
    documentLinks: ["https://docs.example.edu/d/collab-lab-run-of-show"], attachments: [],
  }),
  report({
    id: "IR-260914-CM-1", scholarKey: "jordan ellis", scholarName: "Jordan Ellis", committees: ["Community"], reportingFor: "Community",
    weekOf: "2026-09-14", submittedOn: "2026-09-19", receivedAt: "2026-09-19T23:05:00.000Z",
    project: "Peer check-in buddy system pairing every first-year scholar with a returning scholar.",
    updates: "No update this week. Midterms meant we did not meet and the pairings have not gone out.",
    nextSteps: "Launch the pairings and send each pair a welcome message.",
    issues: "Everyone is busy with midterms and I am the only one free to run the pairings, so nothing moved.",
    documentLinks: [], attachments: [],
  }),
  report({
    id: "IR-260914-CC-1", scholarKey: "dana okafor", scholarName: "Dana Okafor", committees: ["Co-chairs"], reportingFor: "Co-chairs",
    weekOf: "2026-09-14", submittedOn: "2026-09-19", lastMeetingOn: "2026-09-14", receivedAt: "2026-09-19T13:44:00.000Z",
    project: "Committee charter and the weekly reporting standard for all five committees.",
    updates: "Reviewed the charter comments from four committees and approved two of the three committee budgets.",
    nextSteps: "Finalize the charter by September 26 and publish the reporting standard to all committees.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/committee-charter"], attachments: [{ name: "Co-chairs meeting notes 09-14.pdf", kind: "meeting report" }],
  }),

  /* ---------- Week of 2026-09-21 ---------- */
  report({
    id: "IR-260921-SN-1", scholarKey: "ava whitfield", scholarName: "Ava Whitfield", committees: ["Scholar News"], reportingFor: "Scholar News",
    weekOf: "2026-09-21", submittedOn: "2026-09-22", lastMeetingOn: "2026-09-21", receivedAt: "2026-09-22T17:30:00.000Z",
    project: "Fall Scholar Spotlight newsletter — a six-profile issue introducing the new cohort.",
    updates: "Published the Fall Scholar Spotlight newsletter to 214 subscribers and sent the teaser copy to Web and Social Media the same day. The co-chairs approved the draft on Monday after a second follow-up.",
    nextSteps: "Collect open-rate numbers by September 29 and start the alumni interview series outline.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/fall-spotlight-final"], attachments: [{ name: "Scholar News meeting notes 09-21.pdf", kind: "meeting report" }],
  }),
  report({
    id: "IR-260921-SN-2", scholarKey: "tomas vela", scholarName: "Tomas Vela", committees: ["Scholar News"], reportingFor: "Scholar News",
    weekOf: "2026-09-21", submittedOn: "2026-09-22", lastMeetingOn: "2026-09-21", receivedAt: "2026-09-22T19:02:00.000Z",
    project: "Alumni interview series.",
    updates: "Working on it. Made some progress this week.",
    nextSteps: "Keep going.",
    issues: "None.",
    documentLinks: [], attachments: [],
  }),
  report({
    id: "IR-260921-WS-1", scholarKey: "marcus lee", scholarName: "Marcus Lee", committees: ["Web and Social Media"], reportingFor: "Web and Social Media",
    weekOf: "2026-09-21", submittedOn: "2026-09-22", lastMeetingOn: "2026-09-21", receivedAt: "2026-09-22T18:26:00.000Z",
    project: "Instagram relaunch and six-week content calendar for the Academy account.",
    updates: "Published two reels and the newsletter teaser graphic with Scholar News. Reach for the week was 1240 accounts, up from 780.",
    nextSteps: "Post the October event promotion by September 29 and hand the calendar over to the next content lead.",
    issues: "Editing access to the Academy website page is still not resolved after three weeks, so the events page is out of date.",
    documentLinks: ["https://docs.example.edu/d/content-calendar"], attachments: [{ name: "September reach export.csv", kind: "deliverable" }],
  }),
  report({
    id: "IR-260921-EV-1", scholarKey: "priya raman", scholarName: "Priya Raman", committees: ["Events"], reportingFor: "Events",
    weekOf: "2026-09-21", submittedOn: "2026-09-22", lastMeetingOn: "2026-09-22", receivedAt: "2026-09-22T20:10:00.000Z",
    project: "Leadership Lab: Collaboration — delivery and debrief for the October session.",
    updates: "Hosted the Collaboration Lab with 29 check-ins against 31 RSVPs. Ran the debrief with the committee and collected 22 feedback forms.",
    nextSteps: "Send the feedback summary to the co-chairs by September 30 and scout a venue for the November panel.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/collab-lab-debrief"], attachments: [{ name: "Collaboration Lab feedback export.csv", kind: "deliverable" }, { name: "Events meeting notes 09-22.pdf", kind: "meeting report" }],
  }),
  report({
    id: "IR-260921-CM-1", scholarKey: "sam ortega", scholarName: "Sam Ortega", committees: ["Free Agents"], reportingFor: "Community",
    weekOf: "2026-09-21", submittedOn: "2026-09-22", lastMeetingOn: "2026-09-20", receivedAt: "2026-09-22T21:48:00.000Z",
    project: "Peer check-in buddy system — stepped in as a Free Agent to restart the pairings.",
    updates: "Launched the buddy pairings and sent 18 welcome messages. Set up a shared tracker so the committee can see which pairs have met.",
    nextSteps: "Collect the first round of pair check-ins by October 3 and hand the tracker back to Jordan Ellis.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/buddy-tracker"], attachments: [],
  }),

  /* ---------- Week of 2026-09-28: mid-cycle initiative review ----------
     The improvement action on goal g-2, reported by every committee. Officer
     mentors are named in the updates, so they surface as credited people, and
     Tomas Vela's second report shows what mentoring does to a thin one. */
  report({
    id: "IR-260928-CC-1", scholarKey: "dana okafor", scholarName: "Dana Okafor", committees: ["Co-chairs"], reportingFor: "Co-chairs",
    weekOf: "2026-09-28", submittedOn: "2026-09-29", lastMeetingOn: "2026-09-28", receivedAt: "2026-09-29T16:05:00.000Z",
    project: "Mid-Cycle Initiative Review — a halfway checkpoint on every scholar initiative, run with officer mentors.",
    updates: "Hosted the Mid-Cycle Initiative Review on September 28 with 31 scholars checked in against 34 RSVPs. Paired every reviewed initiative with an officer mentor: Renee Alvarez took Community and Events, Malik Turner took Scholar News, Grace Kimani took Web and Social Media. Published the review rubric and the mentor pairing sheet the same day.",
    nextSteps: "Collect each mentor's written feedback by October 6 and publish the second-half initiative plan.",
    issues: "Four initiatives still have no named mentor. We need more hands for the second half and only one officer volunteered.",
    documentLinks: ["https://docs.example.edu/d/mid-cycle-rubric", "https://docs.example.edu/d/mentor-pairings"],
    attachments: [{ name: "Mid-cycle review notes 09-28.pdf", kind: "meeting report" }, { name: "Mentor pairing sheet.xlsx", kind: "deliverable" }],
  }),
  report({
    id: "IR-260928-CM-1", scholarKey: "jordan ellis", scholarName: "Jordan Ellis", committees: ["Community"], reportingFor: "Community",
    weekOf: "2026-09-28", submittedOn: "2026-09-29", lastMeetingOn: "2026-09-28", receivedAt: "2026-09-29T18:22:00.000Z",
    project: "Peer check-in buddy system — mid-cycle review of the pairings.",
    updates: "Took the buddy tracker back from Sam Ortega and collected the first round of pair check-ins: 14 of 18 pairs have met. Reviewed the initiative with Renee Alvarez at the mid-cycle review and cut the scope to monthly check-ins.",
    nextSteps: "Send a reminder to the four pairs that have not met by October 2 and write the mid-cycle summary for the co-chairs.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/buddy-tracker"], attachments: [],
  }),
  report({
    id: "IR-260928-EV-1", scholarKey: "priya raman", scholarName: "Priya Raman", committees: ["Events"], reportingFor: "Events",
    weekOf: "2026-09-28", submittedOn: "2026-09-29", lastMeetingOn: "2026-09-28", receivedAt: "2026-09-29T17:40:00.000Z",
    project: "Mid-Cycle Initiative Review logistics, and the November panel.",
    updates: "Ran the room and the check-in desk for the Mid-Cycle Initiative Review and recorded 31 check-ins. Sent the Collaboration Lab feedback summary to the co-chairs on September 29.",
    nextSteps: "Confirm the November panel venue by October 10 and book the speaker.",
    issues: "The November panel date clashes with the Scholar News publishing week and we are not on the same page about which comes first.",
    documentLinks: [], attachments: [{ name: "Mid-cycle check-in sheet.csv", kind: "deliverable" }],
  }),
  report({
    id: "IR-260928-SN-1", scholarKey: "ava whitfield", scholarName: "Ava Whitfield", committees: ["Scholar News"], reportingFor: "Scholar News",
    weekOf: "2026-09-28", submittedOn: "2026-09-29", lastMeetingOn: "2026-09-28", receivedAt: "2026-09-29T19:11:00.000Z",
    project: "Fall Scholar Spotlight open rates, and the alumni interview series.",
    updates: "Collected the newsletter open-rate numbers: 214 sent, 138 opened, a 64% open rate. Outlined the alumni interview series with Malik Turner at the mid-cycle review and confirmed three alumni for October.",
    nextSteps: "Draft the first alumni interview by October 8 and send the open-rate summary to the co-chairs.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/spotlight-open-rates"], attachments: [{ name: "Scholar News meeting notes 09-28.pdf", kind: "meeting report" }],
  }),
  report({
    id: "IR-260928-SN-2", scholarKey: "tomas vela", scholarName: "Tomas Vela", committees: ["Scholar News"], reportingFor: "Scholar News",
    weekOf: "2026-09-28", submittedOn: "2026-09-29", lastMeetingOn: "2026-09-28", receivedAt: "2026-09-29T20:03:00.000Z",
    project: "Alumni interview series — outreach to graduates from the last five cohorts.",
    updates: "Malik Turner walked me through the review rubric and I rewrote my plan. Contacted 9 alumni and 4 agreed to an interview. Drafted the question set and shared it with Ava Whitfield.",
    nextSteps: "Schedule the first two interviews by October 7 and send the question set to the co-chairs.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/alumni-question-set"], attachments: [],
  }),
  report({
    id: "IR-260928-WS-1", scholarKey: "marcus lee", scholarName: "Marcus Lee", committees: ["Web and Social Media"], reportingFor: "Web and Social Media",
    weekOf: "2026-09-28", submittedOn: "2026-09-29", lastMeetingOn: "2026-09-28", receivedAt: "2026-09-29T21:17:00.000Z",
    project: "Instagram content calendar handover, and the Academy website events page.",
    updates: "Editing access to the website was granted on Monday and the events page is up to date. Posted the October event promotion and a recap reel from the Mid-Cycle Initiative Review; reach was 1680 accounts. Handed the content calendar over to Grace Kimani.",
    nextSteps: "Train Grace Kimani on the posting workflow by October 5.",
    issues: "None.",
    documentLinks: ["https://docs.example.edu/d/content-calendar"], attachments: [{ name: "October reach export.csv", kind: "deliverable" }],
  }),
];
