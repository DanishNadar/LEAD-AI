import { NextRequest, NextResponse } from "next/server";
import { createIndividualReport, listIndividualReports } from "@/lib/lead/mock-database";
import { normalizeSubmission, toCommittee } from "@/lib/lead/report-intake";
import { accessDeniedMessage, canReadCheckIns, canWriteCheckIns } from "@/lib/lead/report-access";

export const runtime = "nodejs";

/**
 * The retrieval index. Returns summaries rather than full narratives so a list
 * view stays cheap; `GET /api/reports/individual/[id]` returns the submission
 * itself with its derived signals.
 *
 * Filters: `week` (Monday, YYYY-MM-DD), `committee`, `scholar`, `q` (full text).
 */
export async function GET(request: NextRequest) {
  if (!(await canReadCheckIns())) return NextResponse.json({ error: accessDeniedMessage }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const committee = params.get("committee");
  const reports = await listIndividualReports({
    week: params.get("week") ?? undefined,
    committee: committee ? toCommittee(committee) : undefined,
    scholar: params.get("scholar") ?? undefined,
    query: params.get("q") ?? undefined,
  });
  return NextResponse.json({ count: reports.length, reports }, { headers: { "Cache-Control": "no-store" } });
}

/** Intake for the weekly individual report and the committee check-in form. */
export async function POST(request: NextRequest) {
  if (!(await canWriteCheckIns())) return NextResponse.json({ error: "Check-in submission is closed on this deployment." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "The check-in payload must be valid JSON." }, { status: 400 });
  }
  const normalized = normalizeSubmission(body);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  const result = await createIndividualReport(normalized.submission);
  return NextResponse.json(result, { status: result.replaced ? 200 : 201 });
}
