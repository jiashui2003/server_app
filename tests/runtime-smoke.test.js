import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package.json exposes a local Electron runtime smoke verifier', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(pkg.scripts['runtime:smoke'], 'node scripts/runtime-smoke.js');
  assert.equal(pkg.scripts['ui:evidence'], 'node scripts/ui-visual-evidence.js');
});

test('runtime smoke script verifies rendered UI, scrolling, command center, and responsive layout', async () => {
  const script = await readFile(new URL('../scripts/runtime-smoke.js', import.meta.url), 'utf8');

  assert.match(script, /createApp/);
  assert.match(script, /electron/);
  assert.match(script, /BrowserWindow/);
  assert.match(script, /setPath\('userData'/);
  assert.match(script, /disableHardwareAcceleration/);
  assert.match(script, /disable-http-cache/);
  assert.match(script, /fallbackRuntimeSmoke/);
  assert.match(script, /static-fallback/);
  assert.match(script, /delivery-readiness-button/);
  assert.match(script, /readiness-check/);
  assert.match(script, /release-readiness-workspace/);
  assert.match(script, /release-readiness-card/);
  assert.match(script, /renderReleaseWorkspace/);
  assert.match(script, /data-release-mode-card="client-handoff"/);
  assert.match(script, /interaction-studio/);
  assert.match(script, /action-dock/);
  assert.match(script, /focus-peek/);
  assert.match(script, /renderInteractionStudio/);
  assert.match(script, /renderActionDock/);
  assert.match(script, /tactile-card/);
  assert.match(script, /scroll-snap-type: x mandatory/);
  assert.match(script, /command-palette-button/);
  assert.match(script, /overscrollBehavior/);
  assert.match(script, /backdropFilter/);
  assert.match(script, /setSize\(390,\s*900\)/);
  assert.match(script, /SERVERLENS_RUNTIME_SMOKE_OK/);
});

test('UI visual evidence script captures browser screenshots when available', async () => {
  const script = await readFile(new URL('../scripts/ui-visual-evidence.js', import.meta.url), 'utf8');

  assert.match(script, /playwright/);
  assert.match(script, /electron/);
  assert.match(script, /launchPlaywrightBrowser/);
  assert.match(script, /playwright\.system-chrome/);
  assert.match(script, /captureWithElectron/);
  assert.match(script, /electron\.chromium-fallback/);
  assert.match(script, /captureWithSystemBrowser/);
  assert.match(script, /system-chromium-cdp-fallback/);
  assert.match(script, /system-chromium-static-snapshot-fallback/);
  assert.match(script, /runSystemBrowserStaticSnapshotEvidence/);
  assert.match(script, /staticSnapshotHtml/);
  assert.match(script, /disable-gpu-compositing/);
  assert.match(script, /single-process/);
  assert.match(script, /chrome\.exe/);
  assert.match(script, /msedge\.exe/);
  assert.match(script, /ui-visual-evidence\.json/);
  assert.match(script, /ui-evidence-desktop\.png/);
  assert.match(script, /ui-evidence-mobile\.png/);
  assert.match(script, /local-ui-visual-evidence/);
  assert.match(script, /pixelChecks/);
  assert.match(script, /pageEvidence/);
  assert.match(script, /pageOperationSummaryPresent/);
  assert.match(script, /pageCount:\s*11/);
  assert.match(script, /horizontalOverflow/);
  assert.match(script, /releaseWorkspacePresent/);
  assert.match(script, /releaseCardsPresent/);
  assert.match(script, /interactionStudioPresent/);
  assert.match(script, /actionDockPresent/);
  assert.match(script, /tactileCardsPresent/);
  assert.match(script, /release-readiness-workspace/);
  assert.match(script, /release-readiness-card/);
  assert.match(script, /healthLabelsPresent/);
  assert.match(script, /health-cell-label/);
  assert.match(script, /SERVERLENS_UI_VISUAL_EVIDENCE/);
});
