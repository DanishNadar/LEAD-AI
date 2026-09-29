import { NextRequest, NextResponse } from "next/server";
import { createTouchpoint } from "@/lib/lead/mock-database";
import type { EventRecord, TouchpointInput } from "@/lib/lead/types";

export const runtime = "nodejs";

const eventTypes: EventRecord["type"][] = ["Leadership lab", "Community meeting", "Campus partnership", "Off-campus engagement"];
const campusAreas: EventRecord["campusArea"][] = ["Academic", "Student life", "Community", "Career"];

function isWholeNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validate(body: Partial<TouchpointInput>): string | undefined {
  if (!body.title?.trim() || body.title.trim().length > 160) return "Enter a touchpoint title (160 characters or fewer).";
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return "Enter a valid touchpoint date.";
  if (!eventTypes.includes(body.type as EventRecord["type"])) return "Choose a valid touchpoint type.";
  if (!campusAreas.includes(body.campusArea as EventRecord["campusArea"])) return "Choose a valid campus area.";
  if (!body.owner?.trim() || body.owner.trim().length > 100) return "Enter an accountable owner.";
  if (![body.expected, body.rsvps, body.checkins].every(isWholeNumber)) return "Attendance counts must be whole numbers.";
  if ((body.rsvps ?? 0) > (body.expected ?? 0)) return "RSVPs cannot exceed expected capacity.";
  if ((body.checkins ?? 0) > (body.rsvps ?? 0)) return "Check-ins cannot exceed RSVPs.";
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.LEAD_ALLOW_DEMO_WRITES) {
    return NextResponse.json({ error: "Local demo writes are disabled in production." }, { status: 403 });
  }
  try {
    const body = await request.json() as Partial<TouchpointInput>;
    const error = validate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(await createTouchpoint({
      title: body.title!.trim(), date: body.date!, type: body.type as EventRecord["type"], campusArea: body.campusArea as EventRecord["campusArea"],
      expected: body.expected!, rsvps: body.rsvps!, checkins: body.checkins!, owner: body.owner!.trim(), hasAgenda: Boolean(body.hasAgenda), hasOutcome: Boolean(body.hasOutcome),
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "The touchpoint payload must be valid JSON." }, { status: 400 });
  }
}
