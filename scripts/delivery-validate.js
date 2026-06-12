import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDeliveryPackageChecklist, buildDeliveryValidationLedger } from '../src/shared/delivery-evidence.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(projectRoot, process.env.SERVERLENS_PACKAGE_DIR ?? 'dist\\win-unpacked', 'ServerLens.exe');
const packageJson = JSON.parse(await readFileJson(path.join(projectRoot, 'package.json')));
const handoffRoot = path.join(projectRoot, 'dist', 'handoff', `ServerLens-${packageJson.version}`);
const validationPath = path.join(projectRoot, 'dist', 'delivery-validation.json');
const handoffValidationPath = path.join(handoffRoot, 'delivery-validation.json');

const commands = [
  { command: 'npm.cmd test' },
  { command: 'npm.cmd run build' },
  { command: 'npm.cmd run runtime:smoke' },
  { command: 'npm.cmd run ui:evidence' },
  { command: 'npm.cmd run package:app' },
  { command: 'npm.cmd run handoff:dir' }
];

const commandResults = [];
for (const command of commands) {
  const result = await annotateUiEvidenceCommand(await runCommand(command));
  commandResults.push(result);
  if (result.exitCode !== 0) break;
}

const ledger = buildDeliveryValidationLedger({
  projectRoot,
  packagePath,
  handoffRoot,
  commandResults
});

await mkdir(path.dirname(validationPath), { recursive: true });
await writeFile(validationPath, `${JSON.stringify(ledger, null, 2)}\n`);
await mkdir(path.dirname(handoffValidationPath), { recursive: true });
await writeFile(handoffValidationPath, `${JSON.stringify(ledger, null, 2)}\n`);
await updateHandoffEvidenceLedger(ledger);

console.log(`SERVERLENS_DELIVERY_VALIDATION ${JSON.stringify({
  status: ledger.status,
  pass: ledger.summary.pass,
  warn: ledger.summary.warn,
  fail: ledger.summary.fail,
  path: validationPath,
  handoffPath: handoffValidationPath
})}`);

if (ledger.status === 'blocked') {
  process.exitCode = 1;
}

function runCommand(command) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  return new Promise((resolve) => {
    const child = spawn(command.command, {
      cwd: projectRoot,
      shell: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('error', (error) => {
      resolve(commandResult(command.command, 1, started, startedAt, error.message));
    });
    child.on('exit', (code) => {
      resolve(commandResult(command.command, code ?? 1, started, startedAt, summarizeOutput(stdout, stderr)));
    });
  });
}

function commandResult(command, exitCode, started, startedAt, summary) {
  return {
    command,
    status: exitCode === 0 ? 'pass' : 'fail',
    exitCode,
    durationMs: Date.now() - started,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary
  };
}

function summarizeOutput(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const important = combined.filter((line) => (
    /pass|fail|SERVERLENS_|Build check passed|Packaged desktop app|Handoff package|tests \d+/i.test(line)
  ));
  return (important.length > 0 ? important : combined).slice(-8).join(' | ').slice(0, 500);
}

async function readFileJson(filePath) {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}

async function annotateUiEvidenceCommand(result) {
  if (result.command !== 'npm.cmd run ui:evidence' || result.exitCode !== 0) {
    return result;
  }

  const evidencePath = path.join(projectRoot, 'dist', 'ui-visual-evidence.json');
  try {
    const evidence = JSON.parse(await readFileJson(evidencePath));
    if (evidence.status === 'ready') {
      return {
        ...result,
        summary: `${result.summary} | UI visual evidence ready with ${evidence.screenshots?.length ?? 0} screenshots`.slice(0, 500)
      };
    }
    return {
      ...result,
      status: 'warn',
      summary: `${result.summary} | UI visual evidence ${evidence.status}: ${evidence.reason ?? 'review required'}`.slice(0, 500)
    };
  } catch (error) {
    return {
      ...result,
      status: 'warn',
      summary: `${result.summary} | UI visual evidence review required: ${error.message}`.slice(0, 500)
    };
  }
}

async function updateHandoffEvidenceLedger(ledger) {
  const evidencePath = path.join(handoffRoot, 'delivery-evidence.json');
  try {
    const evidence = JSON.parse(await readFileJson(evidencePath));
    const handoffChecklist = buildDeliveryPackageChecklist({
      projectRoot,
      packagePath,
      handoffRoot,
      generatedAt: evidence.generatedAt,
      validationLedger: ledger
    });
    await writeFile(evidencePath, `${JSON.stringify({ ...evidence, validationLedger: ledger, handoffChecklist }, null, 2)}\n`);
  } catch {
    // The standalone ledger remains authoritative if a partial handoff was not generated.
  }
}
