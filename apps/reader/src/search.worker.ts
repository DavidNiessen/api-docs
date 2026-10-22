import { search } from '@api-docs/search';
import type { SearchDocument, SearchResult } from '@api-docs/contracts';
type Input =
  | { kind: 'load'; index: SearchDocument[] }
  | {
      kind: 'query';
      id: number;
      query: string;
      filter: { version?: string; kind?: string };
    };
const worker = globalThis as unknown as {
  onmessage: ((message: MessageEvent<Input>) => void) | null;
  postMessage: (message: { id: number; results: SearchResult[] }) => void;
};
let index: SearchDocument[] = [];
worker.onmessage = ({ data }) => {
  if (data.kind === 'load') index = data.index;
  else
    worker.postMessage({
      id: data.id,
      results: search(index, data.query, data.filter),
    });
};
