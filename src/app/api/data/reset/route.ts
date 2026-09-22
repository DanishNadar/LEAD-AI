import { NextResponse } from "next/server";
import { resetDemoDatabase } from "@/lib/lead/mock-database";

export const runtime = "nodejs";

/** Intended for local demo use. Production data must have authenticated admin actions instead. */
export async function POST() {
  if (process.env.NODE_ENV === "production" && !process.env.LEAD_ALLOW_DEMO_RESET) {
    return NextResponse.json({ error: "Demo reset is disabled in production." }, { status: 403 });
  }
  return NextResponse.json(await resetDemoDatabase());
}
