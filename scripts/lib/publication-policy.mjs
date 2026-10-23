import assert from 'node:assert/strict';
import { prerelease } from 'semver';
import { validateReleaseContext } from './release-assets.mjs';

function fields(value, names) {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    'Invalid publication policy object.',
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    [...names].sort(),
    'Missing or unknown publication policy fields.',
  );
}
function boolean(value) {
  assert.equal(
    typeof value,
    'boolean',
    'Publication decisions must be explicit booleans.',
  );
}

/** A public policy contains coordinates and decisions, never signing credentials. */
export function publicationPlan(policy, context, { packages, mavenGroup }) {
  validateReleaseContext(context);
  fields(policy, [
    'schemaVersion',
    'publicationEnabled',
    'environment',
    'npm',
    'maven',
    'container',
    'reviews',
  ]);
  assert.equal(policy.schemaVersion, 1);
  boolean(policy.publicationEnabled);
  assert.equal(policy.environment, 'release');
  fields(policy.npm, ['scope', 'ownershipVerified']);
  fields(policy.maven, [
    'groupId',
    'ownershipVerified',
    'signingKeyFingerprint',
  ]);
  fields(policy.container, ['repository', 'ownershipVerified']);
  fields(policy.reviews, [
    'security',
    'isolation',
    'accessibility',
    'licenses',
    'pilot',
  ]);
  assert.match(policy.npm.scope, /^@[a-z0-9][a-z0-9._-]{0,63}$/);
  assert.match(
    policy.maven.groupId,
    /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/,
  );
  assert.equal(
    policy.maven.groupId,
    mavenGroup,
    'Maven policy and source coordinates disagree.',
  );
  assert.match(
    policy.container.repository,
    /^ghcr\.io\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/,
  );
  if (policy.maven.signingKeyFingerprint !== null)
    assert.match(
      policy.maven.signingKeyFingerprint,
      /^(?:[A-F0-9]{40}|[A-F0-9]{64})$/,
    );
  assert(
    Array.isArray(packages) && packages.length > 0 && packages.length <= 64,
  );
  assert.equal(new Set(packages).size, packages.length);
  for (const name of packages) {
    assert(
      typeof name === 'string' && name.startsWith(policy.npm.scope + '/'),
      'npm policy and source scope disagree.',
    );
    assert.match(
      name.slice(policy.npm.scope.length + 1),
      /^[a-z0-9][a-z0-9._-]*$/,
    );
  }
  const blockers = [];
  if (!policy.publicationEnabled)
    blockers.push('Publication is disabled in the reviewed source policy.');
  for (const kind of ['npm', 'maven', 'container']) {
    boolean(policy[kind].ownershipVerified);
    if (!policy[kind].ownershipVerified)
      blockers.push(`${kind} namespace ownership is unverified.`);
  }
  if (policy.maven.signingKeyFingerprint === null)
    blockers.push('Maven signing key fingerprint is unconfigured.');
  for (const [kind, approved] of Object.entries(policy.reviews)) {
    boolean(approved);
    if (!approved) blockers.push(`${kind} launch review is pending.`);
  }
  return {
    schemaVersion: 1,
    ...context,
    policyApproved: blockers.length === 0,
    publicationApproved: false,
    blockers,
    environment: policy.environment,
    npm: {
      packages: [...packages].sort(),
      version: context.version,
      tag: prerelease(context.version) ? 'next' : 'latest',
    },
    maven: {
      groupId: policy.maven.groupId,
      version: context.version,
      signingKeyFingerprint: policy.maven.signingKeyFingerprint,
    },
    container: {
      repository: policy.container.repository,
      tag: context.version,
    },
  };
}

/** Identify a completed candidate workflow, not another successful workflow at the same commit. */
export function validateCandidateRun(run, context, workflowId) {
  validateReleaseContext(context);
  assert(Number.isSafeInteger(workflowId) && workflowId > 0);
  assert.equal(String(run.id), context.runId);
  assert.equal(
    String(run.run_attempt),
    context.runAttempt,
    'Candidate attempt differs.',
  );
  assert.equal(run.workflow_id, workflowId, 'Unexpected candidate workflow.');
  assert.equal(run.path, '.github/workflows/release-candidate.yml');
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success', 'Every candidate gate must pass.');
  assert.equal(run.head_sha, context.commit);
  assert.equal(run.repository?.full_name, context.repository);
  assert.equal(
    run.head_repository?.full_name,
    context.repository,
    'Fork candidates cannot be promoted.',
  );
}

/** Check actual environment protection before a publishing job can be queued. */
export function validatePublicationEnvironment(environment, branchPolicies) {
  assert.equal(environment.name, 'release');
  assert(
    environment.deployment_branch_policy?.custom_branch_policies === true &&
      environment.deployment_branch_policy.protected_branches === false,
    'Release environment must select explicit tag policies.',
  );
  assert(Array.isArray(environment.protection_rules));
  const rules = environment.protection_rules.filter(
    (rule) => rule.type === 'required_reviewers',
  );
  assert.equal(
    rules.length,
    1,
    'Release environment requires a reviewer gate.',
  );
  assert(Array.isArray(rules[0].reviewers) && rules[0].reviewers.length > 0);
  assert(
    rules[0].reviewers.every(
      (entry) =>
        ['User', 'Team'].includes(entry.type) &&
        Number.isSafeInteger(entry.reviewer?.id) &&
        entry.reviewer.id > 0,
    ),
    'Invalid release reviewers.',
  );
  assert(Array.isArray(branchPolicies.branch_policies));
  assert.equal(
    branchPolicies.branch_policies.length,
    1,
    'Release environment must allow only version tags.',
  );
  assert.equal(branchPolicies.branch_policies[0].type, 'tag');
  assert.equal(branchPolicies.branch_policies[0].name, 'v*');
  return {
    reviewers: rules[0].reviewers.length,
    preventSelfReview: rules[0].prevent_self_review === true,
    tagPolicy: 'v*',
  };
}

/** Publish selected dependencies before dependants, rejecting duplicates and cycles. */
export function npmPublicationOrder(metadata) {
  assert(
    Array.isArray(metadata) && metadata.length > 0 && metadata.length <= 64,
  );
  const packages = new Map(metadata.map((pkg) => [pkg.name, pkg]));
  assert.equal(packages.size, metadata.length);
  const visiting = new Set(),
    done = new Set(),
    output = [];
  function visit(name) {
    assert(!visiting.has(name), 'Cyclic npm publication dependencies.');
    if (done.has(name)) return;
    const pkg = packages.get(name);
    assert(pkg, 'Missing npm publication package.');
    visiting.add(name);
    for (const dependency of Object.keys({
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    }).sort())
      if (packages.has(dependency)) visit(dependency);
    visiting.delete(name);
    done.add(name);
    output.push(name);
  }
  for (const name of [...packages.keys()].sort()) visit(name);
  return output;
}
