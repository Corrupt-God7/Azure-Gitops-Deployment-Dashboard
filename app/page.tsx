"use client";

import { useMemo, useState } from "react";
import {
  Activity, Boxes, Check, ChevronRight, CircleGauge, Cloud, Code2,
  Container, GitBranch, GitFork, History, LayoutDashboard, RefreshCw,
  RotateCcw, ServerCog, Settings2, ShieldCheck, TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

const pipeline = [
  { label: "GitHub", detail: "main", icon: GitFork },
  { label: "Actions", detail: "CI passed", icon: Code2 },
  { label: "ACR", detail: "sha-8f31c2a", icon: Container },
  { label: "Argo CD", detail: "synced", icon: RefreshCw },
  { label: "AKS", detail: "healthy", icon: Boxes },
];

const history = [
  { version: "v1.8.2", commit: "8f31c2a", actor: "GitHub Actions", time: "2 min ago" },
  { version: "v1.8.1", commit: "ba72e91", actor: "GitHub Actions", time: "Yesterday, 16:42" },
  { version: "v1.8.0", commit: "ec091ad", actor: "GitHub Actions", time: "Aug 31, 11:08" },
];

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Applications", icon: Boxes },
  { label: "Deployments", icon: History },
  { label: "Metrics", icon: CircleGauge },
  { label: "Infrastructure", icon: Cloud },
];

export default function Home() {
  const [version, setVersion] = useState("v1.8.2");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("2 minutes ago");
  const bars = useMemo(() => [42, 57, 49, 66, 61, 74, 70, 83, 76, 68, 72, 64], []);

  function syncApplication() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync("just now");
      toast.success("Application synchronized", {
        description: "Argo CD reconciled the Git configuration with the cluster.",
      });
    }, 900);
  }

  function rollback() {
    setVersion("v1.8.1");
    setLastSync("just now");
    toast.success("Rollback simulated", {
      description: "The dashboard now reflects the previous healthy release.",
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar-panel">
        <div className="brand-mark" aria-label="GitOps Control">
          <div className="brand-icon"><GitBranch /></div>
          <div><strong>GitOps</strong><span>CONTROL</span></div>
        </div>
        <nav aria-label="Primary navigation" className="primary-nav">
          <p className="nav-label">Workspace</p>
          {nav.map((item) => (
            <button key={item.label} className={item.active ? "nav-item active" : "nav-item"}>
              <item.icon /><span>{item.label}</span>{item.active && <span className="nav-pip" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="cluster-chip">
            <span className="status-dot" />
            <div><strong>aks-gitops-dev</strong><span>Central India · Connected</span></div>
          </div>
          <button className="nav-item"><Settings2 /><span>Settings</span></button>
        </div>
      </aside>

      <section className="content-panel">
        <header className="topbar">
          <div><p className="eyebrow">Development environment</p><h1>Deployment overview</h1></div>
          <div className="topbar-actions">
            <Badge variant="outline" className="environment-badge"><span className="status-dot" /> dev</Badge>
            <Button onClick={syncApplication} disabled={syncing} className="sync-button">
              <RefreshCw className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing" : "Sync now"}
            </Button>
          </div>
        </header>

        <div className="dashboard-body">
          <section className="summary-grid" aria-label="Deployment summary">
            <article className="summary-card healthy-card">
              <div className="summary-title"><ShieldCheck /><span>Application health</span></div>
              <div className="summary-value">Healthy</div><p>3 of 3 workloads ready</p>
            </article>
            <article className="summary-card">
              <div className="summary-title"><RefreshCw /><span>Sync status</span></div>
              <div className="summary-value">Synced</div><p>Updated {lastSync}</p>
            </article>
            <article className="summary-card">
              <div className="summary-title"><Container /><span>Current release</span></div>
              <div className="summary-value mono">{version}</div><p>Image sha-8f31c2a</p>
            </article>
            <article className="summary-card">
              <div className="summary-title"><Activity /><span>Error rate</span></div>
              <div className="summary-value">0.18%</div><p className="positive">↓ 0.07% over 24h</p>
            </article>
          </section>

          <section className="pipeline-card">
            <div className="section-heading">
              <div><p className="eyebrow">Delivery path</p><h2>Commit to cluster</h2></div>
              <Badge variant="outline" className="healthy-badge"><Check /> All stages passed</Badge>
            </div>
            <div className="pipeline-flow">
              {pipeline.map((step, index) => (
                <div className="pipeline-group" key={step.label}>
                  <div className="pipeline-step">
                    <div className="pipeline-icon"><step.icon /></div>
                    <div><strong>{step.label}</strong><span>{step.detail}</span></div>
                    <Check className="step-check" />
                  </div>
                  {index < pipeline.length - 1 && <ChevronRight className="pipeline-arrow" />}
                </div>
              ))}
            </div>
          </section>

          <section className="main-grid">
            <article className="application-card">
              <div className="section-heading compact">
                <div><p className="eyebrow">Argo CD application</p><h2>gitops-dashboard</h2></div>
                <Badge className="healthy-badge"><span className="status-dot" /> Healthy</Badge>
              </div>
              <Tabs defaultValue="resources" className="application-tabs">
                <TabsList variant="line">
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="resources">
                  <div className="resource-list">
                    <ResourceRow icon={LayoutDashboard} name="frontend" kind="Deployment" replicas="2 / 2" />
                    <ResourceRow icon={ServerCog} name="backend" kind="Deployment" replicas="2 / 2" />
                    <ResourceRow icon={TerminalSquare} name="backend-api" kind="Service" replicas="Active" />
                  </div>
                </TabsContent>
                <TabsContent value="history">
                  <div className="history-list">
                    {history.map((item) => (
                      <div className="history-row" key={item.commit}>
                        <span className="timeline-dot" />
                        <div><strong>{item.version}</strong><span>{item.actor} · {item.time}</span></div>
                        <code>{item.commit}</code>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
              <div className="application-actions">
                <div><span>Namespace</span><code>gitops-dev</code></div>
                <div><span>Revision</span><code>main@8f31c2a</code></div>
                <Button variant="outline" onClick={rollback}><RotateCcw /> Roll back</Button>
              </div>
            </article>

            <article className="metrics-card">
              <div className="section-heading compact">
                <div><p className="eyebrow">Prometheus · 1 hour</p><h2>Request traffic</h2></div><Activity />
              </div>
              <div className="metric-number">1,248 <span>req/min</span></div>
              <div className="bar-chart" aria-label="Request traffic trend">
                {bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
              </div>
              <div className="metric-lines">
                <MetricLine label="P95 latency" value="184 ms" progress={58} />
                <MetricLine label="CPU usage" value="42%" progress={42} />
                <MetricLine label="Memory usage" value="61%" progress={61} />
              </div>
            </article>
          </section>

          <footer className="dashboard-footer">
            <span><span className="status-dot" /> Platform operational</span>
            <span>Desired state: <code>main@8f31c2a</code></span>
            <span>Auto-sync · Prune · Self-heal</span>
          </footer>
        </div>
      </section>
      <Toaster position="bottom-right" />
    </main>
  );
}

function ResourceRow({ icon: Icon, name, kind, replicas }: { icon: typeof Boxes; name: string; kind: string; replicas: string }) {
  return (
    <div className="resource-row">
      <div className="resource-icon"><Icon /></div>
      <div className="resource-name"><strong>{name}</strong><span>{kind}</span></div>
      <Badge variant="outline" className="sync-badge"><RefreshCw /> Synced</Badge>
      <div className="replicas"><span>Ready</span><strong>{replicas}</strong></div>
    </div>
  );
}

function MetricLine({ label, value, progress }: { label: string; value: string; progress: number }) {
  return <div className="metric-line"><div><span>{label}</span><strong>{value}</strong></div><Progress value={progress} /></div>;
}
