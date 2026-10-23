import assert from 'node:assert/strict';

export const vulnerabilityScanner = Object.freeze({
  name: 'grype',
  version: '0.121.0',
  archiveSha256:
    '64e07133d3486115de647a66581461dccf5c732748a0a3119077395565f15519',
  executableSha256:
    'bd511334178bc3002eb9eb58880f89e01e35f7fed7cfbe671171127a8afa3596',
});
export const securityPolicy = Object.freeze({
  maxDatabaseAgeHours: 48,
  blockedSeverities: ['Critical', 'High', 'Unknown'],
});
const hour = 60 * 60 * 1000;

/** Validate complete, unsuppressed scanner output before evaluating severity. */
export function validateContainerSecurity(report, image, now = Date.now()) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  assert.equal(report.descriptor.name, vulnerabilityScanner.name);
  assert.equal(report.descriptor.version, vulnerabilityScanner.version);
  assert.equal(report.source.type, 'image');
  // Grype's CycloneDX importer puts the inventory subject's configuration ID here.
  assert.equal(report.source.target.manifestDigest, image.slice(7));
  const config = report.descriptor.configuration;
  assert.equal(config['only-fixed'], false);
  assert.equal(config['only-notfixed'], false);
  assert.equal(config['ignore-wontfix'], '');
  assert.deepEqual(config.exclude, []);
  assert.deepEqual(config['vex-documents'], []);
  assert.deepEqual(config['vex-add'], []);
  assert.equal(config['show-suppressed'], true);
  assert.equal(config['include-matcher-suppressions'], true);
  assert.equal(config.db['validate-age'], true);
  assert.equal(config.db['validate-by-hash-on-start'], true);
  assert.equal(
    config.db['max-allowed-built-age'],
    securityPolicy.maxDatabaseAgeHours * hour * 1e6,
  );
  assert(
    report.ignoredMatches === undefined || Array.isArray(report.ignoredMatches),
    'Malformed suppressed findings.',
  );
  assert.equal(
    report.ignoredMatches?.length ?? 0,
    0,
    'Suppressed scanner findings require review; this gate has no waiver mechanism.',
  );
  const status = report.descriptor.db.status;
  assert.equal(status.valid, true);
  assert.match(status.schemaVersion, /^v6(?:\.\d+)+$/);
  const databaseUrl = new URL(status.from);
  assert.equal(databaseUrl.origin, 'https://grype.anchore.io');
  assert(databaseUrl.pathname.startsWith('/databases/v6/'));
  assert.match(
    databaseUrl.searchParams.get('checksum') ?? '',
    /^sha256:[a-f0-9]{64}$/,
  );
  const databaseBuilt = Date.parse(status.built);
  const scanned = Date.parse(report.descriptor.timestamp);
  for (const [timestamp, maxAge] of [
    [databaseBuilt, securityPolicy.maxDatabaseAgeHours * hour],
    [scanned, 24 * hour],
  ])
    assert(
      Number.isFinite(timestamp) &&
        timestamp <= now + 5 * 60 * 1000 &&
        timestamp >= now - maxAge,
      'Stale, future or invalid security evidence.',
    );
  assert(Array.isArray(report.matches) && report.matches.length <= 100000);
  const severities = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Negligible: 0,
    Unknown: 0,
  };
  const fixes = { fixed: 0, 'not-fixed': 0, 'wont-fix': 0, unknown: 0 };
  for (const match of report.matches) {
    assert(
      Object.hasOwn(severities, match.vulnerability.severity),
      'Unknown vulnerability severity.',
    );
    for (const value of [
      match.vulnerability.id,
      match.vulnerability.namespace,
      match.artifact.name,
      match.artifact.version,
    ])
      assert(typeof value === 'string' && value.length > 0);
    severities[match.vulnerability.severity]++;
    const state = match.vulnerability.fix?.state;
    assert(
      state === undefined || state === '' || Object.hasOwn(fixes, state),
      'Unknown vulnerability fix state.',
    );
    fixes[state || 'unknown']++;
  }
  const blockingMatches = securityPolicy.blockedSeverities.reduce(
    (sum, severity) => sum + severities[severity],
    0,
  );
  return {
    policy: securityPolicy,
    passed: blockingMatches === 0,
    blockingMatches,
    matches: report.matches.length,
    severities,
    fixes,
    database: {
      schemaVersion: status.schemaVersion,
      from: status.from,
      built: status.built,
    },
    scannedAt: report.descriptor.timestamp,
  };
}
