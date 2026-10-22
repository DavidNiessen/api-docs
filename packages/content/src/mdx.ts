import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function renderTrustedMdx(
  source: string,
  filename: string,
  basePath: string,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--max-old-space-size=192',
        fileURLToPath(new URL('./mdx-worker.js', import.meta.url)),
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '',
      failed = false;
    const fail = (message: string) => {
      if (!failed) {
        failed = true;
        child.kill('SIGKILL');
        reject(new Error(`${filename}: ${message}`));
      }
    };
    const timer = setTimeout(
      () => fail('Trusted MDX exceeded its 5 second execution limit'),
      5000,
    );
    child.once('error', () => fail('Unable to start the trusted MDX worker'));
    child.stdin.on('error', () => fail('Trusted MDX worker input failed'));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (Buffer.byteLength(output) > 8 * 1024 * 1024)
        fail('Trusted MDX exceeded its output limit');
    });
    child.stderr.on('data', () => {
      /* Never expose arbitrary trusted-content logs. */
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (failed) return;
      if (code !== 0) {
        reject(
          new Error(
            `${filename}: Trusted MDX failed. Review syntax, imports, component props and the worker memory limit.`,
          ),
        );
        return;
      }
      try {
        const value = JSON.parse(output) as { html?: unknown };
        if (typeof value.html !== 'string') throw new Error('Invalid output');
        resolve(value.html);
      } catch {
        reject(
          new Error(
            `${filename}: Trusted MDX produced invalid worker output. Avoid writing to stdout.`,
          ),
        );
      }
    });
    child.stdin.end(
      JSON.stringify({
        source,
        filename: pathToFileURL(filename).href,
        basePath,
      }),
    );
  });
}
