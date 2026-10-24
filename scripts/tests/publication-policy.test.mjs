import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  npmPublicationOrder,
  publicationPlan,
  validateCandidateRun,
  validatePublicationEnvironment,
  validatePublicationRulesets,
} from '../lib/publication-policy.mjs';
import { readWorkspacePackages } from '../lib/workspaces.mjs';

const policy = JSON.parse(
  await readFile(new URL('../../release-policy.json', import.meta.url)),
);
const context = {
  repository: 'DavidNiessen/api-docs',
  commit: 'a'.repeat(40),
  version: '0.2.0',
  ref: 'refs/tags/v0.2.0',
  runId: '123',
  runAttempt: '1',
};
const source = {
  packages: ['@api-docs/contracts', '@api-docs/cli'],
  mavenGroup: 'dev.niessen',
};

const masterRules = {
  id: 12,
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [],
  conditions: { ref_name: { include: ['refs/heads/master'], exclude: [] } },
  rules: [
    {
      type: 'pull_request',
      parameters: {
        required_review_thread_resolution: true,
        required_approving_review_count: 0,
      },
    },
    { type: 'non_fast_forward' },
    { type: 'deletion' },
    {
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [{ context: 'Quality', integration_id: 15368 }],
      },
    },
  ],
};
const tagRules = {
  id: 13,
  target: 'tag',
  enforcement: 'active',
  bypass_actors: [],
  conditions: { ref_name: { include: ['refs/tags/v*'], exclude: [] } },
  rules: [{ type: 'update' }, { type: 'deletion' }],
};

test('actual repository rulesets must protect reviewed master and immutable version tags', () => {
  assert.deepEqual(validatePublicationRulesets(masterRules, tagRules), {
    branchRulesetId: 12,
    tagRulesetId: 13,
    requiredCheck: 'Quality',
    checksAppId: 15368,
    administratorBypasses: { branch: 0, tags: 0 },
  });
  const branch = structuredClone(masterRules);
  branch.conditions.ref_name.include = ['~DEFAULT_BRANCH'];
  validatePublicationRulesets(branch, tagRules);
  branch.bypass_actors = [
    { actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' },
  ];
  assert.equal(
    validatePublicationRulesets(branch, tagRules).administratorBypasses.branch,
    1,
  );
});

test('inactive, bypassed, excluded, mutable or unchecked release rulesets fail approval', () => {
  for (const mutate of [
    (branch) => {
      branch.enforcement = 'disabled';
    },
    (branch) => {
      branch.bypass_actors = [{ actor_id: 1, bypass_mode: 'always' }];
    },
    (branch) => {
      branch.conditions.ref_name.exclude = ['refs/heads/master'];
    },
    (branch) => {
      branch.rules[0].parameters.required_review_thread_resolution = false;
    },
    (branch) => {
      branch.rules = branch.rules.filter(
        (rule) => rule.type !== 'pull_request',
      );
    },
    (branch) => {
      branch.rules.at(-1).parameters.required_status_checks[0].context =
        'unrelated check';
    },
    (branch) => {
      branch.rules.at(-1).parameters.required_status_checks[0].integration_id =
        999;
    },
    (branch) => {
      branch.rules.at(-1).parameters.strict_required_status_checks_policy =
        false;
    },
    (_branch, tags) => {
      tags.rules = [{ type: 'deletion' }];
    },
    (_branch, tags) => {
      tags.conditions.ref_name.include = ['refs/tags/unrelated*'];
    },
  ]) {
    const branch = structuredClone(masterRules),
      tags = structuredClone(tagRules);
    mutate(branch, tags);
    assert.throws(() => validatePublicationRulesets(branch, tags));
  }
});

test('the default policy lists pending ownership and reviews without approving publication', () => {
  const plan = publicationPlan(policy, context, source);
  assert.equal(plan.policyApproved, false);
  assert.equal(plan.blockers.length, 10);
  assert.equal(plan.npm.tag, 'latest');
  assert.deepEqual(plan.npm.packages, ['@api-docs/cli', '@api-docs/contracts']);
  assert.equal(
    publicationPlan(
      policy,
      { ...context, version: '0.2.0-rc.1', ref: 'refs/tags/v0.2.0-rc.1' },
      source,
    ).npm.tag,
    'next',
  );
});

test('all source policy decisions and a signing identity are necessary for an approved plan', () => {
  const ready = structuredClone(policy);
  ready.publicationEnabled = true;
  for (const kind of ['npm', 'maven', 'container'])
    ready[kind].ownershipVerified = true;
  ready.maven.signingKeyFingerprint = 'A'.repeat(40);
  for (const kind of Object.keys(ready.reviews)) ready.reviews[kind] = true;
  assert.equal(publicationPlan(ready, context, source).policyApproved, true);
  ready.reviews.licenses = false;
  assert.deepEqual(publicationPlan(ready, context, source).blockers, [
    'licenses launch review is pending.',
  ]);
});

test('policy typos, embedded credentials, mismatched namespaces and truthy strings fail closed', () => {
  for (const change of [
    (p) => {
      p.publicationEnabled = 'true';
    },
    (p) => {
      p.npm.token = 'not-a-real-token';
    },
    (p) => {
      p.npm.scope = '@another-owner';
    },
    (p) => {
      p.maven.groupId = 'other.owner';
    },
    (p) => {
      p.maven.signingKeyFingerprint = 'unverified';
    },
    (p) => {
      p.container.repository = 'https://user:password@ghcr.io/owner/image';
    },
    (p) => {
      p.reviews.security = 'false';
    },
    (p) => {
      delete p.reviews.isolation;
    },
    (p) => {
      p.environment = 'unprotected';
    },
  ]) {
    const changed = structuredClone(policy);
    change(changed);
    assert.throws(() => publicationPlan(changed, context, source));
  }
});

test('promotion requires the exact successful upstream candidate workflow and attempt', () => {
  const run = {
    id: 123,
    run_attempt: 1,
    workflow_id: 456,
    path: '.github/workflows/release-candidate.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    head_sha: context.commit,
    repository: { full_name: context.repository },
    head_repository: { full_name: context.repository },
  };
  validateCandidateRun(run, context, 456);
  for (const fields of [
    { id: 999 },
    { run_attempt: 2 },
    { workflow_id: 789 },
    { path: '.github/workflows/quality.yml' },
    { event: 'pull_request' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { head_sha: 'b'.repeat(40) },
    { head_repository: { full_name: 'untrusted/fork' } },
  ])
    assert.throws(() =>
      validateCandidateRun({ ...run, ...fields }, context, 456),
    );
});

test('a real reviewer gate and tag-only environment policy are required before publishing', () => {
  const environment = {
    name: 'release',
    deployment_branch_policy: {
      custom_branch_policies: true,
      protected_branches: false,
    },
    protection_rules: [
      {
        type: 'required_reviewers',
        prevent_self_review: true,
        reviewers: [{ type: 'User', reviewer: { id: 42 } }],
      },
    ],
  };
  const branches = { branch_policies: [{ name: 'v*', type: 'tag' }] };
  assert.deepEqual(validatePublicationEnvironment(environment, branches), {
    reviewers: 1,
    preventSelfReview: true,
    tagPolicy: 'v*',
  });
  for (const fields of [
    { name: 'unprotected' },
    { protection_rules: [] },
    { deployment_branch_policy: null },
    { protection_rules: [{ type: 'required_reviewers', reviewers: [] }] },
  ])
    assert.throws(() =>
      validatePublicationEnvironment({ ...environment, ...fields }, branches),
    );
  for (const branch_policies of [
    [],
    [{ name: 'v*', type: 'branch' }],
    [{ name: '*', type: 'tag' }],
    [...branches.branch_policies, { name: 'master', type: 'branch' }],
  ])
    assert.throws(() =>
      validatePublicationEnvironment(environment, { branch_policies }),
    );
});

test('the actual public workspace is publishable in dependency order and matches the disabled policy', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const packages = (await readWorkspacePackages(root))
    .filter((pkg) => pkg.path && pkg.metadata.private !== true)
    .map((pkg) => pkg.metadata);
  const order = npmPublicationOrder(packages);
  assert.equal(order.length, packages.length);
  assert.equal(
    publicationPlan(policy, context, { ...source, packages: order })
      .policyApproved,
    false,
  );
  for (const pkg of packages)
    for (const dependency of Object.keys({
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    }))
      if (order.includes(dependency))
        assert(order.indexOf(dependency) < order.indexOf(pkg.name));
  assert.throws(
    () =>
      npmPublicationOrder([
        { name: 'a', dependencies: { b: '1' } },
        { name: 'b', dependencies: { a: '1' } },
      ]),
    /Cyclic/,
  );
  assert.throws(() => npmPublicationOrder([{ name: 'a' }, { name: 'a' }]));
});
