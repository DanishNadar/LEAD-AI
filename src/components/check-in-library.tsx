"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mondayOf, weekLabel, wordLimits } from "@/lib/lead/report-intake";
import { committees, type Committee, type IndividualReportSummary, type IndividualReportView, type Momentum } from "@/lib/lead/types";

/* ==========================================================================
   Committee check-in library.

   The list is for finding a report; the detail view is for reading the one that
   was actually written. The scholar's four answers appear verbatim and first,
   above anything derived from them, because the submission is the evidence and
   the reading is only an interpretation of it.
   ========================================================================== */

type Tone = "good" | "neutral" | "watch" | "alert";

const MOMENTUM_META: Record<Momentum, { label: string; glyph: string; tone: Tone }> = {
  shipped: { label: "Shipped", glyph: "✓", tone: "good" },
  advancing: { label: "Advancing", glyph: "→", tone: "neutral" },
  planning: { label: "Planning", glyph: "◦", tone: "neutral" },
  stalled: { label: "Stalled", glyph: "‒", tone: "watch" },
  blocked: { label: "Blocked", glyph: "!", tone: "alert" },
};
const SEVERITY_TONE: Record<"high" | "medium" | "low", Tone> = { high: "alert", medium: "watch", low: "neutral" };

const fmtDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const today = () => new Date().toISOString().slice(0, 10);

// Tones are namespaced: bare `.good`/`.watch` are existing global tag utilities.
function Pill({ tone, glyph, children }: { tone: Tone; glyph: string; children: React.ReactNode }) {
  return <span className={`pill tone-${tone}`}><i aria-hidden="true">{glyph}</i>{children}</span>;
}

/** Enum values arrive lower-cased from the data; sentence-case them for display. */
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function CheckInLibrary({ canRetrieve, canSubmit, onToast, openId, onOpened }: { canRetrieve: boolean; canSubmit: boolean; onToast: (message: string) => void; openId: string | null; onOpened: () => void }) {
  const [reports, setReports] = useState<IndividualReportSummary[]>([]);
  const [committee, setCommittee] = useState<Committee | "">("");
  const [week, setWeek] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<IndividualReportView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  /** Bumped after a submission so the index refetches without a callback into the effect. */
  const [revision, setRevision] = useState(0);

  const weekOptions = useMemo(() => [...new Set(reports.map((report) => report.weekOf))].sort((a, b) => b.localeCompare(a)), [reports]);

  useEffect(() => {
    // The no-access branch renders before `loading` is read, so it needs no state change here.
    if (!canRetrieve) return;
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (committee) params.set("committee", committee);
        if (week) params.set("week", week);
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/reports/individual?${params}`, { cache: "no-store" });
        const data = await response.json() as { reports: IndividualReportSummary[]; error?: string };
        if (!active) return;
        if (!response.ok) throw new Error(data.error ?? "The check-in index could not be loaded.");
        setReports(data.reports);
        setError(null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The check-in index could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [canRetrieve, committee, week, query, revision]);

  const open = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/reports/individual/${id}`, { cache: "no-store" });
      const data = await response.json() as IndividualReportView & { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Report ${id} could not be retrieved.`);
      setDetail(data);
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : "That report could not be retrieved.");
    }
  }, [onToast]);

  // A citation elsewhere in the dashboard opens the report it points at.
  useEffect(() => {
    if (!openId || !canRetrieve) return;
    void (async () => { await open(openId); onOpened(); })();
  }, [openId, canRetrieve, open, onOpened]);

  if (!canRetrieve) {
    return <section className="library"><p className="admin-message" role="status">Check-ins name individual scholars. Sign in at <a href="/admin">/admin</a> to retrieve them.</p></section>;
  }

  return <section className="library" aria-labelledby="library-title">
    <header className="settings-intro">
      <div>
        <p className="overline">INDIVIDUAL REPORT RETRIEVAL</p>
        <h1 id="library-title">Every check-in, kept as written.</h1>
        <p>Stored verbatim, addressed by ID. Search every answer, or filter by committee or week.</p>
      </div>
      <div className="settings-actions">
        <button className="button primary" onClick={() => setFormOpen(true)} disabled={!canSubmit} title={canSubmit ? undefined : "Check-in submission is closed on this deployment."}>＋ Record a check-in</button>
      </div>
    </header>

    <div className="filters" role="search">
      <label>Search all answers<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="newsletter, catering, access…" /></label>
      <label>Committee<select value={committee} onChange={(event) => setCommittee(event.target.value as Committee | "")}><option value="">All committees</option>{committees.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <label>Reporting week<select value={week} onChange={(event) => setWeek(event.target.value)}><option value="">All weeks</option>{weekOptions.map((option) => <option key={option} value={option}>{weekLabel(option)}</option>)}</select></label>
      <span className="filter-count">{loading ? "Loading…" : `${reports.length} report${reports.length === 1 ? "" : "s"}`}</span>
    </div>

    {error && <p className="admin-message" role="alert">{error}</p>}

    {!loading && reports.length === 0 && !error && <p className="empty-note">No check-in matches these filters.</p>}

    <div className="checkin-list">
      {reports.map((report) => {
        const meta = MOMENTUM_META[report.momentum];
        return <article key={report.id} className="checkin-card">
          <div className="checkin-id"><code>{report.id}</code><small>{fmtDate(report.weekOf)}</small></div>
          <div className="checkin-body">
            <h3>{report.scholarName} <span>· {report.reportingFor}</span></h3>
            <p className="checkin-project">{report.project}</p>
            <p className="checkin-headline">{report.headline}</p>
            <div className="chips">
              <Pill tone={meta.tone} glyph={meta.glyph}>{meta.label}</Pill>
              {report.blockerCount > 0 && <Pill tone="alert" glyph="!">{report.blockerCount} blocker{report.blockerCount === 1 ? "" : "s"}</Pill>}
              {report.commitmentCount > 0 && <Pill tone="neutral" glyph="◦">{report.commitmentCount} next step{report.commitmentCount === 1 ? "" : "s"}</Pill>}
              {report.documentLinks > 0 && <Pill tone="neutral" glyph="🔗">{report.documentLinks} doc{report.documentLinks === 1 ? "" : "s"}</Pill>}
              {report.attachments > 0 && <Pill tone="neutral" glyph="📎">{report.attachments} file{report.attachments === 1 ? "" : "s"}</Pill>}
            </div>
          </div>
          <div className="checkin-score"><strong>{report.specificity}</strong><small>specificity</small><i><em style={{ width: `${report.specificity}%` }} /></i></div>
          <button className="row-action" onClick={() => open(report.id)} aria-label={`Open report ${report.id}`}>→</button>
        </article>;
      })}
    </div>

    {detail && <ReportDetail report={detail} onClose={() => setDetail(null)} />}
    {formOpen && <CheckInForm onClose={() => setFormOpen(false)} onSaved={(message) => { setFormOpen(false); onToast(message); setRevision((value) => value + 1); }} />}
  </section>;
}

function ReportDetail({ report, onClose }: { report: IndividualReportView; onClose: () => void }) {
  const { signals } = report;
  const meta = MOMENTUM_META[signals.momentum];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <p className="overline">COMMITTEE CHECK-IN · <code>{report.id}</code></p>
      <h2 id="detail-title">{report.scholarName}</h2>
      <p>{report.reportingFor} · {weekLabel(report.weekOf)} · submitted {fmtDate(report.submittedOn)}{report.lastMeetingOn ? ` · last committee meeting ${fmtDate(report.lastMeetingOn)}` : " · no committee meeting recorded"}</p>

      <div className="detail-chips">
        <Pill tone={meta.tone} glyph={meta.glyph}>{meta.label}</Pill>
        <Pill tone="neutral" glyph="◈">specificity {signals.specificity}/100</Pill>
        <Pill tone="neutral" glyph="≡">{signals.words} words</Pill>
        {report.committees.length > 0 && <Pill tone="neutral" glyph="◇">member of {report.committees.join(", ")}</Pill>}
      </div>
      <p className="detail-reason">Read as <strong>{meta.label.toLowerCase()}</strong>: {signals.momentumReason}</p>

      {/* The submission first, unedited. Everything after this is interpretation. */}
      <div className="detail-answers">
        <section><h3>Project or task</h3><p>{report.project}</p></section>
        <section><h3>New updates</h3><p>{report.updates}</p></section>
        <section><h3>Next steps</h3><p>{report.nextSteps}</p></section>
        <section><h3>Issues reported</h3><p>{report.issues}</p></section>
      </div>

      {(report.documentLinks.length > 0 || report.attachments.length > 0) && <div className="detail-files">
        {report.documentLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer">🔗 {link.replace(/^https?:\/\//, "").slice(0, 60)}</a>)}
        {report.attachments.map((file) => <span key={file.name}>📎 {file.name} <small>({file.kind})</small></span>)}
      </div>}

      <div className="detail-derived">
        <p className="overline">READ FROM THIS SUBMISSION</p>
        {signals.delivered.length > 0 && <section><h3>Completed</h3><ul>{signals.delivered.map((item) => <li key={item}>{item}</li>)}</ul></section>}
        {signals.commitments.length > 0 && <section><h3>Commitments to check next week</h3><ul>{signals.commitments.map((commitment) => <li key={commitment.text}>{commitment.text}{commitment.due && <em> — {commitment.due}</em>}{commitment.owner && <em> — with {commitment.owner}</em>}</li>)}</ul></section>}
        {signals.blockers.length > 0 && <section><h3>Blockers and the move that clears them</h3>{signals.blockers.map((blocker) => <article key={blocker.kind} className="risk">
          <header><Pill tone={SEVERITY_TONE[blocker.severity]} glyph={blocker.severity === "high" ? "!" : blocker.severity === "medium" ? "▲" : "◦"}>{title(blocker.severity)}</Pill><h4>{blocker.label}</h4></header>
          <blockquote>“{blocker.quote}”</blockquote>
          <p className="risk-action"><strong>Do this:</strong> {blocker.recommendedAction}</p>
        </article>)}</section>}
        <section className="detail-evidence">
          <h3>Evidence found in the text</h3>
          <dl>
            <div><dt>Named artifacts</dt><dd>{signals.evidence.artifacts.join(", ") || "none"}</dd></div>
            <div><dt>Counts</dt><dd>{signals.evidence.numbers.join(", ") || "none"}</dd></div>
            <div><dt>Dates</dt><dd>{signals.evidence.dates.join(", ") || "none"}</dd></div>
            <div><dt>People credited</dt><dd>{signals.evidence.collaborators.join(", ") || "none"}</dd></div>
            <div><dt>Themes</dt><dd>{signals.themes.map((theme) => `${theme.label} (${theme.mentions})`).join(", ") || "none"}</dd></div>
          </dl>
        </section>
        {signals.followUps.length > 0 && <section><h3>Worth asking about</h3><ul className="followups">{signals.followUps.map((note) => <li key={note}>{note}</li>)}</ul></section>}
      </div>
    </section>
  </div>;
}

function CheckInForm({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [scholarName, setScholarName] = useState("");
  const [memberships, setMemberships] = useState<Committee[]>([]);
  const [reportingFor, setReportingFor] = useState<Committee>("Scholar News");
  const [weekOf, setWeekOf] = useState(mondayOf(today()));
  const [submittedOn, setSubmittedOn] = useState(today());
  const [lastMeetingOn, setLastMeetingOn] = useState("");
  const [project, setProject] = useState("");
  const [updates, setUpdates] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [issues, setIssues] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function toggle(committee: Committee) {
    setMemberships((current) => current.includes(committee) ? current.filter((entry) => entry !== committee) : current.length >= 6 ? current : [...current, committee]);
  }

  const withinLimits = countWords(project) <= wordLimits.project && countWords(updates) <= wordLimits.updates && countWords(nextSteps) <= wordLimits.nextSteps && countWords(issues) <= wordLimits.issues;
  const valid = scholarName.trim().length > 1 && memberships.length > 0 && project.trim() && updates.trim() && nextSteps.trim() && issues.trim() && withinLimits
    && (memberships.includes(reportingFor) || memberships.includes("Free Agents"));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reports/individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scholarName: scholarName.trim(), committees: memberships, reportingFor, weekOf, submittedOn,
          lastMeetingOn: lastMeetingOn || undefined,
          project: project.trim(), updates: updates.trim(), nextSteps: nextSteps.trim(), issues: issues.trim(),
          documentLinks: links.split(/[\s,]+/).map((link) => link.trim()).filter(Boolean),
          attachments: files.split(/\n|,/).map((name) => name.trim()).filter(Boolean).map((name) => ({ name, kind: /meeting|minutes|notes/i.test(name) ? "meeting report" : "deliverable" })),
        }),
      });
      const data = await response.json() as { individual?: { id: string }; replaced?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The check-in could not be saved.");
      onSaved(data.replaced ? `Check-in ${data.individual?.id} updated, roll-up recalculated.` : `Check-in ${data.individual?.id} stored, roll-up recalculated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The check-in could not be saved.");
      setSaving(false);
    }
  }

  const counter = (value: string, limit: number) => <small className={countWords(value) > limit ? "over" : undefined}>{countWords(value)} / {limit} words</small>;

  return <div className="modal-backdrop" onMouseDown={() => !saving && onClose()}>
    <section className="modal checkin-modal" role="dialog" aria-modal="true" aria-labelledby="checkin-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close" disabled={saving}>×</button>
      <p className="overline">WEEKLY INDIVIDUAL REPORT</p>
      <h2 id="checkin-title">Record a committee check-in</h2>
      <p>Same questions as the published form. Word limits match, reporting week snaps to Monday.</p>
      <form onSubmit={submit}>
        <label>Your name<input autoFocus value={scholarName} onChange={(event) => setScholarName(event.target.value)} placeholder="e.g., Ava Whitfield" /></label>

        <fieldset className="committee-set">
          <legend>Which committees are you a member of? (up to six)</legend>
          {committees.map((option) => <label key={option} className="check-option"><input type="checkbox" checked={memberships.includes(option)} onChange={() => toggle(option)} /> {option}</label>)}
        </fieldset>

        <div className="form-grid">
          <label>This check-in reports on<select value={reportingFor} onChange={(event) => setReportingFor(event.target.value as Committee)}>{committees.filter((option) => option !== "Free Agents").map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Reporting week (Monday)<input type="date" value={weekOf} onChange={(event) => setWeekOf(mondayOf(event.target.value || today()))} /></label>
          <label>Today&rsquo;s date<input type="date" value={submittedOn} onChange={(event) => setSubmittedOn(event.target.value)} /></label>
          <label>Last committee meeting<input type="date" value={lastMeetingOn} onChange={(event) => setLastMeetingOn(event.target.value)} /></label>
        </div>
        {memberships.length > 0 && !memberships.includes(reportingFor) && !memberships.includes("Free Agents") && <p className="form-hint">Not a member? Tick <strong>Free Agents</strong>, then name the committee you helped.</p>}

        <label>What project or task are you working on? {counter(project, wordLimits.project)}<textarea rows={3} value={project} onChange={(event) => setProject(event.target.value)} placeholder="Name the deliverable, not the topic." /></label>
        <label>What new updates do you have? {counter(updates, wordLimits.updates)}<textarea rows={4} value={updates} onChange={(event) => setUpdates(event.target.value)} placeholder="What is finished, how many, when." /></label>
        <label>What are your next steps as a committee? {counter(nextSteps, wordLimits.nextSteps)}<textarea rows={3} value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} placeholder="One action per step, with a date." /></label>
        <label>Is your committee having any issues with a project? {counter(issues, wordLimits.issues)}<textarea rows={3} value={issues} onChange={(event) => setIssues(event.target.value)} placeholder="Write “none” if there are none." /></label>

        <div className="form-grid">
          <label>Document links (editing access)<textarea rows={2} value={links} onChange={(event) => setLinks(event.target.value)} placeholder="https://… one per line" /></label>
          <label>Files and meeting reports<textarea rows={2} value={files} onChange={(event) => setFiles(event.target.value)} placeholder="File names, one per line" /></label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" disabled={!valid || saving}>{saving ? "Saving check-in…" : "Submit check-in →"}</button>
      </form>
    </section>
  </div>;
}
