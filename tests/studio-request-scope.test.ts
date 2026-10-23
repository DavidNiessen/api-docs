import { expect, it, vi } from 'vitest';
import { StudioApiError } from '../apps/studio/src/api.js';
import type { StudioApi } from '../apps/studio/src/api.js';
import { createStudioRequestScope } from '../apps/studio/src/request-scope.js';

it('rejects a late result even when transport ignores cancellation', async () => {
  let release!: (value: unknown) => void;
  const response = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const transport: StudioApi = async <T>() => (await response) as T;
  const scope = createStudioRequestScope(transport);
  const request = scope.api('/api/projects');
  scope.cancel();
  release([{ id: 'old project' }]);
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
});
it('prevents another workflow step after cancellation and does not retry mutations', async () => {
  const transport = vi.fn(async () => undefined) as StudioApi;
  const scope = createStudioRequestScope(transport);
  await scope.api('/api/projects/one/artifacts', 'POST', {
    artifactId: 'reviewed',
  });
  scope.cancel();
  await expect(
    scope.api('/api/projects/one/publications', 'POST', {}),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(transport).toHaveBeenCalledTimes(1);
});
it('preserves cancellation from an individual caller without cancelling the whole view', async () => {
  const transport = vi.fn(async () => undefined) as StudioApi;
  const scope = createStudioRequestScope(transport);
  const caller = new AbortController();
  caller.abort();
  await expect(
    scope.api('/api/projects', 'GET', undefined, caller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  await expect(scope.api('/api/projects')).resolves.toBeUndefined();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(scope.signal.aborted).toBe(false);
});
it('expires the view once on authentication failure and blocks outstanding workflow steps', async () => {
  const expired = vi.fn();
  const transport = vi.fn(async () => {
    throw new StudioApiError(401, 'Unauthorized');
  }) as StudioApi;
  const scope = createStudioRequestScope(transport, expired);
  await expect(scope.api('/api/projects')).rejects.toMatchObject({
    status: 401,
  });
  await expect(scope.api('/api/projects')).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(expired).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalledTimes(1);
});
it('retains a valid session on permission or service failures', async () => {
  for (const status of [403, 404, 409, 503]) {
    const expired = vi.fn();
    const transport: StudioApi = async () => {
      throw new StudioApiError(status, 'Rejected');
    };
    const scope = createStudioRequestScope(transport, expired);
    await expect(scope.api('/api/projects')).rejects.toMatchObject({ status });
    expect(expired).not.toHaveBeenCalled();
    expect(scope.signal.aborted).toBe(false);
  }
});
it('ignores an authentication failure from an already cancelled view', async () => {
  let fail!: (error: Error) => void;
  const response = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const transport: StudioApi = async () => response;
  const expired = vi.fn();
  const scope = createStudioRequestScope(transport, expired);
  const request = scope.api('/api/projects');
  scope.cancel();
  fail(new StudioApiError(401, 'Previous identity'));
  await expect(request).rejects.toMatchObject({ status: 401 });
  expect(expired).not.toHaveBeenCalled();
});
