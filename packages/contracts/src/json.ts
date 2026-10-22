/** A JSON syntax tree retains number tokens that JavaScript numbers cannot represent exactly. */
export type JsonValueNode =
  | { kind: 'number'; text: string }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'array'; items: JsonValueNode[] }
  | { kind: 'object'; entries: [string, JsonValueNode][] };

const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export function parseJsonValue(text: string): JsonValueNode {
  if (
    text.length > 1_048_576 ||
    new TextEncoder().encode(text).length > 1_048_576
  )
    throw new Error(
      'Field editing is limited to 1 MiB of JSON. Use the raw editor.',
    );
  try {
    JSON.parse(text);
  } catch {
    throw new Error('Enter valid JSON before editing fields.');
  }
  const token =
    /\s*("(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}:,]|\[|\])/y;
  let offset = 0,
    nodes = 0;
  const next = () => {
    token.lastIndex = offset;
    const match = token.exec(text);
    if (!match) throw new Error('Invalid JSON token');
    offset = token.lastIndex;
    return match[1]!;
  };
  const parse = (first: string, depth: number): JsonValueNode => {
    if (depth > 32 || ++nodes > 10_000)
      throw new Error(
        'JSON exceeds the field editor limit of 32 levels or 10,000 values. Use the raw editor.',
      );
    if (first === '{') {
      const entries: [string, JsonValueNode][] = [],
        names = new Set<string>();
      let key = next();
      if (key === '}') return { kind: 'object', entries };
      for (;;) {
        const name = JSON.parse(key) as string;
        if (names.has(name))
          throw new Error('Duplicate JSON properties require the raw editor.');
        names.add(name);
        next(); // colon; JSON.parse already validated the grammar
        entries.push([name, parse(next(), depth + 1)]);
        if (next() === '}') break;
        key = next();
      }
      return { kind: 'object', entries };
    }
    if (first === '[') {
      const items: JsonValueNode[] = [];
      let item = next();
      if (item === ']') return { kind: 'array', items };
      for (;;) {
        items.push(parse(item, depth + 1));
        if (next() === ']') break;
        item = next();
      }
      return { kind: 'array', items };
    }
    if (first.startsWith('"'))
      return { kind: 'string', value: JSON.parse(first) as string };
    if (first === 'null') return { kind: 'null' };
    if (first === 'true' || first === 'false')
      return { kind: 'boolean', value: first === 'true' };
    return { kind: 'number', text: first };
  };
  return parse(next(), 0);
}

export function serializeJsonValue(
  node: JsonValueNode,
  pretty = false,
): string {
  let nodes = 0;
  const write = (value: JsonValueNode, depth: number): string => {
    if (depth > 32 || ++nodes > 10_000)
      throw new Error(
        'JSON value exceeds the serialization limit of 32 levels or 10,000 values',
      );
    if (value.kind === 'number') {
      if (!number.test(value.text)) throw new Error('Invalid JSON number');
      return value.text;
    }
    if (value.kind === 'string' || value.kind === 'boolean')
      return JSON.stringify(value.value);
    if (value.kind === 'null') return 'null';
    const parts =
      value.kind === 'array'
        ? value.items.map((item) => write(item, depth + 1))
        : value.entries.map(
            ([key, child]) =>
              `${JSON.stringify(key)}:${pretty ? ' ' : ''}${write(child, depth + 1)}`,
          );
    const [open, close] = value.kind === 'array' ? ['[', ']'] : ['{', '}'];
    return !pretty || !parts.length
      ? `${open}${parts.join(',')}${close}`
      : `${open}\n${parts.map((part) => '  '.repeat(depth + 1) + part).join(',\n')}\n${'  '.repeat(depth)}${close}`;
  };
  return write(node, 0);
}

export function setJsonProperty(
  node: Extract<JsonValueNode, { kind: 'object' }>,
  name: string,
  value: JsonValueNode | undefined,
): Extract<JsonValueNode, { kind: 'object' }> {
  const exists = node.entries.some(([key]) => key === name);
  return {
    kind: 'object',
    entries: [
      ...node.entries.flatMap(([key, item]): [string, JsonValueNode][] =>
        key !== name
          ? [[key, item]]
          : value === undefined
            ? []
            : [[key, value]],
      ),
      ...(!exists && value !== undefined
        ? [[name, value] as [string, JsonValueNode]]
        : []),
    ],
  };
}
