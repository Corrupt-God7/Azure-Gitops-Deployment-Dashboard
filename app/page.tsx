"use client";

import { useMemo, useState } from "react";
import {
  Activity, Boxes, Check, ChevronRight, CircleGauge, Cloud, Code2,
  Container, Database, GitBranch, GitFork, History, LayoutDashboard,
  Network, RefreshCw, RotateCcw, ServerCog, Settings2, ShieldCheck,
  TerminalSquare, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";

type ViewName = "Overview" | "Applications" | "Deployments" | "Metrics" | "Infrastructure" | "Settings";

const nav: Array<{ label: ViewName; icon: typeof Boxes }> = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Applications", icon: Boxes },
  { label: "Deployments", icon: History },
  { label: "Metrics", icon: CircleGauge },
  { label: "Infrastructure", icon: Cloud },
];

const pipeline = [
  { label: "GitHub", detail: "main", icon: GitFork, description: "Source and desired state are stored in the main branch." },
  { label: "Actions", detail: "CI passed", icon: Code2, description: "Frontend and backend tests passed before image creation." },
  { label: "ACR", detail: "sha-8f31c2a", icon: Container, description: "Immutable frontend and backend images are available in ACR." },
  { label: "Argo CD", detail: "synced", icon: RefreshCw, description: "Git desired state matches the live Kubernetes resources." },
  { label: "AKS", detail: "healthy", icon: Boxes, description: "All deployments are available and their health probes pass." },
];

const deployments = [
  { version: "v1.8.2", commit: "8f31c2a", image: "sha-8f31c2a", actor: "GitHub Actions", time: "2 min ago", status: "Healthy" },
  { version: "v1.8.1", commit: "ba72e91", image: "sha-ba72e91", actor: "GitHub Actions", time: "Yesterday, 16:42", status: "Superseded" },
  { version: "v1.8.0", commit: "ec091ad", image: "sha-ec091ad", actor: "GitHub Actions", time: "Aug 31, 11:08", status: "Superseded" },
  { version: "v1.7.4", commit: "3f1a098", image: "sha-3f1a098", actor: "GitHub Actions", time: "Aug 29, 09:24", status: "Superseded" },
];

const pageTitles: Record<ViewName, { eyebrow: string; title: string }> = {
  Overview: { eyebrow: "Development environment", title: "Deployment overview" },
  Applications: { eyebrow: "Argo CD", title: "Applications" },
  Deployments: { eyebrow: "Release operations", title: "Deployment history" },
  Metrics: { eyebrow: "Prometheus", title: "Service metrics" },
  Infrastructure: { eyebrow: "Terraform-managed", title: "Azure infrastructure" },
  Settings: { eyebrow: "Environment controls", title: "GitOps settings" },
};

export default function Home() {
  const [activeView, setActiveView] = useState<ViewName>("Overview");
  const [version, setVersion] = useState("v1.8.2");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("2 minutes ago");

  function openView(view: ViewName) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncApplication() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync("just now");
      toast.success("Application synchronized", { description: "Argo CD reconciled Git with the cluster." });
    }, 900);
  }

  function rollback(target = "v1.8.1") {
    setVersion(target);
    setLastSync("just now");
    toast.success(`Rollback to ${target} simulated`, { description: "The previous healthy release is now selected." });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar-panel">
        <button className="brand-mark" onClick={() => openView("Overview")} aria-label="Open overview">
          <div className="brand-icon"><GitBranch /></div>
          <div><strong>GitOps</strong><span>CONTROL</span></div>
        </button>
        <nav aria-label="Primary navigation" className="primary-nav">
          <p className="nav-label">Workspace</p>
          {nav.map((item) => (
            <button
              key={item.label}
              onClick={() => openView(item.label)}
              className={activeView === item.label ? "nav-item active" : "nav-item"}
              aria-current={activeView === item.label ? "page" : undefined}
            >
              <item.icon /><span>{item.label}</span>{activeView === item.label && <span className="nav-pip" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="cluster-chip" onClick={() => openView("Infrastructure")}>
            <span className="status-dot" />
            <div><strong>aks-gitops-dev</strong><span>Central India · Connected</span></div>
          </button>
          <button onClick={() => openView("Settings")} className={activeView === "Settings" ? "nav-item active" : "nav-item"}>
            <Settings2 /><span>Settings</span>{activeView === "Settings" && <span className="nav-pip" />}
          </button>
        </div>
      </aside>

      <section className="content-panel">
        <header className="topbar">
          <div><p className="eyebrow">{pageTitles[activeView].eyebrow}</p><h1>{pageTitles[activeView].title}</h1></div>
          <div className="topbar-actions">
            <Badge variant="outline" className="environment-badge"><span className="status-dot" /> dev</Badge>
            <Button onClick={syncApplication} disabled={syncing} className="sync-button">
              <RefreshCw className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing" : "Sync now"}
            </Button>
          </div>
        </header>

        <div className="dashboard-body" key={activeView}>
          {activeView === "Overview" && <Overview version={version} lastSync={lastSync} onRollback={rollback} />}
          {activeView === "Applications" && <ApplicationsView version={version} onSync={syncApplication} />}
          {activeView === "Deployments" && <DeploymentsView currentVersion={version} onRollback={rollback} />}
          {activeView === "Metrics" && <MetricsView />}
          {activeView === "Infrastructure" && <InfrastructureView />}
          {activeView === "Settings" && <SettingsView />}
        </div>
      </section>
      <Toaster position="bottom-right" />
    </main>
  );
}

function Overview({ version, lastSync, onRollback }: { version: string; lastSync: string; onRollback: (version?: string) => void }) {
  const [selectedStage, setSelectedStage] = useState(3);
  const bars = useMemo(() => [42, 57, 49, 66, 61, 74, 70, 83, 76, 68, 72, 64], []);
  const SelectedStageIcon = pipeline[selectedStage].icon;
  return (
    <>
      <section className="summary-grid" aria-label="Deployment summary">
        <SummaryCard icon={ShieldCheck} label="Application health" value="Healthy" note="3 of 3 workloads ready" healthy />
        <SummaryCard icon={RefreshCw} label="Sync status" value="Synced" note={`Updated ${lastSync}`} />
        <SummaryCard icon={Container} label="Current release" value={version} note="Image sha-8f31c2a" mono />
        <SummaryCard icon={Activity} label="Error rate" value="0.18%" note="↓ 0.07% over 24h" positive />
      </section>
      <section className="pipeline-card">
        <div className="section-heading"><div><p className="eyebrow">Delivery path</p><h2>Commit to cluster</h2></div><Badge variant="outline" className="healthy-badge"><Check /> All stages passed</Badge></div>
        <div className="pipeline-flow">
          {pipeline.map((step, index) => (
            <div className="pipeline-group" key={step.label}>
              <button className={selectedStage === index ? "pipeline-step selected" : "pipeline-step"} onClick={() => setSelectedStage(index)}>
                <div className="pipeline-icon"><step.icon /></div><div><strong>{step.label}</strong><span>{step.detail}</span></div><Check className="step-check" />
              </button>
              {index < pipeline.length - 1 && <ChevronRight className="pipeline-arrow" />}
            </div>
          ))}
        </div>
        <div className="stage-detail"><SelectedStageIcon /><div><strong>{pipeline[selectedStage].label}</strong><span>{pipeline[selectedStage].description}</span></div></div>
      </section>
      <section className="main-grid">
        <article className="application-card">
          <div className="section-heading compact"><div><p className="eyebrow">Argo CD application</p><h2>gitops-dashboard</h2></div><Badge className="healthy-badge"><span className="status-dot" /> Healthy</Badge></div>
          <Tabs defaultValue="resources" className="application-tabs">
            <TabsList variant="line"><TabsTrigger value="resources">Resources</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
            <TabsContent value="resources"><div className="resource-list"><ResourceRow icon={LayoutDashboard} name="frontend" kind="Deployment" replicas="2 / 2" /><ResourceRow icon={ServerCog} name="backend" kind="Deployment" replicas="2 / 2" /><ResourceRow icon={TerminalSquare} name="backend-api" kind="Service" replicas="Active" /></div></TabsContent>
            <TabsContent value="history"><HistoryList /></TabsContent>
          </Tabs>
          <div className="application-actions"><div><span>Namespace</span><code>gitops-dev</code></div><div><span>Revision</span><code>main@8f31c2a</code></div><RollbackDialog target="v1.8.1" onRollback={onRollback} /></div>
        </article>
        <article className="metrics-card">
          <div className="section-heading compact"><div><p className="eyebrow">Prometheus · 1 hour</p><h2>Request traffic</h2></div><Activity /></div>
          <div className="metric-number">1,248 <span>req/min</span></div><BarChart values={bars} />
          <div className="metric-lines"><MetricLine label="P95 latency" value="184 ms" progress={58} /><MetricLine label="CPU usage" value="42%" progress={42} /><MetricLine label="Memory usage" value="61%" progress={61} /></div>
        </article>
      </section>
      <DashboardFooter />
    </>
  );
}

function ApplicationsView({ version, onSync }: { version: string; onSync: () => void }) {
  const [selected, setSelected] = useState("gitops-dashboard");
  return (
    <>
      <section className="page-intro"><div><h2>Applications in Argo CD</h2><p>Select an application to inspect its desired revision and Kubernetes resources.</p></div><Badge className="healthy-badge"><span className="status-dot" /> 2 Healthy</Badge></section>
      <section className="application-browser">
        <div className="application-list">
          <button className={selected === "gitops-dashboard" ? "application-choice selected" : "application-choice"} onClick={() => setSelected("gitops-dashboard")}><LayoutDashboard /><div><strong>gitops-dashboard</strong><span>gitops-dev · {version}</span></div><Badge className="healthy-badge">Healthy</Badge></button>
          <button className={selected === "monitoring-stack" ? "application-choice selected" : "application-choice"} onClick={() => setSelected("monitoring-stack")}><Activity /><div><strong>monitoring-stack</strong><span>monitoring · v0.72.0</span></div><Badge className="healthy-badge">Healthy</Badge></button>
        </div>
        <article className="detail-card">
          <div className="section-heading compact"><div><p className="eyebrow">Selected application</p><h2>{selected}</h2></div><Button size="sm" onClick={onSync}><RefreshCw /> Sync</Button></div>
          <div className="detail-facts"><div><span>Project</span><strong>gitops-dashboard</strong></div><div><span>Repository</span><strong>main</strong></div><div><span>Destination</span><strong>{selected === "monitoring-stack" ? "monitoring" : "gitops-dev"}</strong></div><div><span>Auto-sync</span><strong className="positive">Enabled</strong></div></div>
          <div className="resource-list"><ResourceRow icon={Boxes} name={selected === "monitoring-stack" ? "prometheus-server" : "frontend"} kind="Deployment" replicas="2 / 2" /><ResourceRow icon={ServerCog} name={selected === "monitoring-stack" ? "grafana" : "backend"} kind="Deployment" replicas="2 / 2" /><ResourceRow icon={Network} name="ingress" kind="Service" replicas="Active" /></div>
        </article>
      </section>
      <DashboardFooter />
    </>
  );
}

function DeploymentsView({ currentVersion, onRollback }: { currentVersion: string; onRollback: (version?: string) => void }) {
  return (
    <>
      <section className="page-intro"><div><h2>Release history</h2><p>Every release links the Git commit, immutable image and Argo CD result.</p></div><Badge variant="outline" className="environment-badge">Current: {currentVersion}</Badge></section>
      <article className="data-card">
        <Table>
          <TableHeader><TableRow><TableHead>Release</TableHead><TableHead>Commit</TableHead><TableHead>Image</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>{deployments.map((item, index) => <TableRow key={item.commit}><TableCell><strong>{item.version}</strong>{index === 0 && <span className="current-label">Current</span>}</TableCell><TableCell><code>{item.commit}</code></TableCell><TableCell><code>{item.image}</code></TableCell><TableCell>{item.time}</TableCell><TableCell><Badge className={item.status === "Healthy" ? "healthy-badge" : "neutral-badge"}>{item.status}</Badge></TableCell><TableCell className="text-right">{index > 0 ? <RollbackDialog target={item.version} onRollback={onRollback} compact /> : <Button size="sm" variant="outline" disabled>Active</Button>}</TableCell></TableRow>)}</TableBody>
        </Table>
      </article>
      <section className="recovery-strip"><RotateCcw /><div><strong>GitOps recovery rule</strong><span>Rollback creates or reverts a Git change so Argo CD and the cluster remain aligned.</span></div></section>
      <DashboardFooter />
    </>
  );
}

function MetricsView() {
  const traffic = [35, 42, 48, 43, 58, 63, 61, 70, 74, 82, 78, 86, 81, 73, 76, 69, 64, 72, 75, 68];
  return (
    <>
      <section className="summary-grid"><SummaryCard icon={Activity} label="Request rate" value="1,248/min" note="↑ 8.4% over 24h" /><SummaryCard icon={CircleGauge} label="P95 latency" value="184 ms" note="Target below 250 ms" healthy /><SummaryCard icon={ShieldCheck} label="Availability" value="99.98%" note="30-day window" /><SummaryCard icon={TerminalSquare} label="Error rate" value="0.18%" note="↓ 0.07% over 24h" positive /></section>
      <section className="metrics-layout"><article className="data-card chart-card"><div className="section-heading compact"><div><p className="eyebrow">Prometheus query</p><h2>HTTP request traffic</h2></div><Badge variant="outline">Last 6 hours</Badge></div><div className="metric-number">1,248 <span>requests per minute</span></div><BarChart values={traffic} large /></article><article className="data-card"><div className="section-heading compact"><div><p className="eyebrow">Service health</p><h2>Resource usage</h2></div></div><div className="metric-lines spacious"><MetricLine label="Frontend CPU" value="38%" progress={38} /><MetricLine label="Backend CPU" value="42%" progress={42} /><MetricLine label="Frontend memory" value="54%" progress={54} /><MetricLine label="Backend memory" value="61%" progress={61} /></div></article></section>
      <article className="data-card"><Table><TableHeader><TableRow><TableHead>Target</TableHead><TableHead>Endpoint</TableHead><TableHead>Last scrape</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>gitops-dashboard-backend</TableCell><TableCell><code>/metrics</code></TableCell><TableCell>12 seconds ago</TableCell><TableCell><Badge className="healthy-badge">Up</Badge></TableCell></TableRow><TableRow><TableCell>kube-state-metrics</TableCell><TableCell><code>:8080/metrics</code></TableCell><TableCell>8 seconds ago</TableCell><TableCell><Badge className="healthy-badge">Up</Badge></TableCell></TableRow></TableBody></Table></article>
      <DashboardFooter />
    </>
  );
}

function InfrastructureView() {
  const [selected, setSelected] = useState("AKS cluster");
  const resources = [
    { name: "Resource group", value: "rg-gitops-dev", icon: Cloud },
    { name: "AKS cluster", value: "aks-gitops-dev", icon: Boxes },
    { name: "Container registry", value: "acrgitopschirag", icon: Container },
    { name: "Virtual network", value: "vnet-gitops-dev", icon: Network },
    { name: "Log Analytics", value: "log-gitops-dev", icon: Database },
  ];
  return (
    <>
      <section className="page-intro"><div><h2>Terraform-managed resources</h2><p>The cards show the planned development topology. Manual Azure changes are treated as drift.</p></div><Badge variant="outline" className="healthy-badge"><Check /> State aligned</Badge></section>
      <section className="infra-grid">{resources.map((resource) => <button key={resource.name} onClick={() => setSelected(resource.name)} className={selected === resource.name ? "infra-card selected" : "infra-card"}><div className="resource-icon"><resource.icon /></div><span>{resource.name}</span><strong>{resource.value}</strong><Badge className="healthy-badge">Ready</Badge></button>)}</section>
      <article className="data-card infra-detail"><div><p className="eyebrow">Resource details</p><h2>{selected}</h2></div><div className="detail-facts"><div><span>Managed by</span><strong>Terraform</strong></div><div><span>Environment</span><strong>dev</strong></div><div><span>Region</span><strong>Central India</strong></div><div><span>Last plan</span><strong>No changes</strong></div></div></article>
      <section className="recovery-strip"><Workflow /><div><strong>Ownership boundary</strong><span>Terraform owns Azure infrastructure. Argo CD owns Kubernetes application resources.</span></div></section>
      <DashboardFooter />
    </>
  );
}

function SettingsView() {
  const [autoSync, setAutoSync] = useState(true);
  const [prune, setPrune] = useState(true);
  const [selfHeal, setSelfHeal] = useState(true);
  function save() { toast.success("Settings saved", { description: "Development preferences were updated in this dashboard demo." }); }
  return (
    <>
      <section className="settings-grid">
        <article className="data-card"><div className="section-heading compact"><div><p className="eyebrow">Argo CD policy</p><h2>Synchronization</h2></div></div><SettingRow title="Automatic sync" description="Apply Git changes without a manual sync operation." checked={autoSync} onChange={setAutoSync} /><SettingRow title="Prune removed resources" description="Delete Kubernetes resources removed from Git." checked={prune} onChange={setPrune} /><SettingRow title="Self-heal drift" description="Restore resources changed manually in the cluster." checked={selfHeal} onChange={setSelfHeal} /></article>
        <article className="data-card"><div className="section-heading compact"><div><p className="eyebrow">Environment</p><h2>Connection summary</h2></div></div><div className="detail-facts single-column"><div><span>Environment</span><strong>development</strong></div><div><span>Cluster</span><strong>aks-gitops-dev</strong></div><div><span>Namespace</span><strong>gitops-dev</strong></div><div><span>Target branch</span><strong>main</strong></div></div></article>
      </section>
      <div className="settings-actions"><Button onClick={save}>Save settings</Button><span>Demo settings are kept for this browser session.</span></div>
      <DashboardFooter />
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, note, healthy, mono, positive }: { icon: typeof Boxes; label: string; value: string; note: string; healthy?: boolean; mono?: boolean; positive?: boolean }) {
  return <article className={healthy ? "summary-card healthy-card" : "summary-card"}><div className="summary-title"><Icon /><span>{label}</span></div><div className={mono ? "summary-value mono" : "summary-value"}>{value}</div><p className={positive ? "positive" : ""}>{note}</p></article>;
}

function ResourceRow({ icon: Icon, name, kind, replicas }: { icon: typeof Boxes; name: string; kind: string; replicas: string }) {
  return <div className="resource-row"><div className="resource-icon"><Icon /></div><div className="resource-name"><strong>{name}</strong><span>{kind}</span></div><Badge variant="outline" className="sync-badge"><RefreshCw /> Synced</Badge><div className="replicas"><span>Ready</span><strong>{replicas}</strong></div></div>;
}

function HistoryList() {
  return <div className="history-list">{deployments.slice(0, 3).map((item) => <div className="history-row" key={item.commit}><span className="timeline-dot" /><div><strong>{item.version}</strong><span>{item.actor} · {item.time}</span></div><code>{item.commit}</code></div>)}</div>;
}

function MetricLine({ label, value, progress }: { label: string; value: string; progress: number }) {
  return <div className="metric-line"><div><span>{label}</span><strong>{value}</strong></div><Progress value={progress} /></div>;
}

function BarChart({ values, large }: { values: number[]; large?: boolean }) {
  return <div className={large ? "bar-chart large" : "bar-chart"} aria-label="Metric trend">{values.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>;
}

function RollbackDialog({ target, onRollback, compact }: { target: string; onRollback: (version?: string) => void; compact?: boolean }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button size={compact ? "sm" : "default"} variant="outline"><RotateCcw /> Roll back{compact ? "" : ` to ${target}`}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Roll back to {target}?</AlertDialogTitle><AlertDialogDescription>This demo will select {target} as the desired healthy release and update the dashboard state.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onRollback(target)}>Confirm rollback</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function SettingRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="setting-row"><div><strong>{title}</strong><span>{description}</span></div><Switch checked={checked} onCheckedChange={onChange} aria-label={title} /></div>;
}

function DashboardFooter() {
  return <footer className="dashboard-footer"><span><span className="status-dot" /> Platform operational</span><span>Desired state: <code>main@8f31c2a</code></span><span>Auto-sync · Prune · Self-heal</span></footer>;
}
