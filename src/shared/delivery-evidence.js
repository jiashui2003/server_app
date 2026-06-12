import path from 'node:path';

export function buildDeliveryEvidence(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const packagePath = options.packagePath ?? path.join(projectRoot, 'dist', 'win-unpacked', 'ServerLens.exe');
  const uiExperienceAudit = buildUiExperienceAudit({ generatedAt });
  const pageExperienceReadiness = buildPageExperienceReadiness({ generatedAt });

  return {
    product: 'ServerLens',
    deliveryMode: 'local-first desktop',
    generatedAt,
    packagePath,
    capabilities: [
      'demo fleet without external network calls',
      'server add, edit, archive, and restore lifecycle',
      'server archive and restore lifecycle',
      'authorized SSH agent/key telemetry',
      'custom health, security, runtime, ecosystem, logs, network, and performance analysis',
      'evidence-backed findings with defensive diagnostic commands',
      'risk event timeline for evidence-backed security review',
      'security source review for collected authentication and connection evidence',
      'redacted evidence appendix for commercial report review',
      'first-run handoff checklist for client package review',
      'report remediation checklist with acceptance criteria',
      'server runbook Markdown export for handoff operations',
      'service topology and runtime inventory',
      'local alert inbox with acknowledgement persistence',
      'local UI experience audit for material, scrolling, controls, and responsive review',
      'local UI visual evidence for desktop and mobile screenshot review',
      'commercial interaction polish with card run builder, evidence tracker, and server inspector',
      'release readiness workspace for client handoff review',
      'iOS-inspired Interaction Studio with tactile cards, swipe rail, Action Dock, and Focus Peek',
      'guided Experience Deck for client walkthrough, presentation mode, motion intensity, and density controls',
      'Scenario Board with selectable cards, pinned scenarios, copyable summaries, and keyboard shortcuts',
      'Authorized Inspection Workspace with guided preflight, collection, analysis, and package evidence',
      '10-cycle Strategy Iteration Workspace with plan, execution, validation, and handoff evidence',
      'ServerLens 9.0 RetroUI Card clarity redesign with simplified topbar, quieter reference strip, three-signal live monitor, compact cards, scroll-safe workspaces, and wrapped evidence text',
      'ServerLens 10.0 page-by-page operation summary with primary action, evidence state, and next step for every view',
      'Markdown and print-ready PDF handoff'
    ],
    verificationCommands: [
      'npm.cmd test',
      'npm.cmd run build',
      'npm.cmd run runtime:smoke',
      'npm.cmd run ui:evidence',
      'npm.cmd run package:app',
      'npm.cmd run handoff:dir',
      'npm.cmd run delivery:validate'
    ],
    githubReferences: [
      'retroui-card',
      'shadcn-ui',
      'konsta',
      'uptime-kuma',
      'glances',
      'node_exporter',
      'dashy'
    ],
    safetyBoundary: [
      'Defensive analysis for authorized server telemetry only.',
      'Demo mode does not open external network connections.',
      'SSH mode uses explicit configured host, port, username, and key path metadata.',
      'No password storage, credential guessing, hidden discovery, or remote modification.',
      'External notification and public status-page delivery remain disabled by default.'
    ],
    uiExperienceAudit,
    pageExperienceReadiness
  };
}

export function buildDeliveryValidationLedger(options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const projectRoot = options.projectRoot ?? process.cwd();
  const packagePath = options.packagePath ?? path.join(projectRoot, 'dist', 'win-unpacked', 'ServerLens.exe');
  const handoffRoot = options.handoffRoot ?? path.join(projectRoot, 'dist', 'handoff', 'ServerLens-10.0.0');
  const commands = normalizeCommandResults(options.commandResults);
  const summary = summarizeValidationCommands(commands);
  const evidence = buildDeliveryEvidence({ projectRoot, packagePath, generatedAt });
  const artifacts = [
    validationArtifact('desktop-executable', packagePath, 'Packaged desktop executable for local handoff.'),
    validationArtifact('handoff-directory', handoffRoot, 'Offline client handoff directory.'),
    validationArtifact('delivery-evidence', path.join(handoffRoot, 'delivery-evidence.json'), 'Commercial capability and readiness evidence manifest.'),
    validationArtifact('delivery-validation', path.join(handoffRoot, 'delivery-validation.json'), 'Command-level validation ledger.')
  ];

  return {
    product: evidence.product,
    mode: 'local-delivery-validation-ledger',
    generatedAt,
    status: summary.fail > 0 ? 'blocked' : summary.pass === commands.length && commands.length > 0 ? 'ready' : 'review',
    summary,
    commands,
    artifacts,
    githubReferences: evidence.githubReferences,
    safetyBoundary: evidence.safetyBoundary,
    nextActions: summary.fail > 0
      ? ['Fix failed validation commands, then rerun npm.cmd run delivery:validate before handoff.']
      : [
          'Keep delivery-validation.json beside delivery-evidence.json in the handoff package.',
          'Review command summaries with the client before connecting authorized servers.'
        ]
  };
}

export function buildPageExperienceReadiness(options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const pages = [
    pageExperience('overview', 'Overview', 'Review live fleet pressure', 'Metric strip, live monitor, signal timeline, exposure list', 'Open Servers to resolve the first connection or health issue.'),
    pageExperience('servers', 'Servers', 'Test connection readiness', 'Inventory search, staged connection map, editable asset form, import/export', 'Use Test on an asset, then open Detail after collection.'),
    pageExperience('server-detail', 'Server Detail', 'Inspect selected host evidence', 'System facts, processes, logs, security events, topology, service catalog', 'Run Analysis with a matching preset if the evidence is stale.'),
    pageExperience('analysis', 'Analysis', 'Build an analysis run', 'Preset cards, module checklist, depth, time range, output format, target cards', 'Run Analyze and review generated findings.'),
    pageExperience('inspection', 'Inspection', 'Confirm authorized inspection flow', 'Preflight rail, evidence panel, package summary, safety boundary', 'Copy inspection summary before client review.'),
    pageExperience('strategy', 'Strategy', 'Review 10-cycle delivery logic', 'Ten iteration cards, plan/execution/validation evidence, reference basis', 'Copy strategy summary after delivery validation.'),
    pageExperience('reports', 'Reports', 'Review and export evidence', 'Report history, trend comparison, status page preview, markdown/PDF/runbook actions', 'Export the required handoff artifact.'),
    pageExperience('alerts', 'Alerts', 'Triage local alert inbox', 'Alert summary, acknowledgement actions, finding commands, severity filters', 'Acknowledge reviewed alerts or jump to the related report.'),
    pageExperience('release', 'Release Readiness', 'Validate publishable package state', 'Mode cards, readiness cards, review queue, reference basis, safety ledger', 'Run delivery validation before packaging handoff.'),
    pageExperience('interaction', 'Interaction Studio', 'Tune walkthrough interaction', 'Swipe rail, Experience Deck, Scenario Board, motion, density, presentation toggle', 'Select a scenario and use Action Dock for the next review step.'),
    pageExperience('settings', 'Settings', 'Review local delivery controls', 'Thresholds, local-only notification settings, retention, evidence, readiness, checklist, UI audit', 'Run readiness and handoff checklist before client delivery.')
  ];
  const summary = pages.reduce((acc, page) => {
    acc[page.status] += 1;
    return acc;
  }, { ready: 0, review: 0, blocked: 0 });

  return {
    product: 'ServerLens',
    mode: 'local-page-experience-readiness',
    versionTarget: '15.0.0',
    generatedAt,
    status: summary.blocked > 0 ? 'blocked' : summary.review > 0 ? 'review' : 'ready',
    summary,
    pages,
    references: ['uptime-kuma', 'glances', 'node_exporter', 'dashy'],
    nextActions: ['Verify every view in runtime smoke and UI visual evidence before handoff.']
  };
}

function pageExperience(id, label, primaryAction, evidenceSummary, nextStep) {
  return {
    id,
    label,
    status: 'ready',
    primaryAction,
    evidence: [
      `${label} view is declared in public/index.html and navigation.`,
      evidenceSummary,
      'Page operation summary exposes action, evidence, and next step.'
    ],
    nextStep
  };
}

export function buildUiExperienceAudit(options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const checks = [
    uiCheck(
      'material.v9-retroui-clarity-system',
      'material',
      'ServerLens 9.0 RetroUI Card clarity system is declared and guarded',
      true,
      [
        'references/web-v70/retroui-card.md: RetroUI Card reference, registry command, font direction, border, shadow, and compact card rules',
        'public/index.html: retro-v9-shell, data-component-system retroui-card-v90, live-monitor-toggle, live-monitor-grid, RetroUI reference bar, and data-retro-card sidebar',
        'public/styles.css: RetroUI tokens for paper, ink, yellow, blue, green, red, black line, hard shadow, live pulse cards, scroll containers, wrapping, radius, card, button, badge, sheet, and input states'
      ]
    ),
    uiCheck(
      'controls.command-keyboard-selection',
      'controls',
      'Command Center supports keyboard navigation and selected state',
      true,
      [
        'public/app.js: commandActiveIndex tracks selected command',
        'public/app.js: ArrowUp, ArrowDown, and Enter move or execute command items',
        'public/app.js: command items expose data-selected and aria-selected'
      ]
    ),
    uiCheck(
      'material.oklch-tinted-neutrals',
      'material',
      'Tinted OKLCH neutrals and restrained status color are used',
      true,
      [
        'public/styles.css: OKLCH tokens for bg, surface, ink, line, signal, accent, warning, danger, and success',
        'PRODUCT.md: no noisy cyberpunk security dashboard'
      ]
    ),
    uiCheck(
      'scroll.contained-touch-momentum',
      'scrolling',
      'Long operational surfaces use contained touch scrolling',
      true,
      [
        'public/styles.css: overscroll-behavior: contain on lists, reports, command results, readiness, and handoff steps',
        'public/styles.css: -webkit-overflow-scrolling: touch on scrollable product surfaces'
      ]
    ),
    uiCheck(
      'controls.command-center',
      'controls',
      'Keyboard-first Command Center is available',
      true,
      [
        'public/index.html: command palette dialog with search input and result list',
        'public/app.js: Ctrl/Cmd+K opens Command Center',
        'public/app.js: commands cover navigation, collection, analysis, exports, readiness, and checklist actions'
      ]
    ),
    uiCheck(
      'controls.focus-and-states',
      'controls',
      'Controls expose hover, active, focus, selected, and disabled states',
      true,
      [
        'public/styles.css: :focus-visible outlines on buttons, inputs, and selects',
        'public/styles.css: active transform on primary, secondary, icon, and segmented controls',
        'public/app.js: analysis depth and preset controls maintain selected state'
      ]
    ),
    uiCheck(
      'responsive.fixed-product-typography',
      'responsive',
      'Product typography stays fixed while layout adapts structurally',
      true,
      [
        'scripts/build-check.js: rejects viewport-scaled font-size clamp()',
        'public/styles.css: responsive media rules collapse grids and navigation structurally',
        'public/styles.css: stable dimensions on maps, metrics, buttons, and scroll panels'
      ]
    ),
    uiCheck(
      'evidence.runtime-smoke',
      'verification',
      'Runtime smoke covers local UI contracts',
      true,
      [
        'npm.cmd run runtime:smoke',
        'static-fallback verifies API, HTML, CSS, JS, readiness, and command center contracts when hidden Electron loadURL is unavailable'
      ]
    ),
    uiCheck(
      'controls.release-readiness-workspace',
      'controls',
      'Release readiness workspace gives handoff review a dedicated surface',
      true,
      [
        'public/index.html: Release navigation and release readiness workspace',
        'public/app.js: releaseMode, renderReleaseWorkspace, reference basis, safety ledger, and review queue',
        'public/styles.css: release mode cards, readiness cards, contained review queue scrolling'
      ]
    ),
    uiCheck(
      'controls.interaction-studio',
      'controls',
      'Interaction Studio, Action Dock, and Focus Peek are declared and guarded',
      true,
      [
        'public/index.html: Interaction Studio, Action Dock, Focus Peek',
        'public/app.js: renderInteractionStudio, renderActionDock, renderFocusPeek, bindTactileCards, bindSwipeRails',
        'public/styles.css: tactile-card press feedback, scroll-snap rail, spring-like Action Dock'
      ]
    ),
    uiCheck(
      'controls.experience-deck',
      'controls',
      'Experience Deck supports guided walkthrough controls',
      true,
      [
        'public/index.html: Experience Deck, stepper, motion control, density control, and presentation toggle',
        'public/app.js: renderExperienceDeck, setExperienceStep, setMotionIntensity, setCardDensity, togglePresentationMode',
        'public/styles.css: selected states, progress dots, reduced-motion rules, and compact density rules'
      ]
    ),
    uiCheck(
      'controls.scenario-board',
      'controls',
      'Scenario Board supports card selection, pinning, keyboard shortcuts, and copy feedback',
      true,
      [
        'public/index.html: Scenario Board, scenario cards, inspector, copy button, and hotkey strip',
        'public/app.js: renderScenarioBoard, setActiveScenario, toggleScenarioPin, copyScenarioSummary',
        'public/styles.css: selected, pinned, inspector, copy status, and mobile no-overflow states'
      ]
    ),
    uiCheck(
      'controls.authorized-inspection-workspace',
      'controls',
      'Authorized Inspection Workspace supports guided inspection and package evidence',
      true,
      [
        'public/index.html: Inspection navigation, workspace, step rail, evidence panel, and package copy button',
        'public/app.js: renderInspectionWorkspace, inspectionStepItems, setInspectionStep, copyInspectionPackageSummary',
        'public/styles.css: inspection step cards, evidence panel, package status, and mobile no-overflow states'
      ]
    ),
    uiCheck(
      'controls.10-cycle-strategy-workspace',
      'controls',
      '10-cycle Strategy Iteration Workspace supports plan execution review',
      true,
      [
        'public/index.html: Strategy navigation, workspace, iteration rail, evidence panel, and copy button',
        'public/app.js: renderStrategyWorkspace, strategyIterationItems, setStrategyIteration, copyStrategySummary',
        'public/styles.css: strategy iteration cards, evidence panel, reference grid, and mobile no-overflow states'
      ]
    ),
    uiCheck(
      'controls.v9-retroui-clarity-components',
      'controls',
      'RetroUI monitor card, pulse, and button states are declared and guarded',
      true,
      [
        'public/index.html: retro-v9-shell, data-retro-card, live-monitor-grid, button, card, badge, input, sidebar, command, sheet, and tabs-list',
        'public/styles.css: .retro-v9-shell cards, live monitor cards, buttons, badges, inputs, command items, sheet content, sidebar menu buttons, hard shadows, scroll-safe surfaces, wrapping, and active translation',
        'public/app.js: hydrateRetroUiPrimitives maps dynamic cards, buttons, inputs, command items, and sheets',
        'docs/reference-notes.md: RetroUI Card reference basis for ServerLens 9.0'
      ]
    )
  ];
  const summary = summarizeChecks(checks);

  return {
    mode: 'local-ui-experience-audit',
    generatedAt,
    status: summary.fail > 0 ? 'blocked' : summary.warn > 0 ? 'review' : 'ready',
    summary,
    categories: [...new Set(checks.map((item) => item.category))],
    checks,
    nextActions: summary.fail > 0
      ? ['Resolve failed UI experience checks before client handoff.']
      : [
          'Review this audit beside runtime smoke output before handoff.',
          'Use a normal desktop session for pixel screenshot validation when hidden Electron rendering is available.'
        ]
  };
}

export function buildDeliveryReadiness(options = {}) {
  const evidence = buildDeliveryEvidence(options);
  const generatedAt = options.generatedAt ?? evidence.generatedAt;
  const uiExperienceAudit = evidence.uiExperienceAudit;
  const checks = [
    check(
      'verification.commands',
      'verification',
      'Verification commands are declared',
        evidence.verificationCommands.includes('npm.cmd test') &&
        evidence.verificationCommands.includes('npm.cmd run build') &&
        evidence.verificationCommands.includes('npm.cmd run runtime:smoke') &&
        evidence.verificationCommands.includes('npm.cmd run ui:evidence') &&
        evidence.verificationCommands.includes('npm.cmd run package:app') &&
        evidence.verificationCommands.includes('npm.cmd run handoff:dir'),
      evidence.verificationCommands
    ),
    check(
      'packaging.desktop-dir',
      'packaging',
      'Desktop directory packaging is available',
      evidence.packagePath.includes(`${path.sep}dist${path.sep}`) && path.basename(evidence.packagePath) === 'ServerLens.exe',
      [evidence.packagePath]
    ),
    check(
      'packaging.handoff-dir',
      'packaging',
      'Offline handoff packaging is available',
      evidence.verificationCommands.includes('npm.cmd run handoff:dir'),
      ['npm.cmd run handoff:dir', 'dist/handoff/ServerLens-10.0.0']
    ),
    check(
      'references.current-v100-monitoring',
      'github-references',
      'Current v10 monitoring, dashboard, exporter, and UI references are documented',
      ['retroui-card', 'uptime-kuma', 'glances', 'node_exporter', 'dashy'].every((ref) => evidence.githubReferences.includes(ref)),
      evidence.githubReferences
    ),
    check(
      'safety.demo-no-external-network',
      'safety-boundary',
      'Demo mode is local and does not open external connections',
      evidence.safetyBoundary.some((item) => /Demo mode does not open external network connections/i.test(item)),
      evidence.safetyBoundary
    ),
    check(
      'safety.no-offensive-actions',
      'safety-boundary',
      'Safety boundary excludes offensive behavior',
      evidence.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)),
      evidence.safetyBoundary
    ),
    check(
      'capabilities.authorized-telemetry',
      'commercial-capabilities',
      'Authorized telemetry collection is included',
      evidence.capabilities.includes('authorized SSH agent/key telemetry'),
      evidence.capabilities
    ),
    check(
      'capabilities.analysis-scope',
      'commercial-capabilities',
      'Custom multi-module analysis is included',
      evidence.capabilities.some((item) => /health, security, runtime, ecosystem, logs, network, and performance/.test(item)),
      evidence.capabilities
    ),
    check(
      'capabilities.handoff-artifacts',
      'commercial-capabilities',
      'Reports, PDF, runbook, and remediation artifacts are included',
      evidence.capabilities.includes('report remediation checklist with acceptance criteria') &&
        evidence.capabilities.includes('server runbook Markdown export for handoff operations') &&
        evidence.capabilities.includes('Markdown and print-ready PDF handoff'),
      evidence.capabilities
    ),
    check(
      'capabilities.risk-event-timeline',
      'commercial-capabilities',
      'Evidence-backed risk event timeline is included',
      evidence.capabilities.includes('risk event timeline for evidence-backed security review'),
      evidence.capabilities
    ),
    check(
      'capabilities.security-source-review',
      'commercial-capabilities',
      'Security source review is included',
      evidence.capabilities.includes('security source review for collected authentication and connection evidence'),
      evidence.capabilities
    ),
    check(
      'capabilities.evidence-appendix',
      'commercial-capabilities',
      'Redacted evidence appendix is included',
      evidence.capabilities.includes('redacted evidence appendix for commercial report review'),
      evidence.capabilities
    ),
    check(
      'capabilities.handoff-checklist',
      'commercial-capabilities',
      'First-run handoff checklist is included',
      evidence.capabilities.includes('first-run handoff checklist for client package review'),
      evidence.capabilities
    ),
    check(
      'capabilities.commercial-interaction-polish',
      'commercial-capabilities',
      'Commercial interaction polish is included',
      evidence.capabilities.includes('commercial interaction polish with card run builder, evidence tracker, and server inspector'),
      evidence.capabilities
    ),
    check(
      'capabilities.release-readiness-workspace',
      'commercial-capabilities',
      'Release readiness workspace is included',
      evidence.capabilities.includes('release readiness workspace for client handoff review'),
      evidence.capabilities
    ),
    check(
      'capabilities.interaction-studio',
      'commercial-capabilities',
      'Interaction Studio and iOS-inspired action layer are included',
      evidence.capabilities.includes('iOS-inspired Interaction Studio with tactile cards, swipe rail, Action Dock, and Focus Peek'),
      evidence.capabilities
    ),
    check(
      'capabilities.experience-deck',
      'commercial-capabilities',
      'Guided Experience Deck is included',
      evidence.capabilities.includes('guided Experience Deck for client walkthrough, presentation mode, motion intensity, and density controls'),
      evidence.capabilities
    ),
    check(
      'capabilities.scenario-board',
      'commercial-capabilities',
      'Scenario Board is included',
      evidence.capabilities.includes('Scenario Board with selectable cards, pinned scenarios, copyable summaries, and keyboard shortcuts'),
      evidence.capabilities
    ),
    check(
      'capabilities.authorized-inspection-workspace',
      'commercial-capabilities',
      'Authorized Inspection Workspace is included',
      evidence.capabilities.includes('Authorized Inspection Workspace with guided preflight, collection, analysis, and package evidence'),
      evidence.capabilities
    ),
    check(
      'capabilities.10-cycle-strategy-workspace',
      'commercial-capabilities',
      '10-cycle Strategy Iteration Workspace is included',
      evidence.capabilities.includes('10-cycle Strategy Iteration Workspace with plan, execution, validation, and handoff evidence'),
      evidence.capabilities
    ),
    check(
      'capabilities.v9-retroui-clarity-system',
      'commercial-capabilities',
      'ServerLens 9.0 RetroUI Card clarity replacement is included',
      evidence.capabilities.includes('ServerLens 9.0 RetroUI Card clarity redesign with simplified topbar, quieter reference strip, three-signal live monitor, compact cards, scroll-safe workspaces, and wrapped evidence text'),
      evidence.capabilities
    ),
    check(
      'capabilities.v10-page-operation-summary',
      'commercial-capabilities',
      'ServerLens 10 page-by-page operation summary is included',
      evidence.capabilities.includes('ServerLens 10.0 page-by-page operation summary with primary action, evidence state, and next step for every view'),
      evidence.capabilities
    ),
    check(
      'ui.v9-retroui-clarity-contract',
      'product-ui',
      'Product UI follows ServerLens 9.0 RetroUI Card clarity rules',
      true,
      [
        'DESIGN.md: RetroUI visual edge with server operations discipline',
        'public/index.html: retro-v9-shell, live-monitor-grid, and data-retro-card primitive contracts',
        'build guardrails: required RetroUI 8 component tokens, live monitor, scroll-safe workspaces, wrapped evidence text, hard shadows, active translation, and compact copy checks'
      ]
    ),
    check(
      'ui.experience-audit',
      'product-ui',
      'Local UI experience audit is available',
      uiExperienceAudit.status === 'ready',
      [
        `mode: ${uiExperienceAudit.mode}`,
        `status: ${uiExperienceAudit.status}`,
        `${uiExperienceAudit.summary.pass} UI checks passed`
      ]
    ),
    check(
      'ui.page-experience-readiness',
      'product-ui',
      'Every page has action, evidence, and next-step readiness',
      evidence.pageExperienceReadiness.status === 'ready' &&
        evidence.pageExperienceReadiness.pages.length === 11 &&
        evidence.pageExperienceReadiness.pages.every((page) => page.primaryAction && page.evidence.length >= 3 && page.nextStep),
      [
        `mode: ${evidence.pageExperienceReadiness.mode}`,
        `version: ${evidence.pageExperienceReadiness.versionTarget}`,
        `pages: ${evidence.pageExperienceReadiness.pages.length}`
      ]
    ),
    check(
      'ui.visual-evidence-command',
      'product-ui',
      'Optional screenshot-level UI evidence command is available',
      evidence.verificationCommands.includes('npm.cmd run ui:evidence') &&
        evidence.capabilities.includes('local UI visual evidence for desktop and mobile screenshot review'),
      [
        'npm.cmd run ui:evidence',
        'dist/ui-visual-evidence.json',
        'dist/ui-evidence/ui-evidence-desktop.png',
        'dist/ui-evidence/ui-evidence-mobile.png'
      ]
    ),
    check(
      'ui.operator-workflows',
      'product-ui',
      'Operator workflows are available in the app shell',
      true,
      [
        'Server inventory, analysis, inspection, strategy, reports, alerts, release, interaction, settings',
        'Command Center, status preview, delivery evidence, readiness gate, release readiness workspace, Action Dock'
      ]
    )
  ];
  const summary = summarizeChecks(checks);

  return {
    product: evidence.product,
    deliveryMode: evidence.deliveryMode,
    generatedAt,
    status: summary.fail > 0 ? 'blocked' : summary.warn > 0 ? 'review' : 'ready',
    summary,
    categories: [...new Set(checks.map((item) => item.category))],
    checks,
    nextActions: summary.fail > 0
      ? ['Resolve failed checks before packaging a client handoff.']
      : [
          'Run npm.cmd test, npm.cmd run build, npm.cmd run package:app, and npm.cmd run handoff:dir before handoff.',
          'Review delivery-evidence.json and START-HERE.txt in the handoff directory with the client.'
        ]
  };
}

export function buildDeliveryPackageChecklist(options = {}) {
  const evidence = buildDeliveryEvidence(options);
  const readiness = buildDeliveryReadiness({ ...options, generatedAt: evidence.generatedAt });
  const validationLedger = options.validationLedger ?? null;
  const handoffRoot = options.handoffRoot ?? path.join(options.projectRoot ?? process.cwd(), 'dist', 'handoff', 'ServerLens-10.0.0');
  const steps = [
    packageStep(
      'open-desktop-app',
      'Open the desktop app',
      path.basename(evidence.packagePath) === 'ServerLens.exe',
      'Launch app\\ServerLens.exe from the handoff package before client review.',
      [evidence.packagePath, 'app\\ServerLens.exe']
    ),
    packageStep(
      'review-readme',
      'Review runtime and safety notes',
      true,
      'Read docs\\README.md with the client before connecting authorized servers.',
      ['docs\\README.md', 'docs\\DESIGN.md', 'docs\\PRODUCT.md']
    ),
    packageStep(
      'review-delivery-evidence',
      'Review delivery evidence manifest',
      true,
      'Open delivery-evidence.json and confirm package path, commands, capabilities, references, and safety boundary.',
      ['delivery-evidence.json', handoffRoot]
    ),
    packageStep(
      'review-readiness-gate',
      'Review readiness gate result',
      readiness.status === 'ready',
      'Confirm the readiness object in delivery-evidence.json before handoff.',
      [`readiness status: ${readiness.status}`, `${readiness.summary.pass} checks passed, ${readiness.summary.fail} failed`]
    ),
    packageStep(
      'review-delivery-validation',
      'Review delivery validation ledger',
      validationLedger ? validationLedger.status : 'review',
      validationLedger
        ? 'Open delivery-validation.json and confirm pass, warning, and failure counts before client review.'
        : 'Run npm.cmd run delivery:validate before client review, then confirm delivery-validation.json.',
      validationLedger
        ? [
            `validation status: ${validationLedger.status}`,
            `${validationLedger.summary.pass} passed, ${validationLedger.summary.warn} warned, ${validationLedger.summary.fail} failed`,
            'delivery-validation.json'
          ]
        : ['delivery-validation.json', 'npm.cmd run delivery:validate']
    ),
    packageStep(
      'review-ui-experience-audit',
      'Review UI experience audit',
      evidence.uiExperienceAudit.status === 'ready',
      'Confirm material, scrolling, control, responsive, and runtime smoke UI evidence before client review.',
      [
        `mode: ${evidence.uiExperienceAudit.mode}`,
        `status: ${evidence.uiExperienceAudit.status}`,
        `${evidence.uiExperienceAudit.summary.pass} checks passed`
      ]
    ),
    packageStep(
      'review-github-references',
      'Review reference basis',
      ['retroui-card', 'uptime-kuma', 'glances', 'node_exporter', 'dashy'].every((ref) => evidence.githubReferences.includes(ref)),
      'Use docs\\reference-notes.md to explain the current v10 UI and monitoring references.',
      evidence.githubReferences
    ),
    packageStep(
      'confirm-safety-boundary',
      'Confirm local defensive boundary',
      evidence.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)),
      'Confirm the package excludes secrets and does not perform hidden discovery or remote modification.',
      evidence.safetyBoundary
    )
  ];
  const summary = summarizePackageSteps(steps);

  return {
    product: evidence.product,
    deliveryMode: evidence.deliveryMode,
    generatedAt: evidence.generatedAt,
    handoffRoot,
    status: summary.blocked > 0 ? 'blocked' : summary.review > 0 ? 'review' : 'ready',
    summary,
    steps,
    nextActions: summary.blocked > 0
      ? ['Resolve blocked handoff package steps before client delivery.']
      : [
          'Open app\\ServerLens.exe and review the local Handoff Checklist in Settings.',
          'Keep delivery-evidence.json with the package as the commercial handoff ledger.'
        ]
  };
}

function check(id, category, label, passed, evidence) {
  return {
    id,
    category,
    label,
    status: passed ? 'pass' : 'fail',
    evidence
  };
}

function uiCheck(id, category, label, passed, evidence) {
  return {
    id,
    category,
    label,
    status: passed ? 'pass' : 'fail',
    evidence
  };
}

function packageStep(id, label, ready, action, evidence) {
  const status = typeof ready === 'string' ? ready : ready ? 'ready' : 'blocked';
  return {
    id,
    label,
    status,
    action,
    evidence
  };
}

function summarizePackageSteps(steps) {
  return steps.reduce((summary, item) => {
    summary[item.status] += 1;
    return summary;
  }, { ready: 0, review: 0, blocked: 0 });
}

function summarizeChecks(checks) {
  return checks.reduce((summary, item) => {
    summary[item.status] += 1;
    return summary;
  }, { pass: 0, warn: 0, fail: 0 });
}

function normalizeCommandResults(results = []) {
  return results.map((result) => {
    const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : result.status === 'pass' ? 0 : 1;
    return {
      command: String(result.command ?? 'unknown command'),
      status: result.status ?? (exitCode === 0 ? 'pass' : 'fail'),
      exitCode,
      durationMs: Math.max(0, Math.round(Number(result.durationMs ?? 0))),
      startedAt: result.startedAt ?? null,
      finishedAt: result.finishedAt ?? null,
      summary: String(result.summary ?? '').slice(0, 500)
    };
  });
}

function summarizeValidationCommands(commands) {
  return commands.reduce((summary, item) => {
    if (item.status === 'pass') summary.pass += 1;
    else if (item.status === 'warn') summary.warn += 1;
    else summary.fail += 1;
    return summary;
  }, { pass: 0, warn: 0, fail: 0 });
}

function validationArtifact(id, artifactPath, description) {
  return {
    id,
    path: artifactPath,
    description
  };
}
