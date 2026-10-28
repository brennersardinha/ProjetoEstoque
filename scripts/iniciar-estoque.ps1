$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$webLog = Join-Path $runtimeDir "web.log"
$webErrorLog = Join-Path $runtimeDir "web-error.log"
$webPidFile = Join-Path $runtimeDir "web.pid"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Get-EnvValue([string]$name, [string]$fallback) {
    $line = Get-Content (Join-Path $projectRoot ".env") -ErrorAction SilentlyContinue |
        Where-Object { $_ -match "^\s*$name\s*=" } |
        Select-Object -First 1
    if ($line -and $line -match "^\s*$name\s*=\s*(.*)\s*$") {
        $value = $matches[1].Trim().Trim('"').Trim("'")
        if ($value) { return $value }
    }
    return $fallback
}

if (-not (Test-Path (Join-Path $projectRoot ".env"))) {
    throw "Arquivo .env não encontrado. Copie .env.example para .env e configure o JWT_SECRET antes do primeiro uso."
}

$apiPort = Get-EnvValue "API_PORT" "3000"
$webPort = Get-EnvValue "WEB_PORT" "5173"
if ($apiPort -notmatch "^\d+$" -or $webPort -notmatch "^\d+$") {
    throw "API_PORT e WEB_PORT devem ser números de porta válidos no arquivo .env."
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
            $health = Invoke-RestMethod "http://localhost:$apiPort/api/health" -TimeoutSec 3
            if ($health) {
                $healthReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $healthReady) {
        throw "A API não respondeu em http://localhost:$apiPort/api/health. Consulte os logs com: docker compose logs api."
    }

    if (-not (Test-Path (Join-Path $projectRoot "apps\web\dist\index.html"))) {
        $env:VITE_API_URL = "http://localhost:$apiPort/api"
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
            -ArgumentList "/c", "npm --workspace apps/web run preview -- --host 0.0.0.0 --port $webPort 1> `"$webLog`" 2> `"$webErrorLog`"" `
            -WorkingDirectory $projectRoot `
            -WindowStyle Hidden `
            -PassThru
        Set-Content -Path $webPidFile -Value $webProcess.Id
    }

    Start-Process "http://localhost:$webPort"
    Write-Host "Sistema iniciado. Painel: http://localhost:$webPort"
    $lanAddresses = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
        ForEach-Object { $_.IPv4Address.IPAddress }
    if ($lanAddresses) {
        foreach ($address in $lanAddresses) {
            Write-Host "API para celulares na rede local: http://${address}:$apiPort/api"
        }
    } else {
        Write-Host "API para celulares na rede local: http://IP-DESTE-COMPUTADOR:$apiPort/api"
    }
    Write-Host "O aplicativo encontra o servidor automaticamente quando o celular está no mesmo Wi-Fi."
} finally {
    Pop-Location
}
