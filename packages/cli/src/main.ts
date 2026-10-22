#!/usr/bin/env node
import { Command } from 'commander';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { watch } from 'node:fs';
import { compileProject } from '@api-docs/compiler';
import { loadSpec } from '@api-docs/spec';
import { buildSite, createStaticServer } from './index.js';
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
    .option('--trust-plugins', 'allow reviewed local build plugins to execute');
buildOptions(
  program
    .command('build [project]')
    .alias('export')
    .description('Build a verified static publication'),
).action(
  async (
    project = '.',
    options: { config: string; output: string; trustPlugins?: boolean },
  ) => {
    const result = await buildSite(project, options);
    for (const diagnostic of result.site.diagnostics)
      console.warn(`${diagnostic.severity}: ${diagnostic.message}`);
    console.log(
      `Built ${result.site.guides.length} guides and ${result.site.apis.reduce((count, api) => count + api.operations.length, 0)} endpoints in ${result.directory}`,
    );
  },
);
program
  .command('validate [project]')
  .alias('doctor')
  .description(
    'Validate specs, guides, configuration and documentation quality',
  )
  .option('-c, --config <file>', 'project config file', 'docs.config.yaml')
  .option('--strict', 'fail on warnings')
  .option('--json', 'machine-readable output')
  .option('--trust-plugins', 'allow reviewed local plugins')
  .action(
    async (
      project = '.',
      options: {
        config: string;
        strict?: boolean;
        json?: boolean;
        trustPlugins?: boolean;
      },
    ) => {
      const site = await compileProject(
        resolve(project),
        options.config,
        options,
      );
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
        port: string;
        host: string;
      },
    ) => {
      const root = resolve(project);
      const result = await buildSite(root, options);
      const app = await createStaticServer(result.directory);
      await app.listen({ port: Number(options.port), host: options.host });
      let running = false;
      let pending = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const rebuild = async () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        try {
          await buildSite(root, options);
          console.log('Documentation rebuilt. Refresh to see changes.');
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
  .description(
    'Report breaking operation removals and newly required parameters',
  )
  .option('--json', 'machine-readable output')
  .action(
    async (before: string, after: string, options: { json?: boolean }) => {
      const load = async (file: string) =>
        loadSpec(resolve(file, '..'), {
          id: 'api',
          path: file.split('/').pop() ?? file,
        });
      const [oldApi, newApi] = await Promise.all([load(before), load(after)]);
      const changes: { severity: string; message: string }[] = [];
      for (const old of oldApi.operations) {
        const next = newApi.operations.find(
          (operation) =>
            operation.method === old.method && operation.path === old.path,
        );
        if (!next)
          changes.push({
            severity: 'breaking',
            message: `Removed ${old.method.toUpperCase()} ${old.path}`,
          });
        else
          for (const parameter of next.parameters.filter(
            (parameter) =>
              parameter.required &&
              !old.parameters.some(
                (existing) =>
                  existing.in === parameter.in &&
                  existing.name === parameter.name &&
                  existing.required,
              ),
          ))
            changes.push({
              severity: 'breaking',
              message: `${next.id}: newly required ${parameter.in} parameter ${parameter.name}`,
            });
      }
      console.log(
        options.json
          ? JSON.stringify(changes)
          : changes.length
            ? changes
                .map((change) => `${change.severity}: ${change.message}`)
                .join('\n')
            : 'No operation removals or newly required parameters detected. This check does not yet classify all schema changes.',
      );
      if (changes.some((change) => change.severity === 'breaking'))
        process.exitCode = 1;
    },
  );
void program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Command failed');
  process.exitCode = 1;
});
