"""Single-process Uvicorn instrumentation and fixed, read-only Prometheus queries."""
import asyncio
import json
import math
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Response
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Histogram, generate_latest

router = APIRouter()
REGISTRY = CollectorRegistry()
REQUESTS = Counter("gitops_http_requests_total", "Application API responses", ["status_class"], registry=REGISTRY)
DURATION = Histogram("gitops_http_request_duration_seconds", "Application API response duration", registry=REGISTRY)
for status_class in ("1xx", "2xx", "3xx", "4xx", "5xx"):
    REQUESTS.labels(status_class)


class ApplicationMetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Bounded route scope; probes and monitoring polling do not inflate traffic.
        if scope["type"] != "http" or scope.get("path") != "/api/applications":
            return await self.app(scope, receive, send)
        started = time.perf_counter()
        status = 500

        async def record_send(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, record_send)
        finally:
            REQUESTS.labels(f"{status // 100}xx").inc()
            DURATION.observe(time.perf_counter() - started)


@router.get("/metrics", include_in_schema=False)
def exposition():
    return Response(generate_latest(REGISTRY), headers={"Content-Type": CONTENT_TYPE_LATEST})


PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090")
NAMESPACE = os.getenv("WORKLOAD_NAMESPACE", "gitops-dev")
ns = json.dumps(NAMESPACE)
resource_labels = f'namespace={ns},pod=~"gitops-dashboard-(frontend|backend)-.*",container=~"frontend|backend",image!=""'
http_labels = f'namespace={ns},service="gitops-dashboard-backend"'
QUERIES = {
    "cpu": f'sum by (container) (max by (namespace,pod,container) (rate(container_cpu_usage_seconds_total{{{resource_labels}}}[5m])))',
    "memory": f'sum by (container) (max by (namespace,pod,container) (container_memory_working_set_bytes{{{resource_labels}}}))',
    "scrape": f'min(up{{{http_labels}}})',
    "requests": f'sum(rate(gitops_http_requests_total{{{http_labels}}}[5m]))',
    "errors": f'sum(rate(gitops_http_requests_total{{{http_labels},status_class="5xx"}}[5m]))',
    "latency": f'histogram_quantile(0.95, sum by (le) (rate(gitops_http_request_duration_seconds_bucket{{{http_labels}}}[5m])))',
}


def vector(document):
    if document.get("status") != "success" or document.get("warnings"):
        raise ValueError("Prometheus query failed or returned partial results")
    data = document.get("data", {})
    if data.get("resultType") != "vector" or not isinstance(data.get("result"), list):
        raise ValueError("Unexpected Prometheus response")
    result = []
    for item in data["result"]:
        value = float(item["value"][1])
        # NaN is expected for latency when there is no traffic.
        if math.isfinite(value) and value >= 0:
            result.append((item["metric"], value))
    return result


def scalar(rows):
    return rows[0][1] if len(rows) == 1 else None


def snapshot(results):
    cpu = {labels.get("container"): value for labels, value in results["cpu"]}
    memory = {labels.get("container"): value for labels, value in results["memory"]}
    scrape = scalar(results["scrape"])
    requests = scalar(results["requests"]) if scrape == 1 else None
    errors = scalar(results["errors"]) if scrape == 1 else None
    latency = scalar(results["latency"]) if scrape == 1 and requests and requests > 0 else None
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "namespace": NAMESPACE,
        "window_seconds": 300,
        "scrape_healthy": None if scrape is None else scrape == 1,
        "requests_per_second": requests,
        "server_error_percent": errors / requests * 100 if errors is not None and requests and requests > 0 else None,
        "p95_latency_ms": latency * 1000 if latency is not None else None,
        "workloads": [{"name": name, "cpu_cores": cpu.get(name), "memory_bytes": memory.get(name)} for name in ("frontend", "backend")],
    }


@router.get("/api/metrics")
async def metrics():
    async def collect():
        async with httpx.AsyncClient(base_url=PROMETHEUS_URL.rstrip("/"), timeout=4.0, trust_env=False) as client:
            async def query(expression):
                response = await client.get("/api/v1/query", params={"query": expression, "timeout": "3s"})
                response.raise_for_status()
                return vector(response.json())
            values = await asyncio.gather(*(query(expression) for expression in QUERIES.values()))
            return snapshot(dict(zip(QUERIES, values)))
    try:
        return await asyncio.wait_for(collect(), timeout=6.0)
    except (httpx.HTTPError, TimeoutError, ValueError, KeyError, TypeError, IndexError) as error:
        raise HTTPException(503, "Prometheus measurements unavailable. Check monitoring and retry.") from error
