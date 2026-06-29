import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package.json declares desktop app packaging scripts and metadata', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(pkg.main, 'src/desktop/main.cjs');
  assert.equal(pkg.scripts.desktop, 'electron .');
  assert.equal(pkg.scripts['package:app'], 'node scripts/package-desktop.js');
  assert.equal(pkg.scripts['handoff:dir'], 'node scripts/create-handoff-package.js');
  assert.equal(pkg.scripts['delivery:validate'], 'node scripts/delivery-validate.js');
  assert.equal(pkg.scripts['ui:evidence'], 'node scripts/ui-visual-evidence.js');
  assert.equal(pkg.scripts['pack:dir'], 'electron-builder --dir');
  assert.equal(pkg.version, '16.0.0');
  assert.equal(pkg.build.appId, 'com.vibeserverstatus.serverlens');
  assert.equal(pkg.build.productName, 'ServerLens');
  assert.deepEqual(pkg.build.files, [
    'public/**/*',
    'src/**/*',
    'package.json'
  ]);
});

test('desktop package script supports optional code signing with a safe unsigned fallback', async () => {
  const script = await readFile(new URL('../scripts/package-desktop.js', import.meta.url), 'utf8');

  assert.match(script, /maybeSignExecutable/);
  assert.match(script, /SERVERLENS_SIGN_CERT/);
  assert.match(script, /unsigned-dir-fallback/);
  // Signing must never abort packaging: failures resolve to the fallback result.
  assert.match(script, /signtool unavailable or failed/);
  assert.match(script, /SERVERLENS_PACKAGE_SIGNING/);
});

test('desktop handoff package script assembles offline delivery evidence', async () => {
  const script = await readFile(new URL('../scripts/create-handoff-package.js', import.meta.url), 'utf8');

  assert.match(script, /win-unpacked/);
  assert.match(script, /SERVERLENS_HANDOFF_APP_DIR/);
  assert.match(script, /ServerLens\.exe/);
  assert.match(script, /delivery-evidence\.json/);
  assert.match(script, /delivery-validation\.json/);
  assert.match(script, /ui-visual-evidence\.json/);
  assert.match(script, /README\.md/);
  assert.match(script, /docs/);
  assert.match(script, /\.codestable/);
  assert.match(script, /buildDeliveryEvidence/);
  assert.match(script, /buildDeliveryReadiness/);
  assert.match(script, /buildDeliveryPackageChecklist/);
  assert.match(script, /uiExperienceAudit/);
  assert.match(script, /UI Experience Audit/);
  assert.match(script, /handoffChecklist/);
  assert.match(script, /Handoff Checklist/);
  assert.match(script, /validationLedger/);
});

test('delivery validation script runs commercial verification commands and writes a ledger', async () => {
  const script = await readFile(new URL('../scripts/delivery-validate.js', import.meta.url), 'utf8');

  assert.match(script, /buildDeliveryValidationLedger/);
  assert.match(script, /npm\.cmd test/);
  assert.match(script, /npm\.cmd run build/);
  assert.match(script, /npm\.cmd run runtime:smoke/);
  assert.match(script, /npm\.cmd run ui:evidence/);
  assert.match(script, /npm\.cmd run package:app/);
  assert.match(script, /npm\.cmd run handoff:dir/);
  assert.match(script, /delivery-validation\.json/);
  assert.match(script, /updateHandoffEvidenceLedger/);
  assert.match(script, /validationLedger:\s*ledger/);
  assert.match(script, /buildDeliveryPackageChecklist/);
  assert.match(script, /handoffChecklist/);
  assert.match(script, /annotateUiEvidenceCommand/);
  assert.match(script, /ui-visual-evidence\.json/);
  assert.match(script, /status:\s*'warn'/);
});

test('delivery sync script includes core backend runtime files', async () => {
  const script = await readFile(new URL('../scripts/sync-delivery-to-d.ps1', import.meta.url), 'utf8');

  assert.match(script, /src\\server\\app\.js/);
  assert.match(script, /src\\server\\collector\.js/);
  assert.match(script, /src\\server\\store\.js/);
  assert.match(script, /src\\shared\\analysis-engine\.js/);
  assert.match(script, /src\\shared\\delivery-evidence\.js/);
});

test('ServerLens 10 delivery references include monitoring and dashboard repositories', async () => {
  const notes = await readFile(new URL('../docs/reference-notes.md', import.meta.url), 'utf8');
  const evidence = await readFile(new URL('../src/shared/delivery-evidence.js', import.meta.url), 'utf8');

  for (const reference of ['uptime-kuma', 'glances', 'node_exporter', 'dashy']) {
    assert.match(notes, new RegExp(reference));
    assert.match(evidence, new RegExp(reference));
  }
  assert.match(notes, /references\/github-v100/);
  assert.match(evidence, /references\.current-v100-monitoring/);
});

test('desktop package script supports a controlled alternate output directory', async () => {
  const script = await readFile(new URL('../scripts/package-desktop.js', import.meta.url), 'utf8');

  assert.match(script, /SERVERLENS_PACKAGE_DIR/);
  assert.match(script, /resolvePackageDir/);
  assert.match(script, /win-unpacked/);
});

test('desktop entry starts the local app server and opens a native window', async () => {
  const main = await readFile(new URL('../src/desktop/main.cjs', import.meta.url), 'utf8');

  assert.match(main, /BrowserWindow/);
  assert.match(main, /createApp/);
  assert.match(main, /app\.getPath\('userData'\)/);
  assert.match(main, /serverlens\.sqlite/);
  assert.match(main, /loadURL/);
  assert.match(main, /titleBarStyle:\s*'hiddenInset'/);
});

test('delivery metadata documents SQLite persistence runtime constraints', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const architecture = await readFile(new URL('../.codestable/architecture/ARCHITECTURE.md', import.meta.url), 'utf8');

  assert.equal(pkg.engines.node, '>=24.0.0');
  assert.match(readme, /SERVERLENS_DB_PATH/);
  assert.match(readme, /serverlens\.sqlite/);
  assert.match(architecture, /SQLite/);
  assert.match(architecture, /Electron userData/);
});
