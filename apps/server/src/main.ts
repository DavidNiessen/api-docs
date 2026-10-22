import { PostgresRepository } from '@api-docs/storage';
import { createServer } from './index.js';
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
async function start() {
  const repository = new PostgresRepository(required('DATABASE_URL'));
  const app = await createServer({
    repository,
    artifactRoot: process.env.ARTIFACT_ROOT ?? '/data/artifacts',
    rootToken: required('ROOT_TOKEN'),
    publicUrl: required('PUBLIC_URL'),
    insecureDevelopment: process.env.INSECURE_DEVELOPMENT === 'true',
    ...(process.env.STUDIO_ROOT ? { studioRoot: process.env.STUDIO_ROOT } : {}),
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
    'Server startup failed. Check database connectivity, OIDC configuration, required variables and storage permissions.',
  );
  process.exitCode = 1;
});
