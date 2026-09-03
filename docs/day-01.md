# Day 1 - MVP and architecture decision

Date: 2026-09-03
Status: Complete

## Approved MVP

- Applications list and application details
- Health and synchronization state
- Deployment history with commit/image traceability
- Request, error, latency, CPU, and memory metrics
- Controlled sync action
- Controlled rollback action
- Responsive React dashboard
- FastAPI integration layer

## Explicitly deferred

- User authentication and fine-grained authorization
- Multiple clusters and environments
- Application database
- Production ingress, DNS, TLS, and high availability
- Automated environment promotion
- Advanced policy enforcement and supply-chain signing

## Architecture decisions

- Azure development environment: AKS, ACR, Log Analytics, Central India if quota allows.
- Terraform owns Azure resources.
- GitHub Actions performs CI and image publishing with Azure OIDC.
- Argo CD performs continuous delivery; CI does not call `kubectl apply`.
- Helm packages frontend and backend resources.
- Prometheus supplies metrics and Grafana provides the operational metrics dashboard.
- FastAPI aggregates Argo CD and Prometheus data for the custom UI.
- Git is the deployment source of truth.

## Evidence produced

- Functional frontend product slice with overview, resource list, history tab, metrics, sync simulation, and rollback simulation.
- FastAPI health, readiness, and development applications endpoints.
- Initial repository layout for all platform workstreams.
- Architecture and source-of-truth documentation.
- No chargeable Azure resource created.

## Day 2 entry gate

Before Terraform is applied, record:

- Subscription name and Enabled status
- Tenant/directory name
- Effective Azure RBAC role
- Confirmed Azure region
- Confirmed globally unique ACR name
- Approved spending and cleanup boundary
