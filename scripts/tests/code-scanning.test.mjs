import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCodeScanning } from '../lib/code-scanning.mjs';

function fixture(severity) {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CodeQL',
            rules: [
              {
                id: 'js/example',
                properties: {
                  tags: ['security'],
                  'security-severity': severity,
                },
              },
            ],
          },
        },
        invocations: [{ executionSuccessful: true }],
        results: [{ ruleId: 'js/example', ruleIndex: 0 }],
      },
    ],
  };
}

test('CodeQL severity boundaries block high/critical findings and retain other results', () => {
  for (const [severity, kind, passed] of [
    ['0', 'low', true],
    ['3.9', 'low', true],
    ['4', 'medium', true],
    ['6.9', 'medium', true],
    ['7', 'high', false],
    ['8.9', 'high', false],
    ['9', 'critical', false],
    ['10.0', 'critical', false],
  ]) {
    const result = assessCodeScanning(fixture(severity));
    assert.equal(result.passed, passed);
    assert.equal(result.counts[kind], 1);
    assert.equal(result.blockingFindings, passed ? 0 : 1);
  }
});

test('CodeQL accepts a successful empty result but refuses incomplete or foreign reports', () => {
  const empty = fixture('7');
  empty.runs[0].results = [];
  assert.equal(assessCodeScanning(empty).passed, true);
  for (const mutate of [
    (r) => {
      r.version = '1.0.0';
    },
    (r) => {
      r.runs = [];
    },
    (r) => {
      r.runs[0].tool.driver.name = 'Other';
    },
    (r) => {
      r.runs[0].invocations[0].executionSuccessful = false;
    },
    (r) => {
      r.runs[0].results = {};
    },
    (r) => {
      r.runs[0].tool.driver.rules = undefined;
    },
  ]) {
    const report = fixture('7');
    mutate(report);
    assert.throws(() => assessCodeScanning(report));
  }
});

test('CodeQL refuses suppressed results and inconsistent rule references', () => {
  for (const mutate of [
    (r) => {
      r.runs[0].results[0].suppressions = [{ kind: 'inSource' }];
    },
    (r) => {
      r.runs[0].results[0].suppressions = {};
    },
    (r) => {
      r.runs[0].results[0].baselineState = 'absent';
    },
    (r) => {
      r.runs[0].results[0].ruleId = 'missing';
    },
    (r) => {
      r.runs[0].results[0].ruleIndex = 1;
    },
    (r) => {
      r.runs[0].tool.driver.rules.push(r.runs[0].tool.driver.rules[0]);
    },
  ]) {
    const report = fixture('7');
    mutate(report);
    assert.throws(() => assessCodeScanning(report));
  }
});

test('CodeQL refuses missing or malformed security severity without dropping findings', () => {
  for (const value of [
    undefined,
    null,
    '',
    'NaN',
    '-1',
    '10.1',
    '11',
    7,
    ' 7',
    '7x',
  ])
    assert.throws(() => assessCodeScanning(fixture(value)));
  const report = fixture(undefined);
  report.runs[0].tool.driver.rules[0].properties.tags = ['maintainability'];
  const result = assessCodeScanning(report);
  assert.equal(result.passed, true);
  assert.equal(result.counts.other, 1);
});
