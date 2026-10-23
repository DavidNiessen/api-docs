import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedPerformance } from '../lib/prepared-performance.mjs';

const context = { toolVersion: '0.2.0', commit: 'a'.repeat(40) };
const identity = {
  ...context,
  artifactCompilerVersion: context.toolVersion,
  sourceWorkingTreeDirty: true,
};
const compiler = {
  ...identity,
  fullBuildArtifactDigest: 'b'.repeat(64),
  operations: 10000,
  schemaNodes: 50000,
  fullBuildSeconds: 54.37,
  peakRssMiB: 929,
  searchP95Ms: 5.78,
  sampleCount: 100,
  incrementalGuideP95Ms: 158.92,
  incrementalSamples: 20,
};
const browser = {
  ...identity,
  artifactDigest: 'c'.repeat(64),
  profile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    cpuSlowdown: 4,
    latencyMs: 150,
    downloadBitsPerSecond: 1600000,
    uploadBitsPerSecond: 750000,
  },
  budgets: {
    p95LcpMs: 2500,
    maxCls: 0.1,
    p95InteractionMs: 200,
    initialGuideJavaScriptGzipBytes: 153600,
  },
  measurements: ['guide', 'endpoint'].map((name) => ({
    name,
    p95LcpMs: 1000,
    maxCls: 0,
    p95InteractionMs: 100,
    maxInitialJavaScriptGzipBytes: 127643,
    samples: Array.from({ length: 10 }, () => ({
      lcpMs: 1000,
      cls: 0,
      interactionMs: 100,
      initialJavaScriptGzipBytes: 127643,
    })),
  })),
};
const validate = (scenario, report) =>
  validatePreparedPerformance(report, { ...context, scenario });

test('accepts full-size prepared compiler and cold mobile reader results', () => {
  validate('compiler', compiler);
  validate('browser', browser);
});
test('rejects stale tools, publications, commits, missing artifacts and unprepared source', () => {
  for (const [scenario, report] of [
    ['compiler', compiler],
    ['browser', browser],
  ]) {
    const digest =
      scenario === 'compiler' ? 'fullBuildArtifactDigest' : 'artifactDigest';
    for (const fields of [
      { toolVersion: '0.1.0' },
      { artifactCompilerVersion: '0.1.0' },
      { commit: 'd'.repeat(40) },
      { sourceWorkingTreeDirty: false },
      { sourceWorkingTreeDirty: undefined },
      { [digest]: '' },
    ])
      assert.throws(() => validate(scenario, { ...report, ...fields }));
  }
});
test('rejects reduced compiler fixtures and insufficient sample counts', () => {
  for (const fields of [
    { operations: 1000 },
    { schemaNodes: 5000 },
    { sampleCount: 99 },
    { incrementalSamples: 0 },
  ])
    assert.throws(() => validate('compiler', { ...compiler, ...fields }));
});
test('rejects compiler budget overruns and nonnumeric or nonfinite measurements', () => {
  for (const [name, maximum] of [
    ['fullBuildSeconds', 120],
    ['peakRssMiB', 2048],
    ['searchP95Ms', 100],
    ['incrementalGuideP95Ms', 2000],
  ])
    for (const value of [maximum + 1, NaN, Infinity, null, '1', -1])
      assert.throws(() => validate('compiler', { ...compiler, [name]: value }));
});
test('rejects missing, duplicate or reduced reader journeys and a weaker mobile profile', () => {
  const changes = [
    (report) => {
      report.measurements = [];
    },
    (report) => {
      report.measurements[1].name = 'guide';
    },
    (report) => {
      report.measurements[0].samples.pop();
    },
    (report) => {
      report.profile.cpuSlowdown = 1;
    },
    (report) => {
      report.profile.latencyMs = 0;
    },
    (report) => {
      report.budgets.p95LcpMs = 10000;
    },
  ];
  for (const change of changes) {
    const report = structuredClone(browser);
    change(report);
    assert.throws(() => validate('browser', report));
  }
});
test('rejects reader budget overruns and empty or invalid raw samples', () => {
  for (const [name, maximum] of [
    ['p95LcpMs', 2500],
    ['maxCls', 0.1],
    ['p95InteractionMs', 200],
    ['maxInitialJavaScriptGzipBytes', 153600],
  ])
    for (const value of [maximum + 1, NaN, null, -1]) {
      const report = structuredClone(browser);
      report.measurements[0][name] = value;
      assert.throws(() => validate('browser', report));
    }
  for (const name of [
    'lcpMs',
    'cls',
    'interactionMs',
    'initialJavaScriptGzipBytes',
  ]) {
    const report = structuredClone(browser);
    report.measurements[0].samples[0][name] = null;
    assert.throws(() => validate('browser', report));
  }
});
test('rejects passing reader summaries that hide failing raw measurements', () => {
  for (const [name, value] of [
    ['lcpMs', 3000],
    ['cls', 0.2],
    ['interactionMs', 250],
    ['initialJavaScriptGzipBytes', 160000],
  ]) {
    const report = structuredClone(browser);
    report.measurements[0].samples[0][name] = value;
    assert.throws(() => validate('browser', report));
  }
});
