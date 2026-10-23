import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PostgresRepository } from '@api-docs/storage';
import { createServer } from './index.js';
import { readTextFile } from '@api-docs/spec';
import { parseRelayPolicy } from './relay-policy.js';
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
async function secret(name: string): Promise<string> {
  if (process.env[name]) return process.env[name]!;
  const path = process.env[`${name}_FILE`];
  if (path) return (await readFile(path, 'utf8')).replace(/\r?\n$/, '');
  throw new Error(
    `Missing required credential binding: ${name} or ${name}_FILE`,
  );
}
async function start() {
  const relay = process.env.RELAY_CONFIG_FILE
    ? parseRelayPolicy(
        JSON.parse(
          await readTextFile(
            await realpath(process.env.RELAY_CONFIG_FILE),
            64 * 1024,
          ),
        ),
      )
    : undefined;
  const repository = new PostgresRepository(await secret('DATABASE_URL'));
  const app = await createServer({
    ...(relay ? { relay } : {}),
    repository,
    artifactRoot: process.env.ARTIFACT_ROOT ?? '/data/artifacts',
    rootToken: await secret('ROOT_TOKEN'),
    publicUrl: required('PUBLIC_URL'),
    insecureDevelopment: process.env.INSECURE_DEVELOPMENT === 'true',
    studioRoot:
      process.env.STUDIO_ROOT ??
      fileURLToPath(new URL('../../studio/dist/client/', import.meta.url)),
    ...(process.env.OIDC_ISSUER
      ? {
          oidc: {
            issuer: process.env.OIDC_ISSUER,
            clientId: required('OIDC_CLIENT_ID'),
            ...(process.env.OIDC_CLIENT_SECRET
              ? { clientSecret: process.env.OIDC_CLIENT_SECRET }
              : {}),
            allowedHosts:
              process.env.OIDC_ALLOWED_HOSTS?.split(',').filter(Boolean) ?? [],
          },
        }
      : {}),
  });
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 8080),
  });
  const close = async () => {
    await app.close();
    await repository.close();
  };
  process.once('SIGINT', () => {
    void close();
  });
  process.once('SIGTERM', () => {
    void close();
  });
}
void start().catch(() => {
  console.error(
    'Server startup failed. Check database connectivity, OIDC/relay configuration, required variables and storage permissions.',
  );
  process.exitCode = 1;
});
