param([ValidateSet('web','api','demo','test','install','build')][string]$Mode = 'web')
$ErrorActionPreference = 'Stop'
$workspace = $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path $nodePath) 'node_modules/npm/bin/npm-cli.js'
if (!(Test-Path -LiteralPath $npmCli)) { throw 'A complete Node.js installation is required. Install Node 22 LTS or newer.' }
$env:npm_config_cache = Join-Path $workspace '.npm-cache'
function Invoke-Package([string]$folder, [string[]]$arguments) {
  Push-Location (Join-Path $workspace $folder)
  try { & $nodePath $npmCli @arguments; if ($LASTEXITCODE -ne 0) { throw "Command failed in $folder" } } finally { Pop-Location }
}
switch ($Mode) {
  install { Invoke-Package 'backend' @('ci'); Invoke-Package 'frontend' @('ci') }
  api { Invoke-Package 'backend' @('start') }
  demo { Invoke-Package 'backend' @('run', 'demo') }
  test { Invoke-Package 'backend' @('test'); Invoke-Package 'frontend' @('run', 'lint') }
  build { Invoke-Package 'frontend' @('run', 'build'); Invoke-Package 'frontend' @('run', 'build:mobile') }
  web { Invoke-Package 'frontend' @('run', 'web') }
}
