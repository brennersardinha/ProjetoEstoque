$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$webPidFile = Join-Path $projectRoot ".runtime\web.pid"

if (Test-Path $webPidFile) {
    $webPid = Get-Content $webPidFile -ErrorAction SilentlyContinue
    if ($webPid -match "^\d+$") {
        $process = Get-Process -Id ([int]$webPid) -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $process.Id
        }
    }
    Remove-Item $webPidFile -Force -ErrorAction SilentlyContinue
}

Push-Location $projectRoot
try {
    docker compose stop
    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível parar os serviços Docker."
    }
    Write-Host "Sistema parado. Os dados do banco foram preservados."
} finally {
    Pop-Location
}
