import { LeadDashboard } from "@/components/lead-dashboard";
import { getCurrentReport, getDataOverview } from "@/lib/lead/mock-database";

// The local reporting store changes at runtime; do not bake a stale initial view.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [report, overview] = await Promise.all([getCurrentReport(), getDataOverview()]);
  return <LeadDashboard initialReport={report} initialOverview={overview} />;
}
