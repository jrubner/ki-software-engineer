import { execFile } from 'node:child_process';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const execute = promisify(execFile);
const migrations = [
  'control-flow',
  'inject',
  'route-lazy-loading',
  'signal-inputs',
  'signal-queries',
  'outputs',
  'self-closing-tag',
  'cleanup-unused-imports',
  'standalone'
] as const;
const directory = z
  .string()
  .max(200)
  .describe('Source directory, using forward slashes; no absolute paths or traversal');
const dryRun = z
  .boolean()
  .default(true)
  .describe('Preview changes without writing files; set false only to apply them');

function result(text: string, isError = false): CallToolResult {
  return { isError, content: [{ type: 'text', text: text.slice(0, 32_000) }] };
}

async function rejectLinks(path: string, recursive = false): Promise<void> {
  let entry;
  try {
    entry = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (entry.isSymbolicLink()) throw new Error('Source paths must not contain symbolic links or junctions.');
  if (recursive && entry.isDirectory()) {
    for (const child of await readdir(path)) await rejectLinks(join(path, child), true);
  }
}

async function sourcePath(root: string, path: string, mustExist = false): Promise<string> {
  if (!/^src(?:\/[a-zA-Z0-9_-]+)*$/.test(path)) {
    throw new Error('Use a directory under src, without traversal, flags, or shell characters.');
  }
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    await rejectLinks(current);
  }
  if (mustExist && !(await lstat(current)).isDirectory()) throw new Error('Migration path must be a directory.');
  return path;
}

export function createServer(workspace = process.cwd()): McpServer {
  const server = new McpServer({ name: 'workshops-de-angular-mcp', version: '1.0.0' });
  let busy = false;

  async function run(buildArgs: (root: string, project: string) => Promise<string[]>, preview: boolean) {
    if (busy) return result('Another Angular CLI operation is running. Retry after it finishes.', true);
    busy = true;
    try {
      const root = await realpath(workspace);
      const config = JSON.parse(await readFile(join(root, 'angular.json'), 'utf8'));
      const projects = Object.entries(config.projects ?? {}).filter(
        ([, project]) => (project as { sourceRoot?: string }).sourceRoot === 'src'
      );
      if (projects.length !== 1)
        throw new Error('Expected one Angular project with sourceRoot "src" in this workspace.');
      const requireFromWorkspace = createRequire(join(root, 'package.json'));
      const cli = join(dirname(requireFromWorkspace.resolve('@angular/cli/package.json')), 'bin/ng.js');
      const args = await buildArgs(root, projects[0][0]);
      const { stdout, stderr } = await execute(
        process.execPath,
        [cli, ...args, '--interactive=false', `--dry-run=${preview}`],
        {
          cwd: root,
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, NG_CLI_ANALYTICS: 'false', FORCE_COLOR: '0' }
        }
      );
      return result(
        `${preview ? 'Preview only; no files written.' : 'Angular CLI completed; review the diff before committing.'}\n${stdout}\n${stderr}`
      );
    } catch (error) {
      const failure = error as Error & { stdout?: string; stderr?: string };
      return result(`Angular CLI error: ${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`, true);
    } finally {
      busy = false;
    }
  }

  server.registerTool(
    'generate_component',
    {
      title: 'Generate Angular Component',
      description:
        'Preview or create a standalone OnPush component under src/app using the installed Angular CLI. Existing files are not overwritten.',
      inputSchema: {
        name: z
          .string()
          .max(80)
          .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
          .describe('Single kebab-case component name'),
        path: directory
          .optional()
          .describe('Directory under src/app, e.g. src/app/components or components; defaults to src/app'),
        dryRun
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    async ({ name, path, dryRun }) =>
      run(async (root, project) => {
        const target =
          path === undefined || path === 'src/app' ? 'src/app' : path.startsWith('src/') ? path : `src/app/${path}`;
        if (target !== 'src/app' && !target.startsWith('src/app/'))
          throw new Error('Components must be generated under src/app.');
        await sourcePath(root, `${target}/${name}`);
        await rejectLinks(join(root, target), true);
        return [
          'generate',
          '@schematics/angular:component',
          name,
          `--project=${project}`,
          `--path=${target}`,
          '--standalone',
          '--flat',
          '--skip-tests',
          '--skip-import',
          '--inline-style',
          '--inline-template',
          '--change-detection=OnPush',
          '--type=component'
        ];
      }, dryRun)
  );

  server.registerTool(
    'run_migration',
    {
      title: 'Run Angular Migration',
      description:
        'Preview or apply an allowlisted @angular/core migration from the installed Angular version. Defaults to src/app. Signal migration references and cleanup-unused-imports can affect the whole workspace; inspect the preview and diff.',
      inputSchema: {
        migration: z.enum(migrations),
        path: directory
          .optional()
          .describe(
            'Existing source directory; defaults to src/app. Not supported by cleanup-unused-imports, which is workspace-wide.'
          ),
        mode: z
          .enum(['convert-to-standalone', 'prune-ng-modules', 'standalone-bootstrap'])
          .optional()
          .describe('Only for standalone; defaults to convert-to-standalone'),
        dryRun
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
    },
    async ({ migration, path, mode, dryRun }) =>
      run(async root => {
        if (mode !== undefined && migration !== 'standalone') throw new Error('mode is only supported for standalone.');
        if (migration === 'cleanup-unused-imports' && path !== undefined) {
          throw new Error('cleanup-unused-imports is workspace-wide and does not support path.');
        }
        await rejectLinks(join(root, 'src'), true);
        const requireFromWorkspace = createRequire(join(root, 'package.json'));
        const collectionPath = join(
          dirname(requireFromWorkspace.resolve('@angular/core/package.json')),
          'schematics/collection.json'
        );
        const collection = JSON.parse(await readFile(collectionPath, 'utf8'));
        const supported = Object.entries(collection.schematics).some(
          ([name, schematic]) =>
            name === migration || (schematic as { aliases?: string[] }).aliases?.includes(migration)
        );
        if (!supported) throw new Error(`Migration ${migration} is unavailable in the installed Angular version.`);
        const args = ['generate', `@angular/core:${migration}`];
        if (migration !== 'cleanup-unused-imports')
          args.push(`--path=${await sourcePath(root, path ?? 'src/app', true)}`);
        if (migration === 'standalone') args.push(`--mode=${mode ?? 'convert-to-standalone'}`);
        return args;
      }, dryRun)
  );

  return server;
}

if (require.main === module) {
  createServer()
    .connect(new StdioServerTransport())
    .catch(error => {
      console.error('Failed to connect Angular MCP:', error);
      process.exitCode = 1;
    });
}
