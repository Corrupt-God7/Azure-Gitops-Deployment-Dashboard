@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Starting GitOps Environment

rem Local startup only. This script never deletes or recreates the cluster.
set "GITOPS_STATE=%LOCALAPPDATA%\GitOpsDashboard"
if not exist "%GITOPS_STATE%" mkdir "%GITOPS_STATE%"
if not exist "%GITOPS_STATE%" goto STATE_ERROR
set "GITOPS_ERROR=%GITOPS_STATE%\startup-error.log"
set "GITOPS_LOG=%GITOPS_STATE%\startup.log"
>"%GITOPS_LOG%" echo GitOps startup: %DATE% %TIME%

for %%T in (docker.exe kubectl.exe kind.exe powershell.exe) do (
    where %%T >nul 2>&1
    if errorlevel 1 (
        echo ERROR: %%T was not found on PATH.
        echo Install or restore this tool, then reopen the launcher.
        goto FAILED
    )
)

rem Prefer Docker Desktop's Linux engine when its context is available.
docker context inspect desktop-linux >nul 2>&1
if not errorlevel 1 set "DOCKER_CONTEXT=desktop-linux"
set "KIND_EXPERIMENTAL_PROVIDER=docker"

echo [1/6] Starting Docker Desktop...
docker info >"%GITOPS_ERROR%" 2>&1
if not errorlevel 1 goto DOCKER_READY
set "GITOPS_DOCKER_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "GITOPS_DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" set "GITOPS_DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" set "GITOPS_DOCKER_EXE=%LOCALAPPDATA%\Docker\Docker Desktop.exe"
if not defined GITOPS_DOCKER_EXE (
    echo ERROR: Docker is unavailable and its Desktop executable was not found.
    echo Open Docker Desktop manually, wait for Engine running, then retry.
    goto SHOW_ERROR
)
start "" "%GITOPS_DOCKER_EXE%"
set /a GITOPS_ATTEMPT=0
:WAIT_DOCKER
docker info >"%GITOPS_ERROR%" 2>&1
if not errorlevel 1 goto DOCKER_READY
set /a GITOPS_ATTEMPT+=1
echo Waiting for Docker Desktop: attempt %GITOPS_ATTEMPT% of 36...
if %GITOPS_ATTEMPT% GEQ 36 goto DOCKER_TIMEOUT
timeout /t 5 /nobreak >nul
goto WAIT_DOCKER

:DOCKER_READY
echo [2/6] Starting existing kind cluster...
docker container inspect gitops-dev-control-plane >nul 2>"%GITOPS_ERROR%"
if errorlevel 1 (
    echo ERROR: The gitops-dev-control-plane container was not found on this Docker engine.
    docker context show
    docker ps -a --format "table {{.Names}}\t{{.Status}}"
    echo Check Docker Desktop for the existing cluster container.
    goto SHOW_ERROR
)
docker start gitops-dev-control-plane >"%GITOPS_ERROR%" 2>&1
if errorlevel 1 goto SHOW_ERROR

rem Use a dedicated refreshed kubeconfig, preserving the user's main config.
set "KUBECONFIG=%GITOPS_STATE%\kind-gitops-dev.yaml"
kind export kubeconfig --name gitops-dev --kubeconfig "%KUBECONFIG%" >"%GITOPS_ERROR%" 2>&1
if errorlevel 1 goto SHOW_ERROR
echo [3/6] Waiting for the Kubernetes API...
set /a GITOPS_ATTEMPT=0
:WAIT_KUBERNETES
kubectl --context kind-gitops-dev --request-timeout=5s get node gitops-dev-control-plane >"%GITOPS_ERROR%" 2>&1
if not errorlevel 1 goto API_READY
set /a GITOPS_ATTEMPT+=1
echo Waiting for Kubernetes: attempt %GITOPS_ATTEMPT% of 36...
type "%GITOPS_ERROR%"
type "%GITOPS_ERROR%" >>"%GITOPS_LOG%"
if %GITOPS_ATTEMPT% GEQ 36 goto KUBERNETES_TIMEOUT
timeout /t 5 /nobreak >nul
goto WAIT_KUBERNETES

:API_READY
echo [4/6] Waiting for the node and application deployments...
kubectl --context kind-gitops-dev --request-timeout=10s wait --for=condition=Ready node/gitops-dev-control-plane --timeout=180s
if errorlevel 1 goto WORKLOAD_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s rollout status deployment/argocd-server -n argocd --timeout=180s
if errorlevel 1 goto WORKLOAD_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s rollout status deployment/gitops-dashboard-backend -n gitops-dev --timeout=180s
if errorlevel 1 goto WORKLOAD_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s rollout status deployment/gitops-dashboard-frontend -n gitops-dev --timeout=180s
if errorlevel 1 goto WORKLOAD_ERROR

echo [5/6] Waiting for Prometheus and Grafana...
kubectl --context kind-gitops-dev --request-timeout=10s get service monitoring-grafana -n monitoring >"%GITOPS_ERROR%" 2>&1
if errorlevel 1 goto MONITORING_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s get service monitoring-kube-prometheus-prometheus -n monitoring >"%GITOPS_ERROR%" 2>&1
if errorlevel 1 goto MONITORING_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s rollout status deployment/monitoring-grafana -n monitoring --timeout=180s
if errorlevel 1 goto MONITORING_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s get pods -n monitoring -l app.kubernetes.io/name=prometheus -o name | findstr /r "." >nul
if errorlevel 1 goto MONITORING_ERROR
kubectl --context kind-gitops-dev --request-timeout=10s wait --for=condition=Ready pod -l app.kubernetes.io/name=prometheus -n monitoring --timeout=180s
if errorlevel 1 goto MONITORING_ERROR

echo [6/6] Checking local ports...
powershell.exe -NoProfile -Command "$busy = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8080,3001,8001,3002,9090 }); if ($busy.Count) { $busy | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort | Format-Table; exit 1 }; exit 0"
if errorlevel 1 (
    echo A required port is already occupied. Close old port-forward tabs with Ctrl+C.
    echo If the dashboard already works, you can keep using those tabs.
    echo Otherwise free the listed ports and run this launcher again.
    goto FAILED
)
echo Starting port forwards. Keep the five new windows open.
start "Argo CD" powershell.exe -NoProfile -NoExit -Command "kubectl --context kind-gitops-dev port-forward --address 127.0.0.1 svc/argocd-server -n argocd 8080:443"
start "GitOps Frontend" powershell.exe -NoProfile -NoExit -Command "kubectl --context kind-gitops-dev port-forward --address 127.0.0.1 svc/gitops-dashboard-frontend -n gitops-dev 3001:80"
start "GitOps Backend" powershell.exe -NoProfile -NoExit -Command "kubectl --context kind-gitops-dev port-forward --address 127.0.0.1 svc/gitops-dashboard-backend -n gitops-dev 8001:8000"
start "Grafana" powershell.exe -NoProfile -NoExit -Command "kubectl --context kind-gitops-dev port-forward --address 127.0.0.1 svc/monitoring-grafana -n monitoring 3002:80"
start "Prometheus" powershell.exe -NoProfile -NoExit -Command "kubectl --context kind-gitops-dev port-forward --address 127.0.0.1 svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090"
rem Wait for all five local listeners before opening the browser.
powershell.exe -NoProfile -Command "for ($attempt=0; $attempt -lt 30; $attempt++) { $ports = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -eq '127.0.0.1' } | Select-Object -ExpandProperty LocalPort); if ((8080 -in $ports) -and (3001 -in $ports) -and (8001 -in $ports) -and (3002 -in $ports) -and (9090 -in $ports)) { exit 0 }; Start-Sleep -Seconds 1 }; exit 1"
if errorlevel 1 (
    echo ERROR: One or more port forwards did not start. Read the new windows for the error.
    goto FAILED
)
start "" "https://localhost:8080"
start "" "http://localhost:3001"
start "" "http://localhost:8001/ready"
start "" "http://localhost:3002"
start "" "http://localhost:9090/targets"
echo Startup finished. Keep Docker Desktop and the port-forward windows open.
timeout /t 5 /nobreak >nul
exit /b 0

:DOCKER_TIMEOUT
echo ERROR: Docker Desktop did not become available after 36 checks.
goto SHOW_ERROR

:KUBERNETES_TIMEOUT
echo ERROR: Kubernetes did not respond after 36 checks.
type "%GITOPS_ERROR%"
echo Collecting recent container diagnostics...
docker ps -a --filter name=gitops-dev-control-plane >>"%GITOPS_LOG%" 2>&1
docker logs --tail 80 gitops-dev-control-plane >>"%GITOPS_LOG%" 2>&1
goto FAILED

:WORKLOAD_ERROR
echo ERROR: Node or deployment readiness failed. Current pods:
kubectl --context kind-gitops-dev --request-timeout=10s get pods -n argocd -o wide
kubectl --context kind-gitops-dev --request-timeout=10s get pods -n gitops-dev -o wide
echo Screenshot this output so we can diagnose the failing workload.
goto FAILED

:MONITORING_ERROR
echo ERROR: Prometheus or Grafana is missing or not ready. Current monitoring resources:
if exist "%GITOPS_ERROR%" type "%GITOPS_ERROR%"
kubectl --context kind-gitops-dev --request-timeout=10s get pods,pvc,svc -n monitoring -o wide
echo Install or repair the monitoring release before running this launcher again.
echo Screenshot this output so we can diagnose the monitoring workload.
goto FAILED

:SHOW_ERROR
type "%GITOPS_ERROR%"
type "%GITOPS_ERROR%" >>"%GITOPS_LOG%"
:FAILED
echo.
echo Startup stopped. Your existing cluster has been preserved.
echo Startup log: "%GITOPS_LOG%"
echo Send the visible error or this log for the next diagnosis.
pause
exit /b 1

:STATE_ERROR
echo ERROR: Unable to create the local GitOpsDashboard settings folder.
pause
exit /b 1
