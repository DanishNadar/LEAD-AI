import { NextRequest, NextResponse } from "next/server";
import { getWeeklyReport } from "@/lib/lead/mock-database";
import { mondayOf } from "@/lib/lead/report-intake";
import { renderBrief } from "@/lib/lead/weekly-report";
import { accessDeniedMessage, canReadCheckIns } from "@/lib/lead/report-access";

export const runtime = "nodejs";

/**
 * The downloadable brief as Markdown.
 *
 * `audience=internal` (default) keeps the risks, the follow-through ledger, and
 * the follow-up prompts for chairs. `audience=showcase` keeps the achievements,
 * the quotes, and the reach, and carries no blockers or critical attribution —
 * an internal report that can be shown externally without being rewritten.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ week: string }> }) {
  if (!(await canReadCheckIns())) return NextResponse.json({ error: accessDeniedMessage }, { status: 401 });
  const { week } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: "Use a YYYY-MM-DD date inside the reporting week." }, { status: 400 });
  const weekOf = mondayOf(week);
  const weekly = await getWeeklyReport(weekOf);
  if (!weekly) return NextResponse.json({ error: "No committee check-ins are stored for that week." }, { status: 404 });
  const audience = request.nextUrl.searchParams.get("audience") === "showcase" ? "showcase" : "internal";
  return new NextResponse(renderBrief(weekly, audience), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="lead-ai-${audience}-brief-${weekOf}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
