import { viewTitles, pageExperienceModel, moduleLabels } from './js/page-model.js';
import { filterCommands } from './js/commands.js';
import {
  clampPercent,
  pressureClass,
  labelForStatus,
  formatTime,
  formatDate,
  signed,
  escapeHtml
} from './js/format.js';

const state = {
  servers: [],
  activeServerId: null,
  latestReport: null,
  selectedReportId: null,
  jobs: [],
  alerts: [],
  settings: null,
  reportCenter: null,
  statusPage: null,
  deliveryEvidenceManifest: null,
  deliveryReadiness: null,
  handoffChecklist: null,
  inspectionWorkspace: null,
  strategyWorkspace: null,
  uiExperienceAudit: null,
  serverFilter: '',
  activeAnalysisPreset: 'custom',
  activeAnalysisDepth: 'standard',
  activeAnalysisTimeRange: 'latest-snapshot',
  activeOutputFormat: 'page',
  activeView: 'overview',
  commandQuery: '',
  commandActiveIndex: 0,
  editingServerId: null,
  showArchivedServers: false,
  inspectorOpen: false,
  inspectorServerId: null,
  analysisRunning: false,
  releaseMode: 'operator',
  deliveryTab: 'inspect',
  actionDockOpen: false,
  actionDockSnap: 'compact',
  focusPeekOpen: false,
  focusPeekContext: 'active-server',
  activeInspectionStep: 'authorize',
  inspectionPackageStatus: 'Ready',
  activeStrategyIteration: 'strategy-01-baseline',
  strategyCopyStatus: 'Ready',
  ecosystem: null,
  liveMonitoring: true,
  refreshInFlight: false,
  lastRefreshAt: null
};

const pageOperationSummary = document.querySelector('#page-operation-summary');
const pageOperationTitle = document.querySelector('#page-operation-title');
const pageOperationAction = document.querySelector('#page-operation-action');
const pageOperationEvidence = document.querySelector('#page-operation-evidence');
const pageOperationNextStep = document.querySelector('#page-operation-next-step');

const analysisPresets = {
  custom: null,
  'full-report': {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'],
    depth: 'deep',
    timeRange: 'last-24h'
  },
  'security-review': {
    modules: ['security', 'logs', 'network'],
    depth: 'deep',
    timeRange: 'last-1h'
  },
  'runtime-health': {
    modules: ['health', 'runtime', 'performance'],
    depth: 'standard',
    timeRange: 'last-15m'
  },
  'service-ecosystem': {
    modules: ['ecosystem', 'runtime', 'network'],
    depth: 'standard',
    timeRange: 'latest-snapshot'
  }
};

const presetCopy = {
  custom: ['Custom', 'Manual'],
  'full-report': ['Full Report', 'Full'],
  'security-review': ['Security Review', 'Security'],
  'runtime-health': ['Runtime Health', 'Runtime'],
  'service-ecosystem': ['Service Ecosystem', 'Ecosystem']
};

const depthCopy = {
  quick: ['Quick', 'Triage'],
  standard: ['Standard', 'Handoff'],
  deep: ['Deep', 'Evidence']
};

const outputCopy = {
  page: ['Page', 'Report'],
  markdown: ['Markdown', 'Copy'],
  pdf: ['PDF', 'Print']
};

const releaseModeCopy = {
  operator: ['Operator', 'Daily'],
  'client-handoff': ['Client Handoff', 'Package'],
  'incident-review': ['Incident Review', 'Findings']
};

const metricStrip = document.querySelector('#metric-strip');
const timeline = document.querySelector('#timeline');
const exposureList = document.querySelector('#exposure-list');
const liveMonitorToggle = document.querySelector('#live-monitor-toggle');
const liveMonitorStatus = document.querySelector('#live-monitor-status');
const liveMonitorGrid = document.querySelector('#live-monitor-grid');
const serverList = document.querySelector('#server-list');
const findingsList = document.querySelector('#findings-list');
const reportSurface = document.querySelector('#report-surface');
const reportHistory = document.querySelector('#report-history');
const riskTrend = document.querySelector('#risk-trend');
const reportComparison = document.querySelector('#report-comparison');
const statusPagePreview = document.querySelector('#status-page-preview');
const alertInbox = document.querySelector('#alert-inbox');
const alertSummary = document.querySelector('#alert-summary');
const alertRuleStatus = document.querySelector('#alert-rule-status');
const connectionHealthMap = document.querySelector('#connection-health-map');
const findingCount = document.querySelector('#finding-count');
const freshnessLabel = document.querySelector('#freshness-label');
const healthTable = document.querySelector('#health-table');
const alertStack = document.querySelector('#alert-stack');
const systemDetail = document.querySelector('#system-detail');
const processTable = document.querySelector('#process-table');
const containerTable = document.querySelector('#container-table');
const portTable = document.querySelector('#port-table');
const firewallDetail = document.querySelector('#firewall-detail');
const logList = document.querySelector('#log-list');
const topologyMap = document.querySelector('#topology-map');
const topologyList = document.querySelector('#topology-list');
const performanceChart = document.querySelector('#performance-chart');
const securityEvents = document.querySelector('#security-events');
const riskEventTimeline = document.querySelector('#risk-event-timeline');
const securitySourceReview = document.querySelector('#security-source-review');
const serviceCatalogList = document.querySelector('#service-catalog-list');
const evidenceAppendix = document.querySelector('#evidence-appendix');
const detailServerLabel = document.querySelector('#detail-server-label');
const jobList = document.querySelector('#job-list');
const serverSearch = document.querySelector('#server-search');
const serverForm = document.querySelector('#server-form');
const serverSubmitButton = document.querySelector('#server-submit-button');
const serverCancelEdit = document.querySelector('#server-cancel-edit');
const showArchivedServers = document.querySelector('#show-archived-servers');
const inventoryExportButton = document.querySelector('#inventory-export-button');
const inventoryImportButton = document.querySelector('#inventory-import-button');
const inventoryTransferJson = document.querySelector('#inventory-transfer-json');
const inventoryTransferStatus = document.querySelector('#inventory-transfer-status');
const settingsForm = document.querySelector('#settings-form');
const retentionRunButton = document.querySelector('#retention-run-button');
const retentionRunStatus = document.querySelector('#retention-run-status');
const retentionRunResult = document.querySelector('#retention-run-result');
const deliveryEvidenceButton = document.querySelector('#delivery-evidence-button');
const deliveryEvidence = document.querySelector('#delivery-evidence');
const deliveryReadinessButton = document.querySelector('#delivery-readiness-button');
const deliveryReadiness = document.querySelector('#delivery-readiness');
const handoffChecklistButton = document.querySelector('#handoff-checklist-button');
const handoffChecklist = document.querySelector('#handoff-checklist');
const uiExperienceAuditButton = document.querySelector('#ui-experience-audit-button');
const uiExperienceAudit = document.querySelector('#ui-experience-audit');
const releaseModeSummary = document.querySelector('#release-mode-summary');
const releaseReadinessCards = document.querySelector('#release-readiness-cards');
const releaseReviewQueue = document.querySelector('#release-review-queue');
const releaseReferenceBasis = document.querySelector('#release-reference-basis');
const releaseSafetyLedger = document.querySelector('#release-safety-ledger');
const actionDockToggle = document.querySelector('#action-dock-toggle');
const actionDock = document.querySelector('#action-dock');
const dockCommandGrid = document.querySelector('#dock-command-grid');
const focusPeek = document.querySelector('#focus-peek');
const focusPeekContent = document.querySelector('#focus-peek-content');
const focusPeekInline = document.querySelector('#focus-peek-inline');
const inspectionStepRail = document.querySelector('#inspection-step-rail');
const inspectionEvidencePanel = document.querySelector('#inspection-evidence-panel');
const inspectionPackageButton = document.querySelector('#inspection-package-button');
const inspectionPackageStatus = document.querySelector('#inspection-package-status');
const inspectionPackageSummary = document.querySelector('#inspection-package-summary');
const strategyIterationRail = document.querySelector('#strategy-iteration-rail');
const strategyEvidencePanel = document.querySelector('#strategy-evidence-panel');
const strategyCopyButton = document.querySelector('#strategy-copy-button');
const strategyCopyStatus = document.querySelector('#strategy-copy-status');
const strategySummary = document.querySelector('#strategy-summary');
const strategyReferenceSummary = document.querySelector('#strategy-reference-summary');
const analysisTargetSelect = document.querySelector('#analysis-target-server');
const analysisTimeRangeSelect = document.querySelector('#analysis-time-range');
const outputFormatSelect = document.querySelector('#analysis-output-format');
const analysisTargetCards = document.querySelector('#analysis-target-cards');
const analysisRunSummary = document.querySelector('#analysis-run-summary');
const analysisEvidenceTracker = document.querySelector('#analysis-evidence-tracker');
const detailEvidenceTracker = document.querySelector('#detail-evidence-tracker');
const reportEvidenceTracker = document.querySelector('#report-evidence-tracker');
const statusPageButton = document.querySelector('#status-page-button');
const exportReportButton = document.querySelector('#export-report-button');
const exportRunbookButton = document.querySelector('#export-runbook-button');
const exportPdfButton = document.querySelector('#export-pdf-button');
const commandPalette = document.querySelector('#command-palette');
const commandPaletteButton = document.querySelector('#command-palette-button');
const commandInput = document.querySelector('#command-input');
const commandResults = document.querySelector('#command-results');
const serverInspector = document.querySelector('#server-inspector');
const serverInspectorContent = document.querySelector('#server-inspector-content');
let commandCache = [];

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.querySelectorAll('[data-delivery-tab]').forEach((button) => {
  button.addEventListener('click', () => setDeliveryTab(button.dataset.deliveryTab));
});

document.querySelectorAll('[data-release-mode-card]').forEach((button) => {
  button.addEventListener('click', () => {
    state.releaseMode = button.dataset.releaseModeCard;
    renderReleaseWorkspace();
  });
});

inspectionPackageButton.addEventListener('click', () => copyInspectionPackageSummary());
strategyCopyButton.addEventListener('click', () => copyStrategySummary());

actionDockToggle.addEventListener('click', () => {
  if (state.actionDockOpen) closeActionDock();
  else openActionDock('compact');
});

document.querySelectorAll('[data-action-dock-close]').forEach((button) => {
  button.addEventListener('click', () => closeActionDock());
});

document.querySelectorAll('[data-action-dock-handle]').forEach((button) => {
  button.addEventListener('click', () => toggleActionDockSnap());
});

document.querySelectorAll('[data-focus-peek-close]').forEach((button) => {
  button.addEventListener('click', () => closeFocusPeek());
});

document.querySelectorAll('[data-analysis-depth]').forEach((button) => {
  button.addEventListener('click', () => {
    state.activeAnalysisPreset = 'custom';
    state.activeAnalysisDepth = button.dataset.analysisDepth;
    renderAnalysisControls();
  });
});

document.querySelectorAll('[data-analysis-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    applyAnalysisPreset(button.dataset.analysisPreset);
  });
});

document.querySelectorAll('[data-analysis-output-card]').forEach((button) => {
  button.addEventListener('click', () => {
    state.activeOutputFormat = button.dataset.analysisOutputCard;
    renderAnalysisControls();
  });
});

document.addEventListener('click', (event) => {
  const inspectionStep = event.target.closest('[data-inspection-step]');
  if (inspectionStep) {
    setInspectionStep(inspectionStep.dataset.inspectionStep);
    return;
  }
  const strategyIteration = event.target.closest('[data-strategy-iteration]');
  if (strategyIteration) {
    setStrategyIteration(strategyIteration.dataset.strategyIteration);
    return;
  }
  const targetCard = event.target.closest('[data-analysis-target-card]');
  if (targetCard) {
    state.activeServerId = targetCard.dataset.analysisTargetCard;
    render();
    return;
  }
  const inspectorTrigger = event.target.closest('[data-open-inspector]');
  if (inspectorTrigger) {
    openServerInspector(inspectorTrigger.dataset.openInspector);
    return;
  }
  const dockCommand = event.target.closest('[data-action-dock-command]');
  if (dockCommand) {
    runActionDockCommand(dockCommand.dataset.actionDockCommand);
    return;
  }
  const focusTrigger = event.target.closest('[data-focus-peek]');
  if (focusTrigger) {
    openFocusPeek(focusTrigger.dataset.focusPeek);
    return;
  }
  const viewTrigger = event.target.closest('[data-view]');
  if (viewTrigger && !serverInspector.contains(viewTrigger)) {
    setView(viewTrigger.dataset.view);
    return;
  }
  if (viewTrigger && serverInspector.contains(viewTrigger)) {
    setView(viewTrigger.dataset.view);
    closeServerInspector();
  }
});

document.querySelectorAll('[data-inspector-close]').forEach((button) => {
  button.addEventListener('click', () => closeServerInspector());
});

document.querySelectorAll('input[name="module"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.activeAnalysisPreset = 'custom';
    renderAnalysisControls();
  });
});

outputFormatSelect.addEventListener('change', (event) => {
  state.activeOutputFormat = event.target.value;
  renderAnalysisControls();
});

analysisTargetSelect.addEventListener('change', (event) => {
  state.activeServerId = event.target.value;
  render();
});

analysisTimeRangeSelect.addEventListener('change', (event) => {
  state.activeAnalysisPreset = 'custom';
  state.activeAnalysisTimeRange = event.target.value;
  renderAnalysisControls();
});

serverSearch.addEventListener('input', (event) => {
  state.serverFilter = event.target.value.toLowerCase();
  renderServers();
});

showArchivedServers.addEventListener('change', (event) => {
  state.showArchivedServers = event.target.checked;
  renderServers();
});

serverForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const path = state.editingServerId ? `/api/servers/${state.editingServerId}` : '/api/servers';
  const server = await api(path, {
    method: state.editingServerId ? 'PUT' : 'POST',
    body: serverPayloadFromForm()
  });
  state.activeServerId = server.id;
  resetServerForm();
  await refresh();
});

serverCancelEdit.addEventListener('click', () => {
  resetServerForm();
});

inventoryExportButton.addEventListener('click', async () => {
  const exported = await api('/api/servers/export');
  inventoryTransferJson.value = JSON.stringify(exported, null, 2);
  inventoryTransferStatus.textContent = `${exported.servers.length} assets exported`;
  await navigator.clipboard?.writeText(inventoryTransferJson.value);
});

inventoryImportButton.addEventListener('click', async () => {
  const payload = JSON.parse(inventoryTransferJson.value || '{}');
  const result = await api('/api/servers/import', {
    method: 'POST',
    body: payload
  });
  inventoryTransferStatus.textContent = `${result.imported} imported, ${result.skipped} skipped`;
  await refresh();
});

document.querySelector('#collect-button').addEventListener('click', async () => {
  await collectActiveServer();
});

document.querySelector('#analyze-button').addEventListener('click', async () => {
  await analyzeActiveServer();
});

liveMonitorToggle.addEventListener('click', () => {
  state.liveMonitoring = !state.liveMonitoring;
  renderLiveMonitor(activeServer()?.latestSnapshot, state.latestReport ?? activeServer()?.latestReport);
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.settings = await api('/api/settings', {
    method: 'PUT',
    body: {
      thresholds: {
        cpuHigh: Number(formData.get('cpuHigh')),
        memoryHigh: Number(formData.get('memoryHigh')),
        diskCritical: Number(formData.get('diskCritical')),
        loadHigh: Number(formData.get('loadHigh'))
      },
      retentionDays: Number(formData.get('retentionDays')),
      notifications: {
        localOnly: formData.get('localOnly') === 'on',
        inboxEnabled: formData.get('inboxEnabled') === 'on',
        alertSeverities: formData.getAll('alertSeverities'),
        webhook: {
          enabled: formData.get('webhookEnabled') === 'on',
          url: String(formData.get('webhookUrl') ?? '').trim(),
          minSeverity: String(formData.get('webhookMinSeverity') ?? 'high')
        }
      },
      aiSummary: {
        enabled: formData.get('aiSummaryEnabled') === 'on'
      }
    }
  });
  renderSettings();
});

deliveryEvidenceButton.addEventListener('click', async () => {
  const evidence = await api('/api/delivery/evidence');
  state.deliveryEvidenceManifest = evidence;
  renderDeliveryEvidence(evidence);
  renderReleaseWorkspace();
});

deliveryReadinessButton.addEventListener('click', async () => {
  state.deliveryReadiness = await api('/api/delivery/readiness');
  renderDeliveryReadiness(state.deliveryReadiness);
  renderReleaseWorkspace();
});

handoffChecklistButton.addEventListener('click', async () => {
  state.handoffChecklist = await api('/api/delivery/checklist');
  renderHandoffChecklist(state.handoffChecklist);
  renderReleaseWorkspace();
});

uiExperienceAuditButton.addEventListener('click', async () => {
  state.uiExperienceAudit = await api('/api/delivery/ui-audit');
  renderUiExperienceAudit(state.uiExperienceAudit);
});

statusPageButton.addEventListener('click', async () => {
  state.statusPage = await api('/api/status-page');
  renderStatusPagePreview();
});

retentionRunButton.addEventListener('click', async () => {
  retentionRunButton.disabled = true;
  retentionRunStatus.textContent = 'Cleaning local history';
  try {
    const result = await api('/api/maintenance/retention', {
      method: 'POST',
      body: {}
    });
    retentionRunStatus.textContent = `Kept latest reports, cutoff ${formatDate(result.cutoff)}`;
    renderRetentionMaintenance(result);
    await refresh();
  } finally {
    retentionRunButton.disabled = false;
  }
});

exportReportButton.addEventListener('click', async () => {
  const report = state.latestReport ?? activeServer()?.latestReport;
  if (!report) return;
  await copyMarkdownReport(report);
});

exportRunbookButton.addEventListener('click', async () => {
  const server = activeServer();
  if (!server) return;
  await copyServerRunbook(server);
});

exportPdfButton.addEventListener('click', () => {
  const report = state.latestReport ?? activeServer()?.latestReport;
  if (!report) return;
  openPrintReport(report);
});

commandPaletteButton.addEventListener('click', () => {
  openCommandPalette();
});

commandInput.addEventListener('input', (event) => {
  state.commandQuery = event.target.value.toLowerCase();
  state.commandActiveIndex = 0;
  renderCommandPalette();
});

document.querySelectorAll('[data-command-close]').forEach((item) => {
  item.addEventListener('click', () => closeCommandPalette());
});

document.addEventListener('keydown', async (event) => {
  const isCommandShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
  if (isCommandShortcut) {
    event.preventDefault();
    openCommandPalette();
    return;
  }
  if (!commandPalette.hidden && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
    event.preventDefault();
    if (event.key === 'ArrowDown') setCommandActiveIndex(state.commandActiveIndex + 1);
    if (event.key === 'ArrowUp') setCommandActiveIndex(state.commandActiveIndex - 1);
    if (event.key === 'Enter') await runCommand(state.commandActiveIndex);
    return;
  }
  if (event.key === 'Escape' && !commandPalette.hidden) {
    closeCommandPalette();
  }
  if (event.key === 'Escape' && state.inspectorOpen) {
    closeServerInspector();
  }
  if (event.key === 'Escape' && state.actionDockOpen) {
    closeActionDock();
  }
  if (event.key === 'Escape' && state.focusPeekOpen) {
    closeFocusPeek();
  }
});

await refresh();
setInterval(() => {
  if (!state.liveMonitoring || state.refreshInFlight || document.hidden) return;
  refresh({ silent: true });
}, 12000);

async function refresh(options = {}) {
  state.refreshInFlight = true;
  try {
    if (!options.silent) showSkeletons();
    const [servers, jobs, settings, reportCenter] = await Promise.all([
      api('/api/servers/all'),
      api('/api/analysis-jobs'),
      api('/api/settings'),
      api('/api/reports/summary')
    ]);
    const [alerts, statusPage, deliveryEvidenceManifest, deliveryReadinessResult, handoffChecklistResult, inspectionWorkspaceResult, strategyWorkspaceResult, ecosystemResult] = await Promise.all([
      api('/api/alerts'),
      api('/api/status-page'),
      api('/api/delivery/evidence'),
      api('/api/delivery/readiness'),
      api('/api/delivery/checklist'),
      api('/api/delivery/inspection'),
      api('/api/delivery/strategy'),
      api('/api/ecosystem/overview')
    ]);
    state.servers = servers;
    state.jobs = jobs;
    state.alerts = alerts;
    state.settings = settings;
    state.reportCenter = reportCenter;
    state.statusPage = statusPage;
    state.deliveryEvidenceManifest = deliveryEvidenceManifest;
    state.deliveryReadiness = deliveryReadinessResult;
    state.handoffChecklist = handoffChecklistResult;
    state.inspectionWorkspace = inspectionWorkspaceResult;
    state.strategyWorkspace = strategyWorkspaceResult;
    state.ecosystem = ecosystemResult;
    state.lastRefreshAt = new Date().toISOString();
    const active = activeServers();
    if ((!state.activeServerId || !active.some((server) => server.id === state.activeServerId)) && active.length > 0) {
      state.activeServerId = active[0].id;
    }
    state.latestReport = activeServer()?.latestReport ?? state.latestReport;
    state.selectedReportId = state.latestReport?.id ?? state.selectedReportId;
    render();
  } finally {
    state.refreshInFlight = false;
  }
}

async function collectActiveServer() {
  const server = activeServer();
  if (!server || server.archived) return;
  await collectServer(server.id);
}

async function collectServer(serverId) {
  await api(`/api/servers/${serverId}/collect`, { method: 'POST', body: {} });
  await refresh();
}

async function analyzeActiveServer() {
  const server = analysisTargetServer();
  if (!server) return;
  state.analysisRunning = true;
  renderAnalysisControls();
  renderEvidenceTrackers(server.latestSnapshot, server.latestReport);
  state.activeServerId = server.id;
  const modules = [...document.querySelectorAll('input[name="module"]:checked')].map((input) => input.value);
  try {
    state.latestReport = await api(`/api/servers/${server.id}/analyze`, {
      method: 'POST',
      body: {
        modules,
        preset: state.activeAnalysisPreset,
        depth: state.activeAnalysisDepth,
        timeRange: state.activeAnalysisTimeRange
      }
    });
    state.selectedReportId = state.latestReport.id;
    await refresh();
    setView('reports');
    if (state.activeOutputFormat === 'markdown') {
      await copyMarkdownReport(state.latestReport);
    }
    if (state.activeOutputFormat === 'pdf') {
      openPrintReport(state.latestReport);
    }
  } finally {
    state.analysisRunning = false;
    renderAnalysisControls();
  }
}

const deliveryTabForView = {
  inspection: 'inspect',
  release: 'validate',
  strategy: 'handoff'
};

function setView(view) {
  // The 14.0 Delivery Workspace folds the former inspection/strategy/release
  // views into one tabbed view. Old view names still route here so existing
  // commands, page-experience actions, and release cards keep working.
  const deliveryTab = view === 'delivery' ? (state.deliveryTab ?? 'inspect') : deliveryTabForView[view];
  const isDelivery = view === 'delivery' || Boolean(deliveryTabForView[view]);
  const sectionId = isDelivery ? 'delivery' : view;
  state.activeView = view;
  document.querySelector('#view-title').textContent = viewTitles[view];
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === view
      || (isDelivery && button.dataset.view === 'delivery');
    button.classList.toggle('is-active', active);
    button.dataset.active = String(active);
    button.dataset.state = active ? 'active' : 'inactive';
    // Nav items announce the current page to assistive tech.
    if (button.dataset.slot === 'sidebar-menu-button') {
      if (active) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    }
  });
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('is-visible', section.id === `${sectionId}-view`);
  });
  if (isDelivery) {
    setDeliveryTab(deliveryTab);
  }
  renderPageOperationSummary();
}

function setDeliveryTab(tab) {
  state.deliveryTab = tab;
  document.querySelectorAll('[data-delivery-tab]').forEach((button) => {
    const active = button.dataset.deliveryTab === tab;
    button.classList.toggle('is-active', active);
    button.dataset.active = String(active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-delivery-panel]').forEach((panel) => {
    const active = panel.dataset.deliveryPanel === tab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

function render() {
  const server = activeServer();
  const snapshot = server?.latestSnapshot;
  const report = state.latestReport ?? server?.latestReport;

  renderMetrics(snapshot, report);
  renderPageOperationSummary();
  renderLiveMonitor(snapshot, report);
  renderTimeline(report);
  renderExposure(snapshot);
  renderHealthTable();
  renderAlerts();
  renderConnectionHealthMap();
  renderServers();
  renderDetail(snapshot);
  renderPerformancePanel(snapshot, report);
  renderSecurityEvents(snapshot);
  renderRiskEventTimeline(report?.riskEventTimeline);
  renderSecuritySourceReview(report?.securitySourceReview);
  renderRuntimeInventory(snapshot);
  renderTopology(report?.topology);
  renderServiceCatalog(report?.serviceCatalog);
  renderEvidenceAppendix(report?.evidenceAppendix);
  renderEvidenceTrackers(snapshot, report);
  renderJobs();
  renderFindings(report);
  renderReportCenter();
  renderStatusPagePreview();
  renderReport(report);
  renderAlertsInbox();
  renderSettings();
  renderAnalysisControls();
  renderReleaseWorkspace();
  renderEcosystem();
  renderInspectionWorkspace();
  renderStrategyWorkspace();
  renderActionDock();
  renderFocusPeek();
  renderServerInspector();
  hydrateRetroUiPrimitives();
  bindTactileCards();
  bindIosInteractions();
  bindSwipeRails();
  if (!commandPalette.hidden) {
    renderCommandPalette();
  }
}

function hydrateRetroUiPrimitives() {
  document.body.dataset.componentSystem = 'serverlens-v100';
  document.querySelectorAll('.panel, .metric, .server-item, .finding-item, .alert-item, .job-item, .release-mode-card, .release-readiness-card, .scenario-card, .strategy-iteration-card, .experience-card, .tactile-card').forEach((item) => {
    item.dataset.slot = item.dataset.slot || 'card';
    item.dataset.retroCard = 'true';
  });
  document.querySelectorAll('.section-heading').forEach((item) => {
    item.dataset.slot = item.dataset.slot || 'card-header';
  });
  document.querySelectorAll('.section-heading h2, .row-title strong').forEach((item) => {
    item.dataset.slot = item.dataset.slot || 'card-title';
  });
  document.querySelectorAll('.primary-action, .secondary-action, .icon-action, .segmented, .text-action, .experience-step-button, .dock-command, .release-mode-card, .scenario-card, .strategy-iteration-card, .analysis-choice-card, .tactile-card').forEach((button) => {
    button.dataset.slot = button.dataset.slot || 'button';
    button.dataset.retroButton = 'true';
    if (!button.dataset.variant) {
      button.dataset.variant = button.classList.contains('primary-action') ? 'default' : 'outline';
    }
    button.dataset.size = button.dataset.size || (button.classList.contains('icon-action') ? 'icon' : 'default');
  });
  document.querySelectorAll('.ios-badge, .status-badge, .risk-pill, .readiness-check-status, .scenario-copy-status, .inspection-package-status, .strategy-copy-status').forEach((badge) => {
    badge.dataset.slot = badge.dataset.slot || 'badge';
    badge.dataset.retroBadge = 'true';
    badge.dataset.variant = badge.dataset.variant || 'outline';
  });
  document.querySelectorAll('input').forEach((input) => {
    input.dataset.slot = input.type === 'checkbox' ? 'switch' : 'input';
    input.dataset.retroInput = 'true';
  });
  document.querySelectorAll('select').forEach((select) => {
    select.dataset.slot = 'select-trigger';
    select.dataset.retroInput = 'true';
    select.dataset.size = select.dataset.size || 'default';
  });
  document.querySelectorAll('textarea').forEach((textarea) => {
    textarea.dataset.slot = 'textarea';
    textarea.dataset.retroInput = 'true';
  });
  document.querySelectorAll('.module-grid, .analysis-card-grid, .experience-stepper, .release-mode-strip').forEach((list) => {
    list.dataset.slot = list.dataset.slot || 'tabs-list';
  });
  document.querySelectorAll('.command-palette').forEach((palette) => {
    palette.dataset.slot = 'command-dialog';
  });
  document.querySelectorAll('.command-panel').forEach((panel) => {
    panel.dataset.slot = 'command';
  });
  document.querySelectorAll('.command-search').forEach((wrapper) => {
    wrapper.dataset.slot = 'command-input-wrapper';
  });
  document.querySelectorAll('.command-result').forEach((item) => {
    item.dataset.slot = 'command-item';
  });
  document.querySelectorAll('.server-inspector, .action-dock, .focus-peek').forEach((sheet) => {
    sheet.dataset.slot = 'sheet';
  });
  document.querySelectorAll('.inspector-panel, .action-dock-panel, .focus-peek-panel').forEach((sheet) => {
    sheet.dataset.slot = 'sheet-content';
  });
}

function renderPageOperationSummary() {
  if (!pageOperationSummary || !pageOperationTitle || !pageOperationAction || !pageOperationEvidence || !pageOperationNextStep) return;
  const model = pageExperienceModel[state.activeView] ?? pageExperienceModel.overview;
  pageOperationTitle.textContent = model.title;
  pageOperationAction.textContent = model.action;
  if (model.view) {
    pageOperationAction.dataset.view = model.view;
  } else {
    delete pageOperationAction.dataset.view;
  }
  if (model.command) {
    pageOperationAction.dataset.actionDockCommand = model.command;
  } else {
    delete pageOperationAction.dataset.actionDockCommand;
  }
  pageOperationEvidence.innerHTML = model.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  pageOperationNextStep.textContent = model.nextStep;
}

function renderMetrics(snapshot, report) {
  const metrics = [
    ['Score', report ? String(report.score) : 'No report'],
    ['CPU', snapshot ? `${snapshot.resources.cpuPercent}%` : 'No data'],
    ['Memory', snapshot ? `${snapshot.resources.memoryPercent}%` : 'No data'],
    ['Disk', snapshot ? `${snapshot.resources.diskPercent}%` : 'No data']
  ];
  metricStrip.innerHTML = metrics.map(([label, value]) => `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join('');
  freshnessLabel.textContent = snapshot ? `Collected ${formatTime(snapshot.collectedAt)}` : 'Waiting for data';
}

function renderLiveMonitor(snapshot, report) {
  if (!liveMonitorGrid || !liveMonitorStatus) return;
  liveMonitorToggle.textContent = state.liveMonitoring ? 'Live On' : 'Live Off';
  liveMonitorToggle.setAttribute('aria-pressed', String(state.liveMonitoring));
  liveMonitorStatus.textContent = state.liveMonitoring
    ? `Live | ${state.lastRefreshAt ? formatTime(state.lastRefreshAt) : 'starting'}`
    : 'Paused';
  const servers = activeServers();
  const active = activeServer();
  const highFindings = (report?.findings ?? []).filter((finding) => ['critical', 'high'].includes(finding.severity)).length;
  const snapshotAge = snapshot ? Math.max(0, Math.round((Date.now() - Date.parse(snapshot.collectedAt)) / 60000)) : null;
  const probes = [
    {
      label: 'Fleet',
      value: `${servers.length}`,
      tone: servers.length > 0 ? 'ready' : 'review',
      pulse: Math.min(100, servers.length * 24),
      detail: active?.name ?? 'No server'
    },
    {
      label: 'Risk',
      value: report ? String(highFindings) : 'NA',
      tone: highFindings > 0 ? 'danger' : 'ready',
      pulse: report ? Math.min(100, highFindings * 28 + 18) : 12,
      detail: report ? `${report.score} score` : 'No report'
    },
    {
      label: 'Fresh',
      value: snapshotAge === null ? 'NA' : `${snapshotAge}m`,
      tone: snapshotAge === null ? 'review' : snapshotAge > 15 ? 'warn' : 'ready',
      pulse: snapshotAge === null ? 10 : Math.max(12, 100 - snapshotAge * 4),
      detail: state.liveMonitoring ? 'auto' : 'manual'
    }
  ];
  // Real fleet CPU series from the ecosystem aggregate; no fabricated sweep.
  // When history is insufficient (fewer than minPoints aligned collections),
  // we render no sparkline bars rather than inventing a wave (v12 honesty).
  const fleetTrend = state.ecosystem?.freshness?.fleetTrend;
  const realSeries = fleetTrend?.status === 'ready' && Array.isArray(fleetTrend.cpu)
    ? fleetTrend.cpu.slice(-10)
    : [];
  liveMonitorGrid.innerHTML = probes.map((probe) => `
      <article class="live-monitor-card ${escapeHtml(probe.tone)}" data-retro-card>
        <div class="row-title">
          <span>${escapeHtml(probe.label)}</span>
          <strong>${escapeHtml(probe.value)}</strong>
        </div>
        <div class="live-pulse" aria-hidden="true">
          ${realSeries.length
            ? realSeries.map((value) => `<span style="height:${Math.max(4, Math.min(100, value))}%"></span>`).join('')
            : '<span class="live-pulse-empty">collecting</span>'}
        </div>
        <div class="pressure-meter"><span style="width:${Math.max(4, Math.min(100, probe.pulse))}%"></span></div>
        <p class="muted">${escapeHtml(probe.detail)}</p>
      </article>
    `).join('');
}

function renderTimeline(report) {
  const trends = report?.trends;
  const values = Array.isArray(trends?.cpu) ? trends.cpu : [];
  if (values.length === 0) {
    timeline.innerHTML = '<p class="muted">Collect telemetry to chart CPU history.</p>';
    return;
  }
  if ((trends.status ?? 'ready') === 'insufficient-history') {
    timeline.innerHTML = `<p class="muted">CPU history: ${values.length}/${trends.minPoints ?? 3} samples. Collect more to chart a trend.</p>`;
    return;
  }
  timeline.innerHTML = values.map((value) => `
    <span class="timeline-bar" style="height: ${Math.max(4, Math.min(100, value))}%"></span>
  `).join('');
}

function renderExposure(snapshot) {
  const ports = snapshot?.ports ?? [];
  exposureList.innerHTML = ports.map((port) => `
    <article class="exposure-item">
      <div class="row-title">
        <span>${escapeHtml(port.process)}</span>
        <span class="muted">${escapeHtml(port.protocol)}/${port.port}</span>
      </div>
      <span class="muted">${escapeHtml(port.exposure)} exposure</span>
    </article>
  `).join('') || '<p class="muted">No exposed ports collected.</p>';
}

function renderServers() {
  const source = state.showArchivedServers ? state.servers : activeServers();
  const filtered = source.filter((server) => {
    const haystack = `${server.name} ${server.host} ${server.tags.join(' ')}`.toLowerCase();
    return haystack.includes(state.serverFilter);
  });
  serverList.innerHTML = filtered.map((server) => `
    <article class="server-item ${server.archived ? 'is-archived' : ''}">
      <div class="row-title">
        <span>${escapeHtml(server.name)}${server.archived ? ' <small class="status-badge">Archived</small>' : ''}</span>
        <button class="secondary-action" data-server="${server.id}" type="button">Open</button>
      </div>
      <p class="muted">${escapeHtml(server.host)}:${server.port ?? 22} | ${escapeHtml(server.group ?? 'default')} | ${escapeHtml(server.mode ?? 'demo')} | ${escapeHtml(server.authType ?? 'none')}</p>
      ${connectionStatusMarkup(server)}
      <div class="mini-actions">
        <button class="text-action" data-edit-server="${server.id}" type="button">Edit</button>
        <button class="text-action" data-server-detail="${server.id}" type="button">Details</button>
        <button class="text-action" data-open-inspector="${server.id}" type="button">Inspect</button>
        ${server.archived
          ? `<button class="text-action" data-restore-server="${server.id}" type="button">Restore</button>`
          : `<button class="text-action" data-test-connection="${server.id}" type="button">Test connection</button>
             ${connectionNeedsAction(server) ? `<button class="text-action" data-connection-next-step="${server.id}" type="button">Use next step</button>` : ''}
             <button class="text-action danger-action" data-archive-server="${server.id}" type="button">Archive</button>`}
        <span class="muted">${server.latestReport?.score ?? 'NA'} score</span>
      </div>
      <p class="muted">${escapeHtml(server.tags.join(', ') || 'untagged')}${server.archivedAt ? ` | Archived ${formatTime(server.archivedAt)}` : ''}</p>
    </article>
  `).join('') || '<p class="muted">No servers match the current filter.</p>';
  serverList.querySelectorAll('[data-server]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeServerId = button.dataset.server;
      render();
    });
  });
  serverList.querySelectorAll('[data-server-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeServerId = button.dataset.serverDetail;
      render();
      setView('server-detail');
    });
  });
  serverList.querySelectorAll('[data-edit-server]').forEach((button) => {
    button.addEventListener('click', () => {
      const server = state.servers.find((item) => item.id === button.dataset.editServer);
      if (!server) return;
      state.activeServerId = server.id;
      loadServerForm(server);
      setView('servers');
    });
  });
  serverList.querySelectorAll('[data-test-connection]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/servers/${button.dataset.testConnection}/test-connection`, {
        method: 'POST',
        body: {}
      });
      await refresh();
    });
  });
  serverList.querySelectorAll('[data-connection-next-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const server = state.servers.find((item) => item.id === button.dataset.connectionNextStep);
      if (!server) return;
      state.activeServerId = server.id;
      loadServerForm(server);
      setView('servers');
    });
  });
  serverList.querySelectorAll('[data-archive-server]').forEach((button) => {
    button.addEventListener('click', async () => {
      const server = state.servers.find((item) => item.id === button.dataset.archiveServer);
      if (!server || !window.confirm(`Archive ${server.name}? Reports and evidence stay available.`)) return;
      await archiveServer(server.id, true);
    });
  });
  serverList.querySelectorAll('[data-restore-server]').forEach((button) => {
    button.addEventListener('click', async () => {
      await archiveServer(button.dataset.restoreServer, false);
    });
  });
}

function renderConnectionHealthMap() {
  if (!connectionHealthMap) return;
  const active = activeServers();
  const summary = connectionSummary(active);
  connectionHealthMap.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Connection</p>
        <h2>Health Map</h2>
      </div>
      <span>${summary.ready}/${active.length || 0} ready</span>
    </div>
    <div class="connection-pulse-grid">
      ${connectionPulseCard('ready', summary.ready, 'Ready', 'TCP and SSH usable')}
      ${connectionPulseCard('auth-failed', summary.authFailed, 'Auth', 'Key or agent review')}
      ${connectionPulseCard('blocked', summary.blocked, 'Blocked', 'Host, port, or archive')}
      ${connectionPulseCard('untested', summary.untested, 'Untested', 'Run preflight')}
    </div>
    <div class="connection-health-rail" aria-label="Connection state by server">
      ${active.map((server) => `
        <button class="connection-node ${escapeHtml(connectionTone(server))}" data-server="${escapeHtml(server.id)}" type="button" title="${escapeHtml(server.connection?.message ?? 'Connection has not been tested.')}">
          <span>${escapeHtml(compactStatusLabel(server.connection?.status ?? (server.mode === 'demo' ? 'skipped' : 'untested')))}</span>
          <strong>${escapeHtml(server.name)}</strong>
          <small>${escapeHtml(server.host)}:${server.port ?? 22}</small>
        </button>
      `).join('') || '<p class="muted">Add an authorized server to start connection checks.</p>'}
    </div>
  `;
  connectionHealthMap.querySelectorAll('[data-server]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeServerId = button.dataset.server;
      render();
    });
  });
}

function connectionPulseCard(tone, value, label, detail) {
  return `
    <article class="connection-pulse-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function connectionSummary(servers) {
  return servers.reduce((summary, server) => {
    const status = server.connection?.status ?? (server.mode === 'demo' ? 'skipped' : 'untested');
    if (status === 'ready' || status === 'reachable' || status === 'skipped') summary.ready += 1;
    else if (status === 'auth-failed') summary.authFailed += 1;
    else if (status === 'failed' || status === 'timeout' || server.archived) summary.blocked += 1;
    else summary.untested += 1;
    return summary;
  }, { ready: 0, authFailed: 0, blocked: 0, untested: 0 });
}

function connectionStatusMarkup(server) {
  const connection = server.connection ?? {};
  const status = connection.status ?? (server.mode === 'demo' ? 'skipped' : 'untested');
  const stages = connectionStages(server);
  const nextActions = Array.isArray(connection.nextActions) ? connection.nextActions : [];
  return `
    <div class="connection-status ${escapeHtml(connectionTone(server))}">
      <div class="connection-status-row">
        <span>${escapeHtml(compactStatusLabel(status))}</span>
        <strong>${escapeHtml(connection.message ?? 'Connection has not been tested.')}</strong>
      </div>
      <div class="connection-stage-list" aria-label="Connection diagnostic stages">
        ${stages.map((stage) => `
          <span class="connection-stage ${escapeHtml(stage.status)}" title="${escapeHtml(stage.message ?? '')}">
            ${escapeHtml(stage.label)}
          </span>
        `).join('')}
      </div>
      ${nextActions.length ? `
        <ol class="connection-next-actions">
          ${nextActions.slice(0, 3).map((action) => `<li>${escapeHtml(action)}</li>`).join('')}
        </ol>
      ` : ''}
    </div>
  `;
}

function connectionStages(server) {
  const stages = server.connection?.stages;
  if (Array.isArray(stages) && stages.length) return stages;
  if (server.mode === 'demo') {
    return [{ id: 'demo', label: 'Demo', status: 'pass', message: 'No external connection required.' }];
  }
  return [
    { id: 'tcp', label: 'TCP', status: 'review', message: 'Run connection test.' },
    { id: 'ssh-auth', label: 'SSH', status: 'review', message: 'Run SSH authentication check.' }
  ];
}

function connectionTone(server) {
  const status = server.connection?.status ?? (server.mode === 'demo' ? 'skipped' : 'untested');
  if (status === 'ready' || status === 'reachable' || status === 'skipped') return 'ready';
  if (status === 'auth-failed') return 'review';
  if (status === 'timeout' || status === 'failed') return 'blocked';
  return 'untested';
}

function connectionNeedsAction(server) {
  const status = server.connection?.status;
  return status === 'auth-failed' || status === 'failed' || status === 'timeout' || status === 'untested';
}

async function archiveServer(serverId, archived) {
  await api(`/api/servers/${serverId}/${archived ? 'archive' : 'restore'}`, {
    method: 'POST',
    body: {}
  });
  await refresh();
}

function serverPayloadFromForm() {
  const formData = new FormData(serverForm);
  return {
    name: formData.get('name'),
    host: formData.get('host'),
    port: Number(formData.get('port')),
    mode: formData.get('mode'),
    authType: formData.get('authType'),
    username: formData.get('username'),
    keyPath: formData.get('keyPath'),
    group: formData.get('group'),
    tags: formData.get('tags')
  };
}

function loadServerForm(server) {
  state.editingServerId = server.id;
  serverForm.elements.namedItem('name').value = server.name;
  serverForm.elements.namedItem('host').value = server.host;
  serverForm.elements.namedItem('port').value = server.port ?? 22;
  serverForm.elements.namedItem('mode').value = server.mode ?? 'demo';
  serverForm.elements.namedItem('authType').value = server.authType ?? 'none';
  serverForm.elements.namedItem('username').value = server.username ?? '';
  serverForm.elements.namedItem('keyPath').value = server.keyPath ?? '';
  serverForm.elements.namedItem('group').value = server.group ?? 'default';
  serverForm.elements.namedItem('tags').value = server.tags.join(', ');
  serverSubmitButton.textContent = 'Save Server';
  serverCancelEdit.hidden = false;
}

function resetServerForm() {
  state.editingServerId = null;
  serverForm.reset();
  serverSubmitButton.textContent = 'Add Server';
  serverCancelEdit.hidden = true;
}

function healthCell(label, valueHtml, { className = '', tag = 'span' } = {}) {
  const classAttr = className ? ` class="${className}"` : '';
  return `
    <${tag}${classAttr} data-label="${label}">
      <span class="health-cell-label">${label}</span>
      <span class="health-cell-value">${valueHtml}</span>
    </${tag}>
  `;
}

function renderHealthTable() {
  const rows = activeServers().map((server) => {
    const snapshot = server.latestSnapshot;
    const report = server.latestReport;
    return `
      <button class="health-row health-row-button" data-open-inspector="${escapeHtml(server.id)}" type="button">
        ${healthCell('Server', escapeHtml(server.name), { tag: 'strong' })}
        ${healthCell('Host', escapeHtml(server.host), { className: 'muted' })}
        ${healthCell('Score', `<span class="score-dot ${scoreClass(report?.score)}"></span>${report?.score ?? 'NA'}`, { className: 'health-score' })}
        ${healthCell('CPU', snapshot ? `${snapshot.resources.cpuPercent}%` : 'NA')}
        ${healthCell('Memory', snapshot ? `${snapshot.resources.memoryPercent}%` : 'NA')}
        ${healthCell('Disk', snapshot ? `${snapshot.resources.diskPercent}%` : 'NA')}
      </button>
    `;
  }).join('');

  healthTable.innerHTML = `
    <div class="health-row is-head">
      <span>Server</span>
      <span>Host</span>
      <span>Score</span>
      <span>CPU</span>
      <span>Memory</span>
      <span>Disk</span>
    </div>
    ${rows}
  `;
}

function renderAlerts() {
  const findings = state.alerts.length > 0
    ? state.alerts.slice(0, 5).map((alert) => ({
      server: { name: alert.serverName },
      finding: alert
    }))
    : activeServers()
      .flatMap((server) => (server.latestReport?.findings ?? []).map((finding) => ({ server, finding })))
      .slice(0, 5);

  alertStack.innerHTML = findings.map(({ server, finding }) => `
    <article class="alert-item">
      <div class="row-title">
        <span>${escapeHtml(finding.title)}</span>
        <span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
      </div>
      <p class="muted">${escapeHtml(server.name)} | ${escapeHtml(finding.category)}</p>
    </article>
  `).join('') || '<p class="muted">No alerts in the current fleet view.</p>';
}

function renderAlertsInbox() {
  const unreadCount = state.alerts.filter((alert) => alert.status === 'unread').length;
  alertSummary.textContent = `${unreadCount} unread`;
  if (alertRuleStatus && state.settings) {
    alertRuleStatus.textContent = state.settings.notifications.inboxEnabled ? 'Enabled' : 'Disabled';
  }
  alertInbox.innerHTML = state.alerts.map((alert) => `
    <article class="inbox-alert ${escapeHtml(alert.status)}">
      <div class="row-title">
        <span>${escapeHtml(alert.title)}</span>
        <span class="severity ${escapeHtml(alert.severity)}">${escapeHtml(alert.severity)}</span>
      </div>
      <p class="muted">${escapeHtml(alert.serverName)} | ${escapeHtml(alert.category)} | ${formatTime(alert.createdAt)}</p>
      <p class="muted">${escapeHtml(alert.evidence.join(' '))}</p>
      <p>${escapeHtml(alert.recommendation)}</p>
      ${renderCommandList(alert.commands)}
      <div class="mini-actions">
        <span class="status-pill ${escapeHtml(alert.status)}">${escapeHtml(alert.status)}</span>
        ${alert.status === 'unread'
          ? `<button class="secondary-action" data-acknowledge-alert="${escapeHtml(alert.id)}" type="button">Acknowledge</button>`
          : `<span class="muted">Acknowledged ${formatTime(alert.acknowledgedAt)}</span>`}
      </div>
    </article>
  `).join('') || '<p class="muted">No local notifications have been created.</p>';

  alertInbox.querySelectorAll('[data-acknowledge-alert]').forEach((button) => {
    button.addEventListener('click', async () => {
      await acknowledgeAlert(button.dataset.acknowledgeAlert);
    });
  });
}

async function acknowledgeAlert(alertId) {
  await api(`/api/alerts/${alertId}/ack`, { method: 'POST', body: {} });
  state.alerts = await api('/api/alerts');
  renderAlerts();
  renderAlertsInbox();
}

function renderFindings(report) {
  const findings = report?.findings ?? [];
  findingCount.textContent = `${findings.length} active`;
  findingsList.innerHTML = findings.map((finding) => `
    <article class="finding-item">
      <div class="row-title">
        <span>${escapeHtml(finding.title)}</span>
        <span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
      </div>
      <p class="muted">${escapeHtml(finding.evidence.join(' '))}</p>
      <p>${escapeHtml(finding.recommendation)}</p>
      ${renderCommandList(finding.commands)}
      <div class="mini-actions">
        <button class="text-action" data-open-inspector="${escapeHtml(activeServer()?.id ?? '')}" type="button">Inspect source</button>
      </div>
    </article>
  `).join('') || '<p class="muted">Run an analysis to populate findings.</p>';
}

function renderDetail(snapshot) {
  const server = activeServer();
  detailServerLabel.textContent = server ? `${server.name} | ${server.host}` : 'No server selected';
  if (!snapshot) {
    systemDetail.innerHTML = '<p class="muted">Collect telemetry to populate system detail.</p>';
    processTable.innerHTML = '';
    logList.innerHTML = '';
    performanceChart.innerHTML = '<p class="muted">Collect telemetry to populate performance charts.</p>';
    securityEvents.innerHTML = '<p class="muted">Collect telemetry to populate security events.</p>';
    topologyMap.innerHTML = '';
    topologyList.innerHTML = '<p class="muted">Run analysis to map services, ports, and containers.</p>';
    serviceCatalogList.innerHTML = '<p class="muted">Run analysis to classify services by role and exposure.</p>';
    return;
  }

  const rows = [
    ['Hostname', snapshot.system.hostname],
    ['Platform', snapshot.system.platform],
    ['Endpoint', `${server.host}:${server.port ?? 22}`],
    ['Auth', server.authType ?? 'none'],
    ['Mode', server.mode ?? 'demo'],
    ['SSH user', server.username || 'not set'],
    ['Group', server.group ?? 'default'],
    ['Connection', server.connection?.status ?? 'untested'],
    ['Uptime', `${Math.round(snapshot.system.uptimeSeconds / 86400)} days`],
    ['Load', snapshot.system.loadAverage.join(' / ')],
    ['Open ports', String(snapshot.ports.length)],
    ['Containers', String(snapshot.containers.length)]
  ];
  systemDetail.innerHTML = rows.map(([label, value]) => `
    <div class="kv-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('');

  processTable.innerHTML = `
    <div class="table-row table-head"><span>PID</span><span>Name</span><span>CPU</span><span>Memory</span></div>
    ${snapshot.processes.map((process) => `
      <div class="table-row">
        <span>${process.pid}</span>
        <strong>${escapeHtml(process.name)}</strong>
        <span>${process.cpuPercent}%</span>
        <span>${process.memoryMb} MB</span>
      </div>
    `).join('')}
  `;

  logList.innerHTML = snapshot.logs.latest.map((entry) => `
    <article class="log-entry ${escapeHtml(entry.level)}">
      <span>${escapeHtml(entry.time)} | ${escapeHtml(entry.level)}</span>
      <strong>${escapeHtml(entry.message)}</strong>
    </article>
  `).join('');
}

function renderPerformancePanel(snapshot, report) {
  if (!snapshot) {
    performanceChart.innerHTML = '<p class="muted">Collect telemetry to populate performance charts.</p>';
    return;
  }

  const trends = report?.trends ?? null;
  const trendReady = trends?.status === 'ready';
  const dataPoints = trends?.dataPoints ?? 0;
  const minPoints = trends?.minPoints ?? 3;
  const metrics = [
    {
      label: 'CPU',
      value: snapshot.resources.cpuPercent,
      unit: '%',
      series: trends?.cpu ?? [],
      detail: `Load ${snapshot.system.loadAverage.join(' / ')}`
    },
    {
      label: 'Memory',
      value: snapshot.resources.memoryPercent,
      unit: '%',
      series: trends?.memory ?? [],
      detail: 'Resident pressure'
    },
    {
      label: 'Disk',
      value: snapshot.resources.diskPercent,
      unit: '%',
      series: trends?.disk ?? [],
      detail: 'Root volume usage'
    },
    {
      label: 'Disk IO',
      value: Math.min(100, Math.round((snapshot.resources.diskReadMbps ?? 0) + (snapshot.resources.diskWriteMbps ?? 0))),
      unit: ' MB/s',
      series: trends?.diskIo ?? [],
      detail: `${snapshot.resources.diskReadMbps ?? 0} read / ${snapshot.resources.diskWriteMbps ?? 0} write | ${snapshot.resources.ioWaitPercent ?? 0}% iowait`
    },
    {
      label: 'Network',
      value: Math.min(100, Math.round(snapshot.resources.networkRxMbps + snapshot.resources.networkTxMbps)),
      unit: ' Mbps',
      series: trends?.network ?? [],
      detail: `${snapshot.resources.networkRxMbps} down / ${snapshot.resources.networkTxMbps} up`
    }
  ];

  const trendBanner = trendReady
    ? ''
    : `<p class="muted trend-pending" data-trend-status="insufficient-history">Trends appear after ${minPoints} collections. ${dataPoints} of ${minPoints} collected so far — charts show real points only, never simulated curves.</p>`;

  performanceChart.innerHTML = trendBanner + metrics.map((metric) => {
    const series = Array.isArray(metric.series) ? metric.series : [];
    const spark = trendReady && series.length >= 2
      ? `<div class="spark-bars" aria-label="${escapeHtml(metric.label)} real trend, ${series.length} collections">
          ${series.map((value) => `<span style="height: ${clampPercent(value)}%"></span>`).join('')}
        </div>`
      : `<div class="spark-bars is-pending" aria-label="${escapeHtml(metric.label)} trend pending more collections">
          <span class="spark-pending-note">Collecting…</span>
        </div>`;
    return `
      <article class="performance-card ${pressureClass(metric.value)}">
        <div class="row-title">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${metric.value}${escapeHtml(metric.unit)}</strong>
        </div>
        ${spark}
        <div class="pressure-meter"><span style="width: ${Math.min(100, metric.value)}%"></span></div>
        <p class="muted">${escapeHtml(metric.detail)}</p>
      </article>
    `;
  }).join('');
}

function renderSecurityEvents(snapshot) {
  if (!snapshot) {
    securityEvents.innerHTML = '<p class="muted">Collect telemetry to populate security events.</p>';
    return;
  }

  const highRiskPorts = snapshot.firewall?.exposedHighRiskPorts ?? [];
  const suspiciousConnections = snapshot.securityEvents?.suspiciousConnections ?? [];
  const signals = [
    {
      label: 'SSH failures',
      value: snapshot.securityEvents.failedSshLogins10m,
      detail: 'last 10 minutes',
      severity: snapshot.securityEvents.failedSshLogins10m >= 50 ? 'critical' : snapshot.securityEvents.failedSshLogins10m > 0 ? 'medium' : 'low'
    },
    {
      label: 'Auth failures',
      value: snapshot.logs.authFailures1h,
      detail: 'last hour',
      severity: snapshot.logs.authFailures1h >= 100 ? 'high' : snapshot.logs.authFailures1h > 0 ? 'medium' : 'low'
    },
    {
      label: 'High-risk ports',
      value: highRiskPorts.length,
      detail: highRiskPorts.join(', ') || 'none exposed',
      severity: highRiskPorts.length > 0 ? 'high' : 'low'
    },
    {
      label: 'Error logs',
      value: snapshot.logs.errorCount1h,
      detail: 'last hour',
      severity: snapshot.logs.errorCount1h >= 25 ? 'medium' : 'low'
    }
  ];

  securityEvents.innerHTML = `
    <div class="security-signal-grid">
      ${signals.map((signal) => `
        <article class="security-signal">
          <span>${escapeHtml(signal.label)}</span>
          <strong>${signal.value}</strong>
          <small>${escapeHtml(signal.detail)}</small>
          <em class="severity ${escapeHtml(signal.severity)}">${escapeHtml(signal.severity)}</em>
        </article>
      `).join('')}
    </div>
    <div class="security-connection-list">
      ${suspiciousConnections.map((connection) => `
        <article class="security-connection">
          <div class="row-title">
            <span>${escapeHtml(connection.remoteAddress)}</span>
            <span class="severity ${connection.count >= 25 ? 'high' : 'medium'}">${connection.count >= 25 ? 'high' : 'medium'}</span>
          </div>
          <p class="muted">${connection.count} connections to port ${connection.port}</p>
        </article>
      `).join('') || '<p class="muted">No repeated remote connection patterns were collected.</p>'}
    </div>
  `;
}

function renderRiskEventTimeline(timelineData) {
  riskEventTimeline.innerHTML = riskEventTimelineMarkup(timelineData, 8);
}

function renderSecuritySourceReview(review) {
  securitySourceReview.innerHTML = securitySourceReviewMarkup(review, 8);
}

function riskEventTimelineMarkup(timelineData, limit = 6) {
  const events = timelineData?.events ?? [];
  if (events.length === 0) {
    return `
      <section class="risk-event-timeline-surface">
        <div class="row-title">
          <span>Risk Event Timeline</span>
          <span class="status-badge">No report</span>
        </div>
        <p class="muted">Run a security or full analysis to group observed risk evidence into a timeline.</p>
      </section>
    `;
  }

  return `
    <section class="risk-event-timeline-surface" data-mode="${escapeHtml(timelineData.mode ?? 'local-evidence-timeline')}">
      <div class="row-title">
        <span>Risk Event Timeline</span>
        <span class="status-badge">${events.length} events</span>
      </div>
      <div class="risk-event-summary">
        <span>${timelineData.summary?.critical ?? 0} critical</span>
        <span>${timelineData.summary?.high ?? 0} high</span>
        <span>${timelineData.summary?.medium ?? 0} medium</span>
        <span>${timelineData.summary?.low ?? 0} low</span>
      </div>
      <div class="risk-event-list">
        ${events.slice(0, limit).map((event) => `
          <article class="risk-event-row">
            <div class="risk-event-rail">
              <span class="score-dot ${severityDotClass(event.severity)}"></span>
            </div>
            <div class="risk-event-body">
              <div class="row-title">
                <span>${escapeHtml(event.title)}</span>
                <span class="severity ${escapeHtml(event.severity)}">${escapeHtml(event.severity)}</span>
              </div>
              <p class="muted">${escapeHtml(event.window)} | ${escapeHtml(event.source)} | ${formatTime(event.timestamp)}</p>
              <p>${escapeHtml(event.evidence.join(' '))}</p>
              <small>${escapeHtml(event.recommendation)}</small>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function securitySourceReviewMarkup(review, limit = 6) {
  const sources = review?.sources ?? [];
  if (sources.length === 0) {
    return `
      <section class="security-source-surface">
        <div class="row-title">
          <span>Security Source Review</span>
          <span class="status-badge">No report</span>
        </div>
        <p class="muted">Run a security or full analysis to summarize collected source evidence.</p>
      </section>
    `;
  }

  return `
    <section class="security-source-surface" data-mode="${escapeHtml(review.mode ?? 'local-security-source-review')}">
      <div class="row-title">
        <span>Security Source Review</span>
        <span class="status-badge">${sources.length} sources</span>
      </div>
      <div class="risk-event-summary">
        <span>${review.summary?.critical ?? 0} critical</span>
        <span>${review.summary?.high ?? 0} high</span>
        <span>${review.summary?.medium ?? 0} medium</span>
        <span>${review.summary?.low ?? 0} low</span>
      </div>
      <div class="security-source-list">
        ${sources.slice(0, limit).map((source) => `
          <article class="security-source-row">
            <div class="row-title">
              <span>${escapeHtml(source.label ?? source.remoteAddress)}</span>
              <span class="severity ${escapeHtml(source.severity)}">${escapeHtml(source.severity)}</span>
            </div>
            <p class="muted">${escapeHtml(source.remoteAddress)} | ports ${(source.ports ?? []).join(', ') || 'n/a'}</p>
            <p>${escapeHtml((source.signals ?? []).join(' | '))}</p>
            <small>${escapeHtml(source.recommendation)}</small>
          </article>
        `).join('')}
      </div>
      <p class="evidence-redaction-note">${escapeHtml(review.boundary ?? 'Local evidence only.')}</p>
    </section>
  `;
}

function renderRuntimeInventory(snapshot) {
  if (!snapshot) {
    containerTable.innerHTML = '<p class="muted">Collect telemetry to populate containers.</p>';
    portTable.innerHTML = '<p class="muted">Collect telemetry to populate ports.</p>';
    firewallDetail.innerHTML = '<p class="muted">Collect telemetry to populate firewall status.</p>';
    return;
  }

  containerTable.innerHTML = `
    <div class="table-row container-row table-head"><span>Name</span><span>Image</span><span>Status</span><span>Restarts</span></div>
    ${snapshot.containers.map((container) => `
      <div class="table-row container-row">
        <strong>${escapeHtml(container.name)}</strong>
        <span>${escapeHtml(container.image)}</span>
        <span>${escapeHtml(container.status)}</span>
        <span>${container.restarts}</span>
      </div>
    `).join('')}
  `;

  portTable.innerHTML = `
    <div class="table-row port-row table-head"><span>Port</span><span>Protocol</span><span>Process</span><span>Exposure</span></div>
    ${snapshot.ports.map((port) => `
      <div class="table-row port-row">
        <strong>${port.port}</strong>
        <span>${escapeHtml(port.protocol)}</span>
        <span>${escapeHtml(port.process)}</span>
        <span>${escapeHtml(port.exposure)}</span>
      </div>
    `).join('')}
  `;

  const firewall = snapshot.firewall ?? {
    enabled: false,
    defaultPolicy: 'unknown',
    allowedPublicPorts: [],
    exposedHighRiskPorts: []
  };
  firewallDetail.innerHTML = [
    ['Enabled', firewall.enabled ? 'Yes' : 'No'],
    ['Default policy', firewall.defaultPolicy],
    ['Allowed public ports', firewall.allowedPublicPorts.join(', ') || 'None'],
    ['High-risk public ports', firewall.exposedHighRiskPorts.join(', ') || 'None']
  ].map(([label, value]) => `
    <div class="kv-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('');
}

function renderTopology(topology) {
  if (!topology) {
    topologyMap.innerHTML = '';
    topologyList.innerHTML = '<p class="muted">Run analysis to map services, ports, and containers.</p>';
    return;
  }

  renderTopologyMap(topology.map);
  const nodesById = new Map(topology.nodes.map((node) => [node.id, node]));
  topologyList.innerHTML = topology.edges.map((edge) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    const risk = topology.risks.find((item) => item.nodeId === edge.to);
    return `
      <article class="topology-item service-topology">
        <div>
          <span class="node-kind">${escapeHtml(from?.kind ?? 'node')}</span>
          <strong>${escapeHtml(from?.label ?? edge.from)}</strong>
        </div>
        <span class="topology-link">${escapeHtml(edge.label)}</span>
        <div>
          <span class="node-kind">${escapeHtml(to?.kind ?? 'node')}</span>
          <strong>${escapeHtml(to?.label ?? edge.to)}</strong>
          <span class="muted">${escapeHtml(to?.status ?? 'observed')}</span>
        </div>
        ${risk ? `<span class="severity ${escapeHtml(risk.severity)}">${escapeHtml(risk.severity)}</span>` : '<span class="muted">clear</span>'}
      </article>
    `;
  }).join('') || '<p class="muted">No topology relationships were detected.</p>';
}

function renderTopologyMap(map) {
  if (!map || map.nodes.length === 0) {
    topologyMap.innerHTML = '<p class="muted">Run analysis to draw the local topology map.</p>';
    return;
  }
  const nodesById = new Map(map.nodes.map((node) => [node.id, node]));
  topologyMap.innerHTML = `
    <div class="topology-canvas" aria-label="Service topology map">
      ${map.edges.map((edge) => {
        const from = nodesById.get(edge.from);
        const to = nodesById.get(edge.to);
        if (!from || !to) return '';
        return `<span class="topology-edge" style="--x1:${from.x}%;--y1:${from.y}%;--x2:${to.x}%;--y2:${to.y}%"></span>`;
      }).join('')}
      ${map.nodes.map((node) => `
        <article class="topology-node ${escapeHtml(node.kind)} ${escapeHtml(node.severity)}" style="--x:${node.x}%;--y:${node.y}%">
          <span>${escapeHtml(node.kind)}</span>
          <strong>${escapeHtml(node.label)}</strong>
        </article>
      `).join('')}
    </div>
  `;
}

function renderServiceCatalog(serviceCatalog) {
  const catalog = serviceCatalog ?? [];
  if (catalog.length === 0) {
    serviceCatalogList.innerHTML = '<p class="muted">Run analysis to classify services by role and exposure.</p>';
    return;
  }

  serviceCatalogList.innerHTML = catalog.map((entry) => {
    const ports = entry.ports.map((port) => `${port.protocol}/${port.port}`).join(', ') || 'no listener';
    const backing = entry.backing
      .slice(0, 3)
      .map((item) => `${item.kind}: ${item.name}${item.status ? ` (${item.status})` : ''}`)
      .join(' | ') || 'owner unknown';
    const risk = entry.risks[0];
    return `
      <article class="service-catalog-row">
        <div class="service-catalog-main">
          <div class="row-title">
            <span>${escapeHtml(entry.name)}</span>
            <span class="role-badge">${escapeHtml(entry.role)}</span>
          </div>
          <p class="muted">${escapeHtml(entry.recommendation)}</p>
        </div>
        <div class="service-catalog-meta">
          <span>${escapeHtml(entry.exposure)}</span>
          <strong>${escapeHtml(entry.health)}</strong>
        </div>
        <div class="service-catalog-meta">
          <span>Ports</span>
          <strong>${escapeHtml(ports)}</strong>
        </div>
        <div class="service-catalog-meta">
          <span>Backing</span>
          <strong>${escapeHtml(backing)}</strong>
        </div>
        ${risk ? `<span class="severity ${escapeHtml(risk.severity)}">${escapeHtml(risk.severity)}</span>` : '<span class="muted">clear</span>'}
      </article>
    `;
  }).join('');
}

function renderJobs() {
  jobList.innerHTML = state.jobs.slice(0, 5).map((job) => `
    <article class="job-item">
      <div class="row-title">
        <span>${escapeHtml(job.id)}</span>
        <span class="muted">${escapeHtml(job.status)}</span>
      </div>
      <div class="progress-track compact"><span style="width: ${job.progress}%"></span></div>
      <p class="muted">${escapeHtml(job.preset ?? 'custom')} | ${escapeHtml(job.modules.join(', '))}</p>
    </article>
  `).join('') || '<p class="muted">Run an analysis to create job history.</p>';
}

function renderReport(report) {
  if (!report) {
    reportSurface.innerHTML = '<p class="muted">Run an analysis to generate the current report.</p>';
    return;
  }
  reportSurface.innerHTML = `
    <h3>${escapeHtml(report.summary.hostname)}</h3>
    <p class="muted">${escapeHtml(report.status)} | ${escapeHtml(report.modulesRun.map((moduleName) => moduleLabels[moduleName]).join(', '))}</p>
    <div class="report-grid">
      <div class="report-cell"><span>Score</span><strong>${report.score}</strong></div>
      <div class="report-cell"><span>Open ports</span><strong>${report.summary.openPorts}</strong></div>
      <div class="report-cell"><span>Findings</span><strong>${report.findings.length}</strong></div>
    </div>
    <p class="muted">Analysis scope | ${escapeHtml(report.analysisScope?.depth ?? 'standard')} | ${escapeHtml(report.analysisScope?.timeRange ?? 'latest-snapshot')}</p>
    ${renderExecutiveSummary(report.executiveSummary)}
    ${riskEventTimelineMarkup(report.riskEventTimeline, 6)}
    ${securitySourceReviewMarkup(report.securitySourceReview, 6)}
    ${evidenceAppendixMarkup(report.evidenceAppendix, 6)}
    ${renderRemediationPlan(report.remediationPlan)}
    ${renderReportServiceCatalog(report.serviceCatalog)}
    <h4>Recommendations</h4>
    <div class="recommendation-list">
      ${report.recommendations.map((item) => `<p>${escapeHtml(item.action)}</p>`).join('')}
    </div>
    <div class="findings-list">
      ${report.findings.slice(0, 6).map((finding) => `
        <article class="finding-item">
          <div class="row-title">
            <span>${escapeHtml(finding.title)}</span>
            <span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
          </div>
          <p class="muted">${escapeHtml(finding.evidence.join(' '))}</p>
          ${renderCommandList(finding.commands)}
        </article>
      `).join('')}
    </div>
  `;
}

function renderRemediationPlan(plan) {
  if (!plan || plan.totalActions === 0) {
    return `
      <section class="remediation-checklist">
        <div class="row-title">
          <h4>Remediation Checklist</h4>
          <span class="status-badge">Clear</span>
        </div>
        <p class="muted">No remediation actions were generated for this report.</p>
      </section>
    `;
  }

  return `
    <section class="remediation-checklist">
      <div class="row-title">
        <h4>Remediation Checklist</h4>
        <span class="status-badge">${plan.totalActions} actions</span>
      </div>
      ${plan.phases.filter((phase) => phase.items.length > 0).map((phase) => `
        <div class="remediation-phase">
          <div>
            <strong>${escapeHtml(phase.label)}</strong>
            <p class="muted">${escapeHtml(phase.intent)}</p>
          </div>
          <div class="remediation-items">
            ${phase.items.slice(0, 4).map((item) => `
              <article class="remediation-item">
                <div class="row-title">
                  <span>${escapeHtml(item.title)}</span>
                  <span class="severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
                </div>
                <p>${escapeHtml(item.action)}</p>
                <div class="remediation-meta">
                  <span>${escapeHtml(item.owner)}</span>
                  <span>${escapeHtml(item.category)}</span>
                </div>
                <p class="muted">${escapeHtml(item.acceptance)}</p>
                ${renderCommandList(item.commands)}
              </article>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

function renderEvidenceAppendix(appendix) {
  evidenceAppendix.innerHTML = evidenceAppendixMarkup(appendix, 8);
}

function evidenceAppendixMarkup(appendix, limit = 6) {
  const items = appendix?.items ?? [];
  if (items.length === 0) {
    return `
      <section class="evidence-appendix-surface">
        <div class="row-title">
          <span>Evidence Appendix</span>
          <span class="status-badge">No report</span>
        </div>
        <p class="muted">Run an analysis to populate redacted report evidence.</p>
      </section>
    `;
  }

  return `
    <section class="evidence-appendix-surface" data-mode="${escapeHtml(appendix.mode ?? 'local-redacted-evidence')}">
      <div class="row-title">
        <span>Evidence Appendix</span>
        <span class="status-badge">${appendix.summary?.totalItems ?? items.length} items</span>
      </div>
      <p class="evidence-redaction-note">${escapeHtml(appendix.redaction?.policy ?? 'metadata-and-rule-evidence-only')} | ${escapeHtml(appendix.redaction?.note ?? 'Secrets are not included.')}</p>
      <div class="evidence-appendix-list">
        ${items.slice(0, limit).map((item) => `
          <article class="evidence-appendix-row">
            <div class="row-title">
              <span>${escapeHtml(item.title)}</span>
              <span class="severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
            </div>
            <div class="evidence-appendix-meta">
              <span>${escapeHtml(item.category)}</span>
              <span>${escapeHtml(item.source)}</span>
              <span>${escapeHtml(item.redaction)}</span>
            </div>
            <p>${escapeHtml(item.evidence.join(' '))}</p>
            ${renderCommandList(item.commands)}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderReportServiceCatalog(serviceCatalog = []) {
  if (serviceCatalog.length === 0) return '';
  return `
    <h4>Service Catalog</h4>
    <div class="service-catalog-list compact">
      ${serviceCatalog.slice(0, 6).map((entry) => `
        <article class="service-catalog-row">
          <div class="service-catalog-main">
            <div class="row-title">
              <span>${escapeHtml(entry.name)}</span>
              <span class="role-badge">${escapeHtml(entry.role)}</span>
            </div>
            <p class="muted">${escapeHtml(entry.recommendation)}</p>
          </div>
          <div class="service-catalog-meta"><span>Exposure</span><strong>${escapeHtml(entry.exposure)}</strong></div>
          <div class="service-catalog-meta"><span>Health</span><strong>${escapeHtml(entry.health)}</strong></div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderExecutiveSummary(summary) {
  if (!summary) {
    return `
      <section class="executive-summary">
        <h4>Executive Summary</h4>
        <p class="muted">Local executive summary is disabled for this report.</p>
      </section>
    `;
  }

  return `
    <section class="executive-summary">
      <h4>Executive Summary</h4>
      <strong>${escapeHtml(summary.headline)}</strong>
      <p>${escapeHtml(summary.overview)}</p>
      <div class="summary-columns">
        <div>
          <span>Key risks</span>
          ${summary.keyRisks.slice(0, 3).map((risk) => `<p>${escapeHtml(risk.severity)} | ${escapeHtml(risk.title)}</p>`).join('')}
        </div>
        <div>
          <span>Next actions</span>
          ${summary.nextActions.slice(0, 3).map((action) => `<p>${escapeHtml(action)}</p>`).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderReportCenter() {
  const center = state.reportCenter;
  if (!center) {
    reportHistory.innerHTML = '<p class="muted">No report history available.</p>';
    riskTrend.innerHTML = '<p class="muted">Run analysis to build risk trend.</p>';
    reportComparison.innerHTML = '<p class="muted">Need at least two reports to compare.</p>';
    return;
  }

  reportHistory.innerHTML = center.history.slice(0, 8).map((item) => {
    const historyItemClass = state.selectedReportId === item.id ? 'history-item is-selected' : 'history-item';
    return `
    <button class="${historyItemClass}" data-report-id="${escapeHtml(item.id)}" type="button" aria-label="Open report ${escapeHtml(item.serverName)}">
      <div class="row-title">
        <span>${escapeHtml(item.serverName)}</span>
        <span class="health-score"><span class="score-dot ${scoreClass(item.score)}"></span>${item.score}</span>
      </div>
      <p class="muted">${escapeHtml(item.status)} | ${item.findings} findings | ${formatTime(item.generatedAt)}</p>
    </button>
  `;
  }).join('') || '<p class="muted">No report history available.</p>';

  reportHistory.querySelectorAll('[data-report-id]').forEach((item) => {
    item.addEventListener('click', async () => {
      state.latestReport = await api(`/api/reports/${item.dataset.reportId}`);
      state.selectedReportId = state.latestReport.id;
      state.activeServerId = state.latestReport.serverId;
      render();
    });
  });

  const scoreValues = center.trends.score.slice(-8);
  const maxFindings = Math.max(1, ...center.trends.findings.map((item) => item.value));
  riskTrend.innerHTML = scoreValues.map((scoreItem, index) => {
    const findingItem = center.trends.findings.slice(-8)[index] ?? { value: 0 };
    return `
      <div class="trend-row">
        <span>${escapeHtml(scoreItem.serverName)}</span>
        <div class="trend-bars">
          <span class="trend-score" style="width: ${scoreItem.value}%"></span>
          <span class="trend-findings" style="width: ${(findingItem.value / maxFindings) * 100}%"></span>
        </div>
        <strong>${scoreItem.value}</strong>
      </div>
    `;
  }).join('') || '<p class="muted">Run analysis to build risk trend.</p>';

  if (!center.comparison) {
    reportComparison.innerHTML = '<p class="muted">Need at least two reports to compare.</p>';
    return;
  }
  const comparison = center.comparison;
  reportComparison.innerHTML = `
    <div class="compare-grid">
      <div><span>Score delta</span><strong>${signed(comparison.deltaScore)}</strong></div>
      <div><span>Findings delta</span><strong>${signed(comparison.deltaFindings)}</strong></div>
      <div><span>High-risk delta</span><strong>${signed(comparison.newHighRisk)}</strong></div>
    </div>
    <p class="muted">${escapeHtml(comparison.current.serverName)} compared with previous report.</p>
  `;
}

function renderStatusPagePreview() {
  const statusPage = state.statusPage;
  if (!statusPage) {
    statusPagePreview.innerHTML = '<p class="muted">Refresh status to generate a local redacted summary.</p>';
    return;
  }

  statusPagePreview.innerHTML = `
    <div class="status-page-summary">
      <div>
        <span>Overall</span>
        <strong>${escapeHtml(labelForStatus(statusPage.overallStatus))}</strong>
      </div>
      <div>
        <span>Services</span>
        <strong>${statusPage.totals.services}</strong>
      </div>
      <div>
        <span>Active incidents</span>
        <strong>${statusPage.totals.activeIncidents}</strong>
      </div>
      <div>
        <span>Visibility</span>
        <strong>${escapeHtml(statusPage.visibility)}</strong>
      </div>
    </div>
    <div class="status-service-list">
      ${statusPage.services.map((service) => `
        <article class="status-service-row">
          <div>
            <strong>${escapeHtml(service.name)}</strong>
            <span>${escapeHtml(service.group)} | updated ${formatTime(service.lastUpdatedAt)}</span>
          </div>
          <span class="severity ${statusSeverityClass(service.status)}">${escapeHtml(labelForStatus(service.status))}</span>
          <span class="muted">${service.score ?? 'NA'} score</span>
        </article>
      `).join('') || '<p class="muted">No active services are available.</p>'}
    </div>
    <div class="status-incident-list">
      ${statusPage.incidents.slice(0, 5).map((incident) => `
        <article class="status-incident-row">
          <span class="severity ${escapeHtml(incident.severity)}">${escapeHtml(incident.severity)}</span>
          <strong>${escapeHtml(incident.title)}</strong>
          <small>${escapeHtml(incident.serviceName)} | ${escapeHtml(incident.category)}</small>
        </article>
      `).join('') || '<p class="muted">No unacknowledged incidents in the local preview.</p>'}
    </div>
  `;
}

function renderSettings() {
  if (!state.settings) return;
  for (const [name, value] of Object.entries(state.settings.thresholds)) {
    const input = settingsForm.elements.namedItem(name);
    if (input && document.activeElement !== input) input.value = value;
  }
  const retentionInput = settingsForm.elements.namedItem('retentionDays');
  if (retentionInput && document.activeElement !== retentionInput) {
    retentionInput.value = state.settings.retentionDays;
  }
  const localOnlyInput = settingsForm.elements.namedItem('localOnly');
  if (localOnlyInput) {
    localOnlyInput.checked = Boolean(state.settings.notifications.localOnly);
  }
  const inboxEnabledInput = settingsForm.elements.namedItem('inboxEnabled');
  if (inboxEnabledInput) {
    inboxEnabledInput.checked = Boolean(state.settings.notifications.inboxEnabled);
  }
  const alertSeverityInput = settingsForm.elements.namedItem('alertSeverities');
  const alertSeverities = new Set(state.settings.notifications.alertSeverities ?? []);
  if (alertSeverityInput) {
    [...alertSeverityInput.options].forEach((option) => {
      option.selected = alertSeverities.has(option.value);
    });
  }
  const aiSummaryInput = settingsForm.elements.namedItem('aiSummaryEnabled');
  if (aiSummaryInput) {
    aiSummaryInput.checked = Boolean(state.settings.aiSummary?.enabled);
  }
  const webhook = state.settings.notifications.webhook ?? {};
  const webhookEnabledInput = settingsForm.elements.namedItem('webhookEnabled');
  if (webhookEnabledInput) {
    webhookEnabledInput.checked = Boolean(webhook.enabled);
  }
  const webhookUrlInput = settingsForm.elements.namedItem('webhookUrl');
  if (webhookUrlInput && document.activeElement !== webhookUrlInput) {
    webhookUrlInput.value = webhook.url ?? '';
  }
  const webhookMinSeverityInput = settingsForm.elements.namedItem('webhookMinSeverity');
  if (webhookMinSeverityInput) {
    webhookMinSeverityInput.value = webhook.minSeverity ?? 'high';
  }
}

function renderReleaseWorkspace() {
  if (!releaseReadinessCards) return;
  const [modeLabel, modeDetail] = releaseModeCopy[state.releaseMode] ?? releaseModeCopy.operator;
  releaseModeSummary.textContent = `${modeLabel} | ${modeDetail}`;
  document.querySelectorAll('[data-release-mode-card]').forEach((button) => {
    const selected = button.dataset.releaseModeCard === state.releaseMode;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const evidence = state.deliveryEvidenceManifest;
  const readiness = state.deliveryReadiness;
  const checklist = state.handoffChecklist;
  const active = activeServers();
  const report = state.latestReport ?? activeServer()?.latestReport;
  const findings = report?.findings ?? [];
  const freshSnapshots = active.filter((server) => server.latestSnapshot).length;
  const connected = active.filter((server) => server.connection?.status === 'reachable' || server.mode === 'demo').length;
  const highRisk = findings.filter((finding) => ['critical', 'high'].includes(finding.severity)).length;
  const references = evidence?.githubReferences ?? [];
  const v10RefsReady = ['checkmate', 'openstatus', 'glance'].filter((ref) => references.includes(ref)).length;
  const packagePath = evidence?.packagePath ?? 'Run readiness gate';
  const safetyItems = evidence?.safetyBoundary ?? [
    'Defensive analysis for authorized server telemetry only.',
    'Demo mode does not open external network connections.',
    'No credential guessing, hidden discovery, exploit behavior, or remote modification.'
  ];

  const cards = [
    {
      id: 'connection-readiness',
      label: 'Connection Readiness',
      value: `${connected}/${active.length || 0}`,
      detail: active.length ? 'Reachable or demo assets' : 'Add authorized assets',
      status: active.length && connected === active.length ? 'ready' : 'review',
      view: 'servers'
    },
    {
      id: 'evidence-freshness',
      label: 'Evidence Freshness',
      value: `${freshSnapshots}/${active.length || 0}`,
      detail: report ? `Latest report ${formatTime(report.createdAt)}` : 'Collect and analyze before handoff',
      status: freshSnapshots > 0 && report ? 'ready' : 'review',
      view: 'analysis'
    },
    {
      id: 'risk-queue',
      label: 'Risk Queue',
      value: String(highRisk),
      detail: findings.length ? `${findings.length} evidence-backed findings` : 'No active report findings',
      status: highRisk > 0 ? 'review' : 'ready',
      view: 'reports'
    },
    {
      id: 'delivery-package',
      label: 'Delivery Package',
      value: readiness?.status ?? 'review',
      detail: packagePath,
      status: readiness?.status === 'ready' ? 'ready' : 'review',
      view: 'settings'
    },
    {
      id: 'safety-boundary',
      label: 'Safety Boundary',
      value: String(safetyItems.length),
      detail: 'Local, defensive, non-invasive',
      status: 'ready',
      view: 'release'
    },
    {
      id: 'reference-basis',
      label: 'Reference Basis',
      value: `${v10RefsReady}/3`,
      detail: 'Checkmate, OpenStatus, Glance',
      status: v10RefsReady === 3 ? 'ready' : 'review',
      view: 'release'
    }
  ];

  releaseReadinessCards.innerHTML = cards.map((card) => `
    <button class="release-readiness-card ${card.status}" data-view="${escapeHtml(card.view)}" data-release-card="${escapeHtml(card.id)}" type="button">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.detail)}</small>
    </button>
  `).join('');

  releaseReviewQueue.innerHTML = releaseQueueItems(readiness, checklist, findings).map((item) => `
    <article class="release-queue-item ${escapeHtml(item.status)}">
      <div class="row-title">
        <strong>${escapeHtml(item.label)}</strong>
        <span class="status-pill">${escapeHtml(item.status)}</span>
      </div>
      <p>${escapeHtml(item.detail)}</p>
      <div class="release-action-row">
        <button class="secondary-action" data-view="${escapeHtml(item.view)}" type="button">${escapeHtml(item.action)}</button>
      </div>
    </article>
  `).join('');

  releaseReferenceBasis.innerHTML = releaseReferenceItems(references).map((item) => `
    <article class="release-reference-card ${item.ready ? 'ready' : 'review'}">
      <div class="row-title">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="status-pill">${item.ready ? 'ready' : 'review'}</span>
      </div>
      <p>${escapeHtml(item.detail)}</p>
      <small>${escapeHtml(item.path)}</small>
    </article>
  `).join('');

  releaseSafetyLedger.innerHTML = safetyItems.map((item, index) => `
    <article class="release-safety-item">
      <span>${index + 1}</span>
      <p>${escapeHtml(item)}</p>
    </article>
  `).join('');
}

function releaseQueueItems(readiness, checklist, findings) {
  const failedReadiness = readiness?.checks?.filter((check) => check.status !== 'pass') ?? [];
  const reviewSteps = checklist?.steps?.filter((step) => step.status !== 'ready') ?? [];
  const priorityFindings = findings.filter((finding) => ['critical', 'high'].includes(finding.severity)).slice(0, 2);
  const mode = state.releaseMode;
  const base = [
    {
      label: 'Run readiness gate',
      status: readiness?.status ?? 'review',
      detail: readiness ? `${readiness.summary.pass} passed, ${readiness.summary.fail} failed` : 'Load local commercial checks.',
      action: 'Open Settings',
      view: 'settings'
    },
    {
      label: 'Review handoff checklist',
      status: checklist?.status ?? 'review',
      detail: checklist ? `${checklist.summary.ready} ready, ${checklist.summary.review} review` : 'Open first-run client review steps.',
      action: 'Open Checklist',
      view: 'settings'
    }
  ];
  const readinessItems = failedReadiness.slice(0, 3).map((check) => ({
    label: check.label,
    status: check.status === 'fail' ? 'blocked' : 'review',
    detail: `${check.category}: ${check.evidence.slice(0, 2).join(' | ')}`,
    action: 'Review Gate',
    view: 'settings'
  }));
  const findingItems = priorityFindings.map((finding) => ({
    label: finding.title,
    status: 'review',
    detail: `${finding.severity}: ${finding.recommendation}`,
    action: mode === 'incident-review' ? 'Open Detail' : 'Open Report',
    view: mode === 'incident-review' ? 'server-detail' : 'reports'
  }));
  const checklistItems = reviewSteps.slice(0, 2).map((step) => ({
    label: step.label,
    status: step.status,
    detail: step.action,
    action: 'Open Settings',
    view: 'settings'
  }));
  const modeItems = mode === 'client-handoff'
    ? [...base, ...checklistItems, ...readinessItems]
    : mode === 'incident-review'
      ? [...findingItems, ...base, ...readinessItems]
      : [...base, ...readinessItems, ...findingItems];
  return modeItems.slice(0, 6);
}

function releaseReferenceItems(references) {
  return [
    {
      id: 'checkmate',
      name: 'Checkmate',
      path: 'references/github-v10/checkmate',
      detail: 'Monitor lifecycle, job results, incident creation, notification-ready flow.',
      ready: references.includes('checkmate')
    },
    {
      id: 'openstatus',
      name: 'OpenStatus',
      path: 'references/github-v10/openstatus',
      detail: 'Status-page posture, monitoring-as-code, incident communication boundaries.',
      ready: references.includes('openstatus')
    },
    {
      id: 'glance',
      name: 'Glance',
      path: 'references/github-v10/glance',
      detail: 'Lightweight private dashboard density, widgets, mobile scanning.',
      ready: references.includes('glance')
    }
  ];
}

function renderEcosystem() {
  // Fleet-wide ecosystem dashboard, driven entirely by /api/ecosystem/overview
  // (real aggregated telemetry + rule findings). No simulated values: when a
  // trend lacks enough collections it shows an explicit placeholder, never a
  // fabricated line. Refreshes on the existing poll loop for live behavior.
  if (focusPeekInline) {
    focusPeekInline.innerHTML = focusPeekMarkup();
  }
  const overview = state.ecosystem;
  const fleetSummary = document.querySelector('#ecosystem-fleet-summary');
  if (fleetSummary) {
    fleetSummary.textContent = overview
      ? `${overview.fleet.total} servers | ${overview.fleet.withTelemetry} with telemetry | ${overview.fleet.withReport} analyzed`
      : 'Loading fleet';
  }

  const resource = document.querySelector('#eco-resource');
  const services = document.querySelector('#eco-services');
  const containers = document.querySelector('#eco-containers');
  const exposure = document.querySelector('#eco-exposure');
  const risk = document.querySelector('#eco-risk');
  const freshness = document.querySelector('#eco-freshness');
  if (!resource) return;

  if (!overview || overview.fleet.withTelemetry === 0) {
    const empty = '<p class="muted">Collect telemetry on at least one server to populate the fleet ecosystem.</p>';
    [resource, services, containers, exposure, risk, freshness].forEach((node) => {
      if (node) node.innerHTML = empty;
    });
    return;
  }

  const metricLabels = { cpuPercent: 'CPU', memoryPercent: 'Memory', diskPercent: 'Disk', ioWaitPercent: 'IO wait' };
  resource.innerHTML = Object.entries(overview.resourcePressure.metrics).map(([key, value]) => `
    <article class="eco-metric-row ${pressureClass(value.peak)}">
      <div class="row-title"><span>${escapeHtml(metricLabels[key] ?? key)}</span><strong>${value.average}% avg</strong></div>
      <div class="pressure-meter"><span style="width:${clampPercent(value.average)}%"></span></div>
      <p class="muted">Peak ${value.peak}% across fleet</p>
    </article>
  `).join('') + (overview.resourcePressure.hottestServer
    ? `<p class="muted">Hottest: ${escapeHtml(overview.resourcePressure.hottestServer.name)} (${overview.resourcePressure.hottestServer.cpu}% CPU / ${overview.resourcePressure.hottestServer.memory}% mem / ${overview.resourcePressure.hottestServer.disk}% disk)</p>`
    : '');

  const svc = overview.serviceEcosystem;
  services.innerHTML = `
    <div class="row-title"><span>Running / total</span><strong>${svc.running} / ${svc.running + svc.stopped}</strong></div>
    ${svc.roles.map((role) => `
      <article class="eco-role-row">
        <div class="row-title"><span>${escapeHtml(labelForStatus(role.role))}</span><strong>${role.running}/${role.total}</strong></div>
        <div class="pressure-meter"><span style="width:${clampPercent(role.total ? (role.running / role.total) * 100 : 0)}%"></span></div>
      </article>
    `).join('') || '<p class="muted">No services collected.</p>'}`;

  const cf = overview.containerFleet;
  containers.innerHTML = `
    <div class="eco-stat-grid">
      <div class="eco-stat ready"><span>Running</span><strong>${cf.running}</strong></div>
      <div class="eco-stat ${cf.restarting > 0 ? 'warn' : ''}"><span>Restarting</span><strong>${cf.restarting}</strong></div>
      <div class="eco-stat ${cf.stopped > 0 ? 'review' : ''}"><span>Stopped</span><strong>${cf.stopped}</strong></div>
    </div>
    ${cf.restartHotspots.length
      ? `<p class="muted">Restart hotspots</p>` + cf.restartHotspots.map((spot) => `
        <article class="eco-hotspot danger"><div class="row-title"><span>${escapeHtml(spot.server)} / ${escapeHtml(spot.name)}</span><strong>${spot.restarts}x</strong></div></article>
      `).join('')
      : '<p class="muted">No container restart hotspots.</p>'}`;

  const ex = overview.exposureSurface;
  exposure.innerHTML = `
    <div class="eco-stat-grid">
      <div class="eco-stat ${ex.publicPorts > 0 ? 'warn' : 'ready'}"><span>Public ports</span><strong>${ex.publicPorts}</strong></div>
      <div class="eco-stat ready"><span>Private ports</span><strong>${ex.privatePorts}</strong></div>
    </div>
    ${ex.highRiskExposed.length
      ? `<p class="muted">High-risk exposed</p>` + ex.highRiskExposed.map((item) => `
        <article class="eco-hotspot danger"><div class="row-title"><span>${escapeHtml(item.server)}</span><strong>:${escapeHtml(String(item.port))}</strong></div></article>
      `).join('')
      : '<p class="muted">No high-risk public listeners.</p>'}`;

  const rd = overview.riskDistribution;
  const severityTone = { critical: 'danger', high: 'warn', medium: 'review', low: 'ready' };
  risk.innerHTML = `
    <div class="eco-stat-grid">
      ${['critical', 'high', 'medium', 'low'].map((sev) => `
        <div class="eco-stat ${severityTone[sev]}"><span>${escapeHtml(labelForStatus(sev))}</span><strong>${rd.bySeverity[sev] ?? 0}</strong></div>
      `).join('')}
    </div>
    ${rd.byCategory.length
      ? rd.byCategory.map((cat) => `
        <article class="eco-role-row">
          <div class="row-title"><span>${escapeHtml(labelForStatus(cat.category))}</span><strong>${cat.count}</strong></div>
          <div class="pressure-meter"><span style="width:${clampPercent(rd.total ? (cat.count / rd.total) * 100 : 0)}%"></span></div>
        </article>
      `).join('')
      : '<p class="muted">No findings yet. Run analysis to populate risk distribution.</p>'}`;

  const fr = overview.freshness;
  const trend = fr.fleetTrend;
  freshness.innerHTML = `
    ${fr.servers.map((srv) => `
      <article class="eco-fresh-row ${srv.status === 'fresh' ? 'ready' : srv.status === 'stale' ? 'warn' : 'review'}">
        <div class="row-title"><span>${escapeHtml(srv.name)}</span><strong>${srv.ageMinutes === null ? 'No data' : `${srv.ageMinutes}m ago`}</strong></div>
      </article>
    `).join('')}
    <div class="eco-trend">
      <div class="row-title"><span>Fleet CPU trend</span><strong>${labelForStatus(fr.cpuDirection)}</strong></div>
      ${trend.status === 'ready'
        ? `<div class="spark-bars" aria-label="Fleet CPU trend">${trend.cpu.map((value) => `<span style="height:${clampPercent(value)}%"></span>`).join('')}</div>`
        : `<p class="muted">Fleet trend appears after ${trend.minPoints} collections (have ${trend.dataPoints}).</p>`}
    </div>`;
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function isTypingTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
}

function inspectionStepItems() {
  return state.inspectionWorkspace?.steps ?? [
    {
      id: 'authorize',
      label: 'Authorize',
      status: 'review',
      action: 'Load local inspection evidence.',
      evidence: ['Waiting for inspection workspace data.']
    }
  ];
}

function renderInspectionWorkspace() {
  if (!inspectionStepRail || !inspectionEvidencePanel) return;
  const workspace = state.inspectionWorkspace;
  const steps = inspectionStepItems();
  const active = steps.find((step) => step.id === state.activeInspectionStep) ?? steps[0];
  const server = workspace?.server ?? {
    name: activeServer()?.name ?? 'No server selected',
    mode: activeServer()?.mode ?? 'none',
    connectionStatus: activeServer()?.connection?.status ?? 'untested'
  };
  if (!steps.some((step) => step.id === state.activeInspectionStep)) {
    state.activeInspectionStep = active.id;
  }
  inspectionPackageStatus.textContent = state.inspectionPackageStatus;
  inspectionPackageSummary.textContent = workspace
    ? `${workspace.status} | ${server.name} | ${workspace.packageArtifacts?.length ?? 0} artifacts`
    : 'Load inspection workspace';
  inspectionStepRail.innerHTML = steps.map((step, index) => `
    <button class="inspection-step-card ${escapeHtml(step.status)} ${step.id === active.id ? 'is-selected' : ''}" data-inspection-step="${escapeHtml(step.id)}" type="button" aria-pressed="${step.id === active.id}">
      <span>${index + 1}</span>
      <strong>${escapeHtml(step.label)}</strong>
      <small>${escapeHtml(step.action)}</small>
      <em>${escapeHtml(step.status)}</em>
    </button>
  `).join('');
  inspectionEvidencePanel.innerHTML = `
    <div class="inspection-evidence-header">
      <span>${escapeHtml(workspace?.mode ?? 'local-authorized-inspection-workspace')}</span>
      <strong>${escapeHtml(active.label)}</strong>
      <p>${escapeHtml(active.action)}</p>
    </div>
    <div class="inspection-context-grid">
      <div><span>Server</span><strong>${escapeHtml(server.name)}</strong></div>
      <div><span>Mode</span><strong>${escapeHtml(server.mode)}</strong></div>
      <div><span>Connection</span><strong>${escapeHtml(server.connectionStatus)}</strong></div>
      <div><span>Workspace</span><strong>${escapeHtml(workspace?.status ?? 'review')}</strong></div>
    </div>
    <div class="inspection-evidence-list">
      ${active.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
    <div class="inspection-artifact-list">
      ${(workspace?.packageArtifacts ?? ['Markdown report', 'PDF handoff', 'Server runbook']).map((item) => `<code>${escapeHtml(item)}</code>`).join('')}
    </div>
    <div class="inspection-action-row">
      <button class="secondary-action" data-view="${active.id === 'package' ? 'release' : active.id === 'analyze' ? 'analysis' : active.id === 'collect' ? 'server-detail' : 'servers'}" type="button">${active.id === 'package' ? 'Open Release' : active.id === 'analyze' ? 'Open Analysis' : active.id === 'collect' ? 'Open Detail' : 'Open Servers'}</button>
      <button class="secondary-action" data-action-dock-command="copy-inspection-summary" type="button">Copy Summary</button>
    </div>
  `;
}

function setInspectionStep(stepId) {
  if (!inspectionStepItems().some((step) => step.id === stepId)) return;
  state.activeInspectionStep = stepId;
  state.inspectionPackageStatus = 'Ready';
  renderInspectionWorkspace();
}

async function copyInspectionPackageSummary() {
  const workspace = state.inspectionWorkspace;
  const server = workspace?.server ?? activeServer();
  const steps = inspectionStepItems();
  const summary = [
    'ServerLens Authorized Inspection',
    `Status: ${workspace?.status ?? 'review'}`,
    `Server: ${server?.name ?? 'No server selected'}`,
    `Mode: ${server?.mode ?? 'unknown'}`,
    `Connection: ${server?.connectionStatus ?? server?.connection?.status ?? 'untested'}`,
    `Steps: ${steps.map((step) => `${step.label}=${step.status}`).join(', ')}`,
    `Artifacts: ${(workspace?.packageArtifacts ?? ['Markdown report', 'PDF handoff', 'Server runbook']).join(', ')}`,
    'Boundary: explicit authorized telemetry only; no hidden discovery, enrichment, blocking, or remote modification.'
  ].join('\n');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary);
    } else {
      fallbackCopyText(summary);
    }
    state.inspectionPackageStatus = 'Copied inspection summary';
  } catch {
    fallbackCopyText(summary);
    state.inspectionPackageStatus = 'Copied inspection summary';
  }
  renderInspectionWorkspace();
}

function strategyIterationItems() {
  return state.strategyWorkspace?.iterations ?? [
    {
      id: 'strategy-01-baseline',
      label: '01 Baseline',
      status: 'review',
      plan: 'Load the 10-cycle strategy workspace.',
      execution: 'Waiting for local strategy evidence.',
      validation: 'Strategy evidence has not loaded yet.',
      evidence: ['Waiting for /api/delivery/strategy.']
    }
  ];
}

function compactEvidenceLabel(value, index) {
  const text = String(value ?? '').trim();
  const pathMatch = text.match(/(?:[A-Za-z]:)?(?:[./\\][\w .-]+)+/);
  if (pathMatch) {
    const parts = pathMatch[0].split(/[\\/]/).filter(Boolean);
    return parts.slice(-2).join('/');
  }
  const quoted = text.match(/[`"']([^`"']{2,36})[`"']/);
  if (quoted) return quoted[1];
  const words = text.replace(/[.:;].*$/, '').split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ') || `Evidence ${index + 1}`;
}

function compactStatusLabel(value) {
  const text = String(value ?? '').trim();
  const lower = text.toLowerCase();
  if (lower.includes('waiting') || lower.includes('load')) return 'Waiting';
  if (lower.includes('blocked')) return 'Blocked';
  if (lower.includes('fail')) return 'Review';
  if (lower.includes('validat') || lower.includes('done') || lower.includes('pass')) return 'Validated';
  if (lower.includes('package') || lower.includes('handoff')) return 'Packaged';
  if (lower.includes('added') || lower.includes('implemented') || lower.includes('built')) return 'Implemented';
  return compactEvidenceLabel(text, 0);
}

function renderStrategyWorkspace() {
  if (!strategyIterationRail || !strategyEvidencePanel) return;
  const workspace = state.strategyWorkspace;
  const iterations = strategyIterationItems();
  const active = iterations.find((item) => item.id === state.activeStrategyIteration) ?? iterations[0];
  state.activeStrategyIteration = active.id;
  strategyCopyStatus.textContent = state.strategyCopyStatus;
  strategySummary.textContent = workspace
    ? `${workspace.versionTarget} | ${workspace.summary.done} done, ${workspace.summary.review} review, ${workspace.summary.blocked} blocked`
    : 'Loading 10-cycle strategy evidence';
  strategyReferenceSummary.textContent = workspace
    ? workspace.githubReferences.join(', ')
    : 'Waiting for references';
  strategyIterationRail.innerHTML = iterations.map((item, index) => `
    <button class="strategy-iteration-card ${escapeHtml(item.status)} ${item.id === active.id ? 'is-selected' : ''}" data-strategy-iteration="${escapeHtml(item.id)}" type="button" aria-pressed="${item.id === active.id}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <small>${escapeHtml(item.status)}</small>
    </button>
  `).join('');
  strategyEvidencePanel.innerHTML = `
    <div class="strategy-evidence-header">
      <span>${escapeHtml(workspace?.mode ?? 'local-10-cycle-strategy-workspace')}</span>
      <h3>${escapeHtml(active.label)}</h3>
    </div>
    <div class="strategy-evidence-grid">
      <div><span>Execution</span><strong title="${escapeHtml(active.execution)}">${escapeHtml(compactStatusLabel(active.execution))}</strong></div>
      <div><span>Validation</span><strong title="${escapeHtml(active.validation)}">${escapeHtml(compactStatusLabel(active.validation))}</strong></div>
    </div>
    <div class="strategy-evidence-list">
      ${(active.evidence ?? []).slice(0, 4).map((item, index) => `<span title="${escapeHtml(item)}">${escapeHtml(compactEvidenceLabel(item, index))}</span>`).join('')}
    </div>
    <div class="strategy-reference-grid">
      ${(workspace?.githubReferences ?? []).slice(0, 4).map((item) => `<code title="${escapeHtml(item)}">${escapeHtml(compactEvidenceLabel(item, 0))}</code>`).join('')}
    </div>
    <div class="strategy-action-row">
      <button class="secondary-action" data-view="${active.id.includes('package') || active.id.includes('validation') ? 'release' : active.id.includes('ui') ? 'interaction' : 'inspection'}" type="button">Open Evidence</button>
      <button class="secondary-action" data-action-dock-command="copy-strategy-summary" type="button">Copy Summary</button>
    </div>
  `;
}

function setStrategyIteration(iterationId) {
  if (!strategyIterationItems().some((item) => item.id === iterationId)) return;
  state.activeStrategyIteration = iterationId;
  state.strategyCopyStatus = 'Ready';
  renderStrategyWorkspace();
}

async function copyStrategySummary() {
  const workspace = state.strategyWorkspace;
  const iterations = strategyIterationItems();
  const active = iterations.find((item) => item.id === state.activeStrategyIteration) ?? iterations[0];
  const summary = workspace
    ? [
        'ServerLens Strategy Iteration Summary',
        `Version: ${workspace.versionTarget}`,
        `Status: ${workspace.status}`,
        `Iteration: ${active.label}`,
        `Plan: ${active.plan}`,
        `Execution: ${active.execution}`,
        `Validation: ${active.validation}`,
        `Evidence: ${(active.evidence ?? []).join(' | ')}`,
        `References: ${workspace.githubReferences.join(', ')}`
      ].join('\n')
    : 'ServerLens strategy workspace is still loading.';
  try {
    await navigator.clipboard.writeText(summary);
    state.strategyCopyStatus = 'Copied strategy summary';
  } catch {
    state.strategyCopyStatus = 'Copied strategy summary';
  }
  renderStrategyWorkspace();
}

function renderActionDock() {
  if (!actionDock || !dockCommandGrid) return;
  actionDock.hidden = !state.actionDockOpen;
  actionDock.classList.toggle('is-open', state.actionDockOpen);
  actionDock.classList.toggle('is-expanded', state.actionDockSnap === 'expanded');
  actionDock.classList.toggle('is-compact', state.actionDockSnap === 'compact');
  actionDock.dataset.snap = state.actionDockSnap;
  document.body.dataset.dockSnap = state.actionDockOpen ? state.actionDockSnap : 'closed';
  actionDockToggle.setAttribute('aria-expanded', String(state.actionDockOpen));
  dockCommandGrid.innerHTML = actionDockCommands().map((command) => `
    <button class="dock-command ${escapeHtml(command.tone)}" data-slot="command-item" data-action-dock-command="${escapeHtml(command.id)}" title="${escapeHtml(command.detail)}" type="button">
      <span>${escapeHtml(command.label)}</span>
      <strong>${escapeHtml(command.title)}</strong>
      <em>${escapeHtml(command.shortcut)}</em>
    </button>
  `).join('');
}

function actionDockCommands() {
  const server = activeServer();
  const report = state.latestReport ?? server?.latestReport;
  return [
    {
      id: 'collect-active',
      tone: 'neutral',
      label: 'Collect',
      title: server ? server.name : 'No server',
      detail: server ? 'Refresh authorized telemetry' : 'Add an asset before collection',
      shortcut: 'C'
    },
    {
      id: 'analyze-active',
      tone: 'primary',
      label: 'Analyze',
      title: state.activeAnalysisDepth,
      detail: `${state.activeAnalysisPreset} | ${state.activeAnalysisTimeRange}`,
      shortcut: 'A'
    },
    {
      id: 'open-readiness',
      tone: 'neutral',
      label: 'Gate',
      title: state.deliveryReadiness?.status ?? 'review',
      detail: 'Run commercial readiness checks',
      shortcut: 'G'
    },
    {
      id: 'open-checklist',
      tone: 'neutral',
      label: 'Handoff',
      title: state.handoffChecklist?.status ?? 'review',
      detail: 'Open first-run review steps',
      shortcut: 'H'
    },
    {
      id: 'open-focus-peek',
      tone: 'neutral',
      label: 'Peek',
      title: report ? `${report.score} score` : 'Active server',
      detail: 'Open contextual summary',
      shortcut: 'P'
    },
    {
      id: 'open-ecosystem',
      tone: 'primary',
      label: 'Ecosystem',
      title: state.ecosystem ? `${state.ecosystem.fleet.withTelemetry} live` : 'Fleet',
      detail: 'Open the fleet ecosystem overview',
      shortcut: 'E'
    },
    {
      id: 'copy-inspection-summary',
      tone: 'primary',
      label: 'Inspect',
      title: state.inspectionWorkspace?.status ?? 'review',
      detail: 'Copy authorized inspection summary',
      shortcut: 'I'
    },
    {
      id: 'copy-strategy-summary',
      tone: 'primary',
      label: 'Strategy',
      title: state.strategyWorkspace?.versionTarget ?? '9.0.0',
      detail: 'Copy 10-cycle strategy summary',
      shortcut: 'T'
    },
    {
      id: 'open-release',
      tone: 'neutral',
      label: 'Release',
      title: '9.0',
      detail: 'Review readiness workspace',
      shortcut: 'R'
    }
  ];
}

async function runActionDockCommand(command) {
  if (command === 'open-dock') {
    openActionDock('compact');
    return;
  }
  if (command === 'collect-active') {
    await collectActiveServer();
    openActionDock(state.actionDockSnap);
    return;
  }
  if (command === 'analyze-active') {
    await analyzeActiveServer();
    return;
  }
  if (command === 'open-readiness') {
    state.deliveryReadiness = await api('/api/delivery/readiness');
    renderDeliveryReadiness(state.deliveryReadiness);
    renderReleaseWorkspace();
    renderEcosystem();
    setView('settings');
    openActionDock('expanded');
    return;
  }
  if (command === 'open-checklist') {
    state.handoffChecklist = await api('/api/delivery/checklist');
    renderHandoffChecklist(state.handoffChecklist);
    renderEcosystem();
    setView('settings');
    openActionDock('expanded');
    return;
  }
  if (command === 'open-focus-peek') {
    openFocusPeek('active-server');
    return;
  }
  if (command === 'open-ecosystem') {
    setView('ecosystem');
    openActionDock(state.actionDockSnap);
    return;
  }
  if (command === 'copy-inspection-summary') {
    setView('inspection');
    await copyInspectionPackageSummary();
    openActionDock(state.actionDockSnap);
    return;
  }
  if (command === 'copy-strategy-summary') {
    setView('strategy');
    await copyStrategySummary();
    openActionDock(state.actionDockSnap);
    return;
  }
  if (command === 'open-release') {
    setView('release');
    closeActionDock();
  }
}

function openActionDock(snap = 'compact') {
  state.actionDockOpen = true;
  state.actionDockSnap = snap;
  renderActionDock();
}

function closeActionDock() {
  state.actionDockOpen = false;
  document.body.dataset.dockSnap = 'closed';
  renderActionDock();
}

function toggleActionDockSnap() {
  state.actionDockSnap = state.actionDockSnap === 'expanded' ? 'compact' : 'expanded';
  renderActionDock();
}

function openFocusPeek(context = 'active-server') {
  state.focusPeekOpen = true;
  state.focusPeekContext = context;
  renderFocusPeek();
}

function closeFocusPeek() {
  state.focusPeekOpen = false;
  renderFocusPeek();
}

function renderFocusPeek() {
  if (!focusPeek || !focusPeekContent) return;
  focusPeek.hidden = !state.focusPeekOpen;
  focusPeek.classList.toggle('is-open', state.focusPeekOpen);
  focusPeekContent.innerHTML = focusPeekMarkup();
}

function focusPeekMarkup() {
  const server = activeServer();
  const snapshot = server?.latestSnapshot;
  const report = state.latestReport ?? server?.latestReport;
  const findings = report?.findings ?? [];
  return `
    <div class="focus-peek-summary">
      <div><span>Server</span><strong>${escapeHtml(server?.name ?? 'No server')}</strong></div>
      <div><span>Score</span><strong>${escapeHtml(report?.score ?? 'NA')}</strong></div>
      <div><span>Evidence</span><strong>${findings.length}</strong></div>
    </div>
    <div class="kv-list">
      <div class="kv-row"><span>Host</span><strong>${escapeHtml(server ? `${server.host}:${server.port ?? 22}` : 'No asset')}</strong></div>
      <div class="kv-row"><span>Collection</span><strong>${snapshot ? formatTime(snapshot.collectedAt) : 'No telemetry'}</strong></div>
      <div class="kv-row"><span>Report</span><strong>${report ? formatTime(report.createdAt) : 'No report'}</strong></div>
    </div>
    <div class="peek-finding-list">
      ${findings.slice(0, 3).map((finding) => `
        <article>
          <div class="row-title">
            <strong>${escapeHtml(finding.title)}</strong>
            <span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
          </div>
          <p>${escapeHtml(finding.recommendation)}</p>
        </article>
      `).join('') || '<p class="muted">Run analysis to populate focus evidence.</p>'}
    </div>
  `;
}

function bindTactileCards() {
  document.querySelectorAll('[data-tactile-card], .dock-command, .touch-queue-card').forEach((card) => {
    if (card.dataset.tactileBound === 'true') return;
    card.dataset.tactileBound = 'true';
    card.addEventListener('pointerdown', () => card.classList.add('is-pressed'));
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach((eventName) => {
      card.addEventListener(eventName, () => card.classList.remove('is-pressed'));
    });
  });
}

function bindIosInteractions() {
  const interactiveSelector = [
    '[data-tactile-card]',
    '.analysis-choice-card',
    '.experience-card',
    '.scenario-card',
    '.inspection-step-card',
    '.strategy-iteration-card',
    '.release-mode-card',
    '.release-readiness-card',
    '.dock-command',
    '.touch-queue-card',
    '.server-item',
    '.history-item'
  ].join(', ');

  document.querySelectorAll(interactiveSelector).forEach((card) => {
    if (card.dataset.iOSBound === 'true') return;
    card.dataset.iOSBound = 'true';
    card.classList.add('ios-interactive');
    card.addEventListener('pointerdown', (event) => {
      card.classList.add('is-pressed');
      updateIosPointer(card, event);
    });
    card.addEventListener('pointermove', (event) => {
      if (!card.classList.contains('is-pressed')) return;
      updateIosPointer(card, event);
    });
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach((eventName) => {
      card.addEventListener(eventName, () => resetIosPointer(card));
    });
  });
}

function updateIosPointer(card, event) {
  const rect = card.getBoundingClientRect();
  const x = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;
  const y = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
  card.style.setProperty('--press-x', `${Math.round(x * 100)}%`);
  card.style.setProperty('--press-y', `${Math.round(y * 100)}%`);
  card.style.setProperty('--tilt-x', `${((0.5 - y) * 2.4).toFixed(2)}deg`);
  card.style.setProperty('--tilt-y', `${((x - 0.5) * 2.8).toFixed(2)}deg`);
}

function resetIosPointer(card) {
  card.classList.remove('is-pressed');
  card.style.setProperty('--press-x', '50%');
  card.style.setProperty('--press-y', '50%');
  card.style.setProperty('--tilt-x', '0deg');
  card.style.setProperty('--tilt-y', '0deg');
}

function bindSwipeRails() {
  document.querySelectorAll('.interaction-swipe-rail, .strategy-iteration-rail, .inspection-step-rail, .scenario-card-grid, .experience-stepper, .release-mode-strip').forEach((rail) => {
    if (rail.dataset.swipeBound === 'true') return;
    rail.dataset.swipeBound = 'true';
    rail.classList.add('ios-snap-rail');
    updateRailEdgeState(rail);
    rail.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        rail.scrollLeft += event.deltaY;
      }
    }, { passive: false });
    rail.addEventListener('scroll', () => {
      window.requestAnimationFrame(() => updateRailEdgeState(rail));
    }, { passive: true });
  });
}

function updateRailEdgeState(rail) {
  const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
  rail.classList.toggle('is-at-start', rail.scrollLeft <= 4);
  rail.classList.toggle('is-at-end', rail.scrollLeft >= maxScroll - 4);
  rail.classList.toggle('is-scrollable', maxScroll > 4);
}

function renderDeliveryEvidence(evidence) {
  deliveryEvidence.innerHTML = `
    <div class="kv-row"><span>Product</span><strong>${escapeHtml(evidence.product)}</strong></div>
    <div class="kv-row"><span>Mode</span><strong>${escapeHtml(evidence.deliveryMode)}</strong></div>
    <div class="kv-row"><span>Package</span><strong>${escapeHtml(evidence.packagePath)}</strong></div>
    <div class="kv-row"><span>Checks</span><strong>${escapeHtml(evidence.verificationCommands.join(', '))}</strong></div>
    <div class="kv-row"><span>References</span><strong>${escapeHtml(evidence.githubReferences.join(', '))}</strong></div>
  `;
}

function renderDeliveryReadiness(readiness) {
  deliveryReadiness.innerHTML = `
    <div class="readiness-summary">
      <div><span>Status</span><strong>${escapeHtml(readiness.status)}</strong></div>
      <div><span>Passed</span><strong>${readiness.summary.pass}</strong></div>
      <div><span>Warnings</span><strong>${readiness.summary.warn}</strong></div>
      <div><span>Failed</span><strong>${readiness.summary.fail}</strong></div>
    </div>
    <div class="readiness-check-list">
      ${readiness.checks.map((check) => `
        <article class="readiness-check ${escapeHtml(check.status)}">
          <div class="row-title">
            <span>${escapeHtml(check.label)}</span>
            <span class="status-pill">${escapeHtml(check.status)}</span>
          </div>
          <p class="muted">${escapeHtml(check.category)} | ${escapeHtml(check.evidence.slice(0, 2).join(' | '))}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderRetentionMaintenance(result) {
  retentionRunResult.innerHTML = `
    <div><span>Reports</span><strong>${result.deleted.reports}</strong></div>
    <div><span>Jobs</span><strong>${result.deleted.analysisJobs}</strong></div>
    <div><span>Alerts</span><strong>${result.deleted.alerts}</strong></div>
    <div><span>Retention</span><strong>${result.retentionDays}d</strong></div>
  `;
}

function renderHandoffChecklist(checklist) {
  handoffChecklist.innerHTML = `
    <div class="readiness-summary">
      <div><span>Status</span><strong>${escapeHtml(checklist.status)}</strong></div>
      <div><span>Ready</span><strong>${checklist.summary.ready}</strong></div>
      <div><span>Review</span><strong>${checklist.summary.review}</strong></div>
      <div><span>Blocked</span><strong>${checklist.summary.blocked}</strong></div>
    </div>
    <div class="handoff-step-list">
      ${checklist.steps.map((step) => `
        <article class="handoff-step ${escapeHtml(step.status)}">
          <div class="row-title">
            <span>${escapeHtml(step.label)}</span>
            <span class="status-pill">${escapeHtml(step.status)}</span>
          </div>
          <p>${escapeHtml(step.action)}</p>
          <ul>
            ${step.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      `).join('')}
    </div>
  `;
}

function renderUiExperienceAudit(audit) {
  uiExperienceAudit.innerHTML = `
    <div class="readiness-summary" data-mode="${escapeHtml(audit.mode ?? 'local-ui-experience-audit')}">
      <div><span>Status</span><strong>${escapeHtml(audit.status)}</strong></div>
      <div><span>Passed</span><strong>${audit.summary.pass}</strong></div>
      <div><span>Warnings</span><strong>${audit.summary.warn}</strong></div>
      <div><span>Failed</span><strong>${audit.summary.fail}</strong></div>
    </div>
    <div class="ui-audit-check-list">
      ${audit.checks.map((check) => `
        <article class="ui-audit-check ${escapeHtml(check.status)}">
          <div class="row-title">
            <strong>${escapeHtml(check.label)}</strong>
            <span class="status-badge">${escapeHtml(check.category)}</span>
          </div>
          <p class="muted">${escapeHtml(check.id)}</p>
          <ul>
            ${check.evidence.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      `).join('')}
    </div>
  `;
}

function openCommandPalette() {
  commandPalette.hidden = false;
  commandPaletteButton.setAttribute('aria-expanded', 'true');
  state.commandQuery = '';
  state.commandActiveIndex = 0;
  commandInput.value = '';
  renderCommandPalette();
  requestAnimationFrame(() => commandInput.focus());
}

function closeCommandPalette() {
  commandPalette.hidden = true;
  commandPaletteButton.setAttribute('aria-expanded', 'false');
  commandPaletteButton.focus();
}

function renderCommandPalette() {
  commandCache = filterCommands(commandItems(), state.commandQuery, 12);
  state.commandActiveIndex = Math.min(state.commandActiveIndex, Math.max(commandCache.length - 1, 0));

  commandResults.innerHTML = commandCache.map((command, index) => `
    <button class="command-result ${index === state.commandActiveIndex ? 'is-active' : ''}" data-slot="command-item" data-selected="${index === state.commandActiveIndex}" aria-selected="${index === state.commandActiveIndex}" data-command-index="${index}" type="button" role="option">
      <span>${escapeHtml(command.group)}</span>
      <strong>${escapeHtml(command.title)}</strong>
      <small>${escapeHtml(command.detail)}</small>
    </button>
  `).join('') || '<p class="muted">No commands match the current search.</p>';

  commandResults.querySelectorAll('[data-command-index]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runCommand(button.dataset.commandIndex);
    });
  });
  hydrateRetroUiPrimitives();
}

function setCommandActiveIndex(index) {
  if (!commandCache.length) return;
  state.commandActiveIndex = (index + commandCache.length) % commandCache.length;
  renderCommandPalette();
  commandResults.querySelector(`[data-command-index="${state.commandActiveIndex}"]`)?.scrollIntoView({
    block: 'nearest'
  });
}

function commandItems() {
  const views = Object.entries(viewTitles).map(([view, title]) => ({
    group: 'Navigate',
    title: `Open ${title}`,
    detail: `Switch to ${title}`,
    run: async () => setView(view)
  }));

  const serverCommands = activeServers().flatMap((server) => [
    {
      group: 'Server',
      title: `Open ${server.name}`,
      detail: `${server.host} detail`,
      run: async () => {
        state.activeServerId = server.id;
        render();
        setView('server-detail');
      }
    },
    {
      group: 'Collect',
      title: `Collect ${server.name}`,
      detail: `${server.host} telemetry`,
      run: async () => {
        state.activeServerId = server.id;
        await collectServer(server.id);
      }
    },
    {
      group: 'Analyze',
      title: `Analyze ${server.name}`,
      detail: `${state.activeAnalysisPreset} | ${state.activeAnalysisDepth} | ${state.activeAnalysisTimeRange}`,
      run: async () => {
        state.activeServerId = server.id;
        analysisTargetSelect.value = server.id;
        await analyzeActiveServer();
      }
    }
  ]);

  const report = state.latestReport ?? activeServer()?.latestReport;
  const reportCommands = report ? [
    {
      group: 'Report',
      title: 'Copy current report',
      detail: `${report.summary.hostname} Markdown`,
      run: async () => copyMarkdownReport(report)
    },
    {
      group: 'Report',
      title: 'Copy server runbook',
      detail: `${activeServer()?.name ?? report.summary.hostname} handoff Markdown`,
      run: async () => copyServerRunbook(activeServer())
    },
    {
      group: 'Report',
      title: 'Open PDF handoff',
      detail: `${report.summary.hostname} print view`,
      run: async () => openPrintReport(report)
    }
  ] : [];

  const statusCommands = [
    {
      group: 'Status',
      title: 'Refresh status page preview',
      detail: 'Local redacted service summary',
      run: async () => {
        state.statusPage = await api('/api/status-page');
        renderStatusPagePreview();
        setView('reports');
      }
    }
  ];

  const maintenanceCommands = [
    {
      group: 'Maintenance',
      title: 'Run retention cleanup',
      detail: `${state.settings?.retentionDays ?? 30} days, latest evidence preserved`,
      run: async () => {
        const result = await api('/api/maintenance/retention', {
          method: 'POST',
          body: {}
        });
        renderRetentionMaintenance(result);
        retentionRunStatus.textContent = `Kept latest reports, cutoff ${formatDate(result.cutoff)}`;
        await refresh();
        setView('settings');
      }
    }
  ];

  const deliveryCommands = [
    {
      group: 'Inspection',
      title: 'Open Authorized Inspection',
      detail: 'Guided preflight, collection, analysis, and package evidence',
      run: async () => {
        setView('inspection');
        renderInspectionWorkspace();
      }
    },
    {
      group: 'Inspection',
      title: 'Copy inspection summary',
      detail: `${state.inspectionWorkspace?.status ?? 'review'} local package summary`,
      run: async () => {
        setView('inspection');
        await copyInspectionPackageSummary();
      }
    },
    ...inspectionStepItems().map((step) => ({
      group: 'Inspection',
      title: `Inspect ${step.label}`,
      detail: `${step.status} | ${step.action}`,
      run: async () => {
        setView('inspection');
        setInspectionStep(step.id);
      }
    })),
    {
      group: 'Strategy',
      title: 'Open 10-cycle strategy',
      detail: `${state.strategyWorkspace?.versionTarget ?? '9.0.0'} plan, execution, validation`,
      run: async () => {
        setView('strategy');
        renderStrategyWorkspace();
      }
    },
    {
      group: 'Strategy',
      title: 'Copy strategy summary',
      detail: `${state.strategyWorkspace?.summary?.done ?? 0} completed strategy iterations`,
      run: async () => {
        setView('strategy');
        await copyStrategySummary();
      }
    },
    ...strategyIterationItems().map((iteration) => ({
      group: 'Strategy',
      title: `Review ${iteration.label}`,
      detail: `${iteration.status} | ${iteration.validation}`,
      run: async () => {
        setView('strategy');
        setStrategyIteration(iteration.id);
      }
    })),
    {
      group: 'Ecosystem',
      title: 'Open Ecosystem Overview',
      detail: 'Fleet resource pressure, services, containers, exposure, and risk',
      run: async () => {
        setView('ecosystem');
      }
    },
    {
      group: 'Delivery',
      title: 'Run readiness gate',
      detail: 'Commercial handoff checks',
      run: async () => {
        state.deliveryReadiness = await api('/api/delivery/readiness');
        renderDeliveryReadiness(state.deliveryReadiness);
        setView('settings');
      }
    },
    {
      group: 'Delivery',
      title: 'Open handoff checklist',
      detail: 'First-run client review steps',
      run: async () => {
        state.handoffChecklist = await api('/api/delivery/checklist');
        renderHandoffChecklist(state.handoffChecklist);
        setView('settings');
      }
    },
    {
      group: 'Delivery',
      title: 'Run UI experience audit',
      detail: 'Material, scroll, controls, responsive evidence',
      run: async () => {
        state.uiExperienceAudit = await api('/api/delivery/ui-audit');
        renderUiExperienceAudit(state.uiExperienceAudit);
        setView('settings');
      }
    }
  ];

  return [...views, ...serverCommands, ...reportCommands, ...statusCommands, ...maintenanceCommands, ...deliveryCommands];
}

async function runCommand(index) {
  const command = commandCache[Number(index)];
  if (!command) return;
  closeCommandPalette();
  await command.run();
}

function renderCommandList(commands = []) {
  if (!commands.length) return '';
  return `
    <div class="command-list">
      ${commands.slice(0, 3).map((command) => `<code>${escapeHtml(command)}</code>`).join('')}
    </div>
  `;
}

function renderAnalysisTargetCards() {
  const servers = activeServers();
  analysisTargetCards.innerHTML = servers.map((server) => {
    const snapshot = server.latestSnapshot;
    const report = server.latestReport;
    const selected = server.id === state.activeServerId;
    return `
      <button class="analysis-choice-card target-choice-card ${selected ? 'is-selected' : ''}" data-analysis-target-card="${escapeHtml(server.id)}" type="button" aria-pressed="${selected}">
        <span class="target-status ${scoreClass(report?.score)}"></span>
        <strong>${escapeHtml(server.name)}</strong>
        <span>${escapeHtml(server.host)}:${server.port ?? 22}</span>
        <small>${snapshot ? `CPU ${snapshot.resources.cpuPercent}% | Mem ${snapshot.resources.memoryPercent}%` : 'No telemetry yet'}</small>
      </button>
    `;
  }).join('') || '<p class="muted">Add an authorized server before building a run.</p>';
}

function renderEvidenceTrackers(snapshot, report) {
  const markup = evidenceTrackerMarkup(snapshot, report);
  analysisEvidenceTracker.innerHTML = markup;
  detailEvidenceTracker.innerHTML = markup;
  reportEvidenceTracker.innerHTML = markup;
}

function evidenceTrackerMarkup(snapshot, report) {
  const findings = report?.findings?.length ?? 0;
  const steps = [
    {
      key: 'collect',
      label: 'Collect',
      detail: snapshot ? formatTime(snapshot.collectedAt) : 'Waiting for telemetry',
      state: snapshot ? 'done' : 'active'
    },
    {
      key: 'analyze',
      label: 'Analyze',
      detail: state.analysisRunning ? 'Running local rules' : report ? `${report.analysisScope?.preset ?? 'custom'} scope` : 'Ready after collection',
      state: state.analysisRunning ? 'active' : report ? 'done' : snapshot ? 'active' : 'pending'
    },
    {
      key: 'findings',
      label: 'Findings',
      detail: report ? `${findings} evidence-backed` : 'No report yet',
      state: report ? 'done' : 'pending'
    },
    {
      key: 'report',
      label: 'Report',
      detail: report ? `${report.score} score` : 'Generated after analysis',
      state: report ? 'done' : 'pending'
    },
    {
      key: 'handoff',
      label: 'Handoff',
      detail: report ? outputCopy[state.activeOutputFormat][0] : 'Choose output',
      state: report ? 'active' : 'pending'
    }
  ];

  return steps.map((step, index) => `
    <article class="evidence-step ${step.state}" data-evidence-step="${step.key}">
      <span class="evidence-step-index">${index + 1}</span>
      <div>
        <strong>${escapeHtml(step.label)}</strong>
        <span>${escapeHtml(step.detail)}</span>
      </div>
    </article>
  `).join('');
}

function openServerInspector(serverId) {
  state.inspectorServerId = serverId || state.activeServerId;
  state.inspectorOpen = true;
  renderServerInspector();
}

function closeServerInspector() {
  state.inspectorOpen = false;
  serverInspector.hidden = true;
}

function renderServerInspector() {
  if (!state.inspectorOpen) {
    serverInspector.hidden = true;
    return;
  }
  const server = state.servers.find((item) => item.id === state.inspectorServerId) ?? activeServer();
  if (!server) {
    serverInspectorContent.innerHTML = '<p class="muted">No server selected.</p>';
    serverInspector.hidden = false;
    return;
  }

  const snapshot = server.latestSnapshot;
  const report = server.latestReport;
  const findings = report?.findings ?? [];
  const evidence = findings.slice(0, 3);
  serverInspector.hidden = false;
  serverInspectorContent.innerHTML = `
    <section class="inspector-summary">
      <div>
        <span>Server</span>
        <strong>${escapeHtml(server.name)}</strong>
      </div>
      <div>
        <span>Score</span>
        <strong>${report?.score ?? 'NA'}</strong>
      </div>
      <div>
        <span>Mode</span>
        <strong>${escapeHtml(server.mode ?? 'demo')}</strong>
      </div>
    </section>
    <div class="kv-list inspector-kv">
      <div class="kv-row"><span>Host</span><strong>${escapeHtml(server.host)}:${server.port ?? 22}</strong></div>
      <div class="kv-row"><span>Connection</span><strong>${escapeHtml(server.connection?.status ?? 'untested')}</strong></div>
      <div class="kv-row"><span>Last collect</span><strong>${snapshot ? formatTime(snapshot.collectedAt) : 'No telemetry'}</strong></div>
      <div class="kv-row"><span>Latest report</span><strong>${report ? formatTime(report.createdAt) : 'No report'}</strong></div>
    </div>
    <div class="evidence-tracker inspector-tracker">
      ${evidenceTrackerMarkup(snapshot, report)}
    </div>
    <section class="inspector-section">
      <div class="section-heading">
        <h2>Latest Evidence</h2>
        <span>${findings.length} findings</span>
      </div>
      ${evidence.map((finding) => `
        <article class="inspector-evidence">
          <div class="row-title">
            <span>${escapeHtml(finding.title)}</span>
            <span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
          </div>
          <p class="muted">${escapeHtml(finding.evidence.join(' '))}</p>
        </article>
      `).join('') || '<p class="muted">Run analysis to populate evidence.</p>'}
    </section>
    <div class="inspector-actions">
      <button class="secondary-action" data-view="server-detail" type="button">Open Detail</button>
      <button class="secondary-action" data-view="analysis" type="button">Build Run</button>
      <button class="primary-action" data-view="reports" type="button">Review Report</button>
    </div>
  `;
}

async function copyMarkdownReport(report) {
  const exported = await api(`/api/reports/${report.id}/markdown`);
  await navigator.clipboard?.writeText(exported.markdown);
  exportReportButton.textContent = 'Copied';
  setTimeout(() => {
    exportReportButton.textContent = 'Export Markdown';
  }, 1200);
}

async function copyServerRunbook(server) {
  if (!server) return;
  const exported = await api(`/api/servers/${server.id}/runbook/markdown`);
  await navigator.clipboard?.writeText(exported.markdown);
  exportRunbookButton.textContent = 'Copied';
  setTimeout(() => {
    exportRunbookButton.textContent = 'Export Runbook';
  }, 1200);
}

function openPrintReport(report) {
  window.open(`/api/reports/${report.id}/print`, '_blank', 'noopener');
}

function renderAnalysisControls() {
  const active = activeServers().find((server) => server.id === state.activeServerId) ?? activeServers()[0] ?? null;
  analysisTargetSelect.innerHTML = activeServers().map((server) => `
    <option value="${escapeHtml(server.id)}">${escapeHtml(server.name)} | ${escapeHtml(server.host)}</option>
  `).join('');
  if (active && analysisTargetSelect.value !== active.id) {
    analysisTargetSelect.value = active.id;
  }
  if (analysisTimeRangeSelect.value !== state.activeAnalysisTimeRange) {
    analysisTimeRangeSelect.value = state.activeAnalysisTimeRange;
  }
  document.querySelectorAll('[data-analysis-preset]').forEach((button) => {
    const selected = button.dataset.analysisPreset === state.activeAnalysisPreset;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-analysis-depth]').forEach((button) => {
    const selected = button.dataset.analysisDepth === state.activeAnalysisDepth;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-analysis-output-card]').forEach((button) => {
    const selected = button.dataset.analysisOutputCard === state.activeOutputFormat;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = state.analysisRunning;
  });
  if (outputFormatSelect.value !== state.activeOutputFormat) {
    outputFormatSelect.value = state.activeOutputFormat;
  }
  renderAnalysisTargetCards();
  const checkedModules = [...document.querySelectorAll('input[name="module"]:checked')].map((input) => moduleLabels[input.value]);
  const [presetLabel] = presetCopy[state.activeAnalysisPreset] ?? presetCopy.custom;
  const [depthLabel] = depthCopy[state.activeAnalysisDepth] ?? depthCopy.standard;
  analysisRunSummary.textContent = `${presetLabel} | ${depthLabel} | ${checkedModules.length} modules`;
}

function applyAnalysisPreset(presetName) {
  state.activeAnalysisPreset = presetName;
  const preset = analysisPresets[presetName];
  if (preset) {
    const modules = new Set(preset.modules);
    document.querySelectorAll('input[name="module"]').forEach((input) => {
      input.checked = modules.has(input.value);
    });
    state.activeAnalysisDepth = preset.depth;
    state.activeAnalysisTimeRange = preset.timeRange;
  }
  renderAnalysisControls();
}

function activeServer() {
  const active = activeServers();
  return state.servers.find((server) => server.id === state.activeServerId) ?? active[0] ?? null;
}

function analysisTargetServer() {
  return activeServers().find((server) => server.id === analysisTargetSelect.value) ?? activeServer();
}

function activeServers() {
  return state.servers.filter((server) => !server.archived);
}

function scoreClass(score = 100) {
  if (score < 65) return 'danger';
  if (score < 85) return 'warn';
  return '';
}

function severityDotClass(severity) {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warn';
  return '';
}

function statusSeverityClass(status) {
  if (status === 'major-incident') return 'critical';
  if (status === 'degraded') return 'high';
  return 'low';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? 'Request failed');
  }
  return payload;
}

function showSkeletons() {
  if (activeServers().length > 0) return;
  metricStrip.innerHTML = '<div class="metric skeleton"></div><div class="metric skeleton"></div><div class="metric skeleton"></div><div class="metric skeleton"></div>';
  serverList.innerHTML = '<div class="server-item skeleton"></div><div class="server-item skeleton"></div>';
}

