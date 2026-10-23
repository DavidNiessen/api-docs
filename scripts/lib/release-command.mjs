import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Await both input and exit: early pipe closure is a handled failure, never an uncaught stream error. */
export async function releaseCommand(file, args, { input, ...options } = {}) {
  const operation = exec(file, args, options);
  const inputDone = new Promise((resolve) => {
    const stream = operation.child.stdin;
    if (!stream) return resolve(true);
    stream.once('error', () => resolve(true));
    stream.end(input?.length === 0 ? undefined : input, (error) =>
      resolve(Boolean(error)),
    );
  });
  const [result, inputFailed] = await Promise.all([operation, inputDone]);
  if (inputFailed)
    throw new Error('Release command did not accept its standard input.');
  return result;
}
