import "server-only";

import { getAdminSession } from "@/lib/lead/admin-auth";

/* ==========================================================================
   Access boundary for committee check-ins.

   A check-in names the scholar who wrote it and quotes them, so it sits on the
   other side of the boundary from the aggregate program report. Locally the
   demo stays open; on a deployment, retrieval needs an admin session.
   ========================================================================== */

export async function canReadCheckIns() {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(await getAdminSession());
}

export async function canWriteCheckIns() {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.LEAD_ALLOW_DEMO_WRITES) return true;
  return Boolean(await getAdminSession());
}

export const accessDeniedMessage = "Committee check-ins name individual scholars. Sign in at /admin to retrieve them.";
