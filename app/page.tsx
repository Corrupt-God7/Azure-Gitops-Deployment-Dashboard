"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  Cloud,
  Container,
  GitBranch,
  History,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ViewName =
  | "Overview"
  | "Applications"
  | "Deployments"
  | "Metrics"
  | "Infrastructure"
  | "Settings";

type ApplicationStatus = {
  name: string;
  namespace: string;
  health: string;
  sync: string;
  revision: string;
};

const navigation: Array<{
  label: ViewName;
  icon: typeof Boxes;
}> = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Applications", icon: Boxes },
  { label: "Deployments", icon: History },
  { label: "Metrics", icon: Activity },
  { label: "Infrastructure", icon: Cloud },
  { label: "Settings", icon: Settings2 },
];

const titles: Record<ViewName, string> = {
  Overview: "Deployment overview",
  Applications: "Applications",
  Deployments: "Deployment history",
  Metrics: "Service metrics",
  Infrastructure: "Local infrastructure",
  Settings: "Connection settings",
};

function isApplicationStatus(
  value: unknown
): value is ApplicationStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return ["name", "namespace", "health", "sync", "revision"].every(
    (field) => typeof record[field] === "string"
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewName>("Overview");
  const [application, setApplication] =
    useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function loadApplication() {
      const requestController = new AbortController();
      controller = requestController;

      const timeout = setTimeout(
        () => requestController.abort(),
        10_000
      );

      setRefreshing(true);

      try {
        const response = await fetch("/api/applications", {
          cache: "no-store",
          signal: requestController.signal,
        });

        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected API response");
        }

        const result = data
          .filter(isApplicationStatus)
          .find((item) => item.name === "gitops-dashboard");

        if (!result) {
          throw new Error(
            "The API did not return a valid gitops-dashboard application"
          );
        }

        if (!stopped) {
          setApplication(result);
          setError(null);
          setCheckedAt(new Date().toLocaleTimeString());
        }
      } catch (failure) {
        if (!stopped) {
          setApplication(null);
          setError(
            failure instanceof Error && failure.name === "AbortError"
              ? "The backend request timed out"
              : failure instanceof Error
                ? failure.message
                : "Unable to retrieve application status"
          );
        }
      } finally {
        clearTimeout(timeout);

        if (!stopped) {
          setRefreshing(false);
          timer = setTimeout(loadApplication, 15_000);
        }
      }
    }

    void loadApplication();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [refreshKey]);

  function openView(view: ViewName) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fallback = error ? "Unavailable" : "Loading";
  const health = application?.health ?? fallback;
  const sync = application?.sync ?? fallback;
  const revision = application?.revision ?? "—";

  return (
    <main className="app-shell">
      <aside className="sidebar-panel">
        <button
          className="brand-mark"
          onClick={() => openView("Overview")}
          aria-label="Open overview"
        >
          <div className="brand-icon">
            <GitBranch />
          </div>
          <div>
            <strong>GitOps</strong>
            <span>CONTROL</span>
          </div>
        </button>

        <nav aria-label="Primary navigation" className="primary-nav">
          <p className="nav-label">Workspace</p>

          {navigation.map((item) => (
            <button
              key={item.label}
              onClick={() => openView(item.label)}
              className={
                activeView === item.label
                  ? "nav-item active"
                  : "nav-item"
              }
              aria-current={
                activeView === item.label ? "page" : undefined
              }
            >
              <item.icon />
              <span>{item.label}</span>
              {activeView === item.label && (
                <span className="nav-pip" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            className="cluster-chip"
            onClick={() => openView("Infrastructure")}
          >
            <Boxes />
            <div>
              <strong>gitops-dev</strong>
              <span>Local kind environment</span>
            </div>
          </button>
        </div>
      </aside>

      <section className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Development environment</p>
            <h1>{titles[activeView]}</h1>
          </div>

          <div className="topbar-actions">
            <Badge variant="outline" className="environment-badge">
              dev
            </Badge>

            <Button
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={refreshing}
              className="sync-button"
            >
              <RefreshCw
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing…" : "Refresh status"}
            </Button>
          </div>
        </header>

        <div className="dashboard-body">
          {error && (
            <section className="data-card" role="alert">
              <h2>Application status unavailable</h2>
              <p>{error}. Retrying automatically.</p>
              {checkedAt && (
                <p>Last successful check: {checkedAt}</p>
              )}
            </section>
          )}

          {activeView === "Overview" && (
            <>
              <section
                className="summary-grid"
                aria-label="Live deployment summary"
              >
                <SummaryCard
                  icon={ShieldCheck}
                  label="Application health"
                  value={health}
                  note="Reported by Argo CD"
                  healthy={health === "Healthy"}
                />
                <SummaryCard
                  icon={RefreshCw}
                  label="Sync status"
                  value={sync}
                  note="Git compared with cluster state"
                />
                <SummaryCard
                  icon={GitBranch}
                  label="Git revision"
                  value={revision}
                  note="Configuration revision, not image tag"
                />
                <SummaryCard
                  icon={Boxes}
                  label="Namespace"
                  value={application?.namespace ?? "—"}
                  note="Application destination"
                />
              </section>

              <section className="main-grid">
                <ApplicationCard
                  application={application}
                  fallback={fallback}
                  checkedAt={checkedAt}
                />

                <article className="metrics-card">
                  <div className="section-heading compact">
                    <div>
                      <p className="eyebrow">Monitoring</p>
                      <h2>Not connected yet</h2>
                    </div>
                    <Activity />
                  </div>
                  <p>
                    Request traffic, errors, CPU and memory will
                    appear after monitoring integration is configured.
                  </p>
                </article>
              </section>

              <section className="data-card">
                <p className="eyebrow">Environment configuration</p>
                <h2>GitHub Actions · GHCR · Argo CD · kind</h2>
                <p>
                  Application health and sync status come from the API.
                  CI runs, registry contents and individual node status
                  are not queried by this screen yet.
                </p>
              </section>
            </>
          )}

          {activeView === "Applications" && (
            <ApplicationCard
              application={application}
              fallback={fallback}
              checkedAt={checkedAt}
            />
          )}

          {activeView === "Deployments" && (
            <PendingSection
              title="Deployment history is not connected yet"
              description="The API currently returns application status, not release history or image versions. Use Argo CD to inspect deployment history and perform recovery operations."
            />
          )}

          {activeView === "Metrics" && (
            <PendingSection
              title="Monitoring is not connected yet"
              description="Prometheus and Grafana integration is a later step. No sample request rates, latency values or resource metrics are shown here."
            />
          )}

          {activeView === "Infrastructure" && (
            <section className="data-card">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Configured environment</p>
                  <h2>Local Kubernetes and GHCR</h2>
                </div>
                <Container />
              </div>

              <div className="detail-facts">
                <Fact label="Cluster" value="gitops-dev" />
                <Fact label="Platform" value="kind on Docker Desktop" />
                <Fact
                  label="Node"
                  value="gitops-dev-control-plane"
                />
                <Fact
                  label="Image registry"
                  value="ghcr.io/corrupt-god7"
                />
              </div>

              <p>
                These are configured environment details, not live
                infrastructure measurements. This environment does
                not use Azure AKS or ACR.
              </p>
            </section>
          )}

          {activeView === "Settings" && (
            <section className="data-card">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Dashboard connection</p>
                  <h2>Read-only application status</h2>
                </div>
                <Settings2 />
              </div>

              <div className="detail-facts">
                <Fact label="API endpoint" value="/api/applications" />
                <Fact
                  label="Polling"
                  value="15 seconds after each completed request"
                />
                <Fact label="Request timeout" value="10 seconds" />
                <Fact label="Application" value="gitops-dashboard" />
              </div>

              <p>
                Refresh status only reads data. It does not deploy,
                synchronize, delete or roll back any resources.
              </p>
              <p>
                Manage auto-sync, pruning and self-healing in Argo CD.
                This API does not currently return those settings.
              </p>
            </section>
          )}

          <footer className="dashboard-footer">
            <span>
              {application
                ? "Application API connected"
                : error
                  ? "Application API unavailable"
                  : "Connecting to application API"}
            </span>
            <span>Git revision: {revision}</span>
            <span>Read-only dashboard</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function ApplicationCard({
  application,
  fallback,
  checkedAt,
}: {
  application: ApplicationStatus | null;
  fallback: string;
  checkedAt: string | null;
}) {
  const health = application?.health ?? fallback;

  return (
    <article className="application-card">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Argo CD application</p>
          <h2>{application?.name ?? "gitops-dashboard"}</h2>
        </div>

        <Badge
          className={
            health === "Healthy"
              ? "healthy-badge"
              : "neutral-badge"
          }
        >
          {health}
        </Badge>
      </div>

      <div className="detail-facts">
        <Fact
          label="Namespace"
          value={application?.namespace ?? "—"}
        />
        <Fact
          label="Sync status"
          value={application?.sync ?? fallback}
        />
        <Fact
          label="Git revision"
          value={application?.revision ?? "—"}
        />
        <Fact
          label="Last successful API check"
          value={checkedAt ?? "Not checked yet"}
        />
      </div>

      <p>
        Pod counts, image versions and deployment history are not
        included in the current API response.
      </p>
    </article>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
  healthy = false,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  note: string;
  healthy?: boolean;
}) {
  return (
    <article
      className={
        healthy ? "summary-card healthy-card" : "summary-card"
      }
    >
      <div className="summary-title">
        <Icon />
        <span>{label}</span>
      </div>
      <div className="summary-value">{value}</div>
      <p>{note}</p>
    </article>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PendingSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="data-card">
      <p className="eyebrow">Upcoming integration</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}