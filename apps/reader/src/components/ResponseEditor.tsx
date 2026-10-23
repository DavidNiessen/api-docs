import { useContext, useEffect, useRef, useState } from 'react';
import { contrastRatio } from '@api-docs/contracts';
import { EditorPreferencesContext } from '../use-reader-preferences.js';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/codicon.css';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/languages/definitions/xml/register.js';
import 'monaco-editor/languages/definitions/html/register.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { responseDisplay, responseLanguage } from '../response-view.js';
import { useUi } from '../ui-translation.js';
import { Icon } from './Icon.js';
import { CopyButton } from './CopyButton.js';

// Only the standalone editor and selected tokenizers are loaded, without language services.
globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() };
monaco.languages.register({
  id: 'json',
  aliases: ['JSON', 'json'],
  mimetypes: ['application/json'],
});
monaco.languages.setLanguageConfiguration('json', {
  brackets: [
    ['{', '}'],
    ['[', ']'],
  ],
});
monaco.languages.setMonarchTokensProvider('json', {
  defaultToken: '',
  tokenPostfix: '.json',
  tokenizer: {
    root: [
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key'],
      [/"(?:[^"\\]|\\.)*"/, 'string.value'],
      [/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/\b(?:true|false|null)\b/, 'keyword'],
      [/[{}[\]]/, '@brackets'],
      [/[:,]/, 'delimiter'],
    ],
  },
});

export default function ResponseEditor({
  body,
  contentType,
}: {
  body: string;
  contentType: string;
}) {
  const t = useUi();
  const { preferences, mode } = useContext(EditorPreferencesContext);
  const editorTheme =
    preferences.editorTheme === 'auto'
      ? mode === 'dark'
        ? 'vs-dark'
        : 'vs'
      : (
          {
            light: 'vs',
            dark: 'vs-dark',
            contrast: 'hc-black',
            custom: 'api-docs-personal',
          } as const
        )[preferences.editorTheme];
  const selectedTheme = useRef(editorTheme);
  selectedTheme.current = editorTheme;
  useEffect(() => {
    const colors = preferences.editorColors;
    monaco.editor.defineTheme('api-docs-personal', {
      base:
        contrastRatio(colors.background, '#ffffff') >
        contrastRatio(colors.background, '#000000')
          ? 'vs-dark'
          : 'vs',
      inherit: true,
      rules: [
        { token: 'string.key', foreground: colors.key.slice(1) },
        { token: 'string', foreground: colors.string.slice(1) },
        { token: 'string.value', foreground: colors.string.slice(1) },
        { token: 'number', foreground: colors.number.slice(1) },
        { token: 'keyword', foreground: colors.keyword.slice(1) },
      ],
      colors: {
        'editor.background': colors.background,
        'editor.foreground': colors.foreground,
        'editorLineNumber.foreground': colors.foreground + '99',
        'editorLineNumber.activeForeground': colors.foreground,
        'editorGutter.background': colors.background,
        'scrollbarSlider.background': colors.foreground + '33',
        'scrollbarSlider.hoverBackground': colors.foreground + '66',
        'scrollbarSlider.activeBackground': colors.foreground + '88',
      },
    });
    monaco.editor.setTheme(editorTheme);
  }, [editorTheme, preferences.editorColors]);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenDialog = useRef<HTMLDialogElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const viewState = useRef<monaco.editor.ICodeEditorViewState | null>(null);
  const previousBody = useRef(body);
  useEffect(() => {
    const element = fullscreenDialog.current;
    if (fullscreen && element) {
      element.showModal();
      fullscreenButton.current?.focus({ preventScroll: true });
    } else if (wasFullscreen.current) {
      fullscreenButton.current?.focus({ preventScroll: true });
    }
    wasFullscreen.current = fullscreen;
    return () => {
      if (element?.open) element.close();
    };
  }, [fullscreen]);
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [error, setError] = useState('');
  const language = responseLanguage(contentType);
  useEffect(() => {
    if (!host.current) return;
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let model: monaco.editor.ITextModel | undefined;
    try {
      model = monaco.editor.createModel(
        responseDisplay(body, language),
        language,
      );
      editor = monaco.editor.create(host.current, {
        model,
        theme: selectedTheme.current,
        readOnly: true,
        domReadOnly: true,
        ariaLabel: t('response.body'),
        accessibilitySupport: 'on',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 12,
        lineHeight: 21,
        padding: { top: 14, bottom: 14 },
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'always',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'none',
        contextmenu: false,
        links: false,
        colorDecorators: false,
        stickyScroll: { enabled: false },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false,
          alwaysConsumeMouseWheel: false,
        },
        tabIndex: 0,
      });
      if (previousBody.current === body && viewState.current)
        editor.restoreViewState(viewState.current);
      previousBody.current = body;
      instance.current = editor;
    } catch {
      setError(t('response.unavailable'));
    }
    return () => {
      viewState.current = editor?.saveViewState() ?? null;
      instance.current = null;
      editor?.dispose();
      model?.dispose();
    };
  }, [body, language, t, fullscreen]);
  const content = (
    <>
      <div className="response-editor-toolbar">
        <span>
          {t('response.body')}{' '}
          <small>
            {language === 'plaintext' ? 'Text' : language.toUpperCase()}
          </small>
        </span>
        <button
          type="button"
          onClick={() =>
            void instance.current?.getAction('editor.foldAll')?.run()
          }
        >
          {t('response.collapse')}
        </button>
        <button
          type="button"
          onClick={() =>
            void instance.current?.getAction('editor.unfoldAll')?.run()
          }
        >
          {t('response.expand')}
        </button>
        <button
          ref={fullscreenButton}
          type="button"
          className="response-fullscreen-toggle"
          aria-label={t(
            fullscreen ? 'response.exitFullscreen' : 'response.fullscreen',
          )}
          title={t(
            fullscreen ? 'response.exitFullscreen' : 'response.fullscreen',
          )}
          onClick={() => setFullscreen(!fullscreen)}
        >
          <Icon name={fullscreen ? 'minimize' : 'maximize'} size={16} />
        </button>
        <CopyButton text={body} label={t('response.copy')} />
      </div>
      {error && <p role="status">{error}</p>}
      <div
        ref={host}
        className="response-monaco"
        data-editor-theme={preferences.editorTheme}
        hidden={!!error}
      />
      {error && (
        <pre tabIndex={0} className="response-fallback">
          {body}
        </pre>
      )}
    </>
  );
  return (
    <>
      <div className="response-editor" hidden={fullscreen}>
        {!fullscreen && content}
      </div>
      <dialog
        ref={fullscreenDialog}
        className="response-fullscreen-dialog"
        aria-label={t('response.body')}
        onCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setFullscreen(false);
        }}
      >
        {fullscreen && content}
      </dialog>
    </>
  );
}
