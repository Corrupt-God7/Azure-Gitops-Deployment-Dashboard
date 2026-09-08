import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="GitOps Dashboard API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


KUBERNETES_API_URL = os.getenv(
    "KUBERNETES_API_URL",
    "https://kubernetes.default.svc",
)
ARGOCD_NAMESPACE = os.getenv("ARGOCD_NAMESPACE", "argocd")
ARGOCD_APPLICATION = os.getenv(
    "ARGOCD_APPLICATION",
    "gitops-dashboard",
)

SERVICE_ACCOUNT_PATH = Path(
    "/var/run/secrets/kubernetes.io/serviceaccount"
)
TOKEN_PATH = SERVICE_ACCOUNT_PATH / "token"
CA_PATH = SERVICE_ACCOUNT_PATH / "ca.crt"


class Application(BaseModel):
    name: str
    namespace: str
    health: str
    sync: str
    revision: str


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready")
def ready() -> dict[str, bool]:
    return {"ready": True}


def get_argocd_application() -> dict:
    try:
        token = TOKEN_PATH.read_text(encoding="utf-8").strip()
    except OSError as error:
        raise HTTPException(
            status_code=503,
            detail="Kubernetes service-account token is unavailable",
        ) from error

    url = (
        f"{KUBERNETES_API_URL}"
        f"/apis/argoproj.io/v1alpha1"
        f"/namespaces/{ARGOCD_NAMESPACE}"
        f"/applications/{ARGOCD_APPLICATION}"
    )

    try:
        response = httpx.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            verify=str(CA_PATH),
            timeout=5.0,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as error:
        raise HTTPException(
            status_code=502,
            detail=(
                "Kubernetes API returned "
                f"{error.response.status_code}"
            ),
        ) from error
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to the Kubernetes API",
        ) from error


@app.get(
    "/api/applications",
    response_model=list[Application],
)
def applications() -> list[Application]:
    document = get_argocd_application()

    metadata = document.get("metadata", {})
    specification = document.get("spec", {})
    status = document.get("status", {})

    destination = specification.get("destination", {})
    health_status = status.get("health", {})
    sync_status = status.get("sync", {})

    revision = sync_status.get("revision", "unknown")
    if len(revision) > 7:
        revision = revision[:7]

    return [
        Application(
            name=metadata.get("name", ARGOCD_APPLICATION),
            namespace=destination.get("namespace", "unknown"),
            health=health_status.get("status", "Unknown"),
            sync=sync_status.get("status", "Unknown"),
            revision=revision,
        )
    ]