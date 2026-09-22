import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { sendAdminOtpEmail } from "@/lib/lead/gmail";

const directory = join(process.cwd(), ".lead-ai");
const challengePath = join(directory, "admin-otp-challenges.json");
const cookieName = "lead_admin_session";
const challengeLifetimeMs = 10 * 60 * 1000;
const sessionLifetimeSeconds = 8 * 60 * 60;

type Challenge = { digest: string; expiresAt: number; attempts: number; lastSentAt: number };
type ChallengeStore = Record<string, Challenge>;
type AdminSession = { email: string; expiresAt: number };

function normalizedEmail(value: string) { return value.trim().toLowerCase(); }
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("ADMIN_SESSION_SECRET must be configured in production.");
  return "local-development-only-admin-secret";
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
function digest(email: string, code: string) { return sign(`otp:${email}:${code}`); }

async function readChallenges(): Promise<ChallengeStore> {
  try { return JSON.parse(await readFile(challengePath, "utf8")) as ChallengeStore; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
async function saveChallenges(store: ChallengeStore) { await mkdir(directory, { recursive: true }); await writeFile(challengePath, JSON.stringify(store), "utf8"); }

export function isConfiguredAdmin(email: string) {
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(normalizedEmail).filter(Boolean);
  return allowed.includes(normalizedEmail(email));
}

export async function issueAdminOtp(email: string) {
  const normalized = normalizedEmail(email);
  if (!isConfiguredAdmin(normalized)) return { sent: false, reason: "not-authorized" as const };
  const challenges = await readChallenges();
  const prior = challenges[normalized];
  if (prior && Date.now() - prior.lastSentAt < 60_000) return { sent: false, reason: "rate-limited" as const };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  challenges[normalized] = { digest: digest(normalized, code), expiresAt: Date.now() + challengeLifetimeMs, attempts: 0, lastSentAt: Date.now() };
  await saveChallenges(challenges);
  await sendAdminOtpEmail(normalized, code);
  return { sent: true, reason: "sent" as const };
}

export async function verifyAdminOtp(email: string, code: string) {
  const normalized = normalizedEmail(email);
  const challenges = await readChallenges();
  const challenge = challenges[normalized];
  if (!isConfiguredAdmin(normalized) || !challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) return false;
  const actual = Buffer.from(challenge.digest);
  const expected = Buffer.from(digest(normalized, code));
  const matches = actual.length === expected.length && timingSafeEqual(actual, expected);
  if (!matches) { challenge.attempts += 1; await saveChallenges(challenges); return false; }
  delete challenges[normalized];
  await saveChallenges(challenges);
  return true;
}

export function createAdminSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail(email), expiresAt: Date.now() + sessionLifetimeSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(`session:${payload}`)}`;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = (await cookies()).get(cookieName)?.value;
  if (!session) return null;
  const [payload, signature] = session.split(".");
  if (!payload || !signature) return null;
  const expected = sign(`session:${payload}`);
  const actualBytes = Buffer.from(signature); const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    return parsed.expiresAt > Date.now() && isConfiguredAdmin(parsed.email) ? parsed : null;
  } catch { return null; }
}

export const adminSessionCookie = { name: cookieName, options: { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionLifetimeSeconds } };
