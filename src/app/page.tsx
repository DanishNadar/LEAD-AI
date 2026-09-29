import { LeadDashboard } from "@/components/lead-dashboard";
import { getCurrentReport, getDataOverview } from "@/lib/lead/mock-database";
import { canReadCheckIns, canWriteCheckIns } from "@/lib/lead/report-access";

// The local reporting store changes at runtime; do not bake a stale initial view.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Committee check-ins name individual scholars, so the views that read them are
  // gated separately from the aggregate program report.
  const [report, overview, canRead, canWrite] = await Promise.all([getCurrentReport(), getDataOverview(), canReadCheckIns(), canWriteCheckIns()]);
  return <LeadDashboard initialReport={report} initialOverview={overview} canReadCheckIns={canRead} canWriteCheckIns={canWrite} />;
}
