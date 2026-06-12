import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDeliveryEvidence, buildDeliveryPackageChecklist, buildDeliveryReadiness, buildDeliveryValidationLedger } from '../src/shared/delivery-evidence.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const handoffRoot = path.join(projectRoot, 'dist', 'handoff', `ServerLens-${packageJson.version}`);
const appSource = resolveAppSource(process.env.SERVERLENS_HANDOFF_APP_DIR);
const appTarget = path.join(handoffRoot, 'app');
const docsTarget = path.join(handoffRoot, 'docs');
const codeStableTarget = path.join(handoffRoot, 'codestable');

await access(path.join(appSource, 'ServerLens.exe'));
await rm(handoffRoot, { recursive: true, force: true });
await mkdir(handoffRoot, { recursive: true });
await mkdir(docsTarget, { recursive: true });

await cp(appSource, appTarget, { recursive: true, force: true });

for (const file of ['README.md', 'PRODUCT.md', 'DESIGN.md']) {
  await cp(path.join(projectRoot, file), path.join(docsTarget, file), { force: true });
}

await cp(path.join(projectRoot, 'docs'), path.join(docsTarget, 'docs'), { recursive: true, force: true });
await cp(path.join(projectRoot, '.codestable', 'architecture'), path.join(codeStableTarget, 'architecture'), {
  recursive: true,
  force: true
});
await cp(path.join(projectRoot, '.codestable', 'features'), path.join(codeStableTarget, 'features'), {
  recursive: true,
  force: true
});
await cp(path.join(projectRoot, '.codestable', 'roadmap'), path.join(codeStableTarget, 'roadmap'), {
  recursive: true,
  force: true
});

const packagePath = path.join(appSource, 'ServerLens.exe');
const evidence = buildDeliveryEvidence({ projectRoot, packagePath });
const uiExperienceAudit = evidence.uiExperienceAudit;
const readiness = buildDeliveryReadiness({ projectRoot, packagePath, generatedAt: evidence.generatedAt });
const validationLedger = buildDeliveryValidationLedger({
  projectRoot,
  packagePath,
  handoffRoot,
  generatedAt: evidence.generatedAt
});
const handoffChecklist = buildDeliveryPackageChecklist({
  projectRoot,
  packagePath,
  generatedAt: evidence.generatedAt,
  handoffRoot,
  validationLedger
});
const uiVisualEvidence = await copyUiVisualEvidence(handoffRoot);
await writeFile(
  path.join(handoffRoot, 'delivery-evidence.json'),
  `${JSON.stringify({ ...evidence, uiExperienceAudit, uiVisualEvidence, readiness, handoffChecklist, validationLedger, handoffRoot }, null, 2)}\n`
);
await writeFile(
  path.join(handoffRoot, 'delivery-validation.json'),
  `${JSON.stringify(validationLedger, null, 2)}\n`
);

await writeFile(
  path.join(handoffRoot, 'START-HERE.txt'),
  [
    'ServerLens handoff package',
    '',
    '1. Open app\\ServerLens.exe.',
    '2. Review docs\\README.md for runtime and delivery notes.',
    '3. Review delivery-evidence.json for verification commands, references, and safety boundary.',
    '4. Review delivery-validation.json for command-level validation results.',
    '5. Review ui-visual-evidence.json and screenshots in ui-evidence when available.',
    '6. Review the UI Experience Audit in delivery-evidence.json, then open Settings > UI Experience Audit in the app.',
    '7. Review the Handoff Checklist in delivery-evidence.json, then open Settings > Handoff Checklist in the app.',
    '8. Open every page once: Overview, Servers, Detail, Analysis, Inspection, Strategy, Reports, Alerts, Release, Studio, and Settings. Confirm the ServerLens 10.0 page operation summary before client walkthrough.',
    '',
    'This package is local-first and does not include secrets, private keys, passwords, raw logs, or collected telemetry payloads.'
  ].join('\n')
);

console.log(`Handoff package: ${handoffRoot}`);

function resolveAppSource(input = path.join('dist', 'win-unpacked')) {
  const candidate = path.resolve(projectRoot, input);
  if (!candidate.startsWith(`${distRoot}${path.sep}`)) {
    throw new Error('SERVERLENS_HANDOFF_APP_DIR must resolve inside the project dist directory.');
  }
  return candidate;
}

async function copyUiVisualEvidence(handoffRoot) {
  const sourceJson = path.join(projectRoot, 'dist', 'ui-visual-evidence.json');
  const targetJson = path.join(handoffRoot, 'ui-visual-evidence.json');
  const sourceDir = path.join(projectRoot, 'dist', 'ui-evidence');
  const targetDir = path.join(handoffRoot, 'ui-evidence');
  try {
    await cp(sourceJson, targetJson, { force: true });
    await cp(sourceDir, targetDir, { recursive: true, force: true });
    return JSON.parse(await readFile(targetJson, 'utf8'));
  } catch {
    const placeholder = {
      product: 'ServerLens',
      mode: 'local-ui-visual-evidence',
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      reason: 'Run npm.cmd run ui:evidence before handoff to generate screenshot evidence.',
      screenshots: [],
      pixelChecks: []
    };
    await writeFile(targetJson, `${JSON.stringify(placeholder, null, 2)}\n`);
    return placeholder;
  }
}
