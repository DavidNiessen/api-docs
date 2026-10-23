import assert from 'node:assert/strict';

/** Require full-size results from this prepared candidate, retaining the existing budgets. */
export function validatePreparedPerformance(
  report,
  { scenario, toolVersion, commit },
) {
  assert.equal(report.toolVersion, toolVersion, 'Wrong measured tool version');
  assert.equal(
    report.artifactCompilerVersion,
    toolVersion,
    'Stale measured publication',
  );
  assert.equal(report.commit, commit, 'Wrong source commit');
  assert.equal(
    report.sourceWorkingTreeDirty,
    true,
    'Release metadata must be prepared',
  );
  const digest =
    scenario === 'compiler'
      ? report.fullBuildArtifactDigest
      : report.artifactDigest;
  assert.match(digest, /^[a-f0-9]{64}$/, 'Missing measured artifact identity');
  const bounded = (value, maximum, name, positive = true) => {
    assert(
      typeof value === 'number' &&
        Number.isFinite(value) &&
        (positive ? value > 0 : value >= 0) &&
        value <= maximum,
      `Invalid or over-budget ${name}`,
    );
  };
  if (scenario === 'compiler') {
    assert.equal(
      report.operations,
      10000,
      'Compiler fixture must contain 10,000 operations',
    );
    assert.equal(report.schemaNodes, 50000);
    assert.equal(report.sampleCount, 100);
    assert.equal(report.incrementalSamples, 20);
    bounded(report.fullBuildSeconds, 120, 'full build');
    bounded(report.peakRssMiB, 2048, 'peak RSS');
    bounded(report.searchP95Ms, 100, 'search p95', false);
    bounded(report.incrementalGuideP95Ms, 2000, 'incremental guide p95', false);
  } else {
    assert.equal(scenario, 'browser', 'Unknown performance scenario');
    assert.deepEqual(report.budgets, {
      p95LcpMs: 2500,
      maxCls: 0.1,
      p95InteractionMs: 200,
      initialGuideJavaScriptGzipBytes: 150 * 1024,
    });
    assert.deepEqual(report.measurements.map((item) => item.name).sort(), [
      'endpoint',
      'guide',
    ]);
    assert.deepEqual(report.profile, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      cpuSlowdown: 4,
      latencyMs: 150,
      downloadBitsPerSecond: 1600000,
      uploadBitsPerSecond: 750000,
    });
    for (const item of report.measurements) {
      assert.equal(
        item.samples.length,
        10,
        'Require ten cold samples per route',
      );
      bounded(item.p95LcpMs, 2500, 'LCP p95');
      bounded(item.maxCls, 0.1, 'CLS', false);
      bounded(item.p95InteractionMs, 200, 'search interaction p95', false);
      for (const sample of item.samples) {
        bounded(sample.lcpMs, Number.MAX_VALUE, 'sample LCP');
        bounded(sample.cls, Number.MAX_VALUE, 'sample CLS', false);
        bounded(
          sample.interactionMs,
          Number.MAX_VALUE,
          'sample interaction',
          false,
        );
        bounded(
          sample.initialJavaScriptGzipBytes,
          Number.MAX_VALUE,
          'sample JavaScript',
        );
      }
      const p95 = (key) =>
        item.samples.map((sample) => sample[key]).sort((a, b) => a - b)[
          Math.ceil(item.samples.length * 0.95) - 1
        ];
      assert.equal(
        item.p95LcpMs,
        p95('lcpMs'),
        'LCP summary must match samples',
      );
      assert.equal(
        item.p95InteractionMs,
        p95('interactionMs'),
        'Interaction summary must match samples',
      );
      assert.equal(
        item.maxCls,
        Math.max(...item.samples.map((sample) => sample.cls)),
        'CLS summary must match samples',
      );
      assert.equal(
        item.maxInitialJavaScriptGzipBytes,
        Math.max(
          ...item.samples.map((sample) => sample.initialJavaScriptGzipBytes),
        ),
        'JavaScript summary must match samples',
      );
      if (item.name === 'guide')
        bounded(
          item.maxInitialJavaScriptGzipBytes,
          150 * 1024,
          'initial guide JavaScript',
        );
    }
  }
}
