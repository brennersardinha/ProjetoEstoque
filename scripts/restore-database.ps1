param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedBackup = (Resolve-Path (Join-Path $root $BackupFile)).Path
$databaseUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "estoque" }
$databaseName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "estoque" }

if (-not (Test-Path $resolvedBackup -PathType Leaf)) {
  throw "Arquivo de backup nao encontrado: $resolvedBackup"
}

Write-Output "A restauracao substituira os dados atuais do banco."
$confirmation = Read-Host "Digite RESTAURAR para continuar"
if ($confirmation -cne "RESTAURAR") {
  throw "Restauracao cancelada."
}

Get-Content -Raw -Path $resolvedBackup |
  docker compose exec -T postgres psql `
    -U $databaseUser `
    -d $databaseName `
    -v ON_ERROR_STOP=1

Write-Output "Restauracao concluida."
