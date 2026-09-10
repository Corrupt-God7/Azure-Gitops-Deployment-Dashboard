import asyncio

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import monitoring


def test_instrumentation_records_success_and_failure_but_excludes_probes():
    async def target(scope, receive, send):
        if scope.get("query_string") == b"fail":
            raise RuntimeError("test failure")
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(message):
        pass

    middleware = monitoring.ApplicationMetricsMiddleware(target)
    before = monitoring.REGISTRY.get_sample_value("gitops_http_requests_total", {"status_class": "2xx"})
    failures = monitoring.REGISTRY.get_sample_value("gitops_http_requests_total", {"status_class": "5xx"})
    for path in ("/health", "/ready", "/metrics", "/api/metrics", "/api/applications"):
        asyncio.run(middleware({"type": "http", "path": path}, receive, send))
    try:
        asyncio.run(middleware({"type": "http", "path": "/api/applications", "query_string": b"fail"}, receive, send))
    except RuntimeError:
        pass
    assert monitoring.REGISTRY.get_sample_value("gitops_http_requests_total", {"status_class": "2xx"}) == before + 1
    assert monitoring.REGISTRY.get_sample_value("gitops_http_requests_total", {"status_class": "5xx"}) == failures + 1


def results(scrape=1, requests=2):
    return {"cpu": [({"container": "backend"}, 0.002)], "memory": [],
            "scrape": [({}, scrape)], "requests": [({}, requests)],
            "errors": [({}, 0.1)], "latency": [({}, 0.2)]}


def test_units_and_missing_measurements():
    data = monitoring.snapshot(results())
    assert data["requests_per_second"] == 2
    assert data["server_error_percent"] == 5
    assert data["p95_latency_ms"] == 200
    assert data["workloads"][0]["cpu_cores"] is None
    assert data["workloads"][1]["cpu_cores"] == 0.002
    assert data["workloads"][1]["memory_bytes"] is None


def test_failed_scrape_and_no_traffic_do_not_look_healthy():
    failed = monitoring.snapshot(results(scrape=0))
    assert failed["scrape_healthy"] is False
    assert failed["requests_per_second"] is None
    assert failed["server_error_percent"] is None
    idle = monitoring.snapshot(results(requests=0))
    assert idle["requests_per_second"] == 0
    assert idle["server_error_percent"] is None
    assert idle["p95_latency_ms"] is None
    empty = monitoring.snapshot({key: [] for key in monitoring.QUERIES})
    assert empty["scrape_healthy"] is None
    assert empty["requests_per_second"] is None


def test_prometheus_nonfinite_values_are_unavailable():
    assert monitoring.vector({"status": "success", "data": {"resultType": "vector", "result": [{"metric": {}, "value": [1, "NaN"]}]}}) == []


def test_metrics_endpoint_queries_prometheus_and_handles_failure(monkeypatch):
    real_client = httpx.AsyncClient
    calls = []

    def handler(request):
        calls.append(request.url.params["query"])
        return httpx.Response(200, json={"status": "success", "data": {"resultType": "vector", "result": []}})

    monkeypatch.setattr(monitoring.httpx, "AsyncClient", lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(handler)))
    app = FastAPI()
    app.include_router(monitoring.router)
    with TestClient(app) as client:
        response = client.get("/api/metrics")
        assert response.status_code == 200
        assert len(calls) == len(monitoring.QUERIES)
        assert response.json()["requests_per_second"] is None
        assert "gitops_http_request_duration_seconds_bucket" in client.get("/metrics").text

        def fail(request):
            return httpx.Response(503)

        monkeypatch.setattr(monitoring.httpx, "AsyncClient", lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(fail)))
        assert client.get("/api/metrics").status_code == 503
