// Pure page-experience data and view metadata for ServerLens 13.0.
// These are DOM-free constants shared by the app shell and unit tests.

export const viewTitles = {
  overview: 'Overview',
  servers: 'Servers',
  'server-detail': 'Server Detail',
  analysis: 'Analysis',
  delivery: 'Delivery Workspace',
  inspection: 'Delivery Workspace',
  strategy: 'Delivery Workspace',
  reports: 'Reports',
  alerts: 'Alerts',
  release: 'Delivery Workspace',
  ecosystem: 'Ecosystem',
  settings: 'Settings'
};

export const pageExperienceModel = {
  overview: {
    action: 'Open Servers',
    view: 'servers',
    title: 'Review live fleet pressure',
    evidence: ['Metrics', 'Live pulse', 'Exposure'],
    nextStep: 'Open Servers to resolve the first connection or health issue.'
  },
  servers: {
    action: 'Test Connections',
    view: 'servers',
    title: 'Test connection readiness',
    evidence: ['Inventory', 'Connection map', 'Transfer'],
    nextStep: 'Use Test on an asset, then open Detail after collection.'
  },
  'server-detail': {
    action: 'Build Run',
    view: 'analysis',
    title: 'Inspect selected host evidence',
    evidence: ['System', 'Security', 'Topology'],
    nextStep: 'Run Analysis with a matching preset if the evidence is stale.'
  },
  analysis: {
    action: 'Run Analyze',
    command: 'analyze',
    title: 'Build an analysis run',
    evidence: ['Preset', 'Modules', 'Output'],
    nextStep: 'Run Analyze and review generated findings.'
  },
  delivery: {
    action: 'Copy Summary',
    command: 'copy-inspection-summary',
    title: 'Run the delivery workspace',
    evidence: ['Inspect', 'Validate', 'Handoff'],
    nextStep: 'Work the Inspect, Validate, and Handoff tabs before client delivery.'
  },
  inspection: {
    action: 'Copy Summary',
    command: 'copy-inspection-summary',
    title: 'Confirm authorized inspection flow',
    evidence: ['Preflight', 'Evidence', 'Package'],
    nextStep: 'Copy inspection summary before client review.'
  },
  strategy: {
    action: 'Copy Strategy',
    command: 'copy-strategy-summary',
    title: 'Review 10-cycle delivery logic',
    evidence: ['Iterations', 'References', 'Validation'],
    nextStep: 'Copy strategy summary after delivery validation.'
  },
  reports: {
    action: 'Copy Report',
    command: 'open-focus-peek',
    title: 'Review and export evidence',
    evidence: ['History', 'Trends', 'Exports'],
    nextStep: 'Export the required handoff artifact.'
  },
  alerts: {
    action: 'Open Reports',
    view: 'reports',
    title: 'Triage local alert inbox',
    evidence: ['Summary', 'Inbox', 'Commands'],
    nextStep: 'Acknowledge reviewed alerts or jump to the related report.'
  },
  release: {
    action: 'Run Gate',
    command: 'open-readiness',
    title: 'Validate publishable package state',
    evidence: ['Readiness', 'Review queue', 'Safety'],
    nextStep: 'Run delivery validation before packaging handoff.'
  },
  ecosystem: {
    action: 'Open Servers',
    view: 'servers',
    title: 'Review fleet ecosystem',
    evidence: ['Resource', 'Services', 'Risk'],
    nextStep: 'Collect telemetry on more servers to enrich the fleet trend.'
  },
  settings: {
    action: 'Readiness',
    command: 'open-readiness',
    title: 'Review local delivery controls',
    evidence: ['Thresholds', 'Retention', 'Checklist'],
    nextStep: 'Run readiness and handoff checklist before client delivery.'
  }
};

export const moduleLabels = {
  health: 'Health',
  security: 'Security',
  runtime: 'Runtime',
  ecosystem: 'Ecosystem',
  logs: 'Logs',
  network: 'Network',
  performance: 'Performance'
};
