import type { Diagnostic, SiteData } from '@api-docs/contracts';
export interface BuildPlugin {
  name: string;
  version: string;
  pluginApi: '1';
  transform?: (
    site: Readonly<SiteData>,
    context: { signal: AbortSignal; diagnostic: (message: Diagnostic) => void },
  ) => Promise<SiteData> | SiteData;
}
export function definePlugin(plugin: BuildPlugin): BuildPlugin {
  if (
    !/^[a-zA-Z0-9@][a-zA-Z0-9@/._-]*$/.test(plugin.name) ||
    !/^\d+\.\d+\.\d+/.test(plugin.version) ||
    plugin.pluginApi !== '1'
  )
    throw new Error('Invalid plugin name, version or pluginApi (supported: 1)');
  return Object.freeze(plugin);
}
export async function applyPlugins(
  site: SiteData,
  plugins: BuildPlugin[],
  timeout = 10_000,
): Promise<SiteData> {
  const names = new Set<string>();
  let current = site;
  for (const candidate of plugins) {
    const plugin = definePlugin(candidate);
    if (names.has(plugin.name))
      throw new Error(`Duplicate plugin: ${plugin.name}`);
    names.add(plugin.name);
    if (!plugin.transform) continue;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const diagnostics: Diagnostic[] = [];
    try {
      current = await Promise.race([
        Promise.resolve(
          plugin.transform(structuredClone(current), {
            signal: controller.signal,
            diagnostic: (message) => diagnostics.push(message),
          }),
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Plugin timed out: ${plugin.name}`));
          }, timeout);
        }),
      ]);
      if (
        current.schemaVersion !== 1 ||
        !Array.isArray(current.apis) ||
        !Array.isArray(current.guides)
      )
        throw new Error(`Invalid plugin output: ${plugin.name}`);
      current.diagnostics.push(...diagnostics);
    } finally {
      clearTimeout(timer);
    }
  }
  return current;
}
