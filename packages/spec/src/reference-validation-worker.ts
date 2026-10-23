import { parentPort, workerData } from 'node:worker_threads';
import { bundleReferenceSources } from './reference-bundle.js';
try {
  const data = workerData as {
    root: string;
    sources: { url: string; source: Uint8Array }[];
  };
  await bundleReferenceSources(
    data.root,
    new Map(data.sources.map((item) => [item.url, Buffer.from(item.source)])),
  );
  parentPort!.postMessage({ valid: true });
} catch {
  parentPort!.postMessage({
    error:
      'Pinned reference validation failed. Require OpenAPI 3.0/3.1, approved JSON Pointer references, and no URI-rebasing or dynamic schema keywords.',
  });
}
