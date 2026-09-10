export const dynamic = "force-dynamic";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const backend = process.env.BACKEND_URL || "http://gitops-dashboard-backend:8000";
    const response = await fetch(`${backend.replace(/\/$/, "")}/api/metrics`, {
      cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) return Response.json({ detail: "Monitoring API unavailable." }, { status: 503 });
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "Unable to reach the monitoring API." }, { status: 503 });
  } finally { clearTimeout(timeout); }
}
