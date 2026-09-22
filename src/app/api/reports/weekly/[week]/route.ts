import { NextResponse } from "next/server";
import { getWeeklyReport } from "@/lib/lead/mock-database";
import { mondayOf } from "@/lib/lead/report-intake";
import { accessDeniedMessage, canReadCheckIns } from "@/lib/lead/report-access";

export const runtime = "nodejs";

/**
 * One week's roll-up. `week` is any date inside the reporting week; it is snapped
 * to that week's Monday so a link built from a submission date still resolves.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ week: string }> }) {
  if (!(await canReadCheckIns())) return NextResponse.json({ error: accessDeniedMessage }, { status: 401 });
  const { week } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: "Use a YYYY-MM-DD date inside the reporting week." }, { status: 400 });
  const weekly = await getWeeklyReport(mondayOf(week));
  if (!weekly) return NextResponse.json({ error: "No committee check-ins are stored yet." }, { status: 404 });
  return NextResponse.json(weekly, { headers: { "Cache-Control": "no-store" } });
}
