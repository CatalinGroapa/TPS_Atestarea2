$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $projectRoot 'server'
$serverEnvFile = Join-Path $serverDir '.env'

if (-not (Test-Path (Join-Path $serverDir 'package.json'))) {
    Write-Error "Nu am gasit server/package.json in: $serverDir"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js nu este instalat sau nu e in PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm nu este instalat sau nu e in PATH."
}

function Get-EnvValueFromFile {
    param(
        [string]$Path,
        [string]$Key
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $line = Get-Content $Path | Where-Object {
        $_ -match "^\s*$Key\s*="
    } | Select-Object -First 1

    if (-not $line) {
        return $null
    }

    $value = ($line -replace "^\s*$Key\s*=\s*", '').Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    } elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    return $value
}

$openAiKey = Get-EnvValueFromFile -Path $serverEnvFile -Key 'OPENAI_API_KEY'
$openAiModel = Get-EnvValueFromFile -Path $serverEnvFile -Key 'OPENAI_MODEL'
if (-not $openAiModel) {
    $openAiModel = 'gpt-4o-mini'
}

$backendCommand = "cd `"$serverDir`"; "
if ($openAiKey) {
    $escapedKey = $openAiKey.Replace("'", "''")
    $escapedModel = $openAiModel.Replace("'", "''")
    $backendCommand += "`$env:OPENAI_API_KEY='$escapedKey'; `$env:OPENAI_MODEL='$escapedModel'; Write-Host 'OPENAI_API_KEY loaded: YES' -ForegroundColor Green; "
} else {
    Write-Host "AI key nu a fost gasita in server/.env. Backend pornește fara AI rerank." -ForegroundColor Yellow
    $backendCommand += "Write-Host 'OPENAI_API_KEY loaded: NO' -ForegroundColor Yellow; "
}
$backendCommand += "npm start"

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    $backendCommand
)

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "cd `"$projectRoot`"; node web-static-server.js"
)

Write-Host "Serverele au fost pornite."
Write-Host "Backend:  http://localhost:3000/health"
Write-Host "Frontend: http://localhost:8080"
if (-not (Test-Path $serverEnvFile)) {
    Write-Host "Tip: creeaza server/.env pe baza server/.env.example pentru OPENAI_API_KEY." -ForegroundColor Yellow
}
