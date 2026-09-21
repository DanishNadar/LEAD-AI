import { NextRequest, NextResponse } from "next/server";
import { adminSessionCookie, createAdminSession, verifyAdminOtp } from "@/lib/lead/admin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: unknown; code?: unknown };
    if (typeof body.email !== "string" || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) return NextResponse.json({ error: "Enter the six-digit verification code." }, { status: 400 });
    if (!await verifyAdminOtp(body.email, body.code)) return NextResponse.json({ error: "That code is invalid or expired. Request a new code and try again." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminSessionCookie.name, createAdminSession(body.email), adminSessionCookie.options);
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to verify that code." }, { status: 500 });
  }
}
