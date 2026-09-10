import logging
import os
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="GitOps Dashboard API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)
KUBERNETES_API_URL = os.getenv("KUBERNETES_API_URL", "https://kubernetes.default.svc")
ARGOCD_NAMESPACE = os.getenv("ARGOCD_NAMESPACE", "argocd")
ARGOCD_APPLICATION = os.getenv("ARGOCD_APPLICATION", "gitops-dashboard")
WORKLOAD_NAMESPACE = os.getenv("WORKLOAD_NAMESPACE", "gitops-dev")
WORKLOAD_NAMES = ("gitops-dashboard-frontend", "gitops-dashboard-backend")
SERVICE_ACCOUNT_PATH = Path("/var/run/secrets/kubernetes.io/serviceaccount")
TOKEN_PATH = SERVICE_ACCOUNT_PATH / "token"
CA_PATH = SERVICE_ACCOUNT_PATH / "ca.crt"


class ContainerStatus(BaseModel):
    name: str
    image: str
    image_id: str | None = None
    state: str
    ready: bool
    restarts: int


class PodStatus(BaseModel):
    name: str
    phase: str
    ready: bool
    terminating: bool
    containers: list[ContainerStatus]


class DesiredImage(BaseModel):
    name: str
    image: str


class Workload(BaseModel):
    name: str
    exists: bool
    desired_replicas: int | None
    active_pods: int
    ready_pods: int
    terminating_pods: int
    desired_images: list[DesiredImage]
    pods: list[PodStatus]


class DeploymentHistory(BaseModel):
    id: int
    revision: str
    deployed_at: str | None
    deploy_started_at: str | None
    initiated_by: str
    current: bool


class Application(BaseModel):
    name: str
    namespace: str
    health: str
    sync: str
    revision: str
    workloads: list[Workload] = Field(default_factory=list)
    workloads_error: str | None = None
    history: list[DeploymentHistory] = Field(default_factory=list)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/ready")
def ready() -> dict[str, bool]:
    return {"ready": True}


def kubernetes_client() -> httpx.Client:
    try:
        # Read for each request to support projected service-account token rotation.
        token = TOKEN_PATH.read_text(encoding="utf-8").strip()
        context = ssl.create_default_context(cafile=str(CA_PATH))
        if not token:
            raise ValueError("Empty service-account token")
    except (OSError, ValueError) as error:
        raise HTTPException(503, "Kubernetes service-account credentials unavailable") from error
    return httpx.Client(
        base_url=KUBERNETES_API_URL.rstrip("/"),
        headers={"Authorization": f"Bearer {token}"},
        verify=context,
        timeout=2.0,
        trust_env=False,
    )


def get_json(client: httpx.Client, path: str, params: dict | None = None,
             missing_ok: bool = False) -> dict | None:
    response = client.get(path, params=params)
    if missing_ok and response.status_code == 404:
        return None
    response.raise_for_status()
    result = response.json()
    if not isinstance(result, dict):
        raise ValueError("Unexpected Kubernetes response")
    return result


def summarize_pod(document: dict) -> PodStatus:
    metadata = document.get("metadata") or {}
    status = document.get("status") or {}
    terminating = bool(metadata.get("deletionTimestamp"))
    phase = status.get("phase") or "Unknown"
    ready = (
        not terminating
        and phase == "Running"
        and any(c.get("type") == "Ready" and c.get("status") == "True"
                for c in status.get("conditions", []))
    )
    observed = {c["name"]: c for c in status.get("containerStatuses", [])}
    containers = []
    for spec in document.get("spec", {}).get("containers", []):
        current = observed.get(spec["name"], {})
        state = current.get("state") or {}
        if "waiting" in state:
            state_name = state["waiting"].get("reason") or "Waiting"
        elif "terminated" in state:
            state_name = state["terminated"].get("reason") or "Terminated"
        elif "running" in state:
            state_name = "Running"
        else:
            state_name = "Not started"
        containers.append(ContainerStatus(
            name=spec["name"], image=spec.get("image") or "Unknown",
            image_id=current.get("imageID") or None, state=state_name,
            ready=bool(current.get("ready", False)),
            restarts=current.get("restartCount", 0),
        ))
    return PodStatus(name=metadata["name"], phase=phase, ready=ready,
                     terminating=terminating, containers=containers)


def get_workloads(client: httpx.Client) -> list[Workload]:
    namespace = quote(WORKLOAD_NAMESPACE, safe="")
    pod_documents = []
    continuation = ""
    while True:
        params = {
            "labelSelector": f"app in ({','.join(WORKLOAD_NAMES)})",
            "limit": "500",
        }
        if continuation:
            params["continue"] = continuation
        page = get_json(client, f"/api/v1/namespaces/{namespace}/pods", params)
        pod_documents.extend(page.get("items", []))
        continuation = page.get("metadata", {}).get("continue", "")
        if not continuation:
            break

    workloads = []
    for name in WORKLOAD_NAMES:
        deployment = get_json(
            client, f"/apis/apps/v1/namespaces/{namespace}/deployments/{name}",
            missing_ok=True,
        )
        # These are the app labels used by this project's Helm chart.
        pods = [summarize_pod(p) for p in pod_documents
                if p.get("metadata", {}).get("labels", {}).get("app") == name]
        pods.sort(key=lambda p: p.name)
        active = [p for p in pods if not p.terminating
                  and p.phase not in ("Succeeded", "Failed")]
        specification = deployment.get("spec", {}) if deployment else {}
        desired_images = [DesiredImage(name=c["name"], image=c["image"])
                          for c in specification.get("template", {}).get("spec", {}).get("containers", [])]
        workloads.append(Workload(
            name=name, exists=deployment is not None,
            desired_replicas=specification.get("replicas", 1) if deployment else None,
            active_pods=len(active), ready_pods=sum(p.ready for p in active),
            terminating_pods=sum(p.terminating for p in pods),
            desired_images=desired_images, pods=pods,
        ))
    return workloads


def get_deployment_history(status: dict) -> list[DeploymentHistory]:
    current_revision = (status.get("sync") or {}).get("revision") or ""
    raw_history = status.get("history") or []
    if not isinstance(raw_history, list):
        return []
    result = []
    # Argo CD stores history oldest-first. The dashboard shows the latest first.
    for fallback_id, item in reversed(list(enumerate(raw_history))):
        if not isinstance(item, dict):
            continue
        revision = item.get("revision")
        if not isinstance(revision, str) or not revision:
            continue
        identifier = item.get("id")
        if not isinstance(identifier, int) or isinstance(identifier, bool):
            identifier = fallback_id
        initiated = item.get("initiatedBy") or {}
        username = initiated.get("username") if isinstance(initiated, dict) else None
        if isinstance(username, str) and username.strip():
            initiated_by = username.strip()
        elif isinstance(initiated, dict) and initiated.get("automated") is True:
            initiated_by = "Automated sync"
        else:
            initiated_by = "Unknown"
        deployed_at = item.get("deployedAt")
        deploy_started_at = item.get("deployStartedAt")
        result.append(DeploymentHistory(
            id=identifier,
            revision=revision[:7],
            deployed_at=deployed_at if isinstance(deployed_at, str) else None,
            deploy_started_at=(deploy_started_at
                               if isinstance(deploy_started_at, str) else None),
            initiated_by=initiated_by,
            current=revision == current_revision,
        ))
    return result


@app.get("/api/applications", response_model=list[Application])
def applications() -> list[Application]:
    with kubernetes_client() as client:
        try:
            document = get_json(
                client,
                f"/apis/argoproj.io/v1alpha1/namespaces/{quote(ARGOCD_NAMESPACE, safe='')}"
                f"/applications/{quote(ARGOCD_APPLICATION, safe='')}",
            )
        except httpx.HTTPStatusError as error:
            raise HTTPException(502, f"Kubernetes API returned {error.response.status_code}") from error
        except (httpx.RequestError, ValueError) as error:
            raise HTTPException(502, "Unable to read Argo CD application status") from error

        status = document.get("status") or {}
        destination = document.get("spec", {}).get("destination", {})
        result = Application(
            name=document.get("metadata", {}).get("name", ARGOCD_APPLICATION),
            namespace=destination.get("namespace") or "unknown",
            health=(status.get("health") or {}).get("status") or "Unknown",
            sync=(status.get("sync") or {}).get("status") or "Unknown",
            revision=((status.get("sync") or {}).get("revision") or "unknown")[:7],
            history=get_deployment_history(status),
        )
        if result.namespace != WORKLOAD_NAMESPACE:
            result.workloads_error = "Application destination does not match the configured workload namespace."
            return [result]
        try:
            result.workloads = get_workloads(client)
        except httpx.HTTPStatusError as error:
            result.workloads_error = (
                f"Workload access returned HTTP {error.response.status_code}. "
                "Check the backend service account and workload RoleBinding."
            )
        except (httpx.RequestError, ValueError, KeyError, TypeError):
            logger.warning("Workload snapshot unavailable")
            result.workloads_error = "Unable to retrieve workload details. Retrying on the next refresh."
        return [result]
