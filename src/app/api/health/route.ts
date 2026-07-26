import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pickleball-venue-risk-mvp",
    timestamp: new Date().toISOString(),
  });
}
