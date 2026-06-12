# ServerLens 10.0 Reference Notes

ServerLens 10.0 keeps the 9.0 RetroUI Card clarity layer as the visual foundation, then adds page-by-page operation summaries and monitoring-specific reference practice. Reference source is used for product judgment only; no reference repository code is copied into the runtime.

## Active UI References

- `references/web-v70/retroui-card.md`: card grammar, hard shadows, compact labels, and readable workbench surfaces.
- `references/github-v60/shadcn-ui`: composable command, button, badge, and panel vocabulary.
- `references/github-v60/konsta`: iOS spacing, touch feedback, segmented controls, and mobile rhythm.

## Server Monitoring References

- `references/github-v100/uptime-kuma`: monitor list, explicit object status, status-page review, and operator-friendly connection history.
- `references/github-v100/glances`: system resource categories, customizable metric visibility, and dense but readable runtime summaries.
- `references/github-v100/node_exporter`: collector boundaries, host metric naming discipline, and clear include/exclude configuration.
- `references/github-v100/dashy`: multi-page dashboard navigation, quick search, shortcut-first operation, and compact workspace organization.

## 10.0 Design Rule

Every page must answer four operator questions without hunting: what is this page for, what should I do now, what evidence is present, and where do I go next. The page operation summary is the visible contract for that rule.
