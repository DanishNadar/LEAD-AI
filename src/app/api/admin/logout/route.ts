import { NextResponse } from "next/server";
import { adminSessionCookie } from "@/lib/lead/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookie.name, "", { ...adminSessionCookie.options, maxAge: 0 });
  return response;
}
