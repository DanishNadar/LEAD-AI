import { NextResponse } from "next/server";
import { getIndividualReport } from "@/lib/lead/mock-database";
import { accessDeniedMessage, canReadCheckIns } from "@/lib/lead/report-access";

export const runtime = "nodejs";

/**
 * Retrieval by report ID: the submission exactly as it was written, plus the
 * signals derived from it. Every aggregate claim in a weekly report cites one
 * of these IDs, so this is the endpoint that makes the roll-up checkable.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canReadCheckIns())) return NextResponse.json({ error: accessDeniedMessage }, { status: 401 });
  const { id } = await params;
  const report = await getIndividualReport(id);
  if (!report) return NextResponse.json({ error: `No committee check-in is stored with ID ${id}.` }, { status: 404 });
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
