/** Resolve OpenAPI Header Reference Objects, separately from JSON Schema $ref semantics. */
export function resolveHeaderObject(
  input: unknown,
  lookup: (reference: string) => unknown,
  legacy: boolean,
): Record<string, unknown> {
  const chain = new Set<string>();
  function resolve(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Header Object reference could not resolve to an object');
    const header = value as Record<string, unknown>;
    if (!Object.hasOwn(header, '$ref')) return header;
    if (
      typeof header.$ref !== 'string' ||
      chain.has(header.$ref) ||
      chain.size >= 64
    )
      throw new Error(
        'Circular, invalid or excessive Header Object reference chain',
      );
    chain.add(header.$ref);
    const target = resolve(lookup(header.$ref));
    return legacy
      ? target
      : {
          ...target,
          ...(typeof header.description === 'string'
            ? { description: header.description }
            : {}),
        };
  }
  return resolve(input);
}
