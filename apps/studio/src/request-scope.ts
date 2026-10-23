import { StudioApiError } from './api.js';
import type { StudioApi } from './api.js';

/** A cancelled view cannot consume results or begin another request in a workflow. */
export function createStudioRequestScope(
  transport: StudioApi,
  onUnauthorized?: () => void,
) {
  const controller = new AbortController();
  const api: StudioApi = async <T>(
    path: string,
    method?: string,
    payload?: unknown,
    caller?: AbortSignal,
  ) => {
    const signal = caller
      ? AbortSignal.any([controller.signal, caller])
      : controller.signal;
    signal.throwIfAborted();
    try {
      const result = await transport<T>(path, method, payload, signal);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (
        !signal.aborted &&
        error instanceof StudioApiError &&
        error.status === 401
      ) {
        controller.abort();
        onUnauthorized?.();
      }
      throw error;
    }
  };
  return { api, signal: controller.signal, cancel: () => controller.abort() };
}
