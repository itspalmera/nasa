# Instala todo lo necesario en Windows. Uso, desde la raiz del repositorio:
#   powershell -ExecutionPolicy Bypass -File scripts\setup_windows.ps1
$ErrorActionPreference = 'Stop'
# Python en Windows lee archivos como cp1252 si no se fuerza UTF-8; las pruebas y datos usan UTF-8.
$env:PYTHONUTF8 = '1'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host "ERROR en: $what" -ForegroundColor Red; exit 1 } }

Step 'Buscando Python 3.11 o superior'
$python = $null
foreach ($candidate in @('py -3.13', 'py -3.12', 'py -3.11', 'python')) {
    $parts = $candidate.Split(' ')
    $extra = @()
    if ($parts.Length -gt 1) { $extra = $parts[1..($parts.Length - 1)] }
    try {
        $ok = & $parts[0] @extra -c "import sys; print(sys.version_info >= (3, 11))" 2>$null
    } catch { continue }
    if ($ok -eq 'True') { $python = @{ exe = $parts[0]; args = $extra }; Write-Host "Usando: $candidate"; break }
}
if (-not $python) { Write-Host 'No encontre Python 3.11 o superior. Instalalo desde python.org.' -ForegroundColor Red; exit 1 }

if (-not (Test-Path '.venv')) {
    Step 'Creando el entorno virtual .venv'
    & $python.exe @($python.args) -m venv .venv; Check 'crear .venv'
}

Step 'Instalando dependencias del backend (puede tardar varios minutos)'
& .venv\Scripts\python.exe -m pip install --upgrade pip; Check 'actualizar pip'
& .venv\Scripts\python.exe -VV
& .venv\Scripts\python.exe -m pip install -e ".[test]"; Check 'instalar dependencias'

Step 'Instalando dependencias cientificas (opcional: solo las usa el panel de gravedad)'
& .venv\Scripts\python.exe -m pip install -e ".[science,test]"
$science = ($LASTEXITCODE -eq 0)
if (-not $science) { Write-Host 'Aviso: no se pudieron instalar numpy/scipy/scikit-learn. El chat funciona igual; el panel de gravedad parcial no.' -ForegroundColor Yellow }

if (-not (Test-Path '.env')) {
    Step 'Creando .env desde .env.example (Anthropic activado; falta pegar tu clave)'
    (Get-Content .env.example) -replace '^ENABLE_PAID_API=.*', 'ENABLE_PAID_API=true' -replace '^LLM_PROVIDER=.*', 'LLM_PROVIDER=anthropic' | Set-Content .env -Encoding ascii
}

Step 'Indexando los papers (sin llamadas pagadas)'
& .venv\Scripts\python.exe -m flame.cli ingest; Check 'indexar papers'

Step 'Corriendo las pruebas'
# test_path_traversal_and_symlink necesita permisos de administrador en Windows para crear symlinks.
$testArgs = @('tests', '-q', '--deselect', 'tests/test_pipeline.py::test_path_traversal_and_symlink')
if (-not $science) { $testArgs += @('--ignore-glob=tests/test_ood*', '--ignore=tests/test_gravity_sweep.py', '--ignore=tests/test_paper_observations.py', '--ignore=tests/test_fuel_configurations.py') }
& .venv\Scripts\python.exe -m pytest @testArgs
if ($LASTEXITCODE -ne 0) { Write-Host 'Aviso: alguna prueba fallo (revisa arriba). Sigo con la instalacion.' -ForegroundColor Yellow }

Step 'Instalando dependencias del frontend'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'No encontre Node.js. Instala la version 20.9 o superior desde nodejs.org.' -ForegroundColor Red; exit 1 }
npm --prefix frontend ci; Check 'npm ci'

Write-Host "`nListo. Revisa que .env tenga tu ANTHROPIC_API_KEY y luego ejecuta:" -ForegroundColor Green
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\start_windows.ps1'
