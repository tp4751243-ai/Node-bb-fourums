# Windows version of setup.sh. Builds a clean local Beit HaOrchim forum: NodeBB + Postgres + test inbox,
# our plugin activated, categories and permissions created, NodeBB's sample content removed. Safe to run again.
#
# In PowerShell, from this "local" folder:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#
# Needs Docker Desktop, running.

# 'Continue', not 'Stop': Windows PowerShell 5.1 treats Docker's progress output as errors under 'Stop'.
# Failures are caught below by checking each command's exit code.
$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot
$Url = 'http://127.0.0.1:4567'

# A plain function (no param block) so flags like -d and -e reach Docker instead of PowerShell.
function Invoke-Compose {
	& docker compose @args
	if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' ') failed (exit code $LASTEXITCODE)" }
}

function Test-Url([string] $Address) {
	try {
		$null = Invoke-WebRequest -Uri $Address -UseBasicParsing -TimeoutSec 5
		return $true
	} catch {
		return $false
	}
}

function Wait-Forum {
	Write-Host -NoNewline 'Waiting for the forum to start (the first start builds the site and takes a few minutes)'
	for ($i = 0; $i -lt 200; $i++) {
		if (Test-Url "$Url/api/config") { Write-Host ' ready.'; return }
		Write-Host -NoNewline '.'
		Start-Sleep -Seconds 3
	}
	Write-Host ''
	throw 'The forum did not start. See: docker compose logs nodebb'
}

# Docker must be installed and running
& docker info > $null 2> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop, wait until it says "running", then try again.' }

# .env with a random admin password
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
$envLines = Get-Content '.env'
if (-not ($envLines -match '^NODEBB_ADMIN_PASSWORD=.+')) {
	$password = -join ((1..20) | ForEach-Object { '0123456789abcdefghijkmnpqrstuvwxyz'[(Get-Random -Maximum 34)] })
	$envLines = $envLines -replace '^NODEBB_ADMIN_PASSWORD=.*', "NODEBB_ADMIN_PASSWORD=$password"
	Set-Content -Path '.env' -Value $envLines -Encoding ASCII
	Write-Host 'Saved a random admin password in local\.env'
}

Invoke-Compose up -d db mail

& docker compose run --rm --no-deps --entrypoint test nodebb -f /opt/config/config.json
if ($LASTEXITCODE -ne 0) {
	Write-Host 'First run: creating the forum database and admin account...'
	Invoke-Compose run --rm -e SETUP=1 nodebb
}

Invoke-Compose up -d nodebb
Wait-Forum

if (-not (Test-Url "$Url/api/v3/plugins/trust-tiers")) {
	Write-Host 'Activating the trust tiers plugin...'
	Invoke-Compose exec -T nodebb /usr/src/app/nodebb activate nodebb-plugin-trust-tiers --config=/opt/config/config.json
	Invoke-Compose restart nodebb
	Start-Sleep -Seconds 5
	Wait-Forum
}

Write-Host 'Creating categories and permissions...'
Invoke-Compose run --rm tools sh scripts/local-bootstrap.sh

$envLines = Get-Content '.env'
$adminUser = (($envLines -match '^NODEBB_ADMIN_USERNAME=') -replace '^NODEBB_ADMIN_USERNAME=', '') | Select-Object -First 1
$adminPass = (($envLines -match '^NODEBB_ADMIN_PASSWORD=') -replace '^NODEBB_ADMIN_PASSWORD=', '') | Select-Object -First 1
Write-Host ''
Write-Host 'Your local forum is ready.'
Write-Host '  Forum:       http://localhost:4567'
Write-Host "  Admin login: $adminUser / $adminPass   (stored in local\.env)"
Write-Host '  Test inbox:  http://localhost:8025   (every email the forum sends lands here)'
