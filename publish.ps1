<#
.SYNOPSIS
  dsh-token-ledger-pro one-click publish to npm (used by DSH plugin market)
.NOTES
  All npm authentication happens in your browser via npm official OAuth.
  Nothing is stored or transmitted by this script.
#>
$ErrorActionPreference = 'Stop'

if (-not (Test-Path (Join-Path $PSScriptRoot 'package.json'))) {
  Write-Host 'Run this script inside the plugin folder.' -ForegroundColor Red; exit 1
}
$pkg = Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
Write-Host ("Package : " + $pkg.name + "@" + $pkg.version)

try { & npm --version | Out-Null } catch { Write-Host 'npm not found. Install Node.js first.' -ForegroundColor Red; exit 1 }

$who = $null
try { $who = & npm whoami 2>&1 } catch { $who = $null }
if ([string]::IsNullOrEmpty($who) -or "$who" -match 'npm error|not logged in') {
  Write-Host 'Not logged in. Opening npm login (browser OAuth)...' -ForegroundColor Yellow
  & npm login
  if ($LASTEXITCODE -ne 0) { Write-Host 'Login failed.' -ForegroundColor Red; exit 1 }
}
Write-Host ("Logged in as: " + (& npm whoami))

Write-Host 'Dry-run packing...'
& npm pack --dry-run
if ($LASTEXITCODE -ne 0) { Write-Host 'Pack failed.' -ForegroundColor Red; exit 1 }

Write-Host 'Publishing...'
& npm publish --access public
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Publish failed. Common causes: name too similar to existing package (rename or use scope), version already exists (bump version), or 2FA not completed.' -ForegroundColor Red
  exit 1
}
Start-Sleep -Seconds 3
Write-Host ("Published. Registry version now: " + (& npm view ($pkg.name + '@latest') version 2>&1)) -ForegroundColor Green
