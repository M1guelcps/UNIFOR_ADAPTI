# Abre cada parte do ADAPTI numa janela própria do PowerShell.
# Uso (na raiz do projeto):  powershell -ExecutionPolicy Bypass -File .\iniciar.ps1

$raiz = $PSScriptRoot

$partes = @(
  @{ Nome = "auth-service (3001)";   Pasta = "backend\services\auth-service" },
  @{ Nome = "quest-service (3002)";  Pasta = "backend\services\quest-service" },
  @{ Nome = "answer-service (3003)"; Pasta = "backend\services\answer-service" },
  @{ Nome = "user-service (3004)";   Pasta = "backend\services\user-service" },
  @{ Nome = "gateway (3000)";        Pasta = "gateway" },
  @{ Nome = "frontend React (5173)"; Pasta = "frontend-react" }
)

foreach ($p in $partes) {
  $pasta = Join-Path $raiz $p.Pasta
  if (-not (Test-Path (Join-Path $pasta "node_modules"))) {
    Write-Host "Instalando dependências em $($p.Pasta)..." -ForegroundColor Yellow
    Push-Location $pasta
    npm install
    Pop-Location
  }
  $comando = "`$Host.UI.RawUI.WindowTitle = '$($p.Nome)'; Set-Location '$pasta'; npm run dev"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $comando
  Write-Host "Iniciado: $($p.Nome)" -ForegroundColor Green
  Start-Sleep -Milliseconds 400
}

Write-Host ""
Write-Host "Pronto! O site abre em http://localhost:5173" -ForegroundColor Cyan
Write-Host "Para parar tudo, feche as janelas abertas." -ForegroundColor Cyan
