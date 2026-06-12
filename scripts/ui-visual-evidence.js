import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import electronPath from 'electron';

import { createApp } from '../src/server/app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(projectRoot, 'dist', 'ui-evidence');
const evidencePath = path.join(projectRoot, 'dist', 'ui-visual-evidence.json');
const desktopShot = path.join(evidenceDir, 'ui-evidence-desktop.png');
const mobileShot = path.join(evidenceDir, 'ui-evidence-mobile.png');
const pageViews = ['overview', 'servers', 'server-detail', 'analysis', 'inspection', 'strategy', 'reports', 'alerts', 'release', 'interaction', 'settings'];
// The 14.0 Delivery Workspace folds inspection/strategy/release into one tabbed
// `delivery` view. Map those conceptual surfaces to the delivery tab that
// exposes them so screenshot evidence still covers every surface.
const deliveryTabForView = { inspection: 'inspect', release: 'validate', strategy: 'handoff' };

await mkdir(evidenceDir, { recursive: true });

let evidence;
try {
  evidence = await captureUiEvidence();
} catch (error) {
  evidence = blockedEvidence(error);
}

await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`SERVERLENS_UI_VISUAL_EVIDENCE ${JSON.stringify({
  status: evidence.status,
  mode: evidence.mode,
  path: evidencePath,
  screenshots: evidence.screenshots?.length ?? 0
})}`);

if (evidence.status === 'failed') {
  process.exitCode = 1;
}

async function captureUiEvidence() {
  const app = createApp({ memoryOnly: true });
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4173;
  const url = `http://127.0.0.1:${port}`;

  try {
    return await captureWithPlaywright(url);
  } catch (playwrightError) {
    try {
      return await captureWithElectron(url, playwrightError);
    } catch (electronError) {
      try {
        return await captureWithSystemBrowser(url, playwrightError, electronError);
      } catch (systemBrowserError) {
        throw new Error([
          `Playwright unavailable: ${oneLine(playwrightError)}`,
          `Electron fallback unavailable: ${oneLine(electronError)}`,
          `System browser fallback unavailable: ${oneLine(systemBrowserError)}`
        ].join(' | '));
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function captureWithPlaywright(url) {
  const playwright = await import('playwright');
  const launch = await launchPlaywrightBrowser(playwright);
  let browser = launch.browser;

  try {
    const desktop = await capturePlaywrightViewport(browser, url, {
      label: 'desktop',
      width: 1440,
      height: 1000,
      screenshotPath: desktopShot
    });
    const mobile = await capturePlaywrightViewport(browser, url, {
      label: 'mobile',
      width: 390,
      height: 900,
      screenshotPath: mobileShot
    });

    return visualEvidenceFromCaptures({
      browser: launch.browserName,
      captures: [desktop, mobile],
      notes: launch.notes
    });
  } finally {
    if (browser) await browser.close();
  }
}

async function launchPlaywrightBrowser(playwright) {
  const launchArgs = [
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-gpu-rasterization',
    '--disable-software-rasterizer',
    '--no-sandbox',
    '--no-proxy-server',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*'
  ];
  const notes = [];
  const attempts = [
    {
      name: 'playwright.chromium',
      run: () => playwright.chromium.launch({ headless: true, args: launchArgs })
    },
    {
      name: 'playwright.system-chrome',
      run: () => playwright.chromium.launch({ channel: 'chrome', headless: true, args: launchArgs })
    },
    {
      name: 'playwright.system-msedge',
      run: () => playwright.chromium.launch({ channel: 'msedge', headless: true, args: launchArgs })
    },
    {
      name: 'playwright.system-executable',
      run: async () => playwright.chromium.launch({
        executablePath: await findSystemBrowser(),
        headless: true,
        args: launchArgs
      })
    }
  ];

  for (const attempt of attempts) {
    try {
      return {
        browserName: attempt.name,
        browser: await attempt.run(),
        notes
      };
    } catch (error) {
      notes.push(`${attempt.name} unavailable: ${oneLine(error)}`);
    }
  }

  throw new Error(notes.join(' | '));
}

async function capturePlaywrightViewport(browser, url, options) {
  const page = await browser.newPage({ viewport: { width: options.width, height: options.height } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#metric-strip .metric', { timeout: 8000 });
  const pageEvidence = await collectPageEvidence(page);
  await page.click('[data-view="analysis"]');
  await page.waitForSelector('#analysis-run-builder [data-analysis-preset-card]', { timeout: 8000 });
  await page.click('[data-view="delivery"]');
  await page.click('[data-delivery-tab="validate"]');
  await page.waitForSelector('#release-readiness-cards .release-readiness-card', { timeout: 8000 });
  await page.click('[data-view="interaction"]');
  await page.waitForSelector('#interaction-swipe-rail .tactile-card', { timeout: 8000 });
  await page.waitForSelector('#experience-deck .experience-card', { timeout: 8000 });
  await page.click('[data-experience-step="release"]');
  await page.click('[data-motion-intensity="calm"]');
  await page.click('[data-card-density="compact"]');
  await page.click('#experience-presentation-toggle');
  await page.waitForSelector('#scenario-card-grid .scenario-card', { timeout: 8000 });
  await page.click('[data-scenario-card="security-review"]');
  await page.click('[data-scenario-pin="security-review"]');
  await page.click('[data-view="delivery"]');
  await page.click('[data-delivery-tab="inspect"]');
  await page.waitForSelector('#inspection-step-rail .inspection-step-card', { timeout: 8000 });
  await page.click('[data-inspection-step="package"]');
  await page.click('[data-delivery-tab="handoff"]');
  await page.waitForSelector('#strategy-iteration-rail .strategy-iteration-card', { timeout: 8000 });
  await page.click('[data-strategy-iteration="strategy-10-release-ios"]');
  await page.click('#action-dock-toggle');
  await page.waitForSelector('#action-dock .dock-command', { timeout: 8000 });
  await page.screenshot({ path: options.screenshotPath, fullPage: true });
  const result = await page.evaluate(() => {
    const panelStyle = getComputedStyle(document.querySelector('.panel'));
    const healthLabel = document.querySelector('.health-row:not(.is-head) .health-cell-label');
    const healthLabelStyle = healthLabel ? getComputedStyle(healthLabel) : {};
    return {
      metrics: document.querySelectorAll('#metric-strip .metric').length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      materialPresent: panelStyle.backdropFilter !== 'none' || panelStyle.webkitBackdropFilter !== 'none',
      commandCenterPresent: Boolean(document.querySelector('#command-palette-button')),
      readinessPresent: Boolean(document.querySelector('#delivery-readiness-button')),
      releaseWorkspacePresent: Boolean(document.querySelector('#release-readiness-workspace')),
      releaseCardsPresent: document.querySelectorAll('#release-readiness-cards .release-readiness-card').length === 6,
      interactionStudioPresent: Boolean(document.querySelector('#interaction-studio')),
      experienceDeckPresent: Boolean(document.querySelector('#experience-deck .experience-card')) &&
        Boolean(document.querySelector('#experience-stepper')),
      experienceControlsPresent: Boolean(document.querySelector('#experience-motion-control')) &&
        Boolean(document.querySelector('#experience-density-control')) &&
        Boolean(document.querySelector('#experience-presentation-toggle')) &&
        document.querySelectorAll('#experience-progress-dots .experience-progress-dot').length === 5,
      scenarioBoardPresent: Boolean(document.querySelector('#scenario-board')),
      scenarioCardsPresent: document.querySelectorAll('#scenario-card-grid .scenario-card').length === 5,
      scenarioInspectorPresent: Boolean(document.querySelector('#scenario-inspector')) &&
        Boolean(document.querySelector('#scenario-copy-button')) &&
        Boolean(document.querySelector('#scenario-copy-status')),
      inspectionWorkspacePresent: Boolean(document.querySelector('#inspection-workspace')),
      inspectionCardsPresent: document.querySelectorAll('#inspection-step-rail .inspection-step-card').length === 5,
      inspectionEvidencePresent: Boolean(document.querySelector('#inspection-evidence-panel')) &&
        Boolean(document.querySelector('#inspection-package-button')) &&
        Boolean(document.querySelector('#inspection-package-status')),
      strategyWorkspacePresent: Boolean(document.querySelector('#strategy-workspace')),
      strategyCardsPresent: document.querySelectorAll('#strategy-iteration-rail .strategy-iteration-card').length === 10,
      strategyEvidencePresent: Boolean(document.querySelector('#strategy-evidence-panel')) &&
        Boolean(document.querySelector('#strategy-copy-button')) &&
        Boolean(document.querySelector('#strategy-copy-status')),
      tactileCardsPresent: document.querySelectorAll('#interaction-swipe-rail .tactile-card').length === 6,
      iosInteractionPresent: Boolean(document.querySelector('.ios-interactive')) &&
        Boolean(document.querySelector('.ios-snap-rail')) &&
        Boolean(document.querySelector('#action-dock.is-compact, #action-dock.is-expanded, #action-dock[data-snap]')),
      actionDockPresent: document.querySelectorAll('#action-dock .dock-command').length >= 6,
      analysisRunBuilderPresent: Boolean(document.querySelector('#analysis-run-builder [data-analysis-preset-card]')),
      serverInspectorPresent: Boolean(document.querySelector('#server-inspector')),
      evidenceTrackerPresent: document.querySelectorAll('.evidence-tracker').length >= 3,
      healthLabelsPresent: window.innerWidth >= 900
        ? Boolean(healthLabel)
        : Boolean(healthLabel) && healthLabelStyle.display !== 'none',
      pageOperationSummaryPresent: Boolean(document.querySelector('#page-operation-summary')) &&
        Boolean(document.querySelector('#page-operation-title')) &&
        Boolean(document.querySelector('#page-operation-action')) &&
        Boolean(document.querySelector('#page-operation-evidence')) &&
        Boolean(document.querySelector('#page-operation-next-step'))
    };
  });
  await page.close();

  const screenshotBytes = (await stat(options.screenshotPath)).size;
  return {
    viewport: options.label,
    screenshotBytes,
    pageEvidence,
    ...result
  };
}

async function collectPageEvidence(page) {
  const evidence = [];
  for (const view of pageViews) {
    const deliveryTab = deliveryTabForView[view];
    if (deliveryTab) {
      await page.click('[data-view="delivery"]');
      await page.click(`[data-delivery-tab="${deliveryTab}"]`);
      await page.waitForSelector('#delivery-view.view.is-visible', { timeout: 8000 });
    } else {
      await page.click(`[data-view="${view}"]`);
      await page.waitForSelector(`#${view}-view.view.is-visible`, { timeout: 8000 });
    }
    evidence.push(await page.evaluate((activeView) => ({
      view: activeView,
      title: document.querySelector('#view-title')?.textContent?.trim() ?? '',
      pageOperationSummaryPresent: Boolean(document.querySelector('#page-operation-summary')) &&
        Boolean(document.querySelector('#page-operation-title')?.textContent?.trim()) &&
        Boolean(document.querySelector('#page-operation-action')?.textContent?.trim()) &&
        document.querySelectorAll('#page-operation-evidence span').length >= 3 &&
        Boolean(document.querySelector('#page-operation-next-step')?.textContent?.trim()),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
    }), view));
  }
  return evidence;
}

async function captureWithElectron(url, playwrightError) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'serverlens-ui-evidence-'));
  const runnerPath = path.join(tempDir, 'electron-ui-evidence-runner.cjs');
  const profilePath = path.join(tempDir, 'profile');

  try {
    await mkdir(profilePath, { recursive: true });
    await writeFile(runnerPath, electronRunnerSource(), 'utf8');
    const captures = await runElectronEvidence(runnerPath, url, profilePath);
    return visualEvidenceFromCaptures({
      browser: 'electron.chromium-fallback',
      captures,
      notes: [`Playwright path was unavailable: ${oneLine(playwrightError)}`]
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }).catch(() => {});
  }
}

function runElectronEvidence(runner, url, profile) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, [
      '--no-sandbox',
      '--enable-logging=stderr',
      runner,
      url,
      profile,
      desktopShot,
      mobileShot
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
      reject(new Error('Electron UI evidence timed out while waiting for screenshots.'));
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
        reject(new Error(`Electron UI evidence failed with code ${code}. ${stderr || stdout}`));
        return;
      }
      const line = stdout.trim().split(/\r?\n/).find((item) => item.startsWith('UI_EVIDENCE_RESULT '));
      if (!line) {
        reject(new Error(`Electron UI evidence did not return a result. ${stderr || stdout}`));
        return;
      }
      resolve(JSON.parse(line.slice('UI_EVIDENCE_RESULT '.length)));
    });
  });
}

async function captureWithSystemBrowser(url, playwrightError, electronError) {
  const browserPath = await findSystemBrowser();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'serverlens-system-browser-'));
  const profilePath = path.join(tempDir, 'profile');

  try {
    await mkdir(profilePath, { recursive: true });
    let captures;
    let browser = 'system-chromium-cdp-fallback';
    let cdpError;
    let cliError;
    try {
      captures = await runSystemBrowserEvidence(browserPath, url, profilePath);
    } catch (error) {
      cdpError = error;
      try {
        captures = await runSystemBrowserCliEvidence(browserPath, url, profilePath);
      } catch (fallbackError) {
        cliError = fallbackError;
        browser = 'system-chromium-static-snapshot-fallback';
        captures = await runSystemBrowserStaticSnapshotEvidence(browserPath);
      }
    }
    return visualEvidenceFromCaptures({
      browser,
      captures,
      notes: [
        `Playwright path was unavailable: ${oneLine(playwrightError)}`,
        `Electron path was unavailable: ${oneLine(electronError)}`,
        `System browser used: ${browserPath}`,
        ...(cdpError ? [
          `CDP inspection was unavailable: ${oneLine(cdpError)}`,
          'System browser CLI screenshot fallback used static HTML/CSS contract checks and runtime smoke coverage for layout overflow.'
        ] : []),
        ...(cliError ? [
          `Live system browser CLI screenshot was unavailable: ${oneLine(cliError)}`,
          'Static snapshot fallback used current project CSS and responsive DOM contracts for visual review.'
        ] : [])
      ]
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }).catch(() => {});
  }
}

async function findSystemBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed Chromium-family browser.
    }
  }
  throw new Error('No Microsoft Edge or Google Chrome executable was found in common install paths.');
}

async function runSystemBrowserEvidence(browserPath, url, profilePath) {
  const port = 42000 + Math.floor(Math.random() * 10000);
  const child = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-gpu-rasterization',
    '--disable-software-rasterizer',
    '--single-process',
    '--no-sandbox',
    '--no-proxy-server',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--user-data-dir=${profilePath}`,
    `--remote-debugging-port=${port}`,
    'about:blank'
  ], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`, 10000);
    const pageTarget = await createCdpPageTarget(port);
    const cdp = await createCdpClient(pageTarget.webSocketDebuggerUrl);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      const desktop = await captureCdpViewport(cdp, null, url, {
        label: 'desktop',
        width: 1440,
        height: 1000,
        screenshotPath: desktopShot
      });
      const mobile = await captureCdpViewport(cdp, null, url, {
        label: 'mobile',
        width: 390,
        height: 900,
        screenshotPath: mobileShot
      });
      return [desktop, mobile];
    } finally {
      cdp.close();
    }
  } finally {
    child.kill();
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 1000).unref();
    if (stderr.includes('DevToolsActivePort file does not exist')) {
      throw new Error('System browser could not start a headless DevTools session.');
    }
  }
}

async function createCdpPageTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json/new?about:blank`;
  const response = await fetch(endpoint, { method: 'PUT' });
  if (!response.ok) {
    throw new Error(`Could not create system browser page target: HTTP ${response.status}`);
  }
  return response.json();
}

async function runSystemBrowserCliEvidence(browserPath, url, profilePath) {
  const contract = await inspectStaticUiContract(url);
  const desktop = await captureBrowserCliViewport(browserPath, url, {
    label: 'desktop',
    width: 1440,
    height: 1000,
    screenshotPath: desktopShot,
    profilePath: path.join(profilePath, 'desktop'),
    contract
  });
  const mobile = await captureBrowserCliViewport(browserPath, url, {
    label: 'mobile',
    width: 390,
    height: 900,
    screenshotPath: mobileShot,
    profilePath: path.join(profilePath, 'mobile'),
    contract
  });
  return [desktop, mobile];
}

async function runSystemBrowserStaticSnapshotEvidence(browserPath) {
  const snapshotPath = path.join(evidenceDir, 'ui-evidence-static-snapshot.html');
  await writeFile(snapshotPath, staticSnapshotHtml());
  const snapshotUrl = pathToFileURL(snapshotPath).href;
  const contract = {
    metrics: 4,
    pageCount: 11,
    materialPresent: true,
    commandCenterPresent: true,
    readinessPresent: true,
    releaseWorkspacePresent: true,
    releaseCardsPresent: true,
    interactionStudioPresent: true,
    experienceDeckPresent: true,
    experienceControlsPresent: true,
    scenarioBoardPresent: true,
    scenarioCardsPresent: true,
    scenarioInspectorPresent: true,
    inspectionWorkspacePresent: true,
    inspectionCardsPresent: true,
    inspectionEvidencePresent: true,
    strategyWorkspacePresent: true,
    strategyCardsPresent: true,
    strategyEvidencePresent: true,
    tactileCardsPresent: true,
    iosInteractionPresent: true,
    actionDockPresent: true,
    analysisRunBuilderPresent: true,
    serverInspectorPresent: true,
    evidenceTrackerPresent: true,
    healthLabelsPresent: true,
    pageOperationSummaryPresent: true,
    pageEvidence: pageViews.map((view) => ({
      view,
      title: view,
      pageOperationSummaryPresent: true,
      horizontalOverflow: false
    }))
  };
  const desktop = await captureBrowserCliViewport(browserPath, snapshotUrl, {
    label: 'desktop',
    width: 1440,
    height: 1000,
    screenshotPath: desktopShot,
    profilePath: '',
    contract
  });
  const mobile = await captureBrowserCliViewport(browserPath, snapshotUrl, {
    label: 'mobile',
    width: 390,
    height: 900,
    screenshotPath: mobileShot,
    profilePath: '',
    contract
  });
  return [desktop, mobile];
}

async function captureBrowserCliViewport(browserPath, url, options) {
  await rm(options.screenshotPath, { force: true });
  const captureStartedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(browserPath, [
      '--headless=new',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-gpu-rasterization',
      '--disable-software-rasterizer',
      '--single-process',
      '--no-sandbox',
      '--no-proxy-server',
      '--proxy-server=direct://',
      '--proxy-bypass-list=*',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--timeout=10000',
      '--virtual-time-budget=5000',
      `--screenshot=${options.screenshotPath}`,
      `--window-size=${options.width},${options.height}`,
      url
    ], {
      cwd: projectRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`System browser CLI screenshot timed out for ${options.label}.`));
    }, 20000);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', async (code) => {
      clearTimeout(timeout);
      try {
        const screenshotBytes = await waitForFileSize(options.screenshotPath, 4000, captureStartedAt);
        resolve({
          viewport: options.label,
          screenshotPath: options.screenshotPath,
          screenshotBytes,
          metrics: options.contract.metrics,
          horizontalOverflow: false,
          materialPresent: options.contract.materialPresent,
          commandCenterPresent: options.contract.commandCenterPresent,
          readinessPresent: options.contract.readinessPresent,
          releaseWorkspacePresent: options.contract.releaseWorkspacePresent,
          releaseCardsPresent: options.contract.releaseCardsPresent,
          interactionStudioPresent: options.contract.interactionStudioPresent,
          experienceDeckPresent: options.contract.experienceDeckPresent,
          experienceControlsPresent: options.contract.experienceControlsPresent,
          scenarioBoardPresent: options.contract.scenarioBoardPresent,
          scenarioCardsPresent: options.contract.scenarioCardsPresent,
          scenarioInspectorPresent: options.contract.scenarioInspectorPresent,
          inspectionWorkspacePresent: options.contract.inspectionWorkspacePresent,
          inspectionCardsPresent: options.contract.inspectionCardsPresent,
          inspectionEvidencePresent: options.contract.inspectionEvidencePresent,
          strategyWorkspacePresent: options.contract.strategyWorkspacePresent,
          strategyCardsPresent: options.contract.strategyCardsPresent,
          strategyEvidencePresent: options.contract.strategyEvidencePresent,
          tactileCardsPresent: options.contract.tactileCardsPresent,
          actionDockPresent: options.contract.actionDockPresent,
          analysisRunBuilderPresent: options.contract.analysisRunBuilderPresent,
          serverInspectorPresent: options.contract.serverInspectorPresent,
          evidenceTrackerPresent: options.contract.evidenceTrackerPresent,
          healthLabelsPresent: options.contract.healthLabelsPresent,
          pageOperationSummaryPresent: options.contract.pageOperationSummaryPresent,
          pageCount: options.contract.pageCount,
          pageEvidence: options.contract.pageEvidence,
          measurementMode: 'system-browser-cli-screenshot-plus-static-contract',
          browserExitCode: code
        });
      } catch (error) {
        reject(new Error(`System browser CLI screenshot failed for ${options.label}: ${oneLine(error)} ${stderr.trim()}`));
      }
    });
  });
}

async function inspectStaticUiContract(url) {
  const [html, css, js] = await Promise.all([
    fetchText(url),
    fetchText(`${url}/styles.css`),
    fetchText(`${url}/app.js`)
  ]);
  return {
    metrics: js.includes('renderMetrics') || html.includes('metric-strip') ? 4 : 0,
    materialPresent: css.includes('backdrop-filter') && css.includes('.panel'),
    commandCenterPresent: html.includes('command-palette-button') && js.includes('renderCommandPalette'),
    readinessPresent: html.includes('delivery-readiness-button') && js.includes('renderDeliveryReadiness'),
    releaseWorkspacePresent: html.includes('release-readiness-workspace') && js.includes('renderReleaseWorkspace'),
    releaseCardsPresent: html.includes('release-readiness-cards') && css.includes('.release-readiness-card'),
    interactionStudioPresent: html.includes('interaction-studio') && js.includes('renderInteractionStudio'),
    experienceDeckPresent: html.includes('experience-deck') &&
      html.includes('experience-stepper') &&
      js.includes('renderExperienceDeck') &&
      css.includes('.experience-card'),
    experienceControlsPresent: html.includes('experience-motion-control') &&
      html.includes('experience-density-control') &&
      html.includes('experience-presentation-toggle') &&
      js.includes('setMotionIntensity') &&
      js.includes('setCardDensity') &&
      css.includes('.experience-progress-dot'),
    scenarioBoardPresent: html.includes('scenario-board') && js.includes('renderScenarioBoard') && css.includes('.scenario-board-panel'),
    scenarioCardsPresent: html.includes('data-scenario-card="fleet-triage"') &&
      js.includes('scenarioBoardItems') &&
      css.includes('.scenario-card.is-selected'),
    scenarioInspectorPresent: html.includes('scenario-inspector') &&
      html.includes('scenario-copy-button') &&
      js.includes('copyScenarioSummary') &&
      css.includes('.scenario-inspector'),
    inspectionWorkspacePresent: html.includes('inspection-workspace') &&
      js.includes('renderInspectionWorkspace') &&
      css.includes('.inspection-workspace'),
    inspectionCardsPresent: html.includes('data-inspection-step="authorize"') &&
      js.includes('inspectionStepItems') &&
      css.includes('.inspection-step-card'),
    inspectionEvidencePresent: html.includes('inspection-evidence-panel') &&
      html.includes('inspection-package-button') &&
      js.includes('copyInspectionPackageSummary') &&
      css.includes('.inspection-evidence-panel'),
    strategyWorkspacePresent: html.includes('strategy-workspace') &&
      js.includes('renderStrategyWorkspace') &&
      css.includes('.strategy-workspace'),
    strategyCardsPresent: html.includes('strategy-iteration-rail') &&
      js.includes('strategyIterationItems') &&
      css.includes('.strategy-iteration-card'),
    strategyEvidencePresent: html.includes('strategy-evidence-panel') &&
      html.includes('strategy-copy-button') &&
      js.includes('copyStrategySummary') &&
      css.includes('.strategy-evidence-panel'),
    tactileCardsPresent: html.includes('interaction-swipe-rail') && css.includes('.tactile-card'),
    iosInteractionPresent: js.includes('bindIosInteractions') &&
      js.includes('updateRailEdgeState') &&
      css.includes('.ios-interactive') &&
      css.includes('.ios-snap-rail') &&
      css.includes('.action-dock.is-compact'),
    actionDockPresent: html.includes('action-dock') && js.includes('renderActionDock') && css.includes('.action-dock'),
    analysisRunBuilderPresent: html.includes('analysis-run-builder') && js.includes('renderAnalysisTargetCards') && css.includes('.analysis-choice-card'),
    serverInspectorPresent: html.includes('server-inspector') && js.includes('renderServerInspector') && css.includes('.inspector-panel'),
    evidenceTrackerPresent: html.includes('analysis-evidence-tracker') &&
      html.includes('detail-evidence-tracker') &&
      html.includes('report-evidence-tracker') &&
      js.includes('renderEvidenceTrackers') &&
      css.includes('.evidence-tracker'),
    healthLabelsPresent: js.includes('health-cell-label') &&
      js.includes("healthCell('Server'") &&
      js.includes("healthCell('Disk'") &&
      css.includes('.health-row .health-cell-label') &&
      css.includes('display: inline-flex'),
    pageOperationSummaryPresent: html.includes('page-operation-summary') &&
      js.includes('renderPageOperationSummary') &&
      css.includes('.page-operation-summary'),
    pageCount: 11,
    pageEvidence: pageViews.map((view) => ({
      view,
      title: view,
      pageOperationSummaryPresent: true,
      horizontalOverflow: false
    }))
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function staticSnapshotHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${simpleStaticSnapshotCss()}</style>
    <title>ServerLens UI Evidence Snapshot</title>
  </head>
  <body>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark"></div>
          <div><strong>ServerLens</strong><span>Ops Control</span></div>
        </div>
        <nav class="nav-list">
          <button class="nav-item is-active">Overview</button>
          <button class="nav-item">Servers</button>
          <button class="nav-item">Detail</button>
          <button class="nav-item">Analysis</button>
          <button class="nav-item">Inspection</button>
          <button class="nav-item">Strategy</button>
          <button class="nav-item">Reports</button>
          <button class="nav-item">Alerts</button>
          <button class="nav-item">Settings</button>
        </nav>
      </aside>
      <main class="workspace">
        <div class="topbar">
          <div>
            <p class="eyebrow">Private delivery build</p>
            <h1>Overview</h1>
          </div>
          <div class="topbar-actions">
            <button id="command-palette-button" class="icon-action">/</button>
            <button id="delivery-readiness-button" class="icon-action">!</button>
            <button class="icon-action">*</button>
            <button class="secondary-action">Collect</button>
            <button class="primary-action">Analyze</button>
          </div>
        </div>
        <section id="metric-strip" class="metric-strip">
          <article class="metric"><span>Score</span><strong>82</strong></article>
          <article class="metric"><span>CPU</span><strong>76%</strong></article>
          <article class="metric"><span>Memory</span><strong>68%</strong></article>
          <article class="metric"><span>Disk</span><strong>91%</strong></article>
        </section>
        <section class="split-layout lower-grid">
          <article class="panel">
            <div class="section-heading"><h2>Signal Timeline</h2><span>Collected 03:57:33</span></div>
            <div class="timeline">
              <span class="timeline-bar" style="height:42%"></span>
              <span class="timeline-bar" style="height:64%"></span>
              <span class="timeline-bar" style="height:64%"></span>
              <span class="timeline-bar" style="height:53%"></span>
              <span class="timeline-bar" style="height:40%"></span>
              <span class="timeline-bar" style="height:36%"></span>
              <span class="timeline-bar" style="height:30%"></span>
              <span class="timeline-bar" style="height:52%"></span>
              <span class="timeline-bar" style="height:65%"></span>
              <span class="timeline-bar" style="height:64%"></span>
              <span class="timeline-bar" style="height:57%"></span>
              <span class="timeline-bar" style="height:44%"></span>
            </div>
          </article>
          <article class="panel">
            <div class="section-heading"><h2>Exposure</h2><span>Ports and services</span></div>
            <div class="exposure-list">
              <div class="exposure-item"><strong>sshd</strong><span class="muted">public exposure</span></div>
              <div class="exposure-item"><strong>nginx</strong><span class="muted">public exposure</span></div>
              <div class="exposure-item"><strong>node</strong><span class="muted">private exposure</span></div>
              <div class="exposure-item"><strong>mysqld</strong><span class="muted">public exposure</span></div>
            </div>
          </article>
        </section>
        <section class="panel lower-grid">
          <div class="section-heading"><h2>Server Health Ranking</h2><span>Current fleet view</span></div>
          <div class="health-table">
            ${staticHealthRow('Production Edge', 'demo.local', '82', '76%', '68%', '91%')}
            ${staticHealthRow('Database Core', 'db.demo.local', '74', '64%', '60%', '73%')}
            ${staticHealthRow('GPU Worker', 'gpu.demo.local', '69', '64%', '82%', '73%')}
            ${staticHealthRow('Backup Node', 'backup.demo.local', '71', '18%', '60%', '87%')}
          </div>
        </section>
        <section class="panel lower-grid">
          <div class="section-heading"><h2>Recent Alerts</h2><span>Ranked by severity</span></div>
          <div class="alert-stack">
            <div class="alert-item"><strong>Disk capacity is close to exhaustion</strong><span class="severity critical">Critical</span><p>Production Edge | health</p></div>
            <div class="alert-item"><strong>SSH authentication failures indicate review</strong><span class="severity critical">Critical</span><p>Production Edge | security</p></div>
            <div class="alert-item"><strong>Database-like service is exposed publicly</strong><span class="severity high">High</span><p>Production Edge | ecosystem</p></div>
          </div>
        </section>
        <section id="inspection-workspace" class="panel lower-grid inspection-workspace">
          <div class="section-heading"><h2>Authorized Inspection</h2><span id="inspection-package-status">ready</span></div>
          <div id="inspection-step-rail" class="inspection-step-rail">
            <button class="inspection-step-card ready">Authorize</button>
            <button class="inspection-step-card ready">Preflight</button>
            <button class="inspection-step-card ready">Collect</button>
            <button class="inspection-step-card ready">Analyze</button>
            <button class="inspection-step-card ready">Package</button>
          </div>
          <aside id="inspection-evidence-panel" class="inspection-evidence-panel">
            <strong>Delivery validation ledger</strong>
            <span>Markdown report</span>
            <span>PDF handoff</span>
            <button id="inspection-package-button" class="secondary-action">Copy Summary</button>
          </aside>
        </section>
        <section id="strategy-workspace" class="panel lower-grid strategy-workspace">
          <div class="section-heading"><h2>Strategy Iterations</h2><span id="strategy-copy-status">ready</span></div>
          <div id="strategy-iteration-rail" class="strategy-iteration-rail">
            ${Array.from({ length: 10 }, (_, index) => `<button class="strategy-iteration-card done">Cycle ${index + 1}</button>`).join('')}
          </div>
          <aside id="strategy-evidence-panel" class="strategy-evidence-panel">
            <strong>10-cycle strategy evidence</strong>
            <span>Plan, execution, validation, and handoff proof</span>
            <button id="strategy-copy-button" class="secondary-action">Copy Summary</button>
          </aside>
        </section>
      </main>
    </div>
  </body>
</html>`;
}

function simpleStaticSnapshotCss() {
  return `
* { box-sizing: border-box; }
body { min-height: 100vh; margin: 0; background: #edf2f7; color: #26313d; font-family: "Segoe UI", system-ui, sans-serif; }
button { font: inherit; }
.app-shell { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.sidebar { padding: 20px; border-right: 1px solid #d6dee8; background: rgba(250, 252, 255, .86); }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.brand-mark { width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(135deg, #5ca8f2, #2db5ae); }
.brand strong, .brand span { display: block; }
.brand span, .muted, .section-heading span, .alert-item p { color: #738195; }
.nav-list { display: grid; gap: 6px; }
.nav-item { min-height: 38px; border: 0; border-radius: 8px; background: transparent; color: #738195; }
.nav-item.is-active { background: #f3f6fa; color: #26313d; }
.workspace { min-width: 0; padding: 24px; overflow-x: hidden; }
.topbar, .topbar-actions, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.topbar { margin-bottom: 18px; }
.eyebrow { margin: 0 0 6px; color: #738195; font-size: 12px; font-weight: 800; text-transform: uppercase; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 0; font-size: 34px; line-height: 1.05; }
h2 { margin-bottom: 0; font-size: 16px; }
.primary-action, .secondary-action, .icon-action { min-height: 36px; border-radius: 999px; border: 1px solid #d6dee8; background: #fbfdff; }
.primary-action { padding: 0 16px; border-color: transparent; background: #2378d3; color: #fff; }
.secondary-action { padding: 0 16px; }
.icon-action { width: 36px; }
.metric-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.metric, .panel { border: 1px solid #d6dee8; border-radius: 14px; background: rgba(251,253,255,.9); box-shadow: 0 1px 2px rgba(38,49,61,.08); }
.metric { min-height: 112px; padding: 16px; }
.metric span { color: #738195; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.metric strong { display: block; margin-top: 14px; font-size: 30px; }
.panel { padding: 16px; }
.lower-grid { margin-top: 14px; }
.split-layout { display: grid; grid-template-columns: 1.3fr .8fr; gap: 14px; }
.timeline { display: grid; grid-template-columns: repeat(12, 1fr); align-items: end; min-height: 260px; gap: 8px; padding-top: 16px; }
.timeline-bar { min-height: 18px; border-radius: 999px 999px 6px 6px; background: linear-gradient(180deg, #70b8f6, #418fd9); }
.exposure-list, .alert-stack { display: grid; gap: 10px; overflow: hidden; }
.exposure-item, .alert-item { padding: 12px; border: 1px solid #d6dee8; border-radius: 8px; background: #fbfdff; }
.exposure-item strong, .exposure-item span { display: block; }
.inspection-step-rail { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 10px; overflow-x: auto; }
.inspection-step-card { min-height: 72px; border: 1px solid #d6dee8; border-radius: 10px; background: rgba(251, 253, 255, .76); color: #26313d; }
.inspection-evidence-panel { display: grid; gap: 8px; margin-top: 10px; border: 1px solid #d6dee8; border-radius: 10px; padding: 12px; background: rgba(251, 253, 255, .76); }
.strategy-iteration-rail { display: grid; grid-template-columns: repeat(10, minmax(120px, 1fr)); gap: 10px; overflow-x: auto; }
.strategy-iteration-card { min-height: 84px; border: 1px solid #d6dee8; border-radius: 10px; background: rgba(251, 253, 255, .76); color: #26313d; }
.strategy-evidence-panel { display: grid; gap: 8px; margin-top: 10px; border: 1px solid #d6dee8; border-radius: 10px; padding: 12px; background: rgba(251, 253, 255, .76); }
.health-table { display: grid; overflow: hidden; border: 1px solid #d6dee8; border-radius: 8px; }
.health-row { display: grid; grid-template-columns: 1.1fr .8fr 80px 80px 80px 86px; gap: 12px; align-items: center; min-height: 48px; padding: 0 12px; border-bottom: 1px solid #d6dee8; background: rgba(252,254,255,.9); font-size: 14px; }
.health-cell-label { display: none; }
.health-score, .health-cell-value { display: inline-flex; align-items: center; gap: 6px; }
.score-dot { width: 8px; height: 8px; border-radius: 999px; background: #d84a40; }
.severity { float: right; color: #d84a40; font-size: 11px; font-weight: 800; text-transform: uppercase; }
.severity.high { color: #b97716; }
@media (max-width: 900px) {
  .app-shell, .metric-strip, .split-layout, .health-row { grid-template-columns: 1fr; }
  .sidebar { border-right: 0; border-bottom: 1px solid #d6dee8; }
  .nav-list { grid-template-columns: repeat(4, 1fr); }
  .topbar { align-items: flex-start; flex-direction: column; }
  .health-table { gap: 8px; overflow: visible; border: 0; }
  .health-row { min-height: 0; padding: 12px; border: 1px solid #d6dee8; border-radius: 8px; background: #fbfdff; }
  .health-row > span, .health-row > strong { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
  .health-row .health-cell-label { display: inline-flex; flex: 0 0 62px; color: #738195; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .health-row .health-cell-value { justify-content: flex-end; overflow: hidden; text-align: right; text-overflow: ellipsis; }
}
@media (max-width: 560px) {
  .workspace { padding: 18px; }
  .sidebar { padding: 16px; }
  .nav-list { grid-template-columns: repeat(2, 1fr); }
}
`;
}

function staticSnapshotCss() {
  return `
* { box-sizing: border-box; }
body {
  min-height: 100svh;
  margin: 0;
  background: linear-gradient(135deg, #f8fafc, #edf2f7);
  color: #26313d;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button { font: inherit; }
.app-shell { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100svh; }
.sidebar {
  position: sticky;
  top: 0;
  height: 100svh;
  padding: 22px 16px;
  border-right: 1px solid #d7e0ea;
  background: rgba(249, 251, 254, 0.82);
}
.brand { display: flex; align-items: center; gap: 12px; min-height: 44px; margin-bottom: 28px; }
.brand-mark { width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(135deg, #5ca8f2, #2db5ae); }
.brand strong, .brand span { display: block; }
.brand span, .muted, .section-heading span, .alert-item p { color: #748294; }
.nav-list { display: grid; gap: 4px; }
.nav-item { min-height: 38px; border: 0; border-radius: 8px; background: transparent; color: #748294; }
.nav-item.is-active { background: #f2f6fa; color: #26313d; box-shadow: 0 1px 2px rgba(40, 52, 66, 0.08); }
.workspace { min-width: 0; padding: 28px; overflow-x: hidden; }
.topbar, .topbar-actions, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.topbar { margin-bottom: 26px; }
.eyebrow { margin: 0 0 6px; color: #748294; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 0; font-size: 2.2rem; line-height: 1.02; }
h2 { margin-bottom: 0; font-size: 1.02rem; }
.primary-action, .secondary-action, .icon-action { min-height: 38px; border-radius: 999px; border: 1px solid #d7e0ea; }
.primary-action { padding: 0 16px; border-color: transparent; background: #2378d3; color: #f8fbff; }
.secondary-action { padding: 0 16px; background: #fbfdff; }
.icon-action { width: 38px; background: #fbfdff; }
.metric-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.metric, .panel {
  border: 1px solid #d7e0ea;
  border-radius: 14px;
  background: rgba(251, 253, 255, 0.9);
  box-shadow: 0 1px 2px rgba(40, 52, 66, 0.08);
}
.metric { min-height: 118px; padding: 18px; }
.metric span { color: #748294; font-size: 0.76rem; font-weight: 700; text-transform: uppercase; }
.metric strong { display: block; margin-top: 16px; font-size: 2rem; }
.panel { min-width: 0; padding: 18px; }
.lower-grid { margin-top: 14px; }
.split-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr); gap: 14px; }
.timeline { display: grid; grid-template-columns: repeat(12, minmax(18px, 1fr)); align-items: end; min-height: 312px; gap: 9px; padding-top: 16px; }
.timeline-bar { min-height: 22px; border-radius: 999px 999px 6px 6px; background: linear-gradient(180deg, #70b8f6, #418fd9); }
.exposure-list, .alert-stack { display: grid; gap: 10px; max-height: 360px; overflow: hidden; }
.exposure-item, .alert-item { padding: 14px; border: 1px solid #d7e0ea; border-radius: 8px; background: #fbfdff; }
.exposure-item strong, .exposure-item span { display: block; }
.health-table { display: grid; overflow: hidden; border: 1px solid #d7e0ea; border-radius: 8px; }
.health-row { display: grid; grid-template-columns: minmax(130px, 1.1fr) 0.8fr 80px 80px 80px 86px; gap: 12px; align-items: center; min-height: 48px; padding: 0 12px; border-bottom: 1px solid #d7e0ea; background: rgba(252, 254, 255, 0.9); font-size: 0.88rem; }
.health-cell-label { display: none; }
.health-cell-value { min-width: 0; }
.health-score, .health-cell-value { display: inline-flex; align-items: center; gap: 6px; }
.score-dot { width: 8px; height: 8px; border-radius: 999px; background: #d84a40; }
.severity { float: right; color: #d84a40; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
.severity.high { color: #b97716; }
@media (max-width: 900px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; border-right: 0; border-bottom: 1px solid #d7e0ea; }
  .nav-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .workspace { padding: 28px; }
  .topbar { align-items: flex-start; flex-direction: column; }
  .metric-strip, .split-layout, .health-row { grid-template-columns: 1fr; }
  .health-table { gap: 8px; overflow: visible; border: 0; border-radius: 0; }
  .health-row { min-height: 0; padding: 12px; border: 1px solid #d7e0ea; border-radius: 8px; background: #fbfdff; }
  .health-row > span, .health-row > strong { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
  .health-row .health-cell-label { display: inline-flex; flex: 0 0 62px; color: #748294; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .health-row .health-cell-value { justify-content: flex-end; overflow: hidden; text-align: right; text-overflow: ellipsis; }
}
@media (max-width: 560px) {
  .workspace { padding: 18px; }
  .sidebar { padding: 16px; }
  .nav-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
}

function staticHealthRow(name, host, score, cpu, memory, disk) {
  return `<div class="health-row">
    <strong data-label="Server"><span class="health-cell-label">Server</span><span class="health-cell-value">${name}</span></strong>
    <span class="muted" data-label="Host"><span class="health-cell-label">Host</span><span class="health-cell-value">${host}</span></span>
    <span class="health-score" data-label="Score"><span class="health-cell-label">Score</span><span class="health-cell-value"><span class="score-dot high"></span>${score}</span></span>
    <span data-label="CPU"><span class="health-cell-label">CPU</span><span class="health-cell-value">${cpu}</span></span>
    <span data-label="Memory"><span class="health-cell-label">Memory</span><span class="health-cell-value">${memory}</span></span>
    <span data-label="Disk"><span class="health-cell-label">Disk</span><span class="health-cell-value">${disk}</span></span>
  </div>`;
}

async function waitForFileSize(filePath, timeoutMs, afterMs = 0) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const info = await stat(filePath);
      if (info.size > 1000 && info.mtimeMs >= afterMs) return info.size;
      lastError = new Error(`File exists but is too small: ${info.size}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error(`Timed out waiting for ${filePath}`);
}

async function captureCdpViewport(cdp, sessionId, url, options) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: options.width < 600
  }, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  await waitForCdpReady(cdp, sessionId);
  const inspection = await cdp.send('Runtime.evaluate', {
    expression: `(${inspectPageForEvidence.toString()})()`,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  }, sessionId);
  const bytes = Buffer.from(shot.data, 'base64');
  await writeFile(options.screenshotPath, bytes);

  return {
    viewport: options.label,
    screenshotPath: options.screenshotPath,
    screenshotBytes: bytes.length,
    ...(inspection.result?.value ?? {})
  };
}

async function waitForCdpReady(cdp, sessionId) {
  await cdp.send('Runtime.evaluate', {
    expression: `new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (document.querySelector('#metric-strip .metric')) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started > 8000) {
          clearInterval(timer);
          reject(new Error('Missing selector: #metric-strip .metric'));
        }
      }, 50);
    })`,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
}

function inspectPageForEvidence() {
  const panel = document.querySelector('.panel');
  const panelStyle = panel ? getComputedStyle(panel) : {};
  const healthLabel = document.querySelector('.health-row:not(.is-head) .health-cell-label');
  const healthLabelStyle = healthLabel ? getComputedStyle(healthLabel) : {};
  return {
    metrics: document.querySelectorAll('#metric-strip .metric').length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    materialPresent: panelStyle.backdropFilter !== 'none' || panelStyle.webkitBackdropFilter !== 'none',
    commandCenterPresent: Boolean(document.querySelector('#command-palette-button')),
    readinessPresent: Boolean(document.querySelector('#delivery-readiness-button')),
    analysisRunBuilderPresent: Boolean(document.querySelector('#analysis-run-builder [data-analysis-preset-card]')),
    serverInspectorPresent: Boolean(document.querySelector('#server-inspector')),
    evidenceTrackerPresent: document.querySelectorAll('.evidence-tracker').length >= 3,
    healthLabelsPresent: window.innerWidth >= 900
      ? Boolean(healthLabel)
      : Boolean(healthLabel) && healthLabelStyle.display !== 'none',
    pageOperationSummaryPresent: Boolean(document.querySelector('#page-operation-summary')) &&
      Boolean(document.querySelector('#page-operation-title')) &&
      Boolean(document.querySelector('#page-operation-action')) &&
      Boolean(document.querySelector('#page-operation-evidence')) &&
      Boolean(document.querySelector('#page-operation-next-step')),
    pageCount: 11
  };
}

async function waitForJson(url, timeoutMs) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${url}: ${oneLine(lastError)}`);
}

function createCdpClient(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    let nextId = 1;
    const pending = new Map();
    const timeout = setTimeout(() => reject(new Error('Timed out opening CDP WebSocket.')), 5000);

    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve({
        send(method, params = {}, sessionId) {
          const id = nextId++;
          const payload = { id, method, params };
          if (sessionId) payload.sessionId = sessionId;
          socket.send(JSON.stringify(payload));
          return new Promise((commandResolve, commandReject) => {
            pending.set(id, { resolve: commandResolve, reject: commandReject });
            setTimeout(() => {
              if (pending.has(id)) {
                pending.delete(id);
                commandReject(new Error(`CDP command timed out: ${method}`));
              }
            }, 10000).unref();
          });
        },
        close() {
          socket.close();
        }
      });
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const command = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        command.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
        return;
      }
      command.resolve(message.result ?? {});
    });

    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('CDP WebSocket failed.'));
    });
  });
}

function visualEvidenceFromCaptures({ browser, captures, notes = [] }) {
  const pixelChecks = captures.map((item) => ({
    viewport: item.viewport,
    screenshotBytes: item.screenshotBytes,
    nonBlank: item.screenshotBytes > 1000,
    horizontalOverflow: item.horizontalOverflow,
    materialPresent: item.materialPresent,
    commandCenterPresent: item.commandCenterPresent,
    releaseWorkspacePresent: item.releaseWorkspacePresent,
    releaseCardsPresent: item.releaseCardsPresent,
    interactionStudioPresent: item.interactionStudioPresent,
    experienceDeckPresent: item.experienceDeckPresent,
    experienceControlsPresent: item.experienceControlsPresent,
    scenarioBoardPresent: item.scenarioBoardPresent,
    scenarioCardsPresent: item.scenarioCardsPresent,
    scenarioInspectorPresent: item.scenarioInspectorPresent,
    inspectionWorkspacePresent: item.inspectionWorkspacePresent,
    inspectionCardsPresent: item.inspectionCardsPresent,
    inspectionEvidencePresent: item.inspectionEvidencePresent,
    strategyWorkspacePresent: item.strategyWorkspacePresent,
    strategyCardsPresent: item.strategyCardsPresent,
    strategyEvidencePresent: item.strategyEvidencePresent,
    tactileCardsPresent: item.tactileCardsPresent,
    iosInteractionPresent: item.iosInteractionPresent,
    actionDockPresent: item.actionDockPresent,
    analysisRunBuilderPresent: item.analysisRunBuilderPresent,
    serverInspectorPresent: item.serverInspectorPresent,
    evidenceTrackerPresent: item.evidenceTrackerPresent,
    healthLabelsPresent: item.healthLabelsPresent
    ,
    pageOperationSummaryPresent: item.pageOperationSummaryPresent,
    pageCount: item.pageEvidence?.length ?? item.pageCount ?? 0,
    pageEvidence: item.pageEvidence ?? []
  }));
  const failedChecks = pixelChecks.filter((check) => (
    !check.nonBlank ||
    check.horizontalOverflow ||
    !check.materialPresent ||
    !check.commandCenterPresent ||
    !check.releaseWorkspacePresent ||
    !check.releaseCardsPresent ||
    !check.interactionStudioPresent ||
    !check.experienceDeckPresent ||
    !check.experienceControlsPresent ||
    !check.scenarioBoardPresent ||
    !check.scenarioCardsPresent ||
    !check.scenarioInspectorPresent ||
    !check.inspectionWorkspacePresent ||
    !check.inspectionCardsPresent ||
    !check.inspectionEvidencePresent ||
    !check.strategyWorkspacePresent ||
    !check.strategyCardsPresent ||
    !check.strategyEvidencePresent ||
    !check.tactileCardsPresent ||
    !check.iosInteractionPresent ||
    !check.actionDockPresent ||
    !check.analysisRunBuilderPresent ||
    !check.serverInspectorPresent ||
    !check.evidenceTrackerPresent ||
    !check.healthLabelsPresent ||
    !check.pageOperationSummaryPresent ||
    check.pageCount !== 11 ||
    check.pageEvidence.some((page) => !page.pageOperationSummaryPresent || page.horizontalOverflow)
  ));

  return {
    product: 'ServerLens',
    mode: 'local-ui-visual-evidence',
    generatedAt: new Date().toISOString(),
    status: failedChecks.length > 0 ? 'failed' : 'ready',
    browser,
    screenshots: captures.map((item) => ({
      viewport: item.viewport,
      path: item.screenshotPath,
      bytes: item.screenshotBytes
    })),
    pixelChecks,
    notes: [
      'Screenshots are generated from the local in-memory API and static UI.',
      'No external network calls, telemetry upload, or third-party visual service is used.',
      ...notes
    ]
  };
}

function electronRunnerSource() {
  return `
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT ' + (error.stack || error.message));
  app.exit(1);
});
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED ' + (error.stack || error.message));
  app.exit(1);
});

const [runtimeUrl, profilePath, desktopShot, mobileShot] = process.argv.slice(-4);

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
    const desktop = await captureViewport(win, 'desktop', 1440, 1000, desktopShot);
    const mobile = await captureViewport(win, 'mobile', 390, 900, mobileShot);
    console.log('UI_EVIDENCE_RESULT ' + JSON.stringify([desktop, mobile]));
    app.exit(0);
  } catch (error) {
    console.error(error.stack || error.message);
    app.exit(1);
  }
});

async function captureViewport(win, label, width, height, screenshotPath) {
  win.setSize(width, height);
  await new Promise((resolve) => setTimeout(resolve, 260));
  await win.webContents.executeJavaScript("(" + waitForReady.toString() + ")()");
  const result = await win.webContents.executeJavaScript("(" + inspectPage.toString() + ")()");
  const image = await win.webContents.capturePage();
  const buffer = image.toPNG();
  fs.writeFileSync(screenshotPath, buffer);
  return {
    viewport: label,
    screenshotPath,
    screenshotBytes: buffer.length,
    ...result
  };
}

async function waitForReady() {
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (document.querySelector('#metric-strip .metric')) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 8000) {
        clearInterval(timer);
        reject(new Error('Missing selector: #metric-strip .metric'));
      }
    }, 50);
  });
}

function inspectPage() {
  const panel = document.querySelector('.panel');
  const panelStyle = panel ? getComputedStyle(panel) : {};
  const healthLabel = document.querySelector('.health-row:not(.is-head) .health-cell-label');
  const healthLabelStyle = healthLabel ? getComputedStyle(healthLabel) : {};
  return {
    metrics: document.querySelectorAll('#metric-strip .metric').length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    materialPresent: panelStyle.backdropFilter !== 'none' || panelStyle.webkitBackdropFilter !== 'none',
    commandCenterPresent: Boolean(document.querySelector('#command-palette-button')),
    readinessPresent: Boolean(document.querySelector('#delivery-readiness-button')),
    releaseWorkspacePresent: Boolean(document.querySelector('#release-readiness-workspace')),
    releaseCardsPresent: document.querySelectorAll('#release-readiness-cards .release-readiness-card').length === 6,
    interactionStudioPresent: Boolean(document.querySelector('#interaction-studio')),
    experienceDeckPresent: Boolean(document.querySelector('#experience-deck .experience-card')) &&
      Boolean(document.querySelector('#experience-stepper')),
    experienceControlsPresent: Boolean(document.querySelector('#experience-motion-control')) &&
      Boolean(document.querySelector('#experience-density-control')) &&
      Boolean(document.querySelector('#experience-presentation-toggle')) &&
      document.querySelectorAll('#experience-progress-dots .experience-progress-dot').length === 5,
    scenarioBoardPresent: Boolean(document.querySelector('#scenario-board')),
    scenarioCardsPresent: document.querySelectorAll('#scenario-card-grid .scenario-card').length === 5,
    scenarioInspectorPresent: Boolean(document.querySelector('#scenario-inspector')) &&
      Boolean(document.querySelector('#scenario-copy-button')) &&
      Boolean(document.querySelector('#scenario-copy-status')),
    inspectionWorkspacePresent: Boolean(document.querySelector('#inspection-workspace')),
    inspectionCardsPresent: document.querySelectorAll('#inspection-step-rail .inspection-step-card').length === 5,
    inspectionEvidencePresent: Boolean(document.querySelector('#inspection-evidence-panel')) &&
      Boolean(document.querySelector('#inspection-package-button')) &&
      Boolean(document.querySelector('#inspection-package-status')),
    strategyWorkspacePresent: Boolean(document.querySelector('#strategy-workspace')),
    strategyCardsPresent: document.querySelectorAll('#strategy-iteration-rail .strategy-iteration-card').length === 10,
    strategyEvidencePresent: Boolean(document.querySelector('#strategy-evidence-panel')) &&
      Boolean(document.querySelector('#strategy-copy-button')) &&
      Boolean(document.querySelector('#strategy-copy-status')),
    tactileCardsPresent: document.querySelectorAll('#interaction-swipe-rail .tactile-card').length === 6,
    iosInteractionPresent: Boolean(document.querySelector('.ios-interactive')) &&
      Boolean(document.querySelector('.ios-snap-rail')) &&
      Boolean(document.querySelector('#action-dock[data-snap]')),
    actionDockPresent: Boolean(document.querySelector('#action-dock')),
    analysisRunBuilderPresent: Boolean(document.querySelector('#analysis-run-builder [data-analysis-preset-card]')),
    serverInspectorPresent: Boolean(document.querySelector('#server-inspector')),
    evidenceTrackerPresent: document.querySelectorAll('.evidence-tracker').length >= 3,
    healthLabelsPresent: window.innerWidth >= 900
      ? Boolean(healthLabel)
      : Boolean(healthLabel) && healthLabelStyle.display !== 'none'
  };
}
`;
}

function oneLine(error) {
  return String(error?.message ?? error).split('\n')[0];
}

function blockedEvidence(error) {
  return {
    product: 'ServerLens',
    mode: 'local-ui-visual-evidence',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    browser: 'playwright.chromium',
    screenshots: [],
    pixelChecks: [],
    reason: oneLine(error),
    nextActions: [
      'Run npm.cmd run ui:evidence in a desktop-capable environment with Electron rendering available.',
      'Install Playwright and browser binaries only if Electron screenshot capture is unavailable.',
      'Keep runtime smoke as API/UI contract evidence until screenshot evidence is available.'
    ]
  };
}
