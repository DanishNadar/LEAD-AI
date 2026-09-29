"use client";

import { useCallback, useEffect, useState } from "react";
import type { Momentum, WeekIndexEntry, WeeklyReport } from "@/lib/lead/types";

/* ==========================================================================
   Weekly digest.

   Forms follow the data's job rather than decoration: headline counts are stat
   tiles, the one ratio against a limit (follow-through) is a single-hue meter,
   and the five momentum states are labelled counts, not a five-colour stacked
   bar - at five reports a week a distribution bar would be noise, and its two
   neutral segments fail colour-blind separation. Status colour never carries
   meaning alone; every state ships with a glyph and a written label.
   ========================================================================== */

type Tone = "good" | "neutral" | "watch" | "alert";

const MOMENTUM: { key: Momentum; label: string; glyph: string; tone: Tone; note: string }[] = [
  { key: "shipped", label: "Shipped", glyph: "✓", tone: "good", note: "named a completed item" },
  { key: "advancing", label: "Advancing", glyph: "→", tone: "neutral", note: "work in flight" },
  { key: "planning", label: "Planning", glyph: "◦", tone: "neutral", note: "intent without output" },
  { key: "stalled", label: "Stalled", glyph: "‒", tone: "watch", note: "no movement reported" },
  { key: "blocked", label: "Blocked", glyph: "!", tone: "alert", note: "stopped by a blocker" },
];

const SEVERITY_TONE: Record<"high" | "medium" | "low", Tone> = { high: "alert", medium: "watch", low: "neutral" };
const STATUS_TONE: Record<"kept" | "restated" | "dropped", Tone> = { kept: "good", restated: "watch", dropped: "alert" };
const STATUS_GLYPH: Record<"kept" | "restated" | "dropped", string> = { kept: "✓", restated: "↻", dropped: "✕" };

const fmtWeekShort = (weekOf: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${weekOf}T12:00:00Z`));

/** A single ratio against a limit: one hue, more-is-darker track. */
function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="meter">
    <span><b>{label}</b><small>{detail}</small></span>
    <strong>{value}%</strong>
    <i role="img" aria-label={`${label}: ${value} percent`}><em style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>
  </div>;
}

function Tile({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: Tone }) {
  return <article className={`tile tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

// Tones are namespaced: bare `.good`/`.watch` are existing global tag utilities.
function Pill({ tone, glyph, children }: { tone: Tone; glyph: string; children: React.ReactNode }) {
  return <span className={`pill tone-${tone}`}><i aria-hidden="true">{glyph}</i>{children}</span>;
}

/** Enum values arrive lower-cased from the data; sentence-case them for display. */
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function WeeklyDigest({ canRetrieve, onToast, onOpenReport }: { canRetrieve: boolean; onToast: (message: string) => void; onOpenReport: (id: string) => void }) {
  const [weeks, setWeeks] = useState<WeekIndexEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [audience, setAudience] = useState<"internal" | "showcase">("internal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The no-access branch renders before `loading` is read, so it needs no state change here.
    if (!canRetrieve) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/reports/weekly", { cache: "no-store" });
        const data = await response.json() as { weeks: WeekIndexEntry[]; latest: WeeklyReport | null; error?: string };
        if (!response.ok) throw new Error(data.error ?? "The weekly roll-up could not be loaded.");
        if (!active) return;
        setWeeks(data.weeks);
        setWeekly(data.latest);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The weekly roll-up could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [canRetrieve]);

  const selectWeek = useCallback(async (weekOf: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/weekly/${weekOf}`, { cache: "no-store" });
      const data = await response.json() as WeeklyReport & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That week could not be loaded.");
      setWeekly(data);
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : "That week could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  async function download(kind: "internal" | "showcase") {
    if (!weekly) return;
    try {
      const response = await fetch(`/api/reports/weekly/${weekly.weekOf}/brief?audience=${kind}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The brief could not be generated.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `lead-ai-${kind}-brief-${weekly.weekOf}.md`;
      link.click();
      URL.revokeObjectURL(url);
      onToast(kind === "internal" ? "Internal brief downloaded: risks, follow-through, report IDs." : "Showcase brief downloaded: achievements, reach. No blockers.");
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : "The brief could not be generated.");
    }
  }

  if (!canRetrieve) {
    return <section className="digest"><p className="admin-message" role="status">Check-ins name individual scholars. Sign in at <a href="/admin">/admin</a> to read the roll-up.</p></section>;
  }
  if (loading && !weekly) return <section className="digest"><p className="empty-note">Loading the weekly roll-up…</p></section>;
  if (error) return <section className="digest"><p className="admin-message" role="alert">{error}</p></section>;
  if (!weekly) return <section className="digest"><p className="empty-note">No check-ins submitted yet. Record one from <strong>Committee check-ins</strong>.</p></section>;

  const { participation, momentum, followThrough, evidence } = weekly;
  const narrative = audience === "internal" ? weekly.narrative.internal : weekly.narrative.showcase;

  return <section className="digest" aria-labelledby="digest-title">
    <header className="settings-intro">
      <div>
        <p className="overline">WEEKLY COMMITTEE REPORT</p>
        <h1 id="digest-title">{weekly.label}</h1>
        <p>Read from {participation.reports} individual check-in{participation.reports === 1 ? "" : "s"}. Every figure cites the report IDs behind it.</p>
      </div>
      <div className="settings-actions">
        <label className="week-picker"><span>Reporting week</span>
          <select value={weekly.weekOf} onChange={(event) => selectWeek(event.target.value)} disabled={loading}>
            {weeks.map((week) => <option key={week.weekOf} value={week.weekOf}>{week.label} · {week.reports} reports</option>)}
          </select>
        </label>
        <button className="button outline" onClick={() => download("internal")}>↓ Internal brief</button>
        <button className="button primary" onClick={() => download("showcase")}>↓ Showcase brief</button>
      </div>
    </header>

    <div className="tiles" aria-label="Week at a glance">
      <Tile label="Check-ins filed" value={`${participation.reports}`} detail={`${participation.scholars} scholar${participation.scholars === 1 ? "" : "s"} reporting`} />
      <Tile label="Committees reporting" value={`${participation.committeesReporting.length}/${participation.committeesReporting.length + participation.committeesSilent.length}`} detail={participation.committeesSilent.length === 0 ? "Every standing committee" : `Silent: ${participation.committeesSilent.map((entry) => entry.committee).join(", ")}`} tone={participation.committeesSilent.length === 0 ? "good" : "watch"} />
      <Tile label="Completed items named" value={`${weekly.delivered.length}`} detail={`Across ${new Set(weekly.delivered.map((item) => item.committee)).size} committee${new Set(weekly.delivered.map((item) => item.committee)).size === 1 ? "" : "s"}`} tone={weekly.delivered.length > 0 ? "good" : "watch"} />
      <Tile label="Open risks" value={`${weekly.risks.length}`} detail={weekly.risks.length === 0 ? "None reported this week" : `${weekly.risks.filter((risk) => risk.severity === "high").length} at high severity`} tone={weekly.risks.some((risk) => risk.severity === "high") ? "alert" : weekly.risks.length > 0 ? "watch" : "good"} />
    </div>

    <section className="panel narrative-panel">
      <header className="panel-head">
        <div><p className="overline">{audience === "internal" ? "INTERNAL READ" : "SHOWCASE READ"}</p><h2>What the week says</h2></div>
        <div className="audience-toggle" role="group" aria-label="Report audience">
          <button className={audience === "internal" ? "active" : ""} aria-pressed={audience === "internal"} onClick={() => setAudience("internal")}>Internal</button>
          <button className={audience === "showcase" ? "active" : ""} aria-pressed={audience === "showcase"} onClick={() => setAudience("showcase")}>Showcase</button>
        </div>
      </header>
      {narrative.map((paragraph, index) => <p key={index} className="prose">{paragraph}</p>)}
      <p className="audience-note">{audience === "internal" ? "◈ Internal: silent committees, blockers, missing commitments." : "◈ Showcase: achievements, quotes, reach. No blockers, no critical attribution."}</p>
    </section>

    <div className="grid">
      <section className="panel">
        <header className="panel-head"><div><p className="overline">MOMENTUM</p><h2>Where each report sits</h2></div><span className="panel-action">{participation.reports} reports</span></header>
        <ul className="state-list">
          {MOMENTUM.map((state) => <li key={state.key} className={momentum[state.key] === 0 ? "muted" : undefined}>
            <Pill tone={state.tone} glyph={state.glyph}>{state.label}</Pill>
            <small>{state.note}</small>
            <strong>{momentum[state.key]}</strong>
          </li>)}
        </ul>
        <div className="meters">
          <Meter label="Follow-through" value={followThrough.rate} detail={`${followThrough.kept} kept · ${followThrough.restated} restated · ${followThrough.dropped} dropped`} />
          <Meter label="Average specificity" value={evidence.averageSpecificity} detail="Named artifacts, counts, dates, and links per report" />
        </div>
      </section>

      <section className="panel">
        <header className="panel-head"><div><p className="overline">RISKS AND THE MOVE THAT CLEARS THEM</p><h2>Practical, not just flagged</h2></div><span className="panel-action">{weekly.risks.length}</span></header>
        {weekly.risks.length === 0
          ? <p className="empty-note">No blocker declared this week. Follow-up prompts below.</p>
          : <div className="risk-list">{weekly.risks.map((risk) => <article key={risk.kind} className="risk">
              <header><Pill tone={SEVERITY_TONE[risk.severity]} glyph={risk.severity === "high" ? "!" : risk.severity === "medium" ? "▲" : "◦"}>{title(risk.severity)}</Pill><h3>{risk.label}</h3><span className="risk-where">{risk.committees.join(", ")}</span></header>
              {risk.quotes.slice(0, 2).map((quote) => <blockquote key={quote.reportId}>“{quote.quote}”<cite><button className="link-inline" onClick={() => onOpenReport(quote.reportId)}>{quote.scholarName} · {quote.reportId}</button></cite></blockquote>)}
              <p className="risk-action"><strong>Do this:</strong> {risk.recommendedAction}</p>
            </article>)}</div>}
      </section>
    </div>

    <div className="grid lower">
      <section className="panel">
        <header className="panel-head"><div><p className="overline">FOLLOW-THROUGH</p><h2>Did last week&rsquo;s next steps happen?</h2></div><span className="panel-action">{followThrough.rate}% acted on</span></header>
        {weekly.carryOver.length === 0
          ? <p className="empty-note">No commitments recorded for the prior week.</p>
          : <ul className="carry-list">{weekly.carryOver.map((entry, index) => <li key={`${entry.reportId}-${index}`}>
              <Pill tone={STATUS_TONE[entry.status]} glyph={STATUS_GLYPH[entry.status]}>{title(entry.status)}</Pill>
              <div><strong>{entry.commitment}</strong><small>{entry.committee} · {entry.scholarName} · stated {fmtWeekShort(entry.fromWeek)}</small>{entry.evidence && <em>“{entry.evidence}”</em>}</div>
              <button className="row-action" onClick={() => onOpenReport(entry.reportId)} aria-label={`Open report ${entry.reportId}`}>→</button>
            </li>)}</ul>}
      </section>

      <section className="panel">
        <header className="panel-head"><div><p className="overline">PROJECT THREADS</p><h2>One project, followed across weeks</h2></div><span className="panel-action">{weekly.projects.length}</span></header>
        <ul className="thread-list">{weekly.projects.map((thread) => <li key={thread.key}>
          <div><strong>{thread.title}</strong><small>{thread.committees.join(", ")} · {thread.contributors.join(", ")} · {thread.weeks.length} week{thread.weeks.length === 1 ? "" : "s"} tracked</small></div>
          <Pill tone={thread.weeksSinceDelivery >= 2 ? "watch" : "good"} glyph={thread.weeksSinceDelivery >= 2 ? "‒" : "✓"}>{thread.weeksSinceDelivery === 0 ? "delivered this week" : `${thread.weeksSinceDelivery}w since delivery`}</Pill>
        </li>)}</ul>
      </section>
    </div>

    <div className="grid lower">
      <section className="panel">
        <header className="panel-head"><div><p className="overline">HIGHLIGHTS</p><h2>Report-worthy, in their own words</h2></div><span className="panel-action">Quoted verbatim</span></header>
        <div className="highlight-list">{weekly.highlights.map((highlight) => <blockquote key={highlight.reportId}>
          “{highlight.quote}”
          <cite><button className="link-inline" onClick={() => onOpenReport(highlight.reportId)}>{highlight.scholarName} · {highlight.committee}</button><small>Chosen because: {highlight.reason}</small></cite>
        </blockquote>)}</div>
      </section>

      <section className="panel">
        <header className="panel-head"><div><p className="overline">THEMES AND CROSSOVER</p><h2>Where the work concentrated</h2></div><span className="panel-action">{weekly.themes.length} themes</span></header>
        <ul className="theme-list">{weekly.themes.map((theme) => <li key={theme.label}>
          <span><b>{theme.label}</b><small>{theme.committees.join(", ")}</small></span>
          <strong>{theme.mentions}</strong>
          {theme.tone === "watch" && <Pill tone="watch" glyph="▲">watch</Pill>}
        </li>)}</ul>
        {weekly.collaboration.length > 0 && <div className="crossover"><p className="overline">CROSS-COMMITTEE</p>{weekly.collaboration.map((edge) => <p key={edge.committees.join("-")}><strong>{edge.committees.join(" × ")}</strong> {edge.basis}</p>)}</div>}
      </section>
    </div>

    {weekly.followUps.length > 0 && <section className="panel">
      <header className="panel-head"><div><p className="overline">FOLLOW-UP PROMPTS FOR CHAIRS</p><h2>Ask these before next week</h2></div><span className="panel-action">{weekly.followUps.length}</span></header>
      <ul className="followup-list">{weekly.followUps.map((entry, index) => <li key={`${entry.reportId}-${index}`}>
        <div><strong>{entry.committee} · {entry.scholarName}</strong><small>{entry.note}</small></div>
        <button className="row-action" onClick={() => onOpenReport(entry.reportId)} aria-label={`Open report ${entry.reportId}`}>→</button>
      </li>)}</ul>
    </section>}

    <footer className="data-note">
      <p>◈ <span><strong>Evidence:</strong> {evidence.reportIds.length} individual report{evidence.reportIds.length === 1 ? "" : "s"}, {evidence.documentLinks} shared document{evidence.documentLinks === 1 ? "" : "s"}, {evidence.attachments} uploaded file{evidence.attachments === 1 ? "" : "s"}, {participation.meetingsHeld} committee meeting{participation.meetingsHeld === 1 ? "" : "s"} evidenced.</span></p>
      <div>{evidence.reportIds.map((id) => <button key={id} className="id-chip" onClick={() => onOpenReport(id)}>{id}</button>)}</div>
    </footer>
  </section>;
}
