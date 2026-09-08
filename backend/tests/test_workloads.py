import httpx
from fastapi.testclient import TestClient
from app import main

FRONTEND, BACKEND = main.WORKLOAD_NAMES


def pod(name, ready=True, phase="Running", terminating=False, image_id="sha256:old"):
    return {
        "metadata": {"name": name, "labels": {"app": FRONTEND},
                     **({"deletionTimestamp": "2026-09-08T00:00:00Z"} if terminating else {})},
        "spec": {"containers": [{"name": "frontend", "image": "ghcr.io/example/frontend:dev"}]},
        "status": {"phase": phase, "conditions": [{"type": "Ready", "status": "True" if ready else "False"}],
                   "containerStatuses": [{"name": "frontend", "imageID": image_id,
                                          "ready": ready, "restartCount": 2,
                                          "state": {"running": {}}}]},
    }


def response(monkeypatch, pods=None, pod_status=200, replicas=1, missing=False, pages=False):
    calls = []
    def handler(request):
        calls.append(request)
        if "/applications/" in request.url.path:
            return httpx.Response(200, json={"metadata": {"name": "gitops-dashboard"},
                "spec": {"destination": {"namespace": "gitops-dev"}},
                "status": {"health": {"status": "Healthy"}, "sync": {"status": "Synced", "revision": "abcdef123456"}}})
        if request.url.path.endswith("/pods"):
            if pages and not request.url.params.get("continue"):
                return httpx.Response(200, json={"items": [], "metadata": {"continue": "next"}})
            return httpx.Response(pod_status, json={"items": pods or []})
        return httpx.Response(404 if missing else 200, json={"spec": {"replicas": replicas,
            "template": {"spec": {"containers": [{"name": "app", "image": "ghcr.io/example/app:dev"}]}}}})
    monkeypatch.setattr(main, "kubernetes_client", lambda: httpx.Client(base_url="https://kubernetes.test", transport=httpx.MockTransport(handler)))
    result = TestClient(main.app).get("/api/applications")
    assert result.status_code == 200
    return result.json()[0], calls


def test_rollout_counts_and_actual_image_ids(monkeypatch):
    data, _ = response(monkeypatch, [pod("old", terminating=True), pod("new", image_id="sha256:new"),
                                   pod("starting", ready=False), pod("failed", phase="Failed")])
    workload = data["workloads"][0]
    assert (workload["desired_replicas"], workload["ready_pods"], workload["active_pods"], workload["terminating_pods"]) == (1, 1, 2, 1)
    images = {p["name"]: p["containers"][0]["image_id"] for p in workload["pods"]}
    assert images["new"] == "sha256:new" and images["old"] == "sha256:old"
    assert data["workloads"][1]["active_pods"] == 0


def test_running_is_not_necessarily_ready():
    assert main.summarize_pod(pod("unready", ready=False)).ready is False


def test_scale_to_zero_is_preserved(monkeypatch):
    data, _ = response(monkeypatch, replicas=0)
    assert data["workloads"][0]["desired_replicas"] == 0
    assert data["workloads"][0]["exists"] is True


def test_missing_deployment_is_not_reported_as_scaled_to_zero(monkeypatch):
    data, _ = response(monkeypatch, missing=True)
    assert data["workloads"][0]["desired_replicas"] is None
    assert data["workloads"][0]["exists"] is False


def test_rbac_error_preserves_application_status(monkeypatch):
    data, _ = response(monkeypatch, pod_status=403)
    assert data["health"] == "Healthy" and data["revision"] == "abcdef1"
    assert data["workloads"] == []
    assert "403" in data["workloads_error"]


def test_pod_pagination_and_namespace_scope(monkeypatch):
    data, calls = response(monkeypatch, [pod("second-page")], pages=True)
    assert data["workloads"][0]["active_pods"] == 1
    pod_calls = [request for request in calls if request.url.path.endswith("/pods")]
    assert len(pod_calls) == 2
    assert pod_calls[1].url.params["continue"] == "next"
    assert all(request.url.path == "/api/v1/namespaces/gitops-dev/pods" for request in pod_calls)
    assert FRONTEND in pod_calls[0].url.params["labelSelector"]


def test_no_observed_image_is_explicit():
    document = pod("pending", ready=False, phase="Pending")
    document["status"]["containerStatuses"] = []
    container = main.summarize_pod(document).containers[0]
    assert container.image_id is None and container.state == "Not started"


def test_health_probes_do_not_depend_on_kubernetes(monkeypatch):
    def unexpected():
        raise AssertionError("Probes must not query Kubernetes")
    monkeypatch.setattr(main, "kubernetes_client", unexpected)
    client = TestClient(main.app)
    assert client.get("/health").status_code == 200
    assert client.get("/ready").json() == {"ready": True}
