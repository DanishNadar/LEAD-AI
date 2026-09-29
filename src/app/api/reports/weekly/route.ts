import { NextResponse } from "next/server";
import { getWeekIndex, getWeeklyReport } from "@/lib/lead/mock-database";
import { accessDeniedMessage, canReadCheckIns } from "@/lib/lead/report-access";

export const runtime = "nodejs";

/** The week index plus the most recent roll-up, which is what a dashboard opens on. */
export async function GET() {
  if (!(await canReadCheckIns())) return NextResponse.json({ error: accessDeniedMessage }, { status: 401 });
  const [weeks, latest] = await Promise.all([getWeekIndex(), getWeeklyReport()]);
  return NextResponse.json({ weeks, latest }, { headers: { "Cache-Control": "no-store" } });
}
