"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/request-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send a verification code.");
      setStep("code"); setMessage(data.message ?? "Check your inbox for a verification code.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send a verification code."); } finally { setBusy(false); }
  }
  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to verify the code.");
      router.replace("/admin");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to verify the code."); } finally { setBusy(false); }
  }

  return <main className="admin-shell"><section className="admin-card sign-in-card"><div className="admin-brand"><b>L</b><span>LEAD<i>.</i>AI</span></div><p className="overline">RESTRICTED WORKSPACE</p><h1>Admin access</h1><p className="admin-copy">Enter an approved email address. We’ll send a one-time code through the configured Gmail account.</p>{step === "email" ? <form onSubmit={requestCode}><label>Admin email<input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@iit.edu" /></label><button className="button primary" disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button></form> : <form onSubmit={verifyCode}><label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" autoFocus required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label><button className="button primary" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button><button className="text-button" type="button" disabled={busy} onClick={() => { setStep("email"); setCode(""); setMessage(null); }}>Use a different email</button></form>}{message && <p className="admin-message" role="status">{message}</p>}<small>Codes expire after 10 minutes. Access is limited to emails configured by the LEAD-AI administrator.</small></section></main>;
}
