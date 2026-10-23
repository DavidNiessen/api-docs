/** Data-only build policy shared by the control plane and isolated runner. */
export interface IsolatedBuildLimits {
  timeoutMs: number;
  memoryMiB: number;
  cpus: number;
  pids: number;
  sourceMiB: number;
  outputMiB: number;
}
export const defaultIsolatedBuildLimits: Readonly<IsolatedBuildLimits> =
  Object.freeze({
    timeoutMs: 180000,
    memoryMiB: 2048,
    cpus: 2,
    pids: 128,
    sourceMiB: 128,
    outputMiB: 256,
  });
export interface SourceSnapshotInfo {
  digestVersion: 2;
  digest: string;
  bytes: number;
  files: number;
}
export interface BuildPolicy {
  schemaVersion: 1;
  image: string;
  config: string;
  trustPlugins: boolean;
  trustContent: boolean;
  limits: IsolatedBuildLimits;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const own = (value: Record<string, unknown>, key: string) =>
  Object.hasOwn(value, key) ? value[key] : undefined;
export function isImmutableBuilderImage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 512 &&
    /^(?:sha256:[a-f0-9]{64}|[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64})$/.test(
      value,
    )
  );
}
export function isVisibleBuildConfig(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 4096 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value) &&
    value.split('/').every((part) => part && !part.startsWith('.'))
  );
}
export function readIsolatedBuildLimits(
  input: unknown = {},
): IsolatedBuildLimits {
  if (
    !record(input) ||
    Object.keys(input).some(
      (key) => !Object.hasOwn(defaultIsolatedBuildLimits, key),
    )
  )
    throw new Error('Invalid isolated build limits');
  const ranges: Record<keyof IsolatedBuildLimits, readonly [number, number]> = {
    timeoutMs: [1000, 900000],
    memoryMiB: [512, 4096],
    cpus: [1, 4],
    pids: [32, 512],
    sourceMiB: [1, 1024],
    outputMiB: [32, 1024],
  };
  const result = { ...defaultIsolatedBuildLimits };
  for (const key of Object.keys(result) as (keyof IsolatedBuildLimits)[]) {
    const value = own(input, key) === undefined ? result[key] : own(input, key);
    const [minimum, maximum] = ranges[key];
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < minimum ||
      value > maximum
    )
      throw new Error('Invalid isolated build limits');
    result[key] = value;
  }
  return result;
}
export function readSourceSnapshotInfo(input: unknown): SourceSnapshotInfo {
  if (
    !record(input) ||
    Object.keys(input).some(
      (key) => !['digestVersion', 'digest', 'bytes', 'files'].includes(key),
    ) ||
    own(input, 'digestVersion') !== 2 ||
    typeof own(input, 'digest') !== 'string' ||
    !/^[a-f0-9]{64}$/.test(own(input, 'digest') as string)
  )
    throw new Error('Invalid source snapshot metadata');
  const bytes = own(input, 'bytes'),
    files = own(input, 'files');
  if (
    typeof bytes !== 'number' ||
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    bytes > 1024 * 1024 * 1024 ||
    typeof files !== 'number' ||
    !Number.isSafeInteger(files) ||
    files < 0 ||
    files > 30000
  )
    throw new Error('Invalid source snapshot metadata');
  return {
    digestVersion: 2,
    digest: own(input, 'digest') as string,
    bytes,
    files,
  };
}
export function readBuildPolicy(input: unknown): BuildPolicy {
  if (
    !record(input) ||
    Object.keys(input).some(
      (key) =>
        ![
          'schemaVersion',
          'image',
          'config',
          'trustPlugins',
          'trustContent',
          'limits',
        ].includes(key),
    ) ||
    (own(input, 'schemaVersion') !== undefined &&
      own(input, 'schemaVersion') !== 1)
  )
    throw new Error('Invalid build policy');
  const image = own(input, 'image');
  const rawConfig = own(input, 'config');
  const config = rawConfig === undefined ? 'docs.config.yaml' : rawConfig;
  if (!isImmutableBuilderImage(image) || !isVisibleBuildConfig(config))
    throw new Error(
      'Build policy requires an immutable image and visible project-relative config',
    );
  const rawPlugins = own(input, 'trustPlugins'),
    rawContent = own(input, 'trustContent');
  const trustPlugins = rawPlugins === undefined ? false : rawPlugins,
    trustContent = rawContent === undefined ? false : rawContent;
  if (typeof trustPlugins !== 'boolean' || typeof trustContent !== 'boolean')
    throw new Error('Build trust options must be booleans');
  return {
    schemaVersion: 1,
    image,
    config,
    trustPlugins,
    trustContent,
    limits: readIsolatedBuildLimits(own(input, 'limits')),
  };
}
