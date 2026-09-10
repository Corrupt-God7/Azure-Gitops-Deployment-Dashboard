"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WorkloadMetrics = { name: string; cpu_cores: number | null; memory_bytes: number | null };
type Metrics = {
  checked_at: string; namespace: string; window_seconds: number;
  scrape_healthy: boolean | null; requests_per_second: number | null;
  server_error_percent: number | null; p95_latency_ms: number | null;
  workloads: WorkloadMetrics[];
};
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object"; }
function measurement(value: unknown): value is number | null { return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0); }
function valid(value: unknown): value is Metrics {
  return object(value) && typeof value.checked_at === "string" && Number.isFinite(Date.parse(value.checked_at)) && typeof value.namespace === "string" && value.window_seconds === 300 && (value.scrape_healthy === null || typeof value.scrape_healthy === "boolean") && measurement(value.requests_per_second) && measurement(value.server_error_percent) && measurement(value.p95_latency_ms) && Array.isArray(value.workloads) && value.workloads.every((row) => object(row) && typeof row.name === "string" && measurement(row.cpu_cores) && measurement(row.memory_bytes));
}
function format(value: number | null | undefined, digits: number, unit: string) {
  return value == null ? "Unavailable" : `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit}`;
}

export function MetricsPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    async function load() {
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch("/api/metrics", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Monitoring is unavailable. Check Prometheus and the backend connection.");
        const result: unknown = await response.json();
        if (!valid(result)) throw new Error("The monitoring response is incomplete. Check the backend version.");
        if (!stopped) { setData(result); setError(null); }
      } catch (failure) {
        if (!stopped) { setData(null); setError(controller.signal.aborted ? "Monitoring request timed out." : failure instanceof Error ? failure.message : "Monitoring unavailable."); }
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(load, 15000);
      }
    }
    void load();
    return () => { stopped = true; clearTimeout(timer); request?.abort(); };
  }, [refreshKey]);

  return <section className="data-card" style={{ minWidth: 0 }}>
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
      <div><p className="eyebrow">PROMETHEUS</p><h2>Workload and API metrics</h2></div>
      <Badge variant="outline" style={{ color: data ? "#2dd4bf" : "#fbbf24" }}>{data ? "Prometheus connected" : error ? "Unavailable" : "Connecting…"}</Badge>
    </div>
    {error ? <p role="alert" style={{ marginTop: 16, color: "#fbbf24" }}>{error}</p> : !data ? <p role="status" style={{ marginTop: 16 }}>Loading measurements…</p> : <>
      <p style={{ margin: "12px 0", color: "#94a3b8", fontSize: ".875rem" }}>{data.namespace} · Checked {new Date(data.checked_at).toLocaleTimeString()} · Rates averaged over 5 minutes</p>
      {data.scrape_healthy !== true && <p role="status" style={{ marginBottom: 16, color: "#fbbf24" }}>{data.scrape_healthy === false ? "A backend metrics scrape is failing. HTTP measurements are unavailable." : "Waiting for the backend metrics scrape. CPU and memory can appear first."}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, margin: "16px 0" }}>
        <Metric label="API requests / second" value={format(data.requests_per_second, 3, "")} />
        <Metric label="API latency · p95" value={format(data.p95_latency_ms, 1, " ms")} />
        <Metric label="API server errors · 5xx" value={format(data.server_error_percent, 2, "%")} />
      </div>
      <Table><TableHeader><TableRow><TableHead>Workload</TableHead><TableHead>CPU usage</TableHead><TableHead>Memory working set</TableHead></TableRow></TableHeader><TableBody>{data.workloads.map((row) => <TableRow key={row.name}><TableCell>{row.name}</TableCell><TableCell>{format(row.cpu_cores == null ? null : row.cpu_cores * 1000, 2, " mCPU")}</TableCell><TableCell>{format(row.memory_bytes == null ? null : row.memory_bytes / 1048576, 1, " MiB")}</TableCell></TableRow>)}</TableBody></Table>
      <p style={{ marginTop: 16, fontSize: ".875rem", color: "#94a3b8" }}>HTTP measurements cover the backend application API, including dashboard polling. CPU and memory cover both workloads. Latency and error percentage need traffic; new deployments need at least two scrapes.</p>
      <a href="http://localhost:3002" target="_blank" rel="noreferrer" style={{ display: "inline-block", color: "#38bdf8", marginTop: 12 }}>Open Grafana ↗</a>
    </>}
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #20344c", borderRadius: 10, padding: 16 }}><p style={{ color: "#94a3b8", fontSize: ".875rem" }}>{label}</p><strong style={{ display: "block", fontSize: "1.5rem", marginTop: 8 }}>{value}</strong></div>;
}
