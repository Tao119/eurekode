import { NextResponse } from "next/server";

/**
 * Health check endpoint for connectivity testing
 * Used by useOnlineStatus hook
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
