import { AdminConsole } from "@/components/admin-console";
import { AdminSignIn } from "@/components/admin-sign-in";
import { getAdminSession } from "@/lib/lead/admin-auth";
import { getAdminSyncSettings } from "@/lib/lead/mock-database";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) return <AdminSignIn />;
  return <AdminConsole email={session.email} initialSettings={await getAdminSyncSettings()} />;
}
