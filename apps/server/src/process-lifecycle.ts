/** Strict operator configuration, deliberately excluding values echoed from the environment. */
export function shutdownTimeout(value: string | undefined): number {
  if (value === undefined) return 30_000;
  if (!/^[1-9]\d*$/.test(value))
    throw new Error(
      'SHUTDOWN_TIMEOUT_MS must be an integer from 1000 to 300000',
    );
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 300_000)
    throw new Error(
      'SHUTDOWN_TIMEOUT_MS must be an integer from 1000 to 300000',
    );
  return timeout;
}
export const serverStartupFailure =
  'Server startup failed. Check database connectivity, OIDC/relay configuration, required variables and storage permissions.';

/** Own only this executable's signals and resources; embedded servers keep their host's lifecycle. */
export async function runProcessLifecycle({
  start,
  close,
  timeoutMs,
}: {
  start: (signal: AbortSignal) => Promise<void>;
  close: () => Promise<void>;
  timeoutMs: number;
}): Promise<void> {
  // Validate before installing listeners or acquiring application resources.
  shutdownTimeout(String(timeoutMs));
  const controller = new AbortController();
  let closing: Promise<void> | undefined;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  // Defer startup until boot and the signal handlers are both established.
  const boot = Promise.resolve().then(() => start(controller.signal));
  function stop() {
    if (closing) return;
    controller.abort();
    const deadline = setTimeout(() => {
      console.error(
        'Server shutdown exceeded its deadline. Terminating the process.',
      );
      process.exit(1);
    }, timeoutMs);
    closing = (async () => {
      try {
        // Startup owns partially acquired resources until it settles. In particular,
        // never end a pool while createServer is still initializing against it.
        await boot.catch(() => {});
        await close();
      } catch {
        console.error('Server shutdown failed. Terminating the process.');
        process.exit(1);
      } finally {
        clearTimeout(deadline);
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        finish();
      }
    })();
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  void boot.catch(() => {
    console.error(serverStartupFailure);
    process.exitCode = 1;
    stop();
  });
  await finished;
}
