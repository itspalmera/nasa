# Abre dos ventanas: backend (FastAPI, puerto 8000) y frontend (Next.js, puerto 3000). Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\start_windows.ps1
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$root\.venv")) { Write-Host 'Primero ejecuta scripts\setup_windows.ps1' -ForegroundColor Red; exit 1 }
$key = Select-String -Path "$root\.env" -Pattern '^ANTHROPIC_API_KEY=(.+)$' -ErrorAction SilentlyContinue
if (-not $key) { Write-Host 'Aviso: ANTHROPIC_API_KEY esta vacia en .env; el chat solo mostrara evidencia, sin redactar.' -ForegroundColor Yellow }
Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', '$env:PYTHONUTF8=''1''; .venv\Scripts\python.exe -m uvicorn flame.main:app --host 127.0.0.1 --port 8000'
Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', 'npm --prefix frontend run dev -- --port 3000'
Write-Host 'Backend: http://127.0.0.1:8000/docs   Frontend: http://localhost:3000' -ForegroundColor Green
Start-Sleep -Seconds 8
Start-Process 'http://localhost:3000'
