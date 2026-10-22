import type { Diagnostic, SiteData } from '@api-docs/contracts';
import { validatePluginSite } from './validation.js';
export interface BuildPlugin {
  name: string;
  version: string;
  pluginApi: '1';
  inputs?: string[];
  capabilities?: ['transform'];
  transform?: (
    site: Readonly<SiteData>,
    context: { signal: AbortSignal; diagnostic: (message: Diagnostic) => void },
  ) => Promise<SiteData> | SiteData;
}
export function definePlugin(plugin: BuildPlugin): BuildPlugin {
  if (
    !plugin ||
    typeof plugin !== 'object' ||
    !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(plugin.name) ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      plugin.version,
    ) ||
    plugin.pluginApi !== '1' ||
    (plugin.transform !== undefined &&
      typeof plugin.transform !== 'function') ||
    (plugin.inputs !== undefined &&
      (!Array.isArray(plugin.inputs) ||
        plugin.inputs.length > 128 ||
        plugin.inputs.some(
          (input) => typeof input !== 'string' || !input || input.length > 1024,
        ))) ||
    (plugin.capabilities !== undefined &&
      (!Array.isArray(plugin.capabilities) ||
        plugin.capabilities.length !== 1 ||
        plugin.capabilities[0] !== 'transform'))
  )
    throw new Error('Invalid plugin name, version or pluginApi (supported: 1)');
  return Object.freeze(plugin);
}
export { runPluginFiles, checkPluginConformance } from './runner.js';
export type { PluginExecution } from './runner.js';
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
      current = validatePluginSite(current);
    } finally {
      clearTimeout(timer);
    }
  }
  return current;
}
