# Architecture and workflow

## What this project proves

The project separates continuous integration from continuous delivery. GitHub Actions builds and publishes immutable artifacts. It does not push Kubernetes changes directly. Argo CD performs delivery by pulling the desired state from Git and reconciling it into AKS.

## End-to-end workflow

1. A developer creates a feature branch and opens a pull request.
2. GitHub Actions checks out the repository, tests the frontend and backend, and verifies both builds.
3. After a merge to `main`, GitHub Actions authenticates to Azure using OIDC. There is no long-lived Azure password in GitHub.
4. The workflows build two Docker images and push them to Azure Container Registry. Each image is tagged with the full Git commit SHA, so the artifact is traceable and immutable.
5. A controlled Git change updates `helm/gitops-dashboard/values.yaml` to the new image tag. This commit becomes the desired deployment state.
6. Argo CD watches the repository, detects the difference, renders the Helm chart, and applies it to the `gitops-dev` namespace in AKS.
7. Kubernetes starts a rolling update. Readiness probes keep traffic away from unready pods; liveness probes restart unhealthy containers.
8. Argo CD reports health and sync state. With pruning and self-healing enabled, removed resources are deleted and unauthorized live changes are corrected.
9. Prometheus scrapes application and Kubernetes metrics. Grafana queries Prometheus for operational dashboards and alert evaluation.
10. FastAPI queries the Argo CD and Prometheus APIs. The custom dashboard converts their data into application health, desired-versus-live status, deployment history, metrics, and controlled operator actions.

## Three connected paths

### Delivery path

`Developer -> GitHub -> GitHub Actions -> ACR -> Git desired state -> Argo CD -> Helm -> AKS`

### Observability path

`AKS workloads -> /metrics -> Prometheus -> Grafana and FastAPI -> custom dashboard`

### Recovery path

`Select healthy revision -> create/revert Git change -> Argo CD reconciliation -> Kubernetes rollout -> health verification`

Git revert is the preferred GitOps rollback because the repository remains an accurate audit trail. A direct Helm rollback is useful for emergency recovery, but the matching Git desired state must then be corrected or Argo CD will restore the Git version.

## Component responsibilities

| Component | Responsibility | It must not own |
| --- | --- | --- |
| GitHub | Source, review, desired-state history | Live cluster state |
| GitHub Actions | Tests, scans, image builds, ACR push | Kubernetes deployment |
| Docker | Reproducible frontend/backend runtime images | Infrastructure |
| ACR | Immutable image storage | Release selection |
| Terraform | Azure resource lifecycle and RBAC wiring | Application releases |
| Helm | Parameterized Kubernetes resources | Reconciliation loop |
| Argo CD | Desired-versus-live comparison and reconciliation | Image compilation |
| AKS | Runs containers and performs rolling updates | Git history |
| Prometheus | Scrapes and stores metrics | Deployment state |
| Grafana | Metrics visualization and alerts | GitOps reconciliation |
| FastAPI | Aggregates operational APIs and validates actions | Source of truth |
| Dashboard | Operator view and controlled requests | Direct unrestricted cluster access |

## Dashboard data model

- `Application`: name, namespace, project, target revision, health, and sync status.
- `Resource`: Kubernetes kind, name, readiness, health, and message.
- `Deployment`: commit SHA, image tags, actor, timestamp, result, and Argo CD operation ID.
- `Metric`: request rate, error rate, latency, CPU, memory, and availability.
- `Action`: sync or rollback request, target revision, actor, validation result, and audit timestamp.

The first slice uses realistic local data. Later phases replace it with typed Argo CD and Prometheus clients without redesigning the operator experience.

## Security boundaries

- Use GitHub-to-Azure OIDC and short-lived tokens.
- Keep the Argo CD API token in Kubernetes secrets or a managed secret system, never in frontend JavaScript.
- Route sync and rollback through FastAPI authorization and audit logic.
- Give CI push access to ACR only; it does not need AKS administrator access.
- Give Argo CD access only to approved repositories, namespaces, and resource types.
- Disable ACR admin credentials and use managed identities/RBAC.
- Do not expose Prometheus or Argo CD publicly without authentication.

## Definition of done

The project is finished only when a commit triggers tests and image delivery, Argo CD deploys a Git-selected immutable image, live health and metrics appear in the custom dashboard, a controlled drift test self-heals, and a previous release is restored with captured evidence.
