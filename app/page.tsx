"use client";

import { useEffect, useState } from "react";
import { Activity, Boxes, Cloud, GitBranch, History, LayoutDashboard, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricsPanel } from "./metrics-panel";

type View = "Overview" | "Applications" | "Deployments" | "Metrics" | "Infrastructure" | "Settings";
type Container = { name: string; image: string; image_id: string | null; state: string; ready: boolean; restarts: number };
type Pod = { name: string; phase: string; ready: boolean; terminating: boolean; containers: Container[] };
type Workload = { name: string; exists: boolean; desired_replicas: number | null; active_pods: number; ready_pods: number; terminating_pods: number; desired_images: { name: string; image: string }[]; pods: Pod[] };
type Deployment = { id: number; revision: string; deployed_at: string | null; deploy_started_at: string | null; initiated_by: string; current: boolean };
type Application = { name: string; namespace: string; health: string; sync: string; revision: string; workloads?: Workload[]; workloads_error?: string | null; history?: Deployment[] };
const nav = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Applications", icon: Boxes },
  { label: "Deployments", icon: History }, { label: "Metrics", icon: Activity },
  { label: "Infrastructure", icon: Cloud }, { label: "Settings", icon: Settings2 },
] as const;
const titles: Record<View, string> = { Overview: "Deployment overview", Applications: "Applications", Deployments: "Deployment history", Metrics: "Service metrics", Infrastructure: "Local infrastructure", Settings: "Connection settings" };
const wrap = { overflowWrap: "anywhere" as const, whiteSpace: "normal" as const };
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object"; }
function count(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
function isContainer(value: unknown): value is Container {
  return record(value) && typeof value.name === "string" && typeof value.image === "string" && (value.image_id === null || typeof value.image_id === "string") && typeof value.state === "string" && typeof value.ready === "boolean" && count(value.restarts);
}
function isPod(value: unknown): value is Pod {
  return record(value) && typeof value.name === "string" && typeof value.phase === "string" && typeof value.ready === "boolean" && typeof value.terminating === "boolean" && Array.isArray(value.containers) && value.containers.every(isContainer);
}
function isWorkload(value: unknown): value is Workload {
  return record(value) && typeof value.name === "string" && typeof value.exists === "boolean" && (value.desired_replicas === null || count(value.desired_replicas)) && count(value.active_pods) && count(value.ready_pods) && count(value.terminating_pods) && Array.isArray(value.pods) && value.pods.every(isPod) && Array.isArray(value.desired_images) && value.desired_images.every((image) => record(image) && typeof image.name === "string" && typeof image.image === "string");
}
function isDeployment(value: unknown): value is Deployment {
  return record(value) && count(value.id) && typeof value.revision === "string" && (value.deployed_at === null || typeof value.deployed_at === "string") && (value.deploy_started_at === null || typeof value.deploy_started_at === "string") && typeof value.initiated_by === "string" && typeof value.current === "boolean";
}
function isApplication(value: unknown): value is Application {
  return record(value) && ["name", "namespace", "health", "sync", "revision"].every((key) => typeof value[key] === "string") && (value.workloads === undefined || (Array.isArray(value.workloads) && value.workloads.every(isWorkload))) && (value.workloads_error == null || typeof value.workloads_error === "string") && (value.history === undefined || (Array.isArray(value.history) && value.history.every(isDeployment)));
}

export default function Home() {
  const [view, setView] = useState<View>("Overview");
  const [application, setApplication] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function load() {
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 10000);
      setRefreshing(true);
      try {
        const response = await fetch("/api/applications", { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error(`Application API returned HTTP ${response.status}.`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Unexpected application API response.");
        const found = data.find((item: unknown) => record(item) && item.name === "gitops-dashboard");
        if (!isApplication(found)) throw new Error("Application data is missing or invalid.");
        if (!stopped) { setApplication(found); setError(null); setCheckedAt(new Date().toLocaleTimeString()); }
      } catch (failure) {
        if (!stopped) {
          setApplication(null);
          setError(request.signal.aborted ? "The API request timed out. Check the connection and try again." : failure instanceof Error ? failure.message : "Application API unavailable.");
        }
      } finally {
        clearTimeout(timeout);
        if (!stopped) { setRefreshing(false); timer = setTimeout(load, 15000); }
      }
    }
    void load();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [refreshKey]);
  const fallback = error ? "Unavailable" : "Loading…";
  return <main className="app-shell">
    <aside className="sidebar-panel">
      <div className="brand-mark"><div className="brand-icon"><GitBranch /></div><div><strong>GitOps</strong><span>CONTROL</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Workspace">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${view === label ? "active" : ""}`} aria-current={view === label ? "page" : undefined} title={label} onClick={() => { setView(label); window.scrollTo({ top: 0 }); }}><Icon /><span>{label}</span>{view === label && <span className="nav-pip" />}</button>)}</nav>
      <div className="sidebar-foot"><div className="cluster-chip"><Boxes /><div><strong>gitops-dev</strong><span>Local kind environment</span></div></div></div>
    </aside>
    <section className="content-panel">
      <header className="topbar"><div><p className="eyebrow">DEVELOPMENT ENVIRONMENT</p><h1>{titles[view]}</h1></div><div className="topbar-actions"><Badge className="environment-badge" variant="outline">dev</Badge><Button className="sync-button" disabled={refreshing} onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw className={refreshing ? "animate-spin" : ""} />{refreshing ? "Refreshing…" : "Refresh status"}</Button></div></header>
      <div className="dashboard-body" style={{ display: "grid", gap: 16 }}>
        {error && <div className="data-card" role="alert"><h2>Connection unavailable</h2><p>{error}</p>{checkedAt && <p>Last successful API check: {checkedAt}</p>}</div>}
        {view === "Overview" && <>
          <div className="summary-grid">
            <Summary icon={ShieldCheck} label="Application health" value={application?.health ?? fallback} note="Reported by Argo CD" healthy={application?.health === "Healthy"} />
            <Summary icon={RefreshCw} label="Sync status" value={application?.sync ?? fallback} note="Git compared with cluster state" />
            <Summary icon={GitBranch} label="Git revision" value={application?.revision ?? fallback} note="Configuration revision" />
            <Summary icon={Boxes} label="Namespace" value={application?.namespace ?? fallback} note="Application destination" />
          </div>
          <ApplicationCard application={application} fallback={fallback} checkedAt={checkedAt} />
          <MetricsPanel refreshKey={refreshKey} />
        </>}
        {view === "Applications" && <ApplicationCard application={application} fallback={fallback} checkedAt={checkedAt} />}
        {view === "Deployments" && <DeploymentHistory application={application} fallback={fallback} />}
        {view === "Metrics" && <MetricsPanel refreshKey={refreshKey} />}
        {view === "Infrastructure" && <div className="data-card"><p className="eyebrow">CONFIGURED ENVIRONMENT</p><h2>Local Kubernetes and GHCR</h2><div className="detail-facts"><Fact label="Cluster" value="gitops-dev" /><Fact label="Platform" value="kind on Docker Desktop" /><Fact label="Node" value="gitops-dev-control-plane" /><Fact label="Image registry" value="ghcr.io/chirag-deviputra" /></div><p>These are configured environment details. Open Metrics for live workload CPU and memory.</p></div>}
        {view === "Settings" && <div className="data-card"><p className="eyebrow">DASHBOARD CONNECTION</p><h2>Read-only application status</h2><div className="detail-facts"><Fact label="API endpoint" value="/api/applications" /><Fact label="Polling" value="15 seconds after each request" /><Fact label="Request timeout" value="10 seconds" /><Fact label="Application" value="gitops-dashboard" /></div><p>Refresh status reads the latest application and workload data. Manage deployments and synchronization in Argo CD.</p></div>}
        <footer className="page-footer" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 24px", color: "#94a3b8", fontSize: ".875rem", padding: "8px 0" }}><span>{application ? "Application API connected" : error ? "Application API unavailable" : "Connecting to application API…"}</span><span>Git revision: {application?.revision ?? "—"}</span><span>Read-only dashboard</span></footer>
      </div>
    </section>
  </main>;
}

function ApplicationCard({ application, fallback, checkedAt }: { application: Application | null; fallback: string; checkedAt: string | null }) {
  return <section className="data-card"><p className="eyebrow">ARGO CD APPLICATION</p><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h2>{application?.name ?? "gitops-dashboard"}</h2><Badge variant="outline" style={{ color: application?.health === "Healthy" ? "#2dd4bf" : undefined }}>{application?.health ?? fallback}</Badge></div>
    <div className="detail-facts"><Fact label="Namespace" value={application?.namespace ?? fallback} /><Fact label="Sync status" value={application?.sync ?? fallback} /><Fact label="Git revision" value={application?.revision ?? fallback} /><Fact label="Last successful API check" value={checkedAt ?? "—"} /></div>
    <h3>Frontend and backend workloads</h3>
    {!application ? <p role="status">Workload data {fallback.toLowerCase()}</p> : application.workloads_error ? <p role="alert" style={{ color: "#fbbf24" }}>{application.workloads_error}</p> : !application.workloads?.length ? <p role="status">Workload details are not available from this backend yet. Deploy the updated backend and refresh.</p> : <>
      <p style={{ color: "#94a3b8", fontSize: ".8rem", margin: "8px 0 16px" }}>Counts reflect the latest check. During a rollout, active pods can exceed the desired count.</p>
      <div style={{ display: "grid", gap: 16 }}>{application.workloads.map((workload) => <WorkloadCard key={workload.name} workload={workload} />)}</div>
    </>}
  </section>;
}
function WorkloadCard({ workload }: { workload: Workload }) {
  return <section style={{ border: "1px solid #20344c", borderRadius: 10, padding: 16, minWidth: 0 }}>
    <h4 style={wrap}>{workload.name}</h4>
    {!workload.exists && <p role="status" style={{ color: "#fbbf24" }}>Deployment not found. Any remaining matching pods are listed below.</p>}
    <div className="detail-facts"><Fact label="Ready pods" value={String(workload.ready_pods)} /><Fact label="Desired replicas" value={workload.desired_replicas === null ? "Unavailable" : String(workload.desired_replicas)} /><Fact label="Active pods" value={String(workload.active_pods)} /><Fact label="Terminating pods" value={String(workload.terminating_pods)} /></div>
    {workload.desired_images.map((image) => <p key={image.name} style={{ ...wrap, fontSize: ".8rem", marginBottom: 8 }}>Deployment image · {image.name}: <code>{image.image}</code></p>)}
    {workload.pods.length === 0 ? <p>No matching pods at the latest check.</p> : <>
      <Table><TableHeader><TableRow><TableHead>Pod</TableHead><TableHead>Status</TableHead><TableHead>Ready</TableHead><TableHead>Restarts</TableHead></TableRow></TableHeader><TableBody>{workload.pods.map((pod) => <TableRow key={pod.name}><TableCell style={wrap}>{pod.name}</TableCell><TableCell>{pod.terminating ? "Terminating" : pod.containers.find((container) => container.state !== "Running")?.state ?? pod.phase}</TableCell><TableCell>{pod.ready ? "Yes" : "No"}</TableCell><TableCell>{pod.containers.reduce((sum, container) => sum + container.restarts, 0)}</TableCell></TableRow>)}</TableBody></Table>
      <details style={{ marginTop: 16 }}><summary style={{ cursor: "pointer", color: "#38bdf8" }}>Container images and runtime IDs ({workload.pods.length} pods)</summary>
        <p style={{ fontSize: ".8rem", color: "#94a3b8", marginTop: 8 }}>A tag such as dev can point to different builds. Compare runtime image IDs to distinguish the images used by individual containers.</p>
        {workload.pods.map((pod) => <div key={pod.name} style={{ marginTop: 14, ...wrap }}><strong>{pod.name}</strong>{pod.containers.map((container) => <div key={container.name} style={{ marginTop: 8, fontSize: ".8rem" }}><p>{container.name} · {container.state} · {container.ready ? "Container ready" : "Container not ready"}</p><p>Pod image: <code>{container.image}</code></p><p>Runtime image ID: <code>{container.image_id ?? "Not reported yet"}</code></p></div>)}</div>)}
      </details>
    </>}
  </section>;
}
function DeploymentHistory({ application, fallback }: { application: Application | null; fallback: string }) {
  const history = application?.history;
  return <section className="data-card"><p className="eyebrow">ARGO CD HISTORY</p><h2>Successful synchronizations</h2>
    <p style={{ color: "#94a3b8", fontSize: ".8rem", margin: "8px 0 16px" }}>Read from the Argo CD Application status. Newest records appear first. This screen is read-only.</p>
    {!application ? <p role="status">Deployment history {fallback.toLowerCase()}</p> : history === undefined ? <p role="status">History is not available from this backend yet. Deploy the updated backend and refresh.</p> : history.length === 0 ? <p>Argo CD has not recorded any synchronization history for this application.</p> :
      <Table><TableHeader><TableRow><TableHead>Sequence</TableHead><TableHead>Revision</TableHead><TableHead>Deployed at</TableHead><TableHead>Initiated by</TableHead><TableHead>Duration</TableHead><TableHead>State</TableHead></TableRow></TableHeader><TableBody>{history.map((deployment) => <TableRow key={`${deployment.id}-${deployment.revision}`}><TableCell>#{deployment.id}</TableCell><TableCell><code>{deployment.revision}</code></TableCell><TableCell>{formatTimestamp(deployment.deployed_at)}</TableCell><TableCell style={wrap}>{deployment.initiated_by}</TableCell><TableCell>{formatDuration(deployment.deploy_started_at, deployment.deployed_at)}</TableCell><TableCell><Badge variant="outline" style={{ color: deployment.current ? "#2dd4bf" : undefined }}>{deployment.current ? "Current" : "Superseded"}</Badge></TableCell></TableRow>)}</TableBody></Table>}
  </section>;
}
function formatTimestamp(value: string | null) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return "Unavailable";
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Unavailable";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 1) return "<1 sec";
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong title={value}>{value}</strong></div>; }
function Summary({ icon: Icon, label, value, note, healthy = false }: { icon: typeof Boxes; label: string; value: string; note: string; healthy?: boolean }) { return <div className={`summary-card ${healthy ? "healthy-card" : ""}`}><div className="summary-title"><Icon />{label}</div><div className="summary-value">{value}</div><p>{note}</p></div>; }
