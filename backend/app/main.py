from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="GitOps Dashboard API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


class Application(BaseModel):
    name: str
    namespace: str
    health: Literal["Healthy", "Progressing", "Degraded"]
    sync: Literal["Synced", "OutOfSync"]
    revision: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/ready")
def ready() -> dict[str, bool]:
    return {"ready": True}


@app.get("/api/applications", response_model=list[Application])
def applications() -> list[Application]:
    """Development data. Day 17 replaces this with the Argo CD API client."""
    return [
        Application(
            name="gitops-dashboard",
            namespace="gitops-dev",
            health="Healthy",
            sync="Synced",
            revision="8f31c2a",
        )
    ]
