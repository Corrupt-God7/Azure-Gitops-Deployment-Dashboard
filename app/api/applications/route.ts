import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl =
    process.env.BACKEND_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(
      `${backendUrl}/api/applications`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Backend request failed:", error);

    return NextResponse.json(
      { error: "Backend service unavailable" },
      { status: 502 }
    );
  }
}