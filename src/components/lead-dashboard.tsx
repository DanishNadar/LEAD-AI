"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckInLibrary } from "@/components/check-in-library";
import { WeeklyDigest } from "@/components/weekly-digest";
import type { DataOverview, EventRecord, ProgramReport, TouchpointInput } from "@/lib/lead/types";

const fmtDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
const fmtSyncTime = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const fmtUnit = (value: number, unit: string) => (unit === "%" ? `${value}%` : `${value} ${unit}`);
type DataResult = { report: ProgramReport; overview: DataOverview };

function Glyph({ children }: { children: React.ReactNode }) { return <span className="glyph" aria-hidden="true">{children}</span>; }
function Ring({ value }: { value: number }) { const r = 33; const c = 2 * Math.PI * r; return <div className="ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle className="ring-bg" cx="40" cy="40" r={r} /><circle className="ring-fill" cx="40" cy="40" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} /></svg><strong>{value}%</strong></div>; }

export function LeadDashboard({ initialReport, initialOverview, canReadCheckIns, canWriteCheckIns }: { initialReport: ProgramReport; initialOverview: DataOverview; canReadCheckIns: boolean; canWriteCheckIns: boolean }) {
  const [nav, setNav] = useState("Overview");
  // A report ID cited anywhere in the dashboard opens that submission in the library.
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [period, setPeriod] = useState(initialReport.period);
  const [report, setReport] = useState(initialReport);
  const [overview, setOverview] = useState(initialOverview);
  const [modal, setModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [databaseAction, setDatabaseAction] = useState<"sync" | "reset" | null>(null);
  const events = useMemo(() => [...report.events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [report.events]);
  const ordinanceRate = report.ordinance.total === 0 ? 0 : Math.round((report.ordinance.complete / report.ordinance.total) * 100);

  useEffect(() => { if (!menuOpen) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [menuOpen]);
  function applyData(data: DataResult) { setReport(data.report); setOverview(data.overview); setPeriod(data.report.period); }

  async function refreshDashboard() {
    setRefreshing(true);
    try {
      const [reportResponse, overviewResponse] = await Promise.all([fetch("/api/reports/current", { cache: "no-store" }), fetch("/api/data/overview", { cache: "no-store" })]);
      if (!reportResponse.ok || !overviewResponse.ok) throw new Error("The reporting store could not be refreshed.");
      applyData({ report: await reportResponse.json() as ProgramReport, overview: await overviewResponse.json() as DataOverview });
      setToast("Dashboard refreshed from the local reporting store.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Unable to refresh dashboard data."); } finally { setRefreshing(false); }
  }
  async function recordTouchpoint(input: TouchpointInput) {
    const response = await fetch("/api/data/touchpoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const data = await response.json() as DataResult & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "The touchpoint could not be saved.");
    applyData(data); setModal(false); setToast(`“${input.title}” was saved to the local event, RSVP, and check-in tables.`);
  }
  async function runDemoSync() {
    setDatabaseAction("sync");
    try {
      const response = await fetch("/api/campusgroups/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "demo" }) });
      const data = await response.json() as DataResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The CampusGroups demo sync failed.");
      applyData(data); setToast("Demo sync complete: event, RSVP, check-in rows normalized and upserted.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Unable to run demo sync."); } finally { setDatabaseAction(null); }
  }
  async function resetDatabase() {
    if (!window.confirm("Reset to the original sample tables? Removes touchpoints and demo sync rows you added.")) return;
    setDatabaseAction("reset");
    try {
      const response = await fetch("/api/data/reset", { method: "POST" });
      const data = await response.json() as DataResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The reporting store could not be reset.");
      applyData(data); setToast("Local reporting store reset to its original sample tables.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Unable to reset local data."); } finally { setDatabaseAction(null); }
  }
  function downloadBrief() {
    const pulse = report.weeklyPulse;
    // The three questions answered with the qualitative week alongside the metrics,
    // so the brief says what committees actually did, not only what the totals were.
    const lines = ["LEAD-AI | Leadership Academy report", report.period, "", "WHAT DID WE SAY WE'D ACHIEVE?", ...report.goals.map((goal) => `• ${goal.statement} — target: ${fmtUnit(goal.target, goal.unit)}`), "", "WHAT DID WE ACHIEVE?", ...report.goals.map((goal) => `• ${goal.measure}: ${fmtUnit(goal.actual, goal.unit)}. ${goal.evidence}`),
      ...(pulse ? ["", `COMMITTEE WORK — ${pulse.label.toUpperCase()}`, `• ${pulse.reports} individual check-ins from ${pulse.committeesReporting} of ${pulse.committeesTotal} standing committees`, `• ${pulse.shipped} reports named completed work; ${pulse.atRisk} were stalled or blocked`, `• ${pulse.followThroughRate}% of last week's stated next steps were acted on`, ...(pulse.topTheme ? [`• Work concentrated on ${pulse.topTheme.label.toLowerCase()} (${pulse.topTheme.mentions} mentions)`] : [])] : []),
      "", "WHAT IS IN PLACE TO IMPROVE?", ...report.goals.map((goal) => `• ${goal.action}`), ...(pulse?.topRisk ? [`• ${pulse.topRisk.label}: ${pulse.topRisk.recommendedAction}`] : []),
      ...(pulse ? ["", `Full committee detail: Weekly digest → ${pulse.label}. Individual submissions are retrievable by report ID.`] : [])];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" })); const link = document.createElement("a"); link.href = url; link.download = "lead-ai-report-brief.txt"; link.click(); URL.revokeObjectURL(url); setToast(pulse ? "Report brief downloaded, committee check-in week included." : "Report brief downloaded.");
  }

  return <main className="shell">
    <a className="skip-link" href="#dashboard">Skip to dashboard</a>
    <aside className={menuOpen ? "sidebar open" : "sidebar"} id="primary-nav"><div className="brand"><b>L</b><span>LEAD<i>.</i>AI</span></div><p className="workspace">LEADERSHIP ACADEMY</p><nav aria-label="Primary navigation">{[["Overview", "▦"], ["Weekly digest", "◷"], ["Committee check-ins", "▥"], ["Evidence ledger", "▤"], ["Leadership indicators", "⌁"], ["Campus footprint", "◇"], ["Data settings", "⚙"]].map(([label, icon]) => <button key={label} className={nav === label ? "nav active" : "nav"} aria-current={nav === label ? "page" : undefined} onClick={() => { setNav(label); setMenuOpen(false); }}><Glyph>{icon}</Glyph><span>{label}</span></button>)}</nav><div className="side-footer"><p><Glyph>◈</Glyph><span><strong>Private by design</strong>Aggregate reporting view</span></p><div className="user"><b>DR</b><span><strong>Dashboard owner</strong><small>Admin workspace</small></span><i>•••</i></div></div></aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <section className="content"><header className="topbar"><div className="crumb"><button className="menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen(true)}>☰</button>Leadership Academy <i>/</i> <strong>{nav}</strong></div><div><span className="synced"><i /> {overview.storage === "local-demo" ? "Local demo database" : "In-memory demo database"} · synced {fmtSyncTime(report.lastSyncedAt)}</span><button className="plain" aria-label="Refresh figures" onClick={refreshDashboard} disabled={refreshing}>{refreshing ? "…" : "↻"}</button></div></header>
      <div className="dashboard" id="dashboard">
        {nav === "Data settings" ? <DataSettings overview={overview} busy={databaseAction} onDemoSync={runDemoSync} onReset={resetDatabase} />
        : nav === "Weekly digest" ? <WeeklyDigest canRetrieve={canReadCheckIns} onToast={setToast} onOpenReport={(id) => { setOpenReportId(id); setNav("Committee check-ins"); }} />
        : nav === "Committee check-ins" ? <CheckInLibrary canRetrieve={canReadCheckIns} canSubmit={canWriteCheckIns} onToast={setToast} openId={openReportId} onOpened={() => setOpenReportId(null)} />
        : <>
          <section className="intro"><div><p className="overline">PROGRAM PERFORMANCE</p><h1>Make leadership impact<br /><em>clear, credible, and actionable.</em></h1><p>Evidence layer for 312 activity, leadership learning, campus reach.</p></div><div className="actions"><label><span>Reporting period</span><select value={period} onChange={(event) => { setPeriod(event.target.value); setToast("One active period in the seed. Period filtering is the next query to connect."); }}><option>{report.period}</option><option>Fall 2026 · Full term</option><option>Spring 2027 · Planning</option></select></label><button className="button outline" onClick={downloadBrief}>↓ Export brief</button><button className="button primary" onClick={() => setModal(true)} disabled={!overview.demoActions.write} title={overview.demoActions.write ? undefined : "Demo writes are disabled on this deployment. Set LEAD_ALLOW_DEMO_WRITES to enable them."}>＋ Record touchpoint</button></div></section>
          <section className="stats" aria-label="Program indicators"><Metric accent="red" label="Attendance rate" value={`${report.headline.attendanceRate}%`} trend={`${report.events.length} touchpoints`} text="Check-ins ÷ RSVPs across tracked touchpoints" visual="bars" /><Metric accent="amber" label="Learning validation" value={`${report.headline.badgeCompletion}%`} trend="Cohort signal" text="Fellows completing Leadership Foundations" visual="progress" fill={report.headline.badgeCompletion} /><Metric accent="slate" label="Campus leadership" value={`${report.headline.crossCampusOfficers}`} trend="Verified roles" text="Fellows serving as verified officers elsewhere" visual="people" /><Metric accent="green" label="Evidence hygiene" value={`${report.ordinance.complete}/${report.ordinance.total}`} trend={`${report.ordinance.missing.length} gaps`} tone={report.ordinance.missing.length ? "watch" : "good"} text="Touchpoints meeting the data ordinance" visual="progress" fill={ordinanceRate} /></section>
          {report.weeklyPulse && <PulseBand pulse={report.weeklyPulse} onOpen={() => setNav("Weekly digest")} />}
          <section className="report-card"><header><div><p className="overline">STANDARD REPORT</p><h2>The three questions every report answers.</h2></div><button className="link" onClick={() => setToast("This is the recommended administrative reporting standard for every cycle.")}>Reporting standard →</button></header><div className="questions"><Question number="01" title="What did we say we’d achieve?" text="Target, period, owner. Stated before delivery." foot={`${report.goals.length} defined outcomes`} /><Question number="02" title="What did we achieve?" text="Attendance, completion, feedback, reach. Joined as auditable evidence." foot={`${overview.tables.filter((table) => table.count > 0).length} source tables populated`} /><Question number="03" title="What is in place to improve?" text="Owner, next action, check date. One set per variance." foot={`${report.goals.length} improvement actions`} /></div></section>
          <div className="grid"><section className="panel outcome"><PanelHead eyebrow="OUTCOME EVIDENCE" title="Goals, results, next moves" action={period} /><div className="goals">{report.goals.map((goal) => { const good = goal.actual >= goal.target; return <article key={goal.id} className="goal"><b className={good ? "check good" : "check watch"} aria-hidden="true">{good ? "✓" : "!"}</b><div><header><h3>{goal.measure}</h3><span className={good ? "tag good" : "tag watch"}>{good ? "On track" : "Needs attention"}</span></header><p>{goal.statement}</p><small><strong>{fmtUnit(goal.actual, goal.unit)}</strong> actual <i /> <em>target {fmtUnit(goal.target, goal.unit)}</em><span>{goal.evidence}</span></small></div><button className="row-action" onClick={() => setToast(goal.action)} aria-label={`View next action for ${goal.measure}`}>→</button></article>; })}</div></section><section className="panel indicators"><PanelHead eyebrow="LEADERSHIP INDICATORS" title="Growth signals, not rankings" action="Methodology" onAction={() => setToast(report.leadership.note)} /><div className="engagement"><Ring value={report.leadership.engagement} /><div><strong>Engagement</strong><p>Scheduled learning, community touchpoints.</p></div></div><div className="scales"><Scale label="Application" detail="Initiatives advanced" value={report.leadership.application} /><Scale label="Reflection" detail="Impact reflection filed" value={report.leadership.reflection} /></div><div className="ethics">◈ <span>{report.leadership.note}</span></div></section></div>
          <div className="grid lower"><section className="panel activity"><PanelHead eyebrow="TRIANGULATION LEDGER" title="Every meeting leaves evidence." action="Record evidence →" onAction={() => setModal(true)} /><div className="ordinance"><strong>{report.ordinance.complete} of {report.ordinance.total}</strong><span>Touchpoints include event, attendance, and outcome data.</span></div><div>{events.map((event) => <article key={event.id} className="event"><time><b>{fmtDate(event.date).split(" ")[1]}</b><span>{fmtDate(event.date).split(" ")[0]}</span></time><div><h3>{event.title}</h3><p>{event.type} <i /> {event.owner}</p></div><strong className="checkin">{event.checkins}<small>checked in</small></strong><span className={event.hasAgenda && event.hasOutcome ? "tag good" : "tag watch"}>{event.hasAgenda && event.hasOutcome ? "Complete" : "Needs follow-up"}</span></article>)}</div></section><section className="panel footprint"><PanelHead eyebrow="CAMPUS FOOTPRINT" title="Leadership in context" action={`${report.footprint.campusAreas} areas`} /><div className="map" role="img" aria-label={`Leadership Academy cohort connected to ${report.footprint.campusAreas} campus areas: academic, career, student life, and community.`}><i className="orbit one" /><i className="orbit two" /><b className="center">LA<small>cohort</small></b><span className="node academic">Academic</span><span className="node career">Career</span><span className="node life">Student life</span><span className="node community">Community</span></div><div className="foot-stats"><Stat value={report.footprint.internal} label="internal activations" /><Stat value={report.footprint.external} label="community engagements" /><Stat value={report.footprint.partnerships} label="active partners" /></div></section></div>
          <footer className="data-note"><p>◈ <span><strong>Data boundary:</strong> Program-level evidence only. Raw student records stay in the approved store, exposed by role and need.</span></p><div>{report.sourceStatus.slice(0, 5).map((source) => <span key={source.source} className={source.state}>{source.state === "connected" ? "●" : "○"} {source.source}</span>)}</div></footer>
        </>}
      </div>
    </section>
    {modal && <TouchpointModal onClose={() => setModal(false)} onSave={recordTouchpoint} />}
    {toast && <div className="toast" role="status"><span>{toast}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification">×</button></div>}
  </main>;
}

function DataSettings({ overview, busy, onDemoSync, onReset }: { overview: DataOverview; busy: "sync" | "reset" | null; onDemoSync: () => void; onReset: () => void }) {
  return <section className="data-settings" aria-labelledby="data-settings-title"><header className="settings-intro"><div><p className="overline">INTEGRATION WORKBENCH</p><h1 id="data-settings-title">A realistic path from export to evidence.</h1><p>{overview.storage === "local-demo" ? "Persistent local JSON store, emulating approved reporting tables. Saves on this machine, refreshes immediately, resets safely." : "In-memory reporting tables. Writes refresh immediately, do not survive a cold start. Connect an approved database before treating them as evidence."}</p></div><div className="settings-actions"><button className="button primary" onClick={onDemoSync} disabled={busy !== null || !overview.demoActions.sync} title={overview.demoActions.sync ? undefined : "The public sync route is closed on deployments. Use the admin console at /admin."}>{busy === "sync" ? "Syncing…" : "Run demo sync"}</button><button className="button outline" onClick={onReset} disabled={busy !== null || !overview.demoActions.reset} title={overview.demoActions.reset ? undefined : "Demo reset is disabled on this deployment. Set LEAD_ALLOW_DEMO_RESET to enable it."}>{busy === "reset" ? "Resetting…" : "Reset sample tables"}</button></div></header>{!overview.demoActions.sync && <p className="admin-message" role="status">Sync is closed on deployments. Sign in at <a href="/admin">/admin</a> to run a sync, or let the scheduled cron run it.</p>}<div className="pipeline" aria-label="CampusGroups data workflow"><span>CampusGroups export</span><i>→</i><span>Normalize + upsert</span><i>→</i><span>{overview.storage === "local-demo" ? "Local reporting tables" : "In-memory reporting tables"}</span><i>→</i><span>Aggregate dashboard</span></div><div className="settings-grid"><section className="panel table-panel"><PanelHead eyebrow="REPORTING TABLES" title="What the dashboard reads" action={`${overview.tables.reduce((sum, table) => sum + table.count, 0)} stored rows`} /><div className="table-list">{overview.tables.map((table) => <article key={table.name}><div><strong>{table.label}</strong><p>{table.description}</p></div><b>{table.count}</b></article>)}</div></section><section className="panel sync-panel"><PanelHead eyebrow="SYNC ACTIVITY" title="Recent table writes" action={overview.storage === "local-demo" ? "Local demo" : "Ephemeral demo"} /><p>Documented sequence: date-bounded export request, query retrieval, upsert by external ID.</p><ol>{overview.syncRuns.map((run) => <li key={run.id}><i className={run.source === "manual" ? "manual" : "synced-dot"} /><div><strong>{run.resource}</strong><span>{run.source.replace("-", " ")} · {run.received} rows</span></div><time>{fmtSyncTime(run.completedAt)}</time></li>)}</ol></section></div><section className="implementation-note"><div><strong>Swap-in point for production</strong><p>Swap the local repository for your database adapter. Dashboard and report endpoint consume aggregate contracts only, no raw CampusGroups access.</p></div><code>POST /api/campusgroups/sync → normalize → upsert → GET /api/reports/current</code></section></section>;
}

/**
 * The qualitative week beside the quantitative metrics. Figures are labelled
 * counts rather than a chart: at a handful of reports a week, a distribution
 * plot would add colour without adding information.
 */
function PulseBand({ pulse, onOpen }: { pulse: NonNullable<ProgramReport["weeklyPulse"]>; onOpen: () => void }) {
  return <section className="pulse-band" aria-label="Committee check-in week">
    <div className="pulse-head"><p className="overline">COMMITTEE CHECK-INS</p><strong>{pulse.label}</strong></div>
    <dl className="pulse-figures">
      <div><dt>Check-ins</dt><dd>{pulse.reports}</dd></div>
      <div><dt>Committees reporting</dt><dd>{pulse.committeesReporting}<small>/{pulse.committeesTotal}</small></dd></div>
      <div><dt>Named completed work</dt><dd>{pulse.shipped}</dd></div>
      <div><dt>Stalled or blocked</dt><dd className={pulse.atRisk > 0 ? "watch-text" : undefined}>{pulse.atRisk}</dd></div>
      <div><dt>Follow-through</dt><dd>{pulse.followThroughRate}<small>%</small></dd></div>
    </dl>
    {pulse.topRisk
      ? <p className="pulse-risk"><strong>Top risk — {pulse.topRisk.label}:</strong> {pulse.topRisk.recommendedAction}</p>
      : <p className="pulse-risk"><strong>No blocker declared this week.</strong> Digest lists the follow-up prompts anyway.</p>}
    <button className="button outline" onClick={onOpen}>Open weekly digest →</button>
  </section>;
}

function Metric({ accent, label, value, trend, tone = "good", text, visual, fill = 0 }: { accent: string; label: string; value: string; trend: string; tone?: "good" | "watch"; text: string; visual: "bars" | "progress" | "people"; fill?: number }) { return <article className={`metric ${accent}`}><header><span>{label}</span><b className={tone}>{trend}</b></header><strong>{value}</strong><p>{text}</p>{visual === "bars" && <div className="bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}{visual === "progress" && <div className="mini-progress" aria-hidden="true"><i style={{ width: `${fill}%` }} /></div>}{visual === "people" && <div className="people" aria-hidden="true">● ● ● ● ● <small>across approved orgs</small></div>}</article>; }
function Question({ number, title, text, foot }: { number: string; title: string; text: string; foot: string }) { return <article><b>{number}</b><h3>{title}</h3><p>{text}</p><small>{foot}</small></article>; }
function PanelHead({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction?: () => void }) { return <header className="panel-head"><div><p className="overline">{eyebrow}</p><h2>{title}</h2></div>{onAction ? <button className="link" onClick={onAction}>{action}</button> : <span className="panel-action">{action}</span>}</header>; }
function Scale({ label, detail, value }: { label: string; detail: string; value: number }) { return <div className="scale"><span><b>{label}</b><small>{detail}</small></span><strong>{value}%</strong><i><em style={{ width: `${value}%` }} /></i></div>; }
function Stat({ value, label }: { value: number; label: string }) { return <div><strong>{value}</strong><small>{label}</small></div>; }

function TouchpointModal({ onClose, onSave }: { onClose: () => void; onSave: (input: TouchpointInput) => Promise<void> }) {
  const [title, setTitle] = useState(""); const [date, setDate] = useState("2026-09-10"); const [type, setType] = useState<EventRecord["type"]>("Leadership lab"); const [campusArea, setCampusArea] = useState<EventRecord["campusArea"]>("Academic"); const [owner, setOwner] = useState("Leadership Academy"); const [expected, setExpected] = useState("30"); const [rsvps, setRsvps] = useState("25"); const [checkins, setCheckins] = useState("22"); const [hasAgenda, setHasAgenda] = useState(true); const [hasOutcome, setHasOutcome] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const counts = { expected: Number(expected), rsvps: Number(rsvps), checkins: Number(checkins) }; const valid = title.trim().length > 2 && owner.trim().length > 1 && Object.values(counts).every((count) => Number.isInteger(count) && count >= 0) && counts.rsvps <= counts.expected && counts.checkins <= counts.rsvps;
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose, saving]);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!valid) return; setSaving(true); setError(null); try { await onSave({ title: title.trim(), date, type, campusArea, owner: owner.trim(), ...counts, hasAgenda, hasOutcome }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save this touchpoint."); setSaving(false); } }
  return <div className="modal-backdrop" onMouseDown={() => !saving && onClose()}><section className="modal touchpoint-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close" disabled={saving}>×</button><p className="overline">DATA ORDINANCE</p><h2 id="modal-title">Record a touchpoint</h2><p>Writes one event row, linked RSVPs, linked check-ins.</p><form onSubmit={submit}><label>Touchpoint title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g., Cohort Council Meeting" /></label><div className="form-grid"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Accountable owner<input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label>Touchpoint type<select value={type} onChange={(event) => setType(event.target.value as EventRecord["type"])}>{["Leadership lab", "Community meeting", "Campus partnership", "Off-campus engagement"].map((option) => <option key={option}>{option}</option>)}</select></label><label>Campus area<select value={campusArea} onChange={(event) => setCampusArea(event.target.value as EventRecord["campusArea"])}>{["Academic", "Student life", "Career", "Community"].map((option) => <option key={option}>{option}</option>)}</select></label><label>Expected capacity<input min="0" type="number" value={expected} onChange={(event) => setExpected(event.target.value)} /></label><label>RSVPs<input min="0" type="number" value={rsvps} onChange={(event) => setRsvps(event.target.value)} /></label><label>Check-ins<input min="0" type="number" value={checkins} onChange={(event) => setCheckins(event.target.value)} /></label></div><div className="checks"><label><input type="checkbox" checked={hasAgenda} onChange={(event) => setHasAgenda(event.target.checked)} /> Agenda or intent attached</label><label><input type="checkbox" checked={hasOutcome} onChange={(event) => setHasOutcome(event.target.checked)} /> Outcome reflection attached</label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={!valid || saving}>{saving ? "Saving to tables…" : "Save touchpoint →"}</button></form></section></div>;
}
