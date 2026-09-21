"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncResources, type AdminSyncSettings, type SyncCadence, type SyncResource } from "@/lib/lead/types";

const resourceLabels: Record<SyncResource, string> = { events: "Events", rsvp: "RSVPs", checkins: "Check-ins", members: "Members", badge_completions: "Badge completions" };
const cadenceLabels: Record<SyncCadence, string> = { hourly: "Every hour", every_6_hours: "Every 6 hours", daily: "Daily", weekdays: "Weekdays" };

export function AdminConsole({ email, initialSettings }: { email: string; initialSettings: AdminSyncSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const requiresHour = settings.cadence !== "hourly";

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await response.json() as { settings?: AdminSyncSettings; error?: string };
      if (!response.ok || !data.settings) throw new Error(data.error ?? "Unable to save schedule settings.");
      setSettings(data.settings); setMessage("Schedule settings saved. Vercel will evaluate them on its next hourly invocation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save schedule settings."); } finally { setSaving(false); }
  }
  async function runNow() {
    setRunning(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/sync", { method: "POST" });
      const data = await response.json() as { received?: number; resources?: SyncResource[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Sync could not be started.");
      setMessage(`Sync completed: ${data.received ?? 0} rows received across ${(data.resources ?? []).join(", ")}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sync could not be started."); } finally { setRunning(false); }
  }
  async function signOut() { await fetch("/api/admin/logout", { method: "POST" }); router.replace("/admin"); router.refresh(); }
  function toggleResource(resource: SyncResource) { setSettings((current) => ({ ...current, resources: current.resources.includes(resource) ? current.resources.filter((item) => item !== resource) : [...current.resources, resource] })); }

  return <main className="admin-shell"><section className="admin-console"><header className="admin-topbar"><div><div className="admin-brand"><b>L</b><span>LEAD<i>.</i>AI</span></div><p>Admin workspace · {email}</p></div><button className="button outline" onClick={signOut}>Sign out</button></header><div className="admin-heading"><div><p className="overline">SCHEDULED DATA OPERATIONS</p><h1>CampusGroups sync control</h1><p>Configure the sync run, execute it immediately, or let Vercel Cron run it when the saved cadence is due. Hobby projects get one call per day, within the scheduled hour.</p></div><button className="button primary" onClick={runNow} disabled={running}>{running ? "Running sync…" : "Run sync now"}</button></div><div className="admin-grid"><form className="admin-card schedule-form" onSubmit={saveSettings}><header><p className="overline">RUN CONFIGURATION</p><h2>Schedule and sources</h2></header><label className="switch-row"><span><strong>Scheduled sync</strong><small>Vercel evaluates this on the schedule in vercel.json.</small></span><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /></label><div className="admin-fields"><label>Data mode<select value={settings.mode} onChange={(event) => setSettings({ ...settings, mode: event.target.value as AdminSyncSettings["mode"] })}><option value="live">Live CampusGroups export</option><option value="demo">Demo export batch</option></select></label><label>Cadence<select value={settings.cadence} onChange={(event) => setSettings({ ...settings, cadence: event.target.value as SyncCadence })}>{Object.entries(cadenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{requiresHour && <label>UTC start hour<select value={settings.startHourUtc} onChange={(event) => setSettings({ ...settings, startHourUtc: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00 UTC</option>)}</select></label>}<label>Lookback window<select value={settings.lookbackDays} onChange={(event) => setSettings({ ...settings, lookbackDays: Number(event.target.value) })}>{[1, 3, 7, 14, 30].map((days) => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"}</option>)}</select></label></div><fieldset><legend>Export resources</legend>{syncResources.map((resource) => <label key={resource} className="resource-option"><input type="checkbox" checked={settings.resources.includes(resource)} onChange={() => toggleResource(resource)} /> {resourceLabels[resource]}</label>)}</fieldset><button className="button primary" disabled={saving || settings.resources.length === 0}>{saving ? "Saving…" : "Save sync configuration"}</button></form><aside className="admin-card admin-guide"><p className="overline">VERCEL CRON</p><h2>How scheduled runs work</h2><ol><li>Vercel calls the protected cron endpoint on the schedule set in vercel.json.</li><li>The endpoint checks your saved cadence, UTC hour, enabled state, and configured sources.</li><li>When due, it uses the same normalized import path as “Run sync now.”</li></ol><div><strong>Before enabling live sync</strong><p>Add CampusGroups credentials, a cron secret, Gmail app credentials, a session secret, and your allowed admin email(s) to Vercel.</p></div></aside></div>{message && <p className="admin-message console-message" role="status">{message}</p>}<footer className="admin-footer">Local demo persistence is for development only. Use an approved database before relying on Vercel serverless syncs in production.</footer></section></main>;
}
