@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-estoque.ps1"
if errorlevel 1 (
  echo.
  echo Falha ao iniciar o sistema. Leia a mensagem acima.
  pause
)
