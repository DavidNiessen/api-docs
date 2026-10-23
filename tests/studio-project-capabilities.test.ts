import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readProjectCapabilities } from '../apps/studio/src/project-capabilities.js';

it('accepts explicit permissions for the selected project and omits unknown fields', () => {
  const projectId = randomUUID();
  const input = {
    projectId,
    publish: true,
    manageAccess: false,
    readAudit: false,
  };
  expect(
    readProjectCapabilities({ ...input, hostPath: '/private' }, projectId),
  ).toEqual(input);
});
it('rejects foreign project identities, missing or truthy non-boolean permission flags', () => {
  const projectId = randomUUID();
  const input = {
    projectId,
    publish: false,
    manageAccess: false,
    readAudit: false,
  };
  for (const change of [
    { projectId: randomUUID() },
    { publish: 'true' },
    { manageAccess: 1 },
    { readAudit: undefined },
  ])
    expect(() =>
      readProjectCapabilities({ ...input, ...change }, projectId),
    ).toThrow('Invalid project permissions');
  for (const value of [
    null,
    [],
    'admin',
    { ...input, projectId: 'not-a-uuid' },
  ])
    expect(() => readProjectCapabilities(value, projectId)).toThrow();
});
