import { deriveSignals, headlineFor, similarity, toSentences } from "@/lib/lead/semantics";
import { shiftWeek, weekLabel } from "@/lib/lead/report-intake";
import { committees, type CarryOver, type Committee, type IndividualReport, type IndividualReportSummary, type IndividualReportView, type Momentum, type ProjectThread, type WeekIndexEntry, type WeeklyPulse, type WeeklyReport } from "@/lib/lead/types";

/* ==========================================================================
   Weekly roll-up.

   The roll-up is a reading of the week's individual reports, never a
   replacement for them: every claim here carries the report IDs behind it so a
   reader can open the submission and check it. Two comparisons make the report
   worth writing rather than just counting - project threads, which follow one
   piece of work across weeks, and follow-through, which asks whether last
   week's stated next step actually happened.
   ========================================================================== */

/** Standing committees. Free Agents is a membership, not a reporting unit, so its silence is not a gap. */
const STANDING: Committee[] = committees.filter((committee) => committee !== "Free Agents");
const SEVERITY_ORDER = ["high", "medium", "low"] as const;

const signalCache = new Map<string, ReturnType<typeof deriveSignals>>();

function signalsFor(report: IndividualReport) {
  const cached = signalCache.get(report.id);
  if (cached) return cached;
  const signals = deriveSignals(report);
  signalCache.set(report.id, signals);
  if (signalCache.size > 500) signalCache.clear();
  return signals;
}

export function viewOf(report: IndividualReport): IndividualReportView {
  return { ...report, signals: signalsFor(report) };
}

export function summarize(report: IndividualReport): IndividualReportSummary {
  const signals = signalsFor(report);
  return {
    id: report.id,
    scholarName: report.scholarName,
    reportingFor: report.reportingFor,
    weekOf: report.weekOf,
    submittedOn: report.submittedOn,
    project: toSentences(report.project)[0]?.slice(0, 120) ?? report.project.slice(0, 120),
    headline: headlineFor(report, signals),
    momentum: signals.momentum,
    specificity: signals.specificity,
    blockerCount: signals.blockers.length,
    commitmentCount: signals.commitments.length,
    themes: signals.themes.map((theme) => theme.label),
    attachments: report.attachments.length,
    documentLinks: report.documentLinks.length,
  };
}

/** Plain comma list. Reports read as scannable fields, not as prose. */
function listSentence(values: string[]) {
  return values.join(", ");
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Shorten on a word boundary, so a quoted commitment never breaks mid-word. */
function clip(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * Follows one piece of work across weeks. Wording drifts between submissions, so
 * threads cluster on word overlap rather than an exact project title.
 */
export function buildProjectThreads(reports: IndividualReport[], throughWeek: string): ProjectThread[] {
  const ordered = [...reports].filter((report) => report.weekOf <= throughWeek).sort((a, b) => a.weekOf.localeCompare(b.weekOf));
  const threads: (ProjectThread & { texts: string[]; projects: string[]; deliveredWeeks: string[] })[] = [];

  for (const report of ordered) {
    const signals = signalsFor(report);
    const text = `${report.project} ${report.updates}`;
    // The project line is the stable identifier; updates change every week and
    // dilute the comparison, which used to split one project into three threads.
    const match = threads.find((thread) => thread.committees.includes(report.reportingFor)
      && (thread.projects.some((existing) => similarity(existing, report.project) >= 0.45)
        || thread.texts.some((existing) => similarity(existing, text) >= 0.42)));
    const title = toSentences(report.project)[0]?.slice(0, 110) ?? report.project.slice(0, 110);
    if (match) {
      match.texts.push(text);
      match.projects.push(report.project);
      match.title = title;
      match.weeks = [...new Set([...match.weeks, report.weekOf])];
      match.contributors = [...new Set([...match.contributors, report.scholarName])];
      match.reportIds = [...match.reportIds, report.id];
      match.momentum = signals.momentum;
      match.latestUpdate = headlineFor(report, signals);
      match.latestWeek = report.weekOf;
      if (signals.delivered.length > 0) match.deliveredWeeks.push(report.weekOf);
      continue;
    }
    threads.push({
      key: `thread-${threads.length + 1}`,
      title,
      committees: [report.reportingFor],
      contributors: [report.scholarName],
      weeks: [report.weekOf],
      momentum: signals.momentum,
      latestUpdate: headlineFor(report, signals),
      latestWeek: report.weekOf,
      reportIds: [report.id],
      weeksSinceDelivery: 0,
      texts: [text],
      projects: [report.project],
      deliveredWeeks: signals.delivered.length > 0 ? [report.weekOf] : [],
    });
  }

  const weeksBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86_400_000)));
  // The clustering texts stay internal; only the public thread shape is returned.
  return threads.map((thread) => ({
    key: thread.key,
    title: thread.title,
    committees: thread.committees,
    contributors: thread.contributors,
    weeks: thread.weeks,
    momentum: thread.momentum,
    latestUpdate: thread.latestUpdate,
    latestWeek: thread.latestWeek,
    reportIds: thread.reportIds,
    weeksSinceDelivery: thread.deliveredWeeks.length === 0 ? thread.weeks.length : weeksBetween(thread.deliveredWeeks[thread.deliveredWeeks.length - 1], throughWeek),
  }));
}

/**
 * Did last week's stated next step happen? A commitment that reappears in this
 * week's update was worked; one that only reappears in next steps was restated;
 * one that appears nowhere was dropped. The threshold is word overlap, so the
 * evidence sentence travels with the verdict for a reader to check.
 */
export function buildCarryOver(previous: IndividualReport[], current: IndividualReport[]): CarryOver[] {
  const carry: CarryOver[] = [];
  for (const report of previous) {
    const commitments = signalsFor(report).commitments;
    if (commitments.length === 0) continue;
    const followers = current.filter((entry) => entry.scholarKey === report.scholarKey || entry.reportingFor === report.reportingFor);
    const updateSentences = followers.flatMap((entry) => toSentences(entry.updates).map((sentence) => ({ sentence, id: entry.id })));
    const restatements = followers.flatMap((entry) => signalsFor(entry).commitments.map((commitment) => commitment.text));

    for (const commitment of commitments.slice(0, 4)) {
      const best = updateSentences
        .map((entry) => ({ ...entry, score: similarity(commitment.text, entry.sentence) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= 0.34) {
        carry.push({ commitment: commitment.text, committee: report.reportingFor, scholarName: report.scholarName, fromWeek: report.weekOf, status: "kept", evidence: best.sentence.slice(0, 200), reportId: best.id });
        continue;
      }
      const restated = restatements.find((text) => similarity(commitment.text, text) >= 0.34);
      carry.push({
        commitment: commitment.text,
        committee: report.reportingFor,
        scholarName: report.scholarName,
        fromWeek: report.weekOf,
        status: restated ? "restated" : "dropped",
        ...(restated ? { evidence: restated.slice(0, 200) } : {}),
        reportId: report.id,
      });
    }
  }
  return carry;
}

function buildRisks(reports: IndividualReport[]) {
  const grouped = new Map<string, WeeklyReport["risks"][number]>();
  for (const report of reports) {
    for (const blocker of signalsFor(report).blockers) {
      const existing = grouped.get(blocker.kind);
      const quote = { scholarName: report.scholarName, committee: report.reportingFor, quote: blocker.quote, reportId: report.id };
      if (!existing) {
        grouped.set(blocker.kind, { kind: blocker.kind, label: blocker.label, severity: blocker.severity, committees: [report.reportingFor], quotes: [quote], recommendedAction: blocker.recommendedAction });
        continue;
      }
      existing.committees = [...new Set([...existing.committees, report.reportingFor])];
      existing.quotes.push(quote);
      if (SEVERITY_ORDER.indexOf(blocker.severity) < SEVERITY_ORDER.indexOf(existing.severity)) existing.severity = blocker.severity;
    }
  }
  return [...grouped.values()].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.quotes.length - a.quotes.length);
}

function buildThemes(reports: IndividualReport[]) {
  const grouped = new Map<string, WeeklyReport["themes"][number]>();
  for (const report of reports) {
    for (const theme of signalsFor(report).themes) {
      const existing = grouped.get(theme.label);
      if (!existing) {
        grouped.set(theme.label, { label: theme.label, mentions: theme.mentions, committees: [report.reportingFor], tone: theme.tone });
        continue;
      }
      existing.mentions += theme.mentions;
      existing.committees = [...new Set([...existing.committees, report.reportingFor])];
      if (theme.tone === "watch") existing.tone = "watch";
    }
  }
  return [...grouped.values()].sort((a, b) => b.mentions - a.mentions).slice(0, 6);
}

/** Committees whose work overlaps this week, either by shared subject matter or by naming each other. */
function buildCollaboration(reports: IndividualReport[]) {
  const edges: WeeklyReport["collaboration"] = [];
  const seen = new Set<string>();
  for (let i = 0; i < reports.length; i += 1) {
    for (let j = i + 1; j < reports.length; j += 1) {
      const left = reports[i];
      const right = reports[j];
      if (left.reportingFor === right.reportingFor) continue;
      const pair = [left.reportingFor, right.reportingFor].sort();
      const key = pair.join("|");
      if (seen.has(key)) continue;
      const overlap = similarity(`${left.project} ${left.updates}`, `${right.project} ${right.updates}`);
      const namesEachOther = left.updates.toLowerCase().includes(right.reportingFor.toLowerCase()) || right.updates.toLowerCase().includes(left.reportingFor.toLowerCase());
      if (overlap < 0.28 && !namesEachOther) continue;
      seen.add(key);
      edges.push({ committees: pair as Committee[], basis: namesEachOther ? "Named in each other's updates" : `Shared subject matter, ${Math.round(overlap * 100)}% word overlap` });
    }
  }
  return edges.slice(0, 4);
}

function buildHighlights(reports: IndividualReport[]) {
  return reports
    .map((report) => {
      const signals = signalsFor(report);
      const quote = signals.quotes[0] ?? signals.delivered[0];
      if (!quote) return undefined;
      const score = signals.specificity + signals.delivered.length * 12 + signals.evidence.numbers.length * 6 + signals.evidence.artifacts.length * 3;
      const reasons = [
        signals.delivered.length > 0 ? `${plural(signals.delivered.length, "completed item")} named` : undefined,
        signals.evidence.numbers.length > 0 ? `quantified (${signals.evidence.numbers[0].trim()})` : undefined,
        signals.evidence.links > 0 ? "shared an editable document" : undefined,
        signals.evidence.collaborators.length > 0 ? `credits ${listSentence(signals.evidence.collaborators.slice(0, 2))}` : undefined,
      ].filter((reason): reason is string => Boolean(reason));
      return { scholarName: report.scholarName, committee: report.reportingFor, quote, reportId: report.id, reason: reasons.length > 0 ? reasons.join("; ") : `Specificity ${signals.specificity}/100`, score };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => ({ scholarName: entry.scholarName, committee: entry.committee, quote: entry.quote, reportId: entry.reportId, reason: entry.reason }));
}

function buildNarrative(weekly: Omit<WeeklyReport, "narrative">, activeThisWeek: number): WeeklyReport["narrative"] {
  const { participation, momentum, delivered, risks, themes, carryOver, followThrough, projects, collaboration, evidence, highlights } = weekly;
  const internal: string[] = [];
  const showcase: string[] = [];

  const committeesTotal = participation.committeesReporting.length + participation.committeesSilent.length;
  internal.push(
    `Participation: ${participation.reports} check-ins, ${participation.scholars} scholars, ${participation.committeesReporting.length} of ${committeesTotal} committees, ${participation.meetingsHeld} meetings evidenced, average specificity ${evidence.averageSpecificity}/100. ` +
    (participation.committeesSilent.length > 0
      ? `Silent: ${participation.committeesSilent.map((entry) => `${entry.committee} (${entry.lastReportedWeek ? `last ${weekLabel(entry.lastReportedWeek).replace("Week of ", "")}` : "never"})`).join(", ")}.`
      : "Silent: none."),
  );

  internal.push(
    `Momentum: ${momentum.shipped} shipped, ${momentum.advancing} advancing, ${momentum.planning} planning, ${momentum.stalled} stalled, ${momentum.blocked} blocked. ` +
    (delivered.length > 0
      ? `Completed: ${delivered.slice(0, 5).map((item) => `${item.committee} — ${clip(item.text.replace(/\.$/, ""), 90)}`).join("; ")}.`
      : "Completed: nothing named. Ask each committee for one shippable item next week."),
  );

  internal.push(
    risks.length > 0
      ? `Risks: ${risks.length}. ${risks.slice(0, 3).map((risk) => `${risk.label} — ${risk.severity}, ${risk.committees.join(", ")}. Action: ${risk.recommendedAction}`).join(" ")}`
      : `Risks: none declared${weekly.followUps.length > 0 ? `, ${plural(weekly.followUps.length, "follow-up prompt")} below` : ", every submission named a deliverable"}.`,
  );

  if (carryOver.length > 0) {
    internal.push(
      `Follow-through: ${followThrough.kept} kept, ${followThrough.restated} restated, ${followThrough.dropped} dropped, ${followThrough.rate}% acted on. ` +
      (followThrough.dropped > 0
        ? `Dropped: ${carryOver.filter((entry) => entry.status === "dropped").slice(0, 3).map((entry) => `"${clip(entry.commitment, 60)}" (${entry.committee})`).join(", ")}.`
        : "Dropped: none."),
    );
  }

  const stalled = projects.filter((project) => project.weeksSinceDelivery >= 2);
  if (stalled.length > 0) {
    internal.push(`Watchlist: ${stalled.slice(0, 3).map((project) => `"${clip(project.title, 60)}" — ${project.committees.join(", ")}, ${plural(project.weeksSinceDelivery, "week")} without a completed item`).join("; ")}. Put a date on ${stalled.length === 1 ? "it" : "each"}.`);
  }

  // The showcase version keeps the achievements and the reach, and names no one critically.
  showcase.push(`${weekly.label}: ${participation.scholars} scholars, ${participation.committeesReporting.length} committees, ${plural(activeThisWeek, "active project")} — ${participation.committeesReporting.join(", ")}.`);
  // Quoted verbatim rather than folded into a sentence, so proper nouns survive.
  if (delivered.length > 0) showcase.push(`Completed: ${delivered.slice(0, 4).map((item) => clip(item.text.replace(/\.$/, ""), 120)).join("; ")}.`);
  if (highlights.length > 0) showcase.push(`In their own words: ${highlights.slice(0, 2).map((highlight) => `"${highlight.quote.replace(/"/g, "'")}" (${highlight.committee})`).join(" ")}`);
  if (themes.length > 0) showcase.push(`Focus: ${themes.slice(0, 3).map((theme) => `${theme.label.toLowerCase()} (${theme.mentions})`).join(", ")}.`);
  if (collaboration.length > 0) showcase.push(`Cross-committee: ${collaboration.map((edge) => edge.committees.join(" × ")).join(", ")}.`);
  showcase.push(`Evidence: ${plural(evidence.reportIds.length, "individual report")}, ${plural(evidence.documentLinks, "shared document")}, ${plural(evidence.attachments, "uploaded file")} — each retrievable by ID.`);

  return { internal, showcase };
}

export function buildWeeklyReport(weekOf: string, allReports: IndividualReport[]): WeeklyReport {
  const current = allReports.filter((report) => report.weekOf === weekOf).sort((a, b) => a.reportingFor.localeCompare(b.reportingFor));
  const previousWeek = shiftWeek(weekOf, -1);
  const previous = allReports.filter((report) => report.weekOf === previousWeek);
  const reporting = [...new Set(current.map((report) => report.reportingFor))];

  const momentum: Record<Momentum, number> = { shipped: 0, advancing: 0, planning: 0, stalled: 0, blocked: 0 };
  for (const report of current) momentum[signalsFor(report).momentum] += 1;

  const threads = buildProjectThreads(allReports, weekOf);
  const carryOver = buildCarryOver(previous, current);
  const counts = { kept: carryOver.filter((entry) => entry.status === "kept").length, restated: carryOver.filter((entry) => entry.status === "restated").length, dropped: carryOver.filter((entry) => entry.status === "dropped").length };
  const specificities = current.map((report) => signalsFor(report).specificity);

  const base: Omit<WeeklyReport, "narrative"> = {
    weekOf,
    label: weekLabel(weekOf),
    generatedAt: new Date().toISOString(),
    participation: {
      reports: current.length,
      scholars: new Set(current.map((report) => report.scholarKey)).size,
      committeesReporting: reporting,
      committeesSilent: STANDING.filter((committee) => !reporting.includes(committee)).map((committee) => {
        const last = allReports.filter((report) => report.reportingFor === committee && report.weekOf < weekOf).sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0];
        return last ? { committee, lastReportedWeek: last.weekOf } : { committee };
      }),
      meetingsHeld: new Set(current.filter((report) => report.lastMeetingOn).map((report) => `${report.reportingFor}:${report.lastMeetingOn}`)).size,
    },
    momentum,
    delivered: current.flatMap((report) => signalsFor(report).delivered.map((text) => ({ committee: report.reportingFor, scholarName: report.scholarName, text, reportId: report.id }))),
    risks: buildRisks(current),
    themes: buildThemes(current),
    highlights: buildHighlights(current),
    // Stale threads sort first, so the display slice is not a count of active work.
    projects: threads.filter((thread) => thread.latestWeek >= shiftWeek(weekOf, -3)).sort((a, b) => b.weeksSinceDelivery - a.weeksSinceDelivery || b.latestWeek.localeCompare(a.latestWeek)).slice(0, 8),
    collaboration: buildCollaboration(current),
    carryOver,
    followThrough: { ...counts, rate: carryOver.length === 0 ? 0 : Math.round(((counts.kept + counts.restated) / carryOver.length) * 100) },
    evidence: {
      reportIds: current.map((report) => report.id),
      documentLinks: current.reduce((total, report) => total + report.documentLinks.length, 0),
      attachments: current.reduce((total, report) => total + report.attachments.length, 0),
      averageSpecificity: specificities.length === 0 ? 0 : Math.round(specificities.reduce((total, value) => total + value, 0) / specificities.length),
    },
    followUps: current.flatMap((report) => signalsFor(report).followUps.slice(0, 2).map((note) => ({ scholarName: report.scholarName, committee: report.reportingFor, note, reportId: report.id }))).slice(0, 8),
  };

  return { ...base, narrative: buildNarrative(base, threads.filter((thread) => thread.latestWeek === weekOf).length) };
}

export function listWeeks(allReports: IndividualReport[]): WeekIndexEntry[] {
  return [...new Set(allReports.map((report) => report.weekOf))]
    .sort((a, b) => b.localeCompare(a))
    .map((weekOf) => {
      const weekly = buildWeeklyReport(weekOf, allReports);
      return { weekOf, label: weekly.label, reports: weekly.participation.reports, committeesReporting: weekly.participation.committeesReporting.length, blockers: weekly.risks.reduce((total, risk) => total + risk.quotes.length, 0), delivered: weekly.delivered.length, followThroughRate: weekly.followThrough.rate };
    });
}

export function latestWeekOf(allReports: IndividualReport[]) {
  return allReports.reduce<string | undefined>((latest, report) => (!latest || report.weekOf > latest ? report.weekOf : latest), undefined);
}

/** The compact read the program dashboard shows alongside attendance and badge metrics. */
export function buildWeeklyPulse(allReports: IndividualReport[]): WeeklyPulse {
  const weekOf = latestWeekOf(allReports);
  if (!weekOf) return null;
  const weekly = buildWeeklyReport(weekOf, allReports);
  const pulse: NonNullable<WeeklyPulse> = {
    weekOf,
    label: weekly.label,
    reports: weekly.participation.reports,
    committeesReporting: weekly.participation.committeesReporting.length,
    committeesTotal: STANDING.length,
    shipped: weekly.momentum.shipped,
    atRisk: weekly.momentum.blocked + weekly.momentum.stalled,
    followThroughRate: weekly.followThrough.rate,
  };
  if (weekly.risks[0]) pulse.topRisk = { label: weekly.risks[0].label, recommendedAction: weekly.risks[0].recommendedAction };
  if (weekly.themes[0]) pulse.topTheme = { label: weekly.themes[0].label, mentions: weekly.themes[0].mentions };
  return pulse;
}

/**
 * The downloadable brief. Internal keeps the risks, the follow-through ledger,
 * and the follow-up prompts; showcase keeps the achievements and the reach.
 */
export function renderBrief(weekly: WeeklyReport, audience: "internal" | "showcase") {
  const lines: string[] = [`# Leadership Academy — ${weekly.label}`, "", audience === "internal" ? "_Internal. Generated from individual check-ins, every claim traceable to a report ID._" : "_Leadership Academy weekly summary._", ""];

  if (audience === "showcase") {
    weekly.narrative.showcase.forEach((paragraph) => lines.push(paragraph, ""));
    if (weekly.highlights.length > 0) {
      lines.push("## Highlights", "");
      weekly.highlights.forEach((highlight) => lines.push(`- **${highlight.committee}** — "${highlight.quote}"`));
      lines.push("");
    }
    if (weekly.themes.length > 0) {
      lines.push("## Where the work concentrated", "");
      weekly.themes.forEach((theme) => lines.push(`- ${theme.label}: ${plural(theme.mentions, "mention")} across ${listSentence(theme.committees)}`));
      lines.push("");
    }
    return lines.join("\n");
  }

  weekly.narrative.internal.forEach((paragraph) => lines.push(paragraph, ""));

  lines.push("## Participation", "", `- Reports: ${weekly.participation.reports} from ${weekly.participation.scholars} scholars`, `- Committees reporting: ${listSentence(weekly.participation.committeesReporting) || "none"}`, `- Committees silent: ${listSentence(weekly.participation.committeesSilent.map((entry) => `${entry.committee}${entry.lastReportedWeek ? ` (last: ${entry.lastReportedWeek})` : " (never)"}`)) || "none"}`, `- Committee meetings evidenced: ${weekly.participation.meetingsHeld}`, "");

  if (weekly.delivered.length > 0) {
    lines.push("## Completed this week", "");
    weekly.delivered.forEach((item) => lines.push(`- **${item.committee}** (${item.scholarName}, ${item.reportId}): ${item.text}`));
    lines.push("");
  }

  if (weekly.risks.length > 0) {
    lines.push("## Risks, and the move that clears each", "");
    weekly.risks.forEach((risk) => {
      lines.push(`### ${risk.label} — ${risk.severity} (${listSentence(risk.committees)})`);
      risk.quotes.forEach((quote) => lines.push(`- "${quote.quote}" — ${quote.scholarName}, ${quote.reportId}`));
      lines.push(`- **Action:** ${risk.recommendedAction}`, "");
    });
  }

  if (weekly.carryOver.length > 0) {
    lines.push("## Follow-through on last week", "", `Kept ${weekly.followThrough.kept} · restated ${weekly.followThrough.restated} · dropped ${weekly.followThrough.dropped} · ${weekly.followThrough.rate}% acted on`, "");
    weekly.carryOver.forEach((entry) => lines.push(`- [${entry.status}] ${entry.committee}: ${entry.commitment}${entry.evidence ? ` — evidence: "${entry.evidence}"` : ""}`));
    lines.push("");
  }

  if (weekly.projects.length > 0) {
    lines.push("## Project threads", "");
    weekly.projects.forEach((project) => lines.push(`- **${project.title}** (${listSentence(project.committees)}) — ${project.momentum}, ${plural(project.weeks.length, "week")} tracked, ${project.weeksSinceDelivery === 0 ? "delivered this week" : `${plural(project.weeksSinceDelivery, "week")} since a completed item`}. Latest: ${project.latestUpdate}`));
    lines.push("");
  }

  if (weekly.followUps.length > 0) {
    lines.push("## Follow-up prompts for chairs", "");
    weekly.followUps.forEach((entry) => lines.push(`- ${entry.committee} (${entry.scholarName}, ${entry.reportId}): ${entry.note}`));
    lines.push("");
  }

  lines.push("## Evidence", "", `- Individual reports: ${weekly.evidence.reportIds.join(", ") || "none"}`, `- Shared documents: ${weekly.evidence.documentLinks}`, `- Uploaded files: ${weekly.evidence.attachments}`, `- Average specificity: ${weekly.evidence.averageSpecificity}/100`, "");
  return lines.join("\n");
}
