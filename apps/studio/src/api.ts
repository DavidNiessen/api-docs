export class StudioApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export type StudioApi = <T>(
  path: string,
  method?: string,
  payload?: unknown,
  signal?: AbortSignal,
) => Promise<T>;
/** Same-origin only, bounded JSON, caller cancellation and no automatic mutation retries. */
export function createStudioApi(token: string): StudioApi {
  return async <T>(
    path: string,
    method = 'GET',
    payload?: unknown,
    signal?: AbortSignal,
  ): Promise<T> => {
    let url: URL;
    try {
      url = new URL(path, location.origin);
    } catch {
      throw new StudioApiError(0, 'Invalid management API destination.');
    }
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.length > 8192 ||
      url.origin !== location.origin ||
      url.username ||
      url.password ||
      url.hash ||
      url.pathname + url.search !== path ||
      !/^\/(?:api|auth)\//.test(url.pathname)
    )
      throw new StudioApiError(0, 'Invalid management API destination.');
    let status = 0;
    try {
      const response = await fetch(url.pathname + url.search, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(30000),
        ]),
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      status = response.status;
      if (response.ok && status === 204) return undefined as T;
      if (
        !/(?:\/|\+)json(?:\s*;|$)/i.test(
          response.headers.get('content-type') ?? '',
        )
      ) {
        await response.body?.cancel();
        throw new Error('Invalid response type');
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let text = '',
        bytes = 0;
      try {
        if (reader)
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 4 * 1024 * 1024) {
              await reader.cancel();
              throw new Error('Response too large');
            }
            text += decoder.decode(part.value, { stream: true });
          }
        text += decoder.decode();
      } catch (error) {
        await reader?.cancel().catch(() => {});
        throw error;
      } finally {
        reader?.releaseLock();
      }
      const data: unknown = JSON.parse(text);
      if (!response.ok) {
        const detail =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string' &&
          data.error.length <= 512
            ? data.error
            : `Request failed (${status}).`;
        throw new StudioApiError(status, detail);
      }
      return data as T;
    } catch (error) {
      if (error instanceof StudioApiError) throw error;
      if (status >= 400 && status < 500)
        throw new StudioApiError(status, `Request failed (${status}).`);
      throw new StudioApiError(
        status >= 500 ? status : 0,
        'The request could not be confirmed. Check your connection and try again.',
      );
    }
  };
}
