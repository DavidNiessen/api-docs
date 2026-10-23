/** Browser-only plugin API. Importing this subpath never loads Node build workers. */
export interface ReaderPage {
  readonly path: string;
  readonly title: string;
  readonly locale: string;
  readonly kind: 'guide' | 'operation' | 'lifecycle' | 'not-found';
}
export interface ReaderWidget {
  element: HTMLElement;
  dispose?: () => void;
}
export interface ReaderExtensionContext {
  readonly basePath: string;
  readonly signal: AbortSignal;
  getPage(): Readonly<ReaderPage>;
  onPageChange(listener: (page: Readonly<ReaderPage>) => void): () => void;
  setFooter(
    render: (page: Readonly<ReaderPage>) => ReaderWidget | undefined,
  ): () => void;
}
export interface ReaderExtension {
  id: string;
  version: string;
  pluginApi: '1';
  capabilities: readonly ('page' | 'footer')[];
  activate(
    context: ReaderExtensionContext,
  ): void | (() => void) | Promise<void | (() => void)>;
}
export function defineReaderExtension<T extends ReaderExtension>(
  extension: T,
): T {
  if (
    !extension ||
    typeof extension.id !== 'string' ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(extension.id) ||
    typeof extension.version !== 'string' ||
    extension.version.length > 64 ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      extension.version,
    ) ||
    extension.pluginApi !== '1' ||
    typeof extension.activate !== 'function' ||
    !Array.isArray(extension.capabilities) ||
    !extension.capabilities.length ||
    extension.capabilities.length > 2 ||
    new Set(extension.capabilities).size !== extension.capabilities.length ||
    !extension.capabilities.every(
      (capability) => capability === 'page' || capability === 'footer',
    )
  )
    throw new Error('Invalid reader extension metadata');
  return extension;
}
function snapshot(page: ReaderPage): Readonly<ReaderPage> {
  if (
    !page.path.startsWith('/') ||
    page.path.includes('?') ||
    page.path.includes('#') ||
    page.path.length > 4096 ||
    !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(page.locale) ||
    !['guide', 'operation', 'lifecycle', 'not-found'].includes(page.kind)
  )
    throw new Error('Invalid reader page metadata');
  return Object.freeze({
    path: page.path,
    title: page.title.slice(0, 256),
    locale: page.locale,
    kind: page.kind,
  });
}
/** Lifecycle isolation and SDK cleanup; trusted extension code retains full origin privileges. */
export function createReaderExtensionSession(
  extension: ReaderExtension,
  initial: ReaderPage,
  options: {
    basePath: string;
    mount: (widget: ReaderWidget | undefined) => void;
    onError?: () => void;
    timeoutMs?: number;
  },
) {
  defineReaderExtension(extension);
  let page = snapshot(initial),
    closed = false,
    cleanup: (() => void) | undefined;
  let renderer:
      ((page: Readonly<ReaderPage>) => ReaderWidget | undefined) | undefined,
    widget: ReaderWidget | undefined;
  let settleDeadline: (value: boolean) => void = () => {};
  const listeners = new Set<(page: Readonly<ReaderPage>) => void>();
  const controller = new AbortController();
  const safely = (action: (() => void) | undefined) => {
    try {
      action?.();
    } catch {
      /* Cleanup is best effort; no extension values enter logs. */
    }
  };
  const clearWidget = () => {
    const previous = widget;
    widget = undefined;
    safely(previous?.dispose);
    safely(() => options.mount(undefined));
  };
  const dispose = () => {
    if (closed) return;
    closed = true;
    settleDeadline(false);
    clearTimeout(timer);
    controller.abort();
    listeners.clear();
    renderer = undefined;
    clearWidget();
    const previous = cleanup;
    cleanup = undefined;
    safely(previous);
  };
  const failed = () => {
    if (closed) return;
    dispose();
    safely(options.onError);
  };
  const render = () => {
    if (!renderer || closed) return;
    clearWidget();
    widget = renderer(page);
    options.mount(widget);
  };
  const requireCapability = (capability: 'page' | 'footer') => {
    controller.signal.throwIfAborted();
    if (!extension.capabilities.includes(capability))
      throw new Error('Reader extension capability was not declared');
  };
  let expire: () => void = () => {};
  const deadline = new Promise<boolean>((resolve) => {
    settleDeadline = resolve;
    expire = () => {
      failed();
      resolve(false);
    };
  });
  const timer = setTimeout(() => expire(), options.timeoutMs ?? 5000);
  const activated = Promise.resolve()
    .then(async () => {
      if (closed) return false;
      const result = await extension.activate({
        basePath: options.basePath,
        signal: controller.signal,
        getPage: () => page,
        onPageChange(listener) {
          requireCapability('page');
          listeners.add(listener);
          listener(page);
          return () => listeners.delete(listener);
        },
        setFooter(factory) {
          requireCapability('footer');
          renderer = factory;
          render();
          return () => {
            if (renderer === factory) {
              renderer = undefined;
              clearWidget();
            }
          };
        },
      });
      if (result !== undefined && typeof result !== 'function')
        throw new Error('Invalid reader extension cleanup');
      const disposeResult = typeof result === 'function' ? result : undefined;
      if (closed) safely(disposeResult);
      else cleanup = disposeResult;
      return !closed;
    })
    .catch(() => {
      failed();
      return false;
    });
  const ready = Promise.race([activated, deadline]).finally(() =>
    clearTimeout(timer),
  );
  return {
    ready,
    dispose,
    update(next: ReaderPage) {
      if (closed) return;
      page = snapshot(next);
      try {
        for (const listener of [...listeners]) listener(page);
        render();
      } catch {
        failed();
      }
    },
  };
}
