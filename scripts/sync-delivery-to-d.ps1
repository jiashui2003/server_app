$ErrorActionPreference = 'Stop'

$source = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$target = 'D:\vibe-server-status-app'

$files = @(
  'src\shared\analysis-engine.js',
  'src\server\collector.js',
  'src\server\app.js',
  'src\server\store.js',
  'src\shared\delivery-evidence.js',
  'public\index.html',
  'public\app.js',
  'public\styles.css',
  'scripts\build-check.js',
  'scripts\package-desktop.js',
  'scripts\create-handoff-package.js',
  'scripts\runtime-smoke.js',
  'scripts\delivery-validate.js',
  'scripts\ui-visual-evidence.js',
  'scripts\sync-delivery-to-d.ps1',
  'package.json',
  'package-lock.json',
  'PRODUCT.md',
  'DESIGN.md',
  'tests\analysis-engine.test.js',
  'tests\api.test.js',
  'tests\collector.test.js',
  'tests\ui-contract.test.js',
  'tests\commercial-readiness.test.js',
  'tests\desktop-package.test.js',
  'tests\persistence.test.js',
  'tests\runtime-smoke.test.js',
  'README.md',
  'docs\reference-notes.md',
  'references\web-v70\retroui-card.md',
  'references\github-v100\uptime-kuma\README.md',
  'references\github-v100\glances\README.rst',
  'references\github-v100\node_exporter\README.md',
  'references\github-v100\dashy\README.md',
  'docs\superpowers\plans\2026-06-09-v90-retroui-clarity-redesign.md',
  'docs\superpowers\plans\2026-06-09-v100-page-experience-redesign.md',
  '.codestable\architecture\ARCHITECTURE.md'
)

foreach ($file in $files) {
  $destination = Join-Path $target $file
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination $destination -Force
}

"SYNC_OK files=$($files.Count)"
