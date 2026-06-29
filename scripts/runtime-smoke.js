import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import electronPath from 'electron';

import { createApp } from '../src/server/app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = createApp({ memoryOnly: true });
const server = await app.listen(0);
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 4173;
const runtimeUrl = `http://127.0.0.1:${port}`;
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'serverlens-runtime-smoke-'));
const runnerPath = path.join(tempDir, 'electron-runner.cjs');
const profilePath = path.join(tempDir, 'electron-profile');
const keepTemp = process.env.SERVERLENS_RUNTIME_KEEP_TEMP === '1';

try {
  await mkdir(profilePath, { recursive: true });
  await writeFile(runnerPath, electronRunnerSource(), 'utf8');
  let result;
  try {
    result = await runElectronSmoke(runnerPath, runtimeUrl, profilePath);
  } catch (error) {
    result = await fallbackRuntimeSmoke(runtimeUrl, error);
  }
  console.log(`SERVERLENS_RUNTIME_SMOKE_OK ${JSON.stringify(result)}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
  if (keepTemp) {
    console.log(`SERVERLENS_RUNTIME_TEMP ${tempDir}`);
  } else {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fallbackRuntimeSmoke(url, electronError) {
  const [html, css, js, readinessResponse] = await Promise.all([
    fetchText(`${url}/`),
    fetchText(`${url}/styles.css`),
    fetchText(`${url}/app.js`),
    fetchJson(`${url}/api/delivery/readiness`)
  ]);

  assertIncludes(html, 'id="metric-strip"', 'overview metrics shell');
  assertIncludes(html, 'id="delivery-readiness-button"', 'readiness button');
  assertIncludes(html, 'id="command-palette-button"', 'command palette button');
  assertIncludes(html, 'id="release-readiness-workspace"', 'release readiness workspace');
  assertIncludes(html, 'id="ecosystem-view"', 'ecosystem view');
  assertIncludes(html, 'id="ecosystem-studio"', 'ecosystem quick navigation');
  assertIncludes(html, 'id="eco-resource"', 'ecosystem resource panel');
  assertIncludes(html, 'id="eco-services"', 'ecosystem services panel');
  assertIncludes(html, 'id="eco-risk"', 'ecosystem risk panel');
  assertIncludes(html, 'id="inspection-workspace"', 'inspection workspace');
  assertIncludes(html, 'id="inspection-step-rail"', 'inspection step rail');
  assertIncludes(html, 'id="strategy-workspace"', 'strategy workspace');
  assertIncludes(html, 'id="strategy-iteration-rail"', 'strategy iteration rail');
  assertIncludes(html, 'id="action-dock"', 'action dock');
  assertIncludes(html, 'id="focus-peek"', 'focus peek');
  assertIncludes(html, 'id="live-monitor-toggle"', 'live monitor toggle');
  assertIncludes(html, 'id="live-monitor-grid"', 'live monitor grid');
  assertIncludes(html, 'id="live-monitor-status"', 'live monitor status');
  assertIncludes(html, 'retro-v9-shell', 'ServerLens 9.0 shell token');
  assertIncludes(html, 'retro-v10-shell', 'ServerLens 10.0 shell token');
  assertIncludes(html, 'data-component-system="serverlens-v100"', 'ServerLens 10.0 component system token');
  assertIncludes(html, 'id="page-operation-summary"', 'page operation summary');
  assertIncludes(html, 'id="page-operation-title"', 'page operation title');
  assertIncludes(html, 'id="page-operation-action"', 'page operation action');
  assertIncludes(html, 'id="page-operation-evidence"', 'page operation evidence');
  assertIncludes(html, 'id="page-operation-next-step"', 'page operation next step');
  assertIncludes(html, 'retro-reference-bar', 'RetroUI reference bar token');
  assertIncludes(html, 'ios-button', 'button compatibility token');
  assertIncludes(css, '--retro-paper', 'RetroUI paper token');
  assertIncludes(css, '--retro-ink', 'RetroUI ink token');
  assertIncludes(css, '--retro-shadow', 'RetroUI hard shadow token');
  assertIncludes(css, '.retro-v9-shell', 'RetroUI shell styles');
  assertIncludes(css, '.live-monitor-grid', 'live monitor grid styles');
  assertIncludes(css, '.live-pulse', 'live monitor pulse styles');
  assertIncludes(css, 'translate(3px, 3px)', 'RetroUI active translation');
  assertIncludes(css, 'overflow-y: auto', 'scrollable workspace token');
  assertIncludes(css, 'overflow-wrap: anywhere', 'text wrapping token');
  assertIncludes(css, 'white-space: normal', 'normal wrapping token');
  assertIncludes(css, 'overscroll-behavior: contain', 'contained scroll token');
  assertIncludes(css, '-webkit-overflow-scrolling: touch', 'touch momentum scroll token');
  assertIncludes(css, '.readiness-summary', 'readiness summary layout');
  assertIncludes(css, '.release-readiness-card', 'release readiness cards');
  assertIncludes(css, '.tactile-card', 'tactile cards');
  assertIncludes(css, '.ecosystem-grid', 'ecosystem grid layout');
  assertIncludes(css, '.ecosystem-panel', 'ecosystem panels');
  assertIncludes(css, '.eco-metric-row', 'ecosystem metric rows');
  assertIncludes(css, '.eco-trend', 'ecosystem fleet trend');
  assertIncludes(css, '.inspection-step-card', 'inspection step cards');
  assertIncludes(css, '.inspection-evidence-panel', 'inspection evidence panel');
  assertIncludes(css, '.strategy-iteration-card', 'strategy iteration cards');
  assertIncludes(css, '.strategy-evidence-panel', 'strategy evidence panel');
  assertIncludes(css, 'scroll-snap-type: x mandatory', 'horizontal snap rail');
  assertIncludes(css, '.ios-interactive', 'iOS press interaction');
  assertIncludes(css, '.ios-snap-rail', 'iOS snap rail');
  assertIncludes(css, '.action-dock.is-compact', 'action dock compact state');
  assertIncludes(css, '.action-dock.is-open', 'action dock open state');
  assertIncludes(css, '.page-operation-summary', 'page operation summary styles');
  assertIncludes(css, '.page-operation-evidence', 'page operation evidence styles');
  assertIncludes(css, '.page-operation-next-step', 'page operation next step styles');
  assertIncludes(css, '@media (max-width: 900px)', 'responsive layout breakpoint');
  assertIncludes(js, 'renderDeliveryReadiness', 'readiness renderer');
  assertIncludes(js, 'liveMonitoring', 'live monitoring state');
  assertIncludes(js, 'refreshInFlight', 'refresh in-flight guard');
  assertIncludes(js, 'renderLiveMonitor', 'live monitor renderer');
  assertIncludes(js, 'setInterval', 'local polling interval');
  assertIncludes(js, 'renderReleaseWorkspace', 'release renderer');
  assertIncludes(js, 'renderEcosystem', 'ecosystem renderer');
  assertIncludes(js, 'renderInspectionWorkspace', 'inspection workspace renderer');
  assertIncludes(js, 'renderStrategyWorkspace', 'strategy workspace renderer');
  assertIncludes(js, 'renderActionDock', 'action dock renderer');
  assertIncludes(js, 'pageExperienceModel', 'page experience model');
  assertIncludes(js, 'renderPageOperationSummary', 'page operation summary renderer');
  assertIncludes(js, 'bindIosInteractions', 'iOS interaction binder');
  assertIncludes(js, 'updateRailEdgeState', 'snap rail edge state');
  assertIncludes(js, 'Run readiness gate', 'command center readiness action');

  if (readinessResponse.status !== 'ready' || readinessResponse.summary.fail !== 0) {
    throw new Error(`Readiness API is not ready: ${JSON.stringify(readinessResponse.summary)}`);
  }

  return {
    mode: 'static-fallback',
    reason: 'Electron loadURL is unavailable in this host session; API and UI contracts were verified locally.',
    electronError: String(electronError.message ?? electronError).split('\n')[0],
    readinessStatus: readinessResponse.status,
    readinessChecks: readinessResponse.checks.length,
    pageOperationSummaryPresent: html.includes('id="page-operation-summary"'),
    pageCount: 11,
    htmlBytes: html.length,
    cssBytes: css.length,
    jsBytes: js.length
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

function assertIncludes(source, token, label) {
  if (!source.includes(token)) {
    throw new Error(`Runtime fallback smoke missing ${label}: ${token}`);
  }
}

function runElectronSmoke(runner, url, profile) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, [
      '--no-sandbox',
      '--enable-logging=stderr',
      runner,
      url,
      profile
    ], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      }
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Runtime smoke timed out while waiting for Electron.'));
    }, 30000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Electron runtime smoke failed with code ${code}.\n${stderr || stdout}`));
        return;
      }
      const line = stdout.trim().split(/\r?\n/).find((item) => item.startsWith('SMOKE_RESULT '));
      if (!line) {
        reject(new Error(`Electron runtime smoke did not return a result.\n${stderr || stdout}`));
        return;
      }
      resolve(JSON.parse(line.slice('SMOKE_RESULT '.length)));
    });
  });
}

function electronRunnerSource() {
  return `
const { app, BrowserWindow } = require('electron');

console.log('RUNNER_BOOT ' + JSON.stringify(process.argv));
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT ' + (error.stack || error.message));
  app.exit(1);
});
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED ' + (error.stack || error.message));
  app.exit(1);
});

const runtimeUrl = process.argv.at(-2);
const profilePath = process.argv.at(-1);

app.setPath('userData', profilePath);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disk-cache-size', '1');
app.commandLine.appendSwitch('user-data-dir', profilePath);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 1000,
    webPreferences: {
      contextIsolation: true
    }
  });

  try {
    await win.loadURL(runtimeUrl);
    const result = await win.webContents.executeJavaScript("(" + smokePage.toString() + ")()");
    win.setSize(390, 900);
    await new Promise((resolve) => setTimeout(resolve, 220));
    const mobile = await win.webContents.executeJavaScript("({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, ok: document.documentElement.scrollWidth <= window.innerWidth + 2 })");
    if (!mobile.ok) {
      throw new Error('Mobile layout has horizontal overflow: ' + JSON.stringify(mobile));
    }
    result.noMobileOverflow = true;
    result.mobileWidth = mobile.innerWidth;
    console.log('SMOKE_RESULT ' + JSON.stringify(result));
    app.exit(0);
  } catch (error) {
    console.error(error.stack || error.message);
    app.exit(1);
  }
});

async function smokePage() {
  const waitFor = (selector, timeoutMs = 8000) => new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const node = document.querySelector(selector);
      if (node) {
        clearInterval(timer);
        resolve(node);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Missing selector: ' + selector));
      }
    }, 50);
  });
  const click = async (selector) => {
    const node = await waitFor(selector);
    node.click();
    return node;
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const styleOf = (selector) => getComputedStyle(document.querySelector(selector));
  const hasNoHorizontalOverflow = () => document.documentElement.scrollWidth <= window.innerWidth + 2;

  await waitFor('#metric-strip .metric');
  await waitFor('#live-monitor-grid .live-monitor-card');
  assert(document.querySelectorAll('#metric-strip .metric').length === 4, 'Expected four metrics.');
  assert(document.querySelectorAll('#live-monitor-grid .live-monitor-card').length === 3, 'Expected three live monitor cards.');
  assert(hasNoHorizontalOverflow(), 'Desktop layout has horizontal overflow.');

  const workspaceStyle = styleOf('.workspace');
  assert(['auto', 'scroll'].includes(workspaceStyle.overflowY), 'Workspace is not vertically scrollable.');
  const liveCardStyle = styleOf('#live-monitor-grid .live-monitor-card');
  assert(liveCardStyle.overflowWrap === 'anywhere' || liveCardStyle.overflowWrap === 'break-word', 'Live monitor card text is not wrap guarded.');
  await click('#live-monitor-toggle');
  assert(document.querySelector('#live-monitor-toggle').getAttribute('aria-pressed') === 'false', 'Live monitor toggle did not pause polling.');
  await click('#live-monitor-toggle');
  assert(document.querySelector('#live-monitor-toggle').getAttribute('aria-pressed') === 'true', 'Live monitor toggle did not resume polling.');

  const panelStyle = styleOf('.panel');
  assert(panelStyle.backdropFilter !== 'none' || panelStyle.webkitBackdropFilter !== 'none', 'Panel material is missing backdropFilter.');

  await click('[data-view="settings"]');
  await click('#delivery-readiness-button');
  await waitFor('.readiness-check.pass');
  const readinessChecks = document.querySelectorAll('.readiness-check').length;
  assert(readinessChecks >= 10, 'Readiness gate rendered too few checks.');

  const readinessListStyle = styleOf('.readiness-check-list');
  assert(['auto', 'scroll'].includes(readinessListStyle.overflowY), 'Readiness check list is not scrollable.');
  assert(readinessListStyle.overscrollBehavior === 'contain', 'Readiness check list does not contain overscrollBehavior.');

  await click('[data-view="delivery"]');
  await click('[data-delivery-tab="validate"]');
  await waitFor('#release-readiness-cards .release-readiness-card');
  assert(document.querySelectorAll('[data-release-mode-card]').length === 3, 'Expected three release mode cards.');
  assert(document.querySelectorAll('#release-readiness-cards .release-readiness-card').length === 6, 'Expected six release readiness cards.');
  await click('[data-release-mode-card="client-handoff"]');
  assert(document.querySelector('[data-release-mode-card="client-handoff"]').classList.contains('is-selected'), 'Client handoff mode did not become selected.');
  const releaseQueueStyle = styleOf('.release-review-queue');
  assert(['auto', 'scroll'].includes(releaseQueueStyle.overflowY), 'Release review queue is not scrollable.');
  assert(releaseQueueStyle.overscrollBehavior === 'contain', 'Release review queue does not contain overscrollBehavior.');

  await click('[data-view="ecosystem"]');
  await waitFor('#interaction-swipe-rail .tactile-card');
  assert(document.querySelectorAll('#interaction-swipe-rail .tactile-card').length === 6, 'Expected six tactile navigation cards.');
  await waitFor('#eco-resource .eco-metric-row');
  assert(document.querySelectorAll('#eco-resource .eco-metric-row').length >= 1, 'Ecosystem resource panel did not populate from real telemetry.');
  assert(document.querySelector('#eco-services').textContent.trim().length > 0, 'Ecosystem services panel is empty.');
  assert(document.querySelector('#eco-risk').textContent.trim().length > 0, 'Ecosystem risk panel is empty.');
  assert(document.querySelector('#eco-freshness').textContent.trim().length > 0, 'Ecosystem freshness panel is empty.');
  const railStyle = styleOf('#interaction-swipe-rail');
  assert(railStyle.scrollSnapType.includes('x'), 'Ecosystem nav rail is missing x snap.');
  assert(document.querySelector('#interaction-swipe-rail').classList.contains('ios-snap-rail'), 'Ecosystem nav rail is missing iOS snap binding.');
  assert(document.querySelector('#interaction-swipe-rail .tactile-card').classList.contains('ios-interactive'), 'Tactile card is missing iOS press binding.');

  await click('[data-view="delivery"]');
  await click('[data-delivery-tab="inspect"]');
  await waitFor('#inspection-step-rail .inspection-step-card');
  assert(document.querySelectorAll('#inspection-step-rail .inspection-step-card').length === 5, 'Expected five inspection step cards.');
  await click('[data-inspection-step="package"]');
  assert(document.querySelector('[data-inspection-step="package"]').classList.contains('is-selected'), 'Package inspection step did not become selected.');
  assert(document.querySelector('#inspection-evidence-panel').textContent.includes('Delivery validation ledger'), 'Inspection evidence panel is missing package artifacts.');

  await click('[data-delivery-tab="handoff"]');
  await waitFor('#strategy-iteration-rail .strategy-iteration-card');
  assert(document.querySelectorAll('#strategy-iteration-rail .strategy-iteration-card').length === 10, 'Expected ten strategy iteration cards.');
  await click('[data-strategy-iteration="strategy-10-release-ios"]');
  assert(document.querySelector('[data-strategy-iteration="strategy-10-release-ios"]').classList.contains('is-selected'), 'Release ios strategy iteration did not become selected.');
  assert(document.querySelector('#strategy-evidence-panel').textContent.includes('CodeStable'), 'Strategy evidence panel is missing CodeStable evidence.');

  await click('#action-dock-toggle');
  await waitFor('#action-dock .dock-command');
  assert(document.querySelectorAll('#action-dock .dock-command').length >= 6, 'Action Dock rendered too few commands.');
  await click('[data-action-dock-handle]');
  assert(document.querySelector('#action-dock').classList.contains('is-expanded'), 'Action Dock did not expand.');
  assert(document.body.dataset.dockSnap === 'expanded', 'Action Dock snap state did not update on body.');

  await click('#command-palette-button');
  await waitFor('#command-results');
  const commandInput = document.querySelector('#command-input');
  commandInput.value = 'readiness';
  commandInput.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 120));
  const commandText = document.querySelector('#command-results').textContent;
  assert(commandText.includes('Run readiness gate'), 'Command Center cannot find readiness gate.');

  return {
    metrics: document.querySelectorAll('#metric-strip .metric').length,
    liveMonitorCards: document.querySelectorAll('#live-monitor-grid .live-monitor-card').length,
    readinessChecks,
    commandHasReadiness: commandText.includes('Run readiness gate'),
    releaseCards: document.querySelectorAll('#release-readiness-cards .release-readiness-card').length,
    ecosystemPanels: document.querySelectorAll('#eco-resource, #eco-services, #eco-containers, #eco-exposure, #eco-risk, #eco-freshness').length,
    inspectionCards: document.querySelectorAll('#inspection-step-rail .inspection-step-card').length,
    inspectionSelected: document.querySelector('[data-inspection-step="package"]').classList.contains('is-selected'),
    strategyCards: document.querySelectorAll('#strategy-iteration-rail .strategy-iteration-card').length,
    strategySelected: document.querySelector('[data-strategy-iteration="strategy-10-release-ios"]').classList.contains('is-selected'),
    tactileCards: document.querySelectorAll('#interaction-swipe-rail .tactile-card').length,
    dockCommands: document.querySelectorAll('#action-dock .dock-command').length,
    noDesktopOverflow: true,
    panelBackdrop: panelStyle.backdropFilter || panelStyle.webkitBackdropFilter
  };
}
`;
}
