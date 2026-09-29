import { NextRequest, NextResponse } from "next/server";
import { issueAdminOtp } from "@/lib/lead/admin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: unknown };
    if (typeof body.email !== "string" || !/^\S+@\S+\.\S+$/.test(body.email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const result = await issueAdminOtp(body.email);
    // Never disclose whether an address is in ADMIN_EMAILS.
    if (result.reason === "rate-limited") return NextResponse.json({ ok: true, message: "If that address is authorized, a recent code is still valid." });
    return NextResponse.json({ ok: true, message: "If that address is authorized, a verification code has been sent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send a verification email.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
