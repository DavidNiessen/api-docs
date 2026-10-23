import { feedbackHref } from '@api-docs/contracts';
import type { ProjectConfig } from '@api-docs/contracts';
import { Icon } from './Icon.js';

export function PageFooter({
  source,
  config,
  path,
}: {
  source: string;
  config: ProjectConfig;
  path: string;
}) {
  const feedback = feedbackHref(config, path);
  return (
    <footer className="article-footer">
      <div>
        <Icon name="code" size={15} />
        <span>
          Source: <code>{source}</code>
        </span>
      </div>
      {feedback && (
        <a
          className="article-feedback"
          href={feedback}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          {config.feedback?.label ?? 'Report an issue'}
          <Icon name="arrow" size={13} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      <span>Built with api-docs</span>
    </footer>
  );
}
