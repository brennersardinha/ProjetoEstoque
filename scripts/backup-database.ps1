param(
  [string]$OutputDirectory = ".\backups"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = Join-Path $root $OutputDirectory
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$databaseUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "estoque" }
$databaseName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "estoque" }

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $outputPath "estoque-$timestamp.sql"
docker compose exec -T postgres pg_dump `
  --clean `
  --if-exists `
  --no-owner `
  --no-privileges `
  -U $databaseUser `
  -d $databaseName |
  Set-Content -Path $backupFile -Encoding utf8

if (-not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
  throw "O backup nao foi gerado."
}

Write-Output "Backup criado: $backupFile"
