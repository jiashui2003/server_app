import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampPercent,
  pressureClass,
  labelForStatus,
  signed,
  formatTime,
  formatDate,
  escapeHtml
} from '../public/js/format.js';
import { filterCommands, clampActiveIndex, wrapActiveIndex } from '../public/js/commands.js';
import { viewTitles, pageExperienceModel, moduleLabels } from '../public/js/page-model.js';

test('clampPercent bounds values to 0..100 and rejects non-numbers', () => {
  assert.equal(clampPercent(50), 50);
  assert.equal(clampPercent(-10), 0);
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent('not-a-number'), 0);
});

test('pressureClass maps load to the expected severity class', () => {
  assert.equal(pressureClass(95), 'is-critical');
  assert.equal(pressureClass(80), 'is-warn');
  assert.equal(pressureClass(40), 'is-stable');
  assert.equal(pressureClass(), 'is-stable');
});

test('labelForStatus humanizes hyphenated status tokens', () => {
  assert.equal(labelForStatus('major-incident'), 'major incident');
  assert.equal(labelForStatus(undefined), 'unknown');
});

test('signed prefixes positive deltas only', () => {
  assert.equal(signed(3), '+3');
  assert.equal(signed(0), '0');
  assert.equal(signed(-2), '-2');
});

test('escapeHtml neutralizes markup characters', () => {
  assert.equal(escapeHtml('<script>"&\'</script>'), '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
});

test('formatTime and formatDate handle invalid input without throwing', () => {
  assert.equal(formatTime('not-a-date'), 'No timestamp');
  assert.equal(formatDate('not-a-date'), 'No date');
  assert.notEqual(formatTime('2026-06-11T09:30:00.000Z'), 'No timestamp');
});

test('filterCommands matches title, detail, and group case-insensitively', () => {
  const commands = [
    { title: 'Run Analyze', detail: 'Build a run', group: 'Analysis' },
    { title: 'Open Reports', detail: 'Review history', group: 'Navigation' },
    { title: 'Acknowledge alert', detail: 'Clear inbox', group: 'Alerts' }
  ];
  assert.equal(filterCommands(commands, '').length, 3);
  assert.deepEqual(filterCommands(commands, 'analy').map((item) => item.title), ['Run Analyze']);
  assert.deepEqual(filterCommands(commands, 'NAVIGATION').map((item) => item.title), ['Open Reports']);
  assert.equal(filterCommands(commands, 'no-match').length, 0);
});

test('filterCommands bounds the result count', () => {
  const commands = Array.from({ length: 30 }, (_, index) => ({ title: `Command ${index}`, detail: '', group: 'Bulk' }));
  assert.equal(filterCommands(commands, '', 12).length, 12);
  assert.equal(filterCommands(commands, '').length, 12);
});

test('clampActiveIndex and wrapActiveIndex stay in bounds', () => {
  assert.equal(clampActiveIndex(5, 3), 2);
  assert.equal(clampActiveIndex(-1, 3), 0);
  assert.equal(clampActiveIndex(0, 0), 0);
  assert.equal(wrapActiveIndex(3, 3), 0);
  assert.equal(wrapActiveIndex(-1, 3), 2);
  assert.equal(wrapActiveIndex(0, 0), 0);
});

test('page experience model stays aligned with view titles', () => {
  for (const id of Object.keys(pageExperienceModel)) {
    const page = pageExperienceModel[id];
    assert.ok(page.action, `${id} has a primary action`);
    assert.ok(page.title, `${id} has a title`);
    assert.ok(Array.isArray(page.evidence) && page.evidence.length > 0, `${id} has evidence chips`);
    assert.ok(page.nextStep, `${id} has a next step`);
  }
  assert.equal(viewTitles.overview, 'Overview');
  assert.equal(moduleLabels.performance, 'Performance');
});
