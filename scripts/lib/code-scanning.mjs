import assert from 'node:assert/strict';

/** Assess the current, unsuppressed results produced by a successful CodeQL job. */
export function assessCodeScanning(report) {
  assert.equal(report.version, '2.1.0');
  assert(Array.isArray(report.runs) && report.runs.length > 0);
  const counts = { critical: 0, high: 0, medium: 0, low: 0, other: 0 };
  for (const run of report.runs) {
    assert.equal(run.tool?.driver?.name, 'CodeQL');
    assert(Array.isArray(run.tool.driver.rules));
    const rules = run.tool.driver.rules;
    const byId = new Map(rules.map((rule) => [rule.id, rule]));
    assert.equal(byId.size, rules.length, 'Duplicate CodeQL rule identities.');
    for (const rule of rules)
      assert(typeof rule.id === 'string' && rule.id.length > 0);
    assert(run.invocations === undefined || Array.isArray(run.invocations));
    for (const invocation of run.invocations ?? [])
      assert.equal(
        invocation.executionSuccessful,
        true,
        'CodeQL execution failed.',
      );
    assert(run.results === undefined || Array.isArray(run.results));
    for (const result of run.results ?? []) {
      assert(
        result.suppressions === undefined ||
          (Array.isArray(result.suppressions) &&
            result.suppressions.length === 0),
        'Suppressed CodeQL findings require review; this gate has no waivers.',
      );
      assert(
        result.baselineState === undefined || result.baselineState !== 'absent',
        'Assess current results rather than a baseline comparison.',
      );
      const rule = byId.get(result.ruleId);
      assert(rule, 'Unresolved CodeQL result rule.');
      if (result.ruleIndex !== undefined)
        assert(
          Number.isInteger(result.ruleIndex) &&
            rules[result.ruleIndex] === rule,
          'CodeQL result rule ID/index mismatch.',
        );
      const value = rule.properties?.['security-severity'];
      const security = rule.properties?.tags?.includes('security');
      if (value === undefined) {
        assert(!security, 'Security findings must declare a numeric severity.');
        counts.other++;
        continue;
      }
      assert(
        typeof value === 'string' &&
          /^(?:[0-9](?:\.\d+)?|10(?:\.0+)?)$/.test(value),
        'Invalid CodeQL security severity.',
      );
      const severity = Number(value);
      counts[
        severity >= 9
          ? 'critical'
          : severity >= 7
            ? 'high'
            : severity >= 4
              ? 'medium'
              : 'low'
      ]++;
    }
  }
  const blockingFindings = counts.critical + counts.high;
  return {
    passed: blockingFindings === 0,
    blockingFindings,
    counts,
  };
}
