#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { Command } from 'commander';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { watch } from 'node:fs';
import { compileProject, auditDocumentation } from '@api-docs/compiler';
import { loadSpec, diffApi, parseConfig } from '@api-docs/spec';
import { checkPluginConformance } from '@api-docs/plugin-sdk';
import {
  buildSite,
  createStaticServer,
  stageArtifact,
  createDevelopmentBuilder,
} from './index.js';
const program = new Command()
  .name('api-docs')
  .description(
    'Self-hosted API documentation: build, validate, preview and publish.',
  )
  .version('0.1.0');
const buildOptions = (command: Command): Command =>
  command
    .option('-c, --config <file>', 'project config file', 'docs.config.yaml')
    .option(
      '-o, --output <directory>',
      'output directory inside the project .api-docs folder',
      '.api-docs/site',
    )
    .option('--trust-plugins', 'allow reviewed local build plugins to execute')
    .option(
      '--trust-content',
      'allow reviewed MDX content to execute in bounded workers',
    );
buildOptions(
  program
    .command('build [project]')
    .alias('export')
    .description('Build a verified static publication'),
).action(
  async (
    project = '.',
    options: {
      config: string;
      output: string;
      trustPlugins?: boolean;
      trustContent?: boolean;
    },
  ) => {
    const result = await buildSite(project, options);
    for (const diagnostic of result.site.diagnostics)
      console.warn(`${diagnostic.severity}: ${diagnostic.message}`);
    console.log(
      `Built ${result.site.guides.length} guides and ${result.site.apis.reduce((count, api) => count + api.operations.length, 0)} endpoints in ${result.directory}`,
    );
  },
);
for (const mode of ['validate', 'doctor'] as const)
  program
    .command(`${mode} [project]`)
    .description(
      'Validate specs, guides, configuration and documentation quality',
    )
    .option('-c, --config <file>', 'project config file', 'docs.config.yaml')
    .option('--strict', 'fail on warnings')
    .option('--json', 'machine-readable output')
    .option('--trust-plugins', 'allow reviewed local plugins')
    .option(
      '--trust-content',
      'allow reviewed MDX content to execute in bounded workers',
    )
    .action(
      async (
        project = '.',
        options: {
          config: string;
          strict?: boolean;
          json?: boolean;
          trustPlugins?: boolean;
          trustContent?: boolean;
        },
      ) => {
        const site = await compileProject(
          resolve(project),
          options.config,
          options,
        );
        if (mode === 'doctor')
          site.diagnostics = await auditDocumentation(site);
        console.log(
          options.json
            ? JSON.stringify(site.diagnostics)
            : site.diagnostics.length
              ? site.diagnostics
                  .map(
                    (diagnostic) =>
                      `${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}`,
                  )
                  .join('\n')
              : 'Validation passed with no diagnostics.',
        );
        if (
          site.diagnostics.some(
            (diagnostic) => diagnostic.severity === 'error' || options.strict,
          )
        )
          process.exitCode = 1;
      },
    );
program
  .command('serve <directory>')
  .description('Serve an existing static publication')
  .option('--port <port>', 'listening port', '3000')
  .option('--host <host>', 'listening interface', '127.0.0.1')
  .action(
    async (directory: string, options: { port: string; host: string }) => {
      const app = await createStaticServer(directory);
      await app.listen({ port: Number(options.port), host: options.host });
      console.log(`Documentation server started on port ${options.port}.`);
      const close = () => {
        void app.close();
      };
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    },
  );
buildOptions(
  program
    .command('dev [project]')
    .description('Build, watch project sources and serve a local preview'),
)
  .option('--port <port>', 'listening port', '3000')
  .option('--host <host>', 'listening interface', '127.0.0.1')
  .action(
    async (
      project = '.',
      options: {
        config: string;
        output: string;
        trustPlugins?: boolean;
        trustContent?: boolean;
        port: string;
        host: string;
      },
    ) => {
      const root = resolve(project);
      const builder = createDevelopmentBuilder(root, options);
      const result = await builder.build();
      const app = await createStaticServer(result.directory);
      await app.listen({ port: Number(options.port), host: options.host });
      let running = false;
      let pending = false;
      const changes = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const rebuild = async () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        try {
          const files = [...changes];
          changes.clear();
          const built = await builder.build(files);
          console.log(
            `${built.mode === 'incremental' ? 'Changed guides' : 'Documentation'} rebuilt. Refresh to see changes.`,
          );
        } catch (error) {
          console.error(
            error instanceof Error ? error.message : 'Build failed',
          );
        } finally {
          running = false;
          if (pending) {
            pending = false;
            void rebuild();
          }
        }
      };
      const watcher = watch(root, { recursive: true }, (_event, filename) => {
        if (
          !filename ||
          /(^|[/\\])(\.api-docs|node_modules|\.git)([/\\]|$)/.test(filename)
        )
          return;
        changes.add(filename);
        clearTimeout(timer);
        timer = setTimeout(() => {
          void rebuild();
        }, 150);
      });
      console.log(
        `Watching project sources. Documentation server started on port ${options.port}.`,
      );
      const close = () => {
        watcher.close();
        clearTimeout(timer);
        void app.close();
      };
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    },
  );
program
  .command('init [directory]')
  .description(
    'Create a minimal documentation project without overwriting existing files',
  )
  .action(async (directory = '.') => {
    const root = resolve(directory);
    await mkdir(root, { recursive: true });
    const files = {
      'docs.config.yaml':
        'schemaVersion: 1\nname: My API\nspecs:\n  - id: api\n    path: openapi.yaml\n',
      'openapi.yaml':
        'openapi: 3.1.0\ninfo:\n  title: My API\n  version: v1\nservers:\n  - url: https://api.example.com\npaths:\n  /health:\n    get:\n      operationId: getHealth\n      summary: Get health\n      description: Check whether the API is available.\n      responses:\n        "200":\n          description: Healthy\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n                    example: ok\n',
      'guides/introduction.md':
        '---\ntitle: Introduction\ndescription: Welcome to your API documentation.\n---\n\n## Get started\n\nConfigure your OpenAPI source in `docs.config.yaml`, then build and serve your documentation.\n',
    };
    for (const file of Object.keys(files)) {
      try {
        await access(join(root, file));
        throw new Error(`Refusing to overwrite ${file}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    for (const [file, content] of Object.entries(files)) {
      await mkdir(resolve(root, file, '..'), { recursive: true });
      await writeFile(join(root, file), content, { flag: 'wx' });
    }
    console.log(
      'Created docs.config.yaml, openapi.yaml and guides/introduction.md.',
    );
  });
program
  .command('diff <before> <after>')
  .description('Classify API contract changes and flag uncertain compatibility')
  .option('--json', 'machine-readable change array')
  .option('--allow-review', 'allow review findings without a failing exit code')
  .action(
    async (
      before: string,
      after: string,
      options: { json?: boolean; allowReview?: boolean },
    ) => {
      const load = async (file: string) => {
        const absolute = resolve(file);
        return loadSpec(dirname(absolute), {
          id: 'api',
          path: basename(absolute),
        });
      };
      const [oldApi, newApi] = await Promise.all([load(before), load(after)]);
      const changes = diffApi(oldApi, newApi);
      console.log(
        options.json
          ? JSON.stringify(changes)
          : changes.length
            ? changes
                .map(
                  (change) =>
                    `${change.severity} [${change.code}] ${change.operation} ${change.location}: ${change.message}${change.referenceUrl ? ` See ${change.referenceUrl}` : ''}`,
                )
                .join('\n')
            : 'No classified contract changes detected. See the documented compatibility coverage.',
      );
      if (changes.some((change) => change.severity === 'breaking'))
        process.exitCode = 1;
      else if (
        !options.allowReview &&
        changes.some((change) => change.severity === 'review')
      )
        process.exitCode = 2;
    },
  );
program
  .command('plugin-check <file> [project]')
  .description('Execute a reviewed plugin twice against a project fixture')
  .requiredOption(
    '--trust-plugins',
    'acknowledge execution of reviewed local code',
  )
  .option('-c, --config <file>', 'project config file', 'docs.config.yaml')
  .option('--trust-content', 'allow reviewed MDX in the fixture')
  .action(
    async (
      file: string,
      project = '.',
      options: { config: string; trustContent?: boolean },
    ) => {
      const root = resolve(project);
      const site = await compileProject(root, options.config, {
        skipPlugins: true,
        trustContent: options.trustContent ?? false,
      });
      const result = await checkPluginConformance(root, [file], site);
      try {
        parseConfig(result.site.config);
      } catch {
        throw new Error(
          'Invalid plugin project configuration. Review the configuration contract.',
        );
      }
      console.log(
        `Plugin conformance passed: ${result.plugins[0]!.name}@${result.plugins[0]!.version}. Fresh executions returned identical validated output.`,
      );
    },
  );
program
  .command('stage <directory>')
  .description(
    'Stage a verified publication in operator-controlled immutable storage',
  )
  .requiredOption('--store <directory>', 'artifact store root')
  .action(async (directory: string, options: { store: string }) => {
    console.log(
      await stageArtifact(resolve(directory), resolve(options.store)),
    );
  });
program
  .command('publish <artifact>')
  .description('Register and activate a staged publication')
  .requiredOption('--server <origin>', 'management server HTTPS origin')
  .requiredOption('--project <id>', 'project id or slug')
  .option(
    '--insecure-development',
    'permit loopback HTTP for local development',
  )
  .action(
    async (
      artifact: string,
      options: {
        server: string;
        project: string;
        insecureDevelopment?: boolean;
      },
    ) => {
      if (!/^[a-f0-9]{64}$/.test(artifact))
        throw new Error('Artifact id must be a SHA-256 digest');
      const url = new URL(options.server);
      if (
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
          !(
            options.insecureDevelopment &&
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)
          ))
      )
        throw new Error(
          'Use an HTTPS origin, or explicitly enable local development on loopback',
        );
      const token = process.env.DOCS_PUBLISH_TOKEN;
      if (!token)
        throw new Error('Set DOCS_PUBLISH_TOKEN securely in the environment');
      const call = async (
        path: string,
        payload?: unknown,
      ): Promise<unknown> => {
        const response = await fetch(new URL(path, url), {
          method: payload === undefined ? 'GET' : 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        });
        if (!response.ok)
          throw new Error(`Management API returned HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      };
      const projects = (await call('/api/projects')) as {
        id: string;
        slug: string;
        activePublicationId: string | null;
      }[];
      const project = projects.find(
        (item) => item.id === options.project || item.slug === options.project,
      );
      if (!project) throw new Error('Project not found or not accessible');
      await call(`/api/projects/${project.id}/artifacts`, {
        artifactId: artifact,
      });
      const publication = (await call(
        `/api/projects/${project.id}/publications`,
        {
          artifactId: artifact,
          expectedPublicationId: project.activePublicationId,
          idempotencyKey: process.env.DOCS_IDEMPOTENCY_KEY ?? randomUUID(),
        },
      )) as { id: string };
      console.log(`Activated publication ${publication.id}.`);
    },
  );
void program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Command failed');
  process.exitCode = 1;
});
