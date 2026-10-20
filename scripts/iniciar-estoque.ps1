$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$webLog = Join-Path $runtimeDir "web.log"
$webErrorLog = Join-Path $runtimeDir "web-error.log"
$webPidFile = Join-Path $runtimeDir "web.pid"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

if (-not (Test-Path (Join-Path $projectRoot ".env"))) {
    throw "Arquivo .env não encontrado. Copie .env.example para .env e configure o JWT_SECRET antes do primeiro uso."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "O Docker Desktop não está aberto ou não está pronto. Abra o Docker Desktop e tente novamente."
}

Push-Location $projectRoot
try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível iniciar o banco e a API com Docker Compose."
    }

    $healthReady = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $health = Invoke-RestMethod "http://localhost:3000/api/health" -TimeoutSec 3
            if ($health) {
                $healthReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $healthReady) {
        throw "A API não respondeu em http://localhost:3000/api/health."
    }

    if (-not (Test-Path (Join-Path $projectRoot "apps\web\dist\index.html"))) {
        npm --workspace apps/web run build
        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível gerar o painel web."
        }
    }

    $existingPid = $null
    if (Test-Path $webPidFile) {
        $existingPid = Get-Content $webPidFile -ErrorAction SilentlyContinue
    }
    $webRunning = $false
    if ($existingPid) {
        $process = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        $webRunning = $null -ne $process
    }

    if (-not $webRunning) {
        $webProcess = Start-Process `
            -FilePath "cmd.exe" `
            -ArgumentList "/c", "npm --workspace apps/web run preview -- --host 0.0.0.0 --port 5173 1> `"$webLog`" 2> `"$webErrorLog`"" `
            -WorkingDirectory $projectRoot `
            -WindowStyle Hidden `
            -PassThru
        Set-Content -Path $webPidFile -Value $webProcess.Id
    }

    Start-Process "http://localhost:5173"
    Write-Host "Sistema iniciado. Painel: http://localhost:5173"
    Write-Host "API para celulares na rede local: http://IP-DESTE-COMPUTADOR:3000/api"
} finally {
    Pop-Location
}
