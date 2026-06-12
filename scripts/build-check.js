import { access, readFile, readdir } from 'node:fs/promises';

const requiredFiles = [
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'src/server/index.js',
  'src/server/app.js',
  'src/server/collector.js',
  'src/server/store.js',
  'src/shared/analysis-engine.js',
  'src/shared/delivery-evidence.js',
  'src/desktop/main.cjs',
  'scripts/create-handoff-package.js',
  'scripts/runtime-smoke.js',
  'scripts/delivery-validate.js',
  'scripts/ui-visual-evidence.js',
  'PRODUCT.md',
  'DESIGN.md',
  'README.md',
  'docs/reference-notes.md'
];

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url));
}

const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const js = await readFrontendJs();
const appServer = await readFile(new URL('../src/server/app.js', import.meta.url), 'utf8');
const desktopMain = await readFile(new URL('../src/desktop/main.cjs', import.meta.url), 'utf8');
const store = await readFile(new URL('../src/server/store.js', import.meta.url), 'utf8');
const collector = await readFile(new URL('../src/server/collector.js', import.meta.url), 'utf8');
const analysisEngine = await readFile(new URL('../src/shared/analysis-engine.js', import.meta.url), 'utf8');
const deliveryEvidence = await readFile(new URL('../src/shared/delivery-evidence.js', import.meta.url), 'utf8');
const handoffScript = await readFile(new URL('../scripts/create-handoff-package.js', import.meta.url), 'utf8');
const runtimeSmoke = await readFile(new URL('../scripts/runtime-smoke.js', import.meta.url), 'utf8');
const deliveryValidate = await readFile(new URL('../scripts/delivery-validate.js', import.meta.url), 'utf8');
const uiVisualEvidence = await readFile(new URL('../scripts/ui-visual-evidence.js', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const bannedPatterns = [
  { pattern: /background-clip:\s*text/, message: 'Gradient text is banned.' },
  { pattern: /border-left:\s*[2-9]px/, message: 'Side stripe borders are banned.' },
  { pattern: /#000(?:;|\s)/, message: 'Pure black is banned.' },
  { pattern: /#fff(?:;|\s)/, message: 'Pure white is banned.' }
];

for (const { pattern, message } of bannedPatterns) {
  if (pattern.test(css)) {
    throw new Error(message);
  }
}

for (const token of [
  'ServerLens',
  'Analysis modules',
  'data-view="delivery"',
  'data-delivery-tab="inspect"',
  'data-delivery-tab="validate"',
  'data-delivery-tab="handoff"',
  'data-view="reports"',
  'data-view="alerts"',
  'data-view="server-detail"',
  'data-view="interaction"',
  'data-view="settings"',
  'analysis-run-builder',
  'Analysis run builder',
  'analysis-target-cards',
  'data-analysis-preset-card',
  'data-analysis-depth-card',
  'data-analysis-output-card',
  'analysis-evidence-tracker',
  'inspection-workspace',
  'Authorized Inspection Workspace',
  'inspection-step-rail',
  'inspection-step-card',
  'inspection-evidence-panel',
  'inspection-package-button',
  'inspection-package-status',
  'strategy-workspace',
  '10-cycle Strategy Iteration Workspace',
  'strategy-iteration-rail',
  'strategy-iteration-card',
  'strategy-evidence-panel',
  'strategy-copy-button',
  'strategy-copy-status',
  'detail-evidence-tracker',
  'report-evidence-tracker',
  'server-inspector',
  'server-inspector-content',
  'data-inspector-close',
  'delivery-evidence-button',
  'delivery-evidence',
  'delivery-readiness-button',
  'delivery-readiness',
  'ui-experience-audit-button',
  'ui-experience-audit',
  'handoff-checklist-button',
  'handoff-checklist',
  'release-readiness-workspace',
  'Release readiness workspace',
  'data-release-mode-card="operator"',
  'data-release-mode-card="client-handoff"',
  'data-release-mode-card="incident-review"',
  'release-readiness-cards',
  'release-review-queue',
  'release-reference-basis',
  'release-safety-ledger',
  'interaction-studio',
  'Interaction Studio',
  'interaction-swipe-rail',
  'experience-deck',
  'Experience Deck',
  'experience-stepper',
  'data-experience-step="prepare"',
  'data-motion-intensity="calm"',
  'data-card-density="compact"',
  'experience-presentation-toggle',
  'experience-progress-dots',
  'scenario-board',
  'Scenario Board',
  'scenario-card-grid',
  'data-scenario-card="fleet-triage"',
  'data-scenario-card="security-review"',
  'data-scenario-card="runtime-pressure"',
  'scenario-inspector',
  'scenario-copy-button',
  'scenario-copy-status',
  'scenario-hotkey-strip',
  'data-tactile-card',
  'action-dock',
  'Action Dock',
  'action-dock-toggle',
  'data-action-dock-handle',
  'focus-peek',
  'Focus Peek',
  'focus-peek-content',
  'retention-run-button',
  'retention-run-status',
  'data-analysis-depth="quick"',
  'data-analysis-depth="standard"',
  'data-analysis-depth="deep"',
  'data-analysis-preset="full-report"',
  'data-analysis-preset="security-review"',
  'data-analysis-preset="runtime-health"',
  'data-analysis-preset="service-ecosystem"',
  'analysis-target-server',
  'analysis-time-range',
  'analysis-output-format',
  'status-page-button',
  'status-page-preview',
  'name="retentionDays"',
  'name="localOnly"',
  'name="inboxEnabled"',
  'name="alertSeverities"',
  'name="aiSummaryEnabled"',
  'export-report-button',
  'export-runbook-button',
  'export-pdf-button',
  'command-palette-button',
  'command-palette',
  'command-input',
  'command-results',
  'report-history',
  'risk-trend',
  'report-comparison',
  'alert-inbox',
  'alert-summary',
  'show-archived-servers',
  'inventory-export-button',
  'inventory-import-button',
  'inventory-transfer-json',
  'inventory-transfer-status',
  'server-submit-button',
  'server-cancel-edit',
  'container-table',
  'port-table',
  'firewall-detail',
  'performance-panel',
  'performance-chart',
  'security-events-panel',
  'security-events',
  'security-source-review',
  'security-source-review-panel',
  'risk-event-timeline',
  'evidence-appendix',
  'service-catalog-list',
  'name="mode"',
  'name="username"',
  'name="keyPath"',
  'settings-form',
  'topology-list',
  'topology-map'
]) {
  if (!html.includes(token)) {
    throw new Error(`Missing UI contract token: ${token}`);
  }
}

for (const token of [
  '/api/servers',
  'health',
  'security',
  'runtime',
  'ecosystem',
  'logs',
  'network',
  'performance',
  'analysis-jobs',
  'markdown',
  '/print',
  'activeAnalysisDepth',
  'inspectorOpen',
  'inspectorServerId',
  'analysisRunning',
  'releaseMode',
  'actionDockOpen',
  'actionDockSnap',
  'focusPeekOpen',
  'focusPeekContext',
  'inspectionWorkspace',
  'activeInspectionStep',
  'inspectionPackageStatus',
  'strategyWorkspace',
  'activeStrategyIteration',
  'strategyCopyStatus',
  'deliveryEvidenceManifest',
  'releaseModeCopy',
  'renderReleaseWorkspace',
  'releaseReadinessCards',
  'releaseReviewQueue',
  'releaseReferenceBasis',
  'releaseSafetyLedger',
  'data-release-mode-card',
  'renderInteractionStudio',
  'renderExperienceDeck',
  'experienceDeckSteps',
  'setExperienceStep',
  'setMotionIntensity',
  'setCardDensity',
  'togglePresentationMode',
  'data-experience-step',
  'data-motion-intensity',
  'data-card-density',
  'renderScenarioBoard',
  'scenarioBoardItems',
  'setActiveScenario',
  'toggleScenarioPin',
  'copyScenarioSummary',
  'renderInspectionWorkspace',
  'inspectionStepItems',
  'setInspectionStep',
  'copyInspectionPackageSummary',
  '/api/delivery/inspection',
  'renderStrategyWorkspace',
  'strategyIterationItems',
  'setStrategyIteration',
  'copyStrategySummary',
  '/api/delivery/strategy',
  'data-scenario-card',
  'data-scenario-pin',
  'scenario-hotkey',
  'renderActionDock',
  'renderFocusPeek',
  'bindTactileCards',
  'bindIosInteractions',
  'updateIosPointer',
  'resetIosPointer',
  'bindSwipeRails',
  'updateRailEdgeState',
  'openActionDock',
  'closeActionDock',
  'toggleActionDockSnap',
  'openFocusPeek',
  'data-action-dock-command',
  'data-focus-peek',
  'activeAnalysisPreset',
  'analysisPresets',
  'applyAnalysisPreset',
  'activeAnalysisTimeRange',
  'analysisTargetSelect',
  'activeOutputFormat',
  'renderAnalysisTargetCards',
  'data-analysis-target-card',
  'renderEvidenceTrackers',
  'evidenceTrackerMarkup',
  'openServerInspector',
  'renderServerInspector',
  'data-open-inspector',
  'depth: state.activeAnalysisDepth',
  'timeRange: state.activeAnalysisTimeRange',
  'preset: state.activeAnalysisPreset',
  'copyMarkdownReport',
  'copyServerRunbook',
  '/runbook/markdown',
  'openPrintReport',
  'retentionDays',
  '/api/maintenance/retention',
  'retentionRunButton',
  'retentionRunStatus',
  '/api/delivery/evidence',
  '/api/delivery/readiness',
  '/api/delivery/checklist',
  'renderDeliveryEvidence',
  'renderDeliveryReadiness',
  'renderUiExperienceAudit',
  '/api/delivery/ui-audit',
  'uiExperienceAuditButton',
  'local-ui-experience-audit',
  'renderHandoffChecklist',
  'localOnly',
  'aiSummary',
  'test-connection',
  'connection-status',
  'editingServerId',
  'serverPayloadFromForm',
  'loadServerForm',
  'resetServerForm',
  'data-edit-server',
  'data-archive-server',
  'data-restore-server',
  'activeServers',
  '/api/servers/all',
  '/api/servers/export',
  '/api/servers/import',
  'inventoryTransferJson',
  'Save Server',
  'username',
  'keyPath',
  'server.mode',
  'renderPerformancePanel',
  'performanceBars',
  "healthCell('Server'",
  "healthCell('Disk'",
  'health-cell-label',
  'pressureClass',
  'networkRxMbps',
  'diskReadMbps',
  'diskWriteMbps',
  'ioWaitPercent',
  'renderSecurityEvents',
  'renderSecuritySourceReview',
  'securitySourceReview',
  'local-security-source-review',
  'renderRiskEventTimeline',
  'riskEventTimeline',
  'failedSshLogins10m',
  'suspiciousConnections',
  'exposedHighRiskPorts',
  'renderTopology',
  'renderTopologyMap',
  'topologyMap',
  'renderServiceCatalog',
  'serviceCatalog',
  'renderRuntimeInventory',
  'container-table',
  'firewall.allowedPublicPorts',
  'service-topology',
  '/api/reports/summary',
  '/api/status-page',
  'renderStatusPagePreview',
  'statusPageButton',
  '/api/alerts',
  'acknowledgeAlert',
  'renderAlertsInbox',
  'renderCommandList',
  'finding.commands',
  'renderReportCenter',
  'renderExecutiveSummary',
  'renderRemediationPlan',
  'renderEvidenceAppendix',
  'executiveSummary',
  'remediationPlan',
  'evidenceAppendix',
  'local-redacted-evidence',
  'remediation-checklist',
  'selectedReportId',
  'item.dataset.reportId',
  'history-item is-selected',
  'openCommandPalette',
  'renderCommandPalette',
  'commandItems',
  'runCommand',
  'data-command-index'
]) {
  if (!js.includes(token)) {
    throw new Error(`Missing frontend workflow token: ${token}`);
  }
}

for (const token of [
  'backdrop-filter',
  'overscroll-behavior: contain',
  '-webkit-overflow-scrolling: touch',
  '.history-item.is-selected',
  '.alert-inbox',
  '.status-pill',
  '.command-list',
  '.command-palette',
  '.command-panel',
  '.command-results',
  '.command-result',
  '.health-cell-label',
  '.health-cell-value',
  '.health-row > span',
  '.performance-panel',
  '.performance-chart',
  '.spark-bars',
  '.pressure-meter',
  '.security-events',
  '.security-source-review',
  '.security-source-list',
  '.security-source-row',
  '.security-signal-grid',
  '.security-connection-list',
  '.risk-event-timeline',
  '.risk-event-row',
  '.risk-event-rail',
  '.evidence-appendix',
  '.evidence-appendix-row',
  '.evidence-redaction-note',
  '.analysis-presets',
  '.analysis-run-builder',
  '.analysis-choice-card',
  '.target-card-grid',
  '.analysis-output-cards',
  '.evidence-tracker',
  '.evidence-step',
  '.server-inspector',
  '.inspector-panel',
  '.inspector-summary',
  '.health-row-button',
  '.preset-button',
  '.service-catalog-list',
  '.topology-map',
  '.topology-node',
  '.topology-edge',
  '.service-catalog-row',
  '.role-badge',
  '.server-item.is-archived',
  '.status-badge',
  '.toggle-row',
  '.delivery-evidence-panel',
  '.delivery-readiness-panel',
  '.ui-experience-audit-panel',
  '.ui-audit-check-list',
  '.ui-audit-check',
  '.handoff-checklist-panel',
  '.handoff-checklist',
  '.handoff-step',
  '.release-workspace',
  '.release-mode-strip',
  '.release-mode-card',
  '.release-summary-grid',
  '.release-readiness-card',
  '.release-review-queue',
  '.release-reference-grid',
  '.release-safety-ledger',
  '.release-action-row',
  '.interaction-studio',
  '.experience-deck-panel',
  '.experience-toolbar',
  '.experience-stepper',
  '.experience-step-button',
  '.experience-stage',
  '.experience-card',
  '.experience-progress-dots',
  '.experience-progress-dot',
  'body[data-motion-intensity="calm"]',
  'body[data-card-density="compact"]',
  '.scenario-board-panel',
  '.scenario-card-grid',
  '.scenario-card',
  '.scenario-card.is-selected',
  '.scenario-card.is-pinned',
  '.scenario-inspector',
  '.scenario-hotkey-strip',
  '.scenario-copy-status',
  '.interaction-swipe-rail',
  'scroll-snap-type: x mandatory',
  '--ios-material',
  '--ios-spring',
  '.ios-interactive',
  '.ios-interactive.is-pressed',
  '.ios-snap-rail',
  '.ios-snap-rail.is-scrollable',
  '.tactile-card',
  '.tactile-card.is-pressed',
  '.action-dock',
  '.action-dock.is-open',
  '.action-dock.is-expanded',
  '.action-dock.is-compact',
  '.action-dock-handle',
  '.focus-peek',
  '.focus-peek.is-open',
  '.dock-command-grid',
  '.readiness-summary',
  '.readiness-check',
  '.retention-maintenance-panel',
  '.maintenance-result',
  '.status-page-panel',
  '.status-service-row',
  '.executive-summary',
  '.remediation-checklist',
  '.remediation-phase',
  '.remediation-item',
  '.remediation-meta',
  '.summary-columns',
  '.inventory-transfer',
  '.transfer-actions'
]) {
  if (!css.includes(token)) {
    throw new Error(`Missing commercial interaction/design token: ${token}`);
  }
}

for (const token of ['firewall', 'allowedPublicPorts', 'exposedHighRiskPorts', 'diskReadMbps', 'diskWriteMbps', 'ioWaitPercent', 'iostat -dm 1 2', 'vmstat 1 2']) {
  if (!collector.includes(token)) {
    throw new Error(`Missing runtime inventory collector token: ${token}`);
  }
}

for (const token of ['collectSnapshotForServerAsync', 'collectSshSnapshot', 'BatchMode=yes', 'StrictHostKeyChecking=accept-new', 'parseSshSnapshot']) {
  if (!collector.includes(token)) {
    throw new Error(`Missing SSH collection token: ${token}`);
  }
}

for (const token of ['__SERVERLENS_CONNECTIONS__', 'ss -tanH state established', 'parseSuspiciousConnections', 'suspiciousConnections: parseSuspiciousConnections']) {
  if (!collector.includes(token)) {
    throw new Error(`Missing passive SSH connection summary token: ${token}`);
  }
}

if (/font-size:\s*clamp\(/.test(css)) {
  throw new Error('Product UI must not scale typography with viewport width.');
}

for (const token of [
  'name="port"',
  'name="mode"',
  'name="authType"',
  'name="username"',
  'name="keyPath"',
  'name="group"',
  'name="tags"'
]) {
  if (!html.includes(token)) {
    throw new Error(`Missing server asset field: ${token}`);
  }
}

await access(new URL('../references/web-v70/retroui-card.md', import.meta.url));
await access(new URL('../docs/reference-notes.md', import.meta.url));

for (const token of ['createApp(options = {})', 'createStore(options)', 'store.listServers().length === 0']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing persistent app contract token: ${token}`);
  }
}

for (const token of ['store.updateServer', "method === 'PUT' && serverDetailMatch"]) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing server edit API token: ${token}`);
  }
}

for (const token of ['store.archiveServer', 'store.restoreServer', '/api/servers/all', 'Archived servers must be restored before collection']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing server archive API token: ${token}`);
  }
}

for (const token of ['store.exportServerInventory', 'store.importServerInventory', '/api/servers/export', '/api/servers/import']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing server inventory transfer API token: ${token}`);
  }
}

for (const token of ['store.runRetentionMaintenance', '/api/maintenance/retention']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing retention maintenance API token: ${token}`);
  }
}

for (const token of ['buildStatusPageSummary', '/api/status-page', 'local-preview', 'statusForScore']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing status page preview API token: ${token}`);
  }
}

for (const token of ['updateServer(id, input)', 'Connection has not been tested after the latest asset edit']) {
  if (!store.includes(token)) {
    throw new Error(`Missing server edit store token: ${token}`);
  }
}

for (const token of ['archiveServer(id)', 'restoreServer(id)', 'archivedAt', 'includeArchived']) {
  if (!store.includes(token)) {
    throw new Error(`Missing server archive store token: ${token}`);
  }
}

for (const token of ['exportServerInventory()', 'importServerInventory(input = {})', 'serverlens.inventory.v1', 'exportServerAsset']) {
  if (!store.includes(token)) {
    throw new Error(`Missing server inventory transfer store token: ${token}`);
  }
}

for (const token of ['runRetentionMaintenance(options = {})', 'deleteRecord', 'preservedLatestReports', 'normalizeRetentionDays']) {
  if (!store.includes(token)) {
    throw new Error(`Missing retention maintenance store token: ${token}`);
  }
}

for (const token of ['app.getPath(\'userData\')', 'serverlens.sqlite']) {
  if (!desktopMain.includes(token)) {
    throw new Error(`Missing desktop persistence token: ${token}`);
  }
}

for (const token of ['node:sqlite', 'DatabaseSync', 'close()']) {
  if (!store.includes(token)) {
    throw new Error(`Missing SQLite store token: ${token}`);
  }
}

for (const token of ['createAlertsForReport', 'listAlerts', 'acknowledgeAlert', 'alertSeverities']) {
  if (!store.includes(token)) {
    throw new Error(`Missing local alert inbox store token: ${token}`);
  }
}

for (const token of ['timeRange: input.timeRange', 'depth: input.depth', 'preset: input.preset']) {
  if (!store.includes(token)) {
    throw new Error(`Missing analysis scope job token: ${token}`);
  }
}

for (const token of ['/api/alerts', 'store.createAlertsForReport', 'store.acknowledgeAlert']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing local alert inbox API token: ${token}`);
  }
}

for (const token of ['buildDeliveryEvidence', 'buildDeliveryReadiness', 'buildPageExperienceReadiness', 'buildUiExperienceAudit', 'buildHandoffChecklist', 'buildStrategyIterationWorkspace', '/api/delivery/evidence', '/api/delivery/readiness', '/api/delivery/page-readiness', '/api/delivery/checklist', '/api/delivery/strategy', '/api/delivery/ui-audit']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing delivery evidence API token: ${token}`);
  }
}

for (const token of ['buildDeliveryEvidence', 'buildDeliveryReadiness', 'buildDeliveryValidationLedger', 'buildPageExperienceReadiness', 'uiExperienceAudit', 'pageExperienceReadiness', 'local-ui-experience-audit', 'local-page-experience-readiness', 'local-delivery-validation-ledger', 'security source review for collected authentication and connection evidence', 'commercial interaction polish with card run builder, evidence tracker, and server inspector', 'release readiness workspace for client handoff review', 'iOS-inspired Interaction Studio with tactile cards, swipe rail, Action Dock, and Focus Peek', 'guided Experience Deck for client walkthrough, presentation mode, motion intensity, and density controls', 'Scenario Board with selectable cards, pinned scenarios, copyable summaries, and keyboard shortcuts', 'Authorized Inspection Workspace with guided preflight, collection, analysis, and package evidence', '10-cycle Strategy Iteration Workspace with plan, execution, validation, and handoff evidence', 'ServerLens 10.0 page-by-page operation summary with primary action, evidence state, and next step for every view', 'capabilities.security-source-review', 'capabilities.release-readiness-workspace', 'capabilities.interaction-studio', 'capabilities.experience-deck', 'capabilities.scenario-board', 'capabilities.authorized-inspection-workspace', 'capabilities.10-cycle-strategy-workspace', 'capabilities.v10-page-operation-summary', 'references.current-v100-monitoring', 'verificationCommands', 'githubReferences', 'uptime-kuma', 'glances', 'node_exporter', 'dashy', 'retroui-card', 'safetyBoundary', 'win-unpacked', 'ServerLens.exe', 'readiness']) {
  if (!deliveryEvidence.includes(token)) {
    throw new Error(`Missing delivery evidence shared token: ${token}`);
  }
}

for (const token of [
  'retro-v9-shell',
  'retro-v10-shell',
  'data-component-system="serverlens-v100"',
  'page-operation-summary',
  'live-monitor-toggle',
  'live-monitor-grid',
  'live-monitor-status',
  'data-retro-card',
  'data-slot="sidebar"',
  'data-slot="sidebar-menu-button"',
  'data-slot="button"',
  'data-slot="badge"',
  'data-slot="tabs-list"'
]) {
  if (!html.includes(token)) {
    throw new Error(`Missing RetroUI 8 primitive HTML token: ${token}`);
  }
}

for (const token of ['shadcn-v6-shell', 'data-component-system="shadcn-v4-konsta-ios"', 'ServerLens 6.0']) {
  if (html.includes(token)) {
    throw new Error(`Old 6.0 active HTML token must not remain: ${token}`);
  }
}

for (const token of ['aria-label="Notifications"', 'aria-label="Settings"']) {
  if (html.includes(token)) {
    throw new Error(`Redundant 9.0 topbar shortcut must not remain: ${token}`);
  }
}

for (const token of [
  'hydrateRetroUiPrimitives',
  'liveMonitoring',
  'refreshInFlight',
  'setInterval',
  'renderLiveMonitor',
  'dataset.retroCard',
  'dataset.retroButton',
  'dataset.retroInput',
  'commandActiveIndex',
  'setCommandActiveIndex',
  'data-selected',
  'aria-selected',
  'ArrowDown',
  'ArrowUp'
]) {
  if (!js.includes(token)) {
    throw new Error(`Missing RetroUI 8 interaction token: ${token}`);
  }
}

for (const token of [
  '--font-retro-display',
  '--font-retro-ui',
  '--retro-paper',
  '--retro-ink',
  '--retro-yellow',
  '--retro-blue',
  '--retro-green',
  '--retro-red',
  '--retro-shadow',
  '.retro-v9-shell [data-retro-card]',
  '.retro-v9-shell [data-slot="button"]',
  '.retro-v9-shell [data-slot="badge"]',
  '.retro-v9-shell input',
  '.retro-v9-shell .workspace',
  '.retro-v9-shell .live-monitor-grid',
  '.retro-v9-shell .live-pulse',
  'ServerLens 9.0 clarity pass',
  'ServerLens 9.0 page-wide layout pass',
  '.retro-v9-shell .view.is-visible',
  '.retro-v9-shell .server-form',
  '.retro-v9-shell .settings-form',
  '.retro-v9-shell .inspection-step-rail',
  'grid-template-columns: repeat(3, minmax(0, 1fr))',
  '.retro-v9-shell .command-result',
  '.retro-v9-shell .action-dock-panel',
  '.retro-v10-shell .page-operation-summary',
  '.page-operation-evidence',
  '.page-operation-next-step',
  'translate(3px, 3px)',
  'box-shadow: var(--retro-shadow)',
  'overflow-wrap: anywhere',
  'white-space: normal'
]) {
  if (!css.includes(token)) {
    throw new Error(`Missing RetroUI 8 primitive CSS token: ${token}`);
  }
}

for (const token of ['retro-v9-shell', 'retro-v10-shell', 'retro-reference-bar', 'ios-badge', 'ios-button', 'ios-segment']) {
  if (!html.includes(token)) {
    throw new Error(`Missing ServerLens 9.0 HTML token: ${token}`);
  }
}

for (const token of ['--retro-paper', '--retro-ink', '--retro-shadow', '.retro-v9-shell', '.retro-reference-bar', '.ios-badge', '.ios-button', '.ios-segment']) {
  if (!css.includes(token)) {
    throw new Error(`Missing ServerLens 9.0 CSS token: ${token}`);
  }
}

for (const token of ['buildDeliveryPackageChecklist', 'handoffRoot', 'review-delivery-evidence', 'review-delivery-validation', 'review-ui-experience-audit', 'confirm-safety-boundary']) {
  if (!deliveryEvidence.includes(token)) {
    throw new Error(`Missing delivery package checklist token: ${token}`);
  }
}

if (!pkg.scripts['handoff:dir']?.includes('create-handoff-package.js')) {
  throw new Error('Missing handoff package script command.');
}

if (!pkg.scripts['delivery:validate']?.includes('delivery-validate.js')) {
  throw new Error('Missing delivery validation script command.');
}

if (!pkg.scripts['ui:evidence']?.includes('ui-visual-evidence.js')) {
  throw new Error('Missing UI visual evidence script command.');
}

if (!pkg.scripts['runtime:smoke']?.includes('runtime-smoke.js')) {
  throw new Error('Missing runtime smoke script command.');
}

for (const token of ['win-unpacked', 'ServerLens.exe', 'delivery-evidence.json', 'delivery-validation.json', 'ui-visual-evidence.json', 'START-HERE.txt', '.codestable', 'uiExperienceAudit', 'UI Experience Audit', 'uiVisualEvidence', 'handoffChecklist', 'Handoff Checklist', 'validationLedger']) {
  if (!handoffScript.includes(token)) {
    throw new Error(`Missing handoff packaging token: ${token}`);
  }
}

for (const token of ['buildDeliveryPackageChecklist', 'buildDeliveryValidationLedger', 'npm.cmd test', 'npm.cmd run build', 'npm.cmd run runtime:smoke', 'npm.cmd run ui:evidence', 'annotateUiEvidenceCommand', 'status: \'warn\'', 'handoffChecklist', 'npm.cmd run package:app', 'npm.cmd run handoff:dir', 'delivery-validation.json', 'SERVERLENS_DELIVERY_VALIDATION']) {
  if (!deliveryValidate.includes(token)) {
    throw new Error(`Missing delivery validation token: ${token}`);
  }
}

for (const token of ['playwright', 'launchPlaywrightBrowser', 'playwright.system-chrome', 'electron', 'captureWithElectron', 'electron.chromium-fallback', 'captureWithSystemBrowser', 'system-chromium-cdp-fallback', 'system-chromium-static-snapshot-fallback', 'runSystemBrowserCliEvidence', 'runSystemBrowserStaticSnapshotEvidence', 'staticSnapshotHtml', 'msedge.exe', 'chrome.exe', 'ui-visual-evidence.json', 'ui-evidence-desktop.png', 'ui-evidence-mobile.png', 'local-ui-visual-evidence', 'pixelChecks', 'horizontalOverflow', 'releaseWorkspacePresent', 'releaseCardsPresent', 'release-readiness-workspace', 'release-readiness-card', 'interactionStudioPresent', 'experienceDeckPresent', 'experienceControlsPresent', 'scenarioBoardPresent', 'scenarioCardsPresent', 'scenarioInspectorPresent', 'inspectionWorkspacePresent', 'inspectionCardsPresent', 'inspectionEvidencePresent', 'strategyWorkspacePresent', 'strategyCardsPresent', 'strategyEvidencePresent', 'tactileCardsPresent', 'actionDockPresent', 'interaction-studio', 'experience-deck', 'experience-stepper', 'scenario-board', 'scenario-card', 'scenario-inspector', 'inspection-workspace', 'inspection-step-card', 'inspection-evidence-panel', 'strategy-workspace', 'strategy-iteration-card', 'strategy-evidence-panel', 'tactile-card', 'action-dock', 'analysisRunBuilderPresent', 'serverInspectorPresent', 'evidenceTrackerPresent', 'analysis-run-builder', 'server-inspector', 'evidence-tracker', 'healthLabelsPresent', 'health-cell-label', 'SERVERLENS_UI_VISUAL_EVIDENCE']) {
  if (!uiVisualEvidence.includes(token)) {
    throw new Error(`Missing UI visual evidence token: ${token}`);
  }
}

for (const token of ['createApp', 'electron', 'BrowserWindow', 'delivery-readiness-button', 'release-readiness-workspace', 'release-readiness-card', 'renderReleaseWorkspace', 'interaction-studio', 'experience-deck', 'experience-stepper', 'scenario-board', 'scenario-inspector', 'strategy-workspace', 'strategy-iteration-card', 'strategy-evidence-panel', 'action-dock', 'focus-peek', 'renderInteractionStudio', 'renderExperienceDeck', 'renderScenarioBoard', 'renderStrategyWorkspace', 'renderActionDock', 'command-palette-button', 'overscrollBehavior', 'backdropFilter', 'setSize(390, 900)', 'SERVERLENS_RUNTIME_SMOKE_OK']) {
  if (!runtimeSmoke.includes(token)) {
    throw new Error(`Missing runtime smoke token: ${token}`);
  }
}

for (const token of ['buildServiceTopology', 'buildTopologyMap', 'local-service-topology-map', 'buildServiceCatalog', 'inferServiceRole', 'runs service', 'listens on', 'runs container', 'commandsForFinding', 'commands: finding.commands', 'network.unknown-public-listener', 'isUnknownListenerProcess']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing service topology token: ${token}`);
  }
}

for (const token of ['buildRemediationPlan', 'remediationPlan', 'local-rule-checklist', 'acceptanceForFinding', 'ownerForFinding']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing remediation checklist token: ${token}`);
  }
}

for (const token of ['buildRiskEventTimeline', 'riskEventTimeline', 'local-evidence-timeline', 'risk-event-ssh-failures', 'risk-event-high-risk-public-ports']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing risk event timeline token: ${token}`);
  }
}

for (const token of ['buildSecuritySourceReview', 'securitySourceReview', 'local-security-source-review', 'security-source-ssh-auth', 'Source review uses collected authentication counts']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing security source review token: ${token}`);
  }
}

for (const token of ['buildEvidenceAppendix', 'evidenceAppendix', 'local-redacted-evidence', 'metadata-and-rule-evidence-only', 'sanitizeEvidenceList']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing evidence appendix token: ${token}`);
  }
}

for (const token of ['performance.disk-io-pressure', 'diskReadMbps', 'diskWriteMbps', 'ioWaitPercent', 'iostat -dx 1 5', 'pidstat -d 1 5']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing disk IO performance token: ${token}`);
  }
}

if (!appServer.includes('Service Topology')) {
  throw new Error('Markdown export is missing the service topology section.');
}

for (const token of ['Topology Map Summary', 'renderTopologyMapSummaryMarkdown', 'renderTopologyMapSummaryPrintHtml', 'local-service-topology-map']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing topology map summary export token: ${token}`);
  }
}

if (!appServer.includes('Service Catalog') || !appServer.includes('renderServiceCatalogMarkdown')) {
  throw new Error('Markdown export is missing the service catalog section.');
}

if (!appServer.includes('Risk Event Timeline') || !appServer.includes('renderRiskEventTimelineMarkdown')) {
  throw new Error('Markdown export is missing the risk event timeline section.');
}

if (!appServer.includes('Security Source Review') || !appServer.includes('renderSecuritySourceReviewMarkdown') || !appServer.includes('renderSecuritySourceReviewPrintHtml')) {
  throw new Error('Markdown export is missing the security source review section.');
}

if (!appServer.includes('Evidence Appendix') || !appServer.includes('renderEvidenceAppendixMarkdown')) {
  throw new Error('Markdown export is missing the evidence appendix section.');
}

for (const token of ['Commands:', 'renderFindingCommandsMarkdown', 'finding.commands']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing remediation command export token: ${token}`);
  }
}

for (const token of ['ANALYSIS_PRESETS', 'resolveAnalysisOptions', 'security-review']) {
  if (!analysisEngine.includes(token)) {
    throw new Error(`Missing analysis preset token: ${token}`);
  }
}

for (const token of ['Analysis scope', 'report.analysisScope', 'preset: body?.preset', 'timeRange: body?.timeRange', 'Executive Summary', 'renderExecutiveSummaryMarkdown', 'report.executiveSummary']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing analysis scope export token: ${token}`);
  }
}

for (const token of ['Remediation Checklist', 'renderRemediationPlanMarkdown', 'renderRemediationPlanPrintHtml', 'report.remediationPlan']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing remediation export token: ${token}`);
  }
}

for (const token of ['ServerLens Server Runbook', 'renderServerRunbookMarkdown', 'runbook\\/markdown', 'uniqueCommands', 'Safety Boundary']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing server runbook export token: ${token}`);
  }
}

for (const token of ['renderReportPrintHtml', '/api/reports/', 'window.print', 'text/html; charset=utf-8']) {
  if (!appServer.includes(token)) {
    throw new Error(`Missing print/PDF report export token: ${token}`);
  }
}

if (pkg.main !== 'src/desktop/main.cjs') {
  throw new Error('Desktop app entry is not configured.');
}

if (!pkg.scripts['pack:dir']) {
  throw new Error('Desktop packaging script is missing.');
}

if (!pkg.scripts['package:app']) {
  throw new Error('Offline desktop packaging script is missing.');
}

if (!pkg.scripts['handoff:dir']) {
  throw new Error('Offline handoff packaging script is missing.');
}

if (!pkg.scripts['delivery:validate']) {
  throw new Error('Delivery validation script is missing.');
}

if (!pkg.scripts['ui:evidence']) {
  throw new Error('UI visual evidence script is missing.');
}

console.log('Build check passed: files, UI contracts, references, and design guardrails are present.');

// Frontend JS is split across public/app.js plus the public/js/*.js ES modules
// extracted in 13.0. Token scanning reads the aggregate so moved symbols still
// resolve regardless of which module now owns them.
async function readFrontendJs() {
  const parts = [await readFile(new URL('../public/app.js', import.meta.url), 'utf8')];
  const jsDir = new URL('../public/js/', import.meta.url);
  try {
    const entries = await readdir(jsDir);
    for (const entry of entries.filter((name) => name.endsWith('.js')).sort()) {
      parts.push(await readFile(new URL(entry, jsDir), 'utf8'));
    }
  } catch {
    // No public/js modules present; app.js alone is the frontend source.
  }
  return parts.join('\n');
}
