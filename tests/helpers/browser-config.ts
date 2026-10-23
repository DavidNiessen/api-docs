type BrowserName = 'chromium' | 'firefox' | 'webkit';

/** Preserve Chromium defaults and never pass its executable or flags to another engine. */
export function browserOptions(
  environment: Record<string, string | undefined> = process.env,
): {
  browserName: BrowserName;
  launchOptions?: { executablePath?: string; args: string[] };
} {
  const browserName = environment.PLAYWRIGHT_BROWSER ?? 'chromium';
  if (
    browserName !== 'chromium' &&
    browserName !== 'firefox' &&
    browserName !== 'webkit'
  )
    throw new Error('PLAYWRIGHT_BROWSER must be chromium, firefox or webkit.');
  return {
    browserName,
    ...(browserName === 'chromium'
      ? {
          launchOptions: {
            ...(environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
              ? {
                  executablePath:
                    environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
                }
              : {}),
            args: ['--no-sandbox'],
          },
        }
      : {}),
  };
}
