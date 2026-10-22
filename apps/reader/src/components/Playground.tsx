import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ComponentProps, Ref } from 'react';
import { Explorer } from './Explorer.js';

type Props = Pick<
  ComponentProps<typeof Explorer>,
  'api' | 'operation' | 'basePath' | 'oauthClients'
> & { ref?: Ref<PlaygroundHandle> };

export interface PlaygroundHandle {
  open: (trigger: HTMLElement) => void;
}

/** A native modal keeps the underlying documentation inert and traps focus. */
export function Playground({ ref, ...props }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useImperativeHandle(ref, () => ({
    open: (element) => {
      returnFocus.current = element;
      update(true);
    },
  }));
  useEffect(() => {
    const sync = () =>
      setOpen(new URL(location.href).searchParams.get('playground') === 'open');
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [props.operation]);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.documentElement.style.overflow = previousOverflow;
      const target = returnFocus.current?.isConnected
        ? returnFocus.current
        : trigger.current?.querySelector<HTMLButtonElement>('button.try-now');
      target?.focus({ preventScroll: true });
      returnFocus.current = null;
    };
  }, [open]);
  function update(next: boolean) {
    const url = new URL(location.href);
    if (next) url.searchParams.set('playground', 'open');
    else url.searchParams.delete('playground');
    history.replaceState(
      history.state,
      '',
      url.pathname + url.search + url.hash,
    );
    setOpen(next);
  }
  return (
    <>
      <div ref={trigger} className="playground-preview">
        <Explorer
          {...props}
          previewOnly
          onOpen={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            update(true);
          }}
        />
      </div>
      <dialog
        ref={dialog}
        className="playground-dialog"
        aria-label={`${props.operation.summary} playground`}
        onCancel={(event) => {
          event.preventDefault();
          update(false);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            update(false);
        }}
      >
        {open && <Explorer {...props} onClose={() => update(false)} />}
      </dialog>
    </>
  );
}
