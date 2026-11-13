const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');
const { mkdtemp, mkdir, readFile, writeFile, symlink, rm } = require('node:fs/promises');
const { join, resolve, sep } = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const repository = resolve(__dirname, '../..');
const temporaryDirectory = join(repository, 'tmp');
let root;
let client;
let diagnostics;

beforeEach(async () => {
  // Angular 20 migration hosts cannot resolve dependency junctions across Windows drives.
  await mkdir(temporaryDirectory, { recursive: true });
  root = await mkdtemp(join(temporaryDirectory, 'angular-mcp-test-'));
  await mkdir(join(root, 'src/app'), { recursive: true });
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'junction');
  await writeFile(join(root, 'package.json'), '{"private":true}');
  await writeFile(
    join(root, 'angular.json'),
    JSON.stringify({
      version: 1,
      projects: {
        fixture: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          prefix: 'app',
          architect: {
            build: {
              builder: '@angular/build:application',
              options: {
                browser: 'src/main.ts',
                tsConfig: 'tsconfig.app.json'
              }
            }
          }
        }
      },
      cli: { analytics: false }
    })
  );
  await writeFile(
    join(root, 'tsconfig.app.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        experimentalDecorators: true,
        skipLibCheck: true
      },
      files: ['src/main.ts']
    })
  );
  await writeFile(
    join(root, 'src/main.ts'),
    "import { bootstrapApplication } from '@angular/platform-browser';\nimport { provideRouter } from '@angular/router';\nimport { Legacy } from './app/legacy';\nimport { routes } from './app/app.routes';\nbootstrapApplication(Legacy, { providers: [provideRouter(routes)] });\n"
  );
  await writeFile(
    join(root, 'src/app/app.routes.ts'),
    "import { Routes } from '@angular/router';\nimport { Legacy } from './legacy';\nexport const routes: Routes = [{ path: '', component: Legacy }];\n"
  );
  await writeFile(
    join(root, 'src/app/legacy.ts'),
    "import { Component } from '@angular/core';\nimport { CommonModule } from '@angular/common';\n@Component({ selector: 'app-legacy', standalone: true, imports: [CommonModule], template: '<p *ngIf=\"visible\">Hello</p>' })\nexport class Legacy { visible = true; }\n"
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(repository, 'dist/angular-mcp/index.js')],
    cwd: root,
    stderr: 'pipe'
  });
  diagnostics = '';
  transport.stderr.on('data', chunk => {
    diagnostics += chunk.toString();
  });
  client = new Client({ name: 'angular-mcp-integration-tests', version: '1.0.0' });
  await client.connect(transport);
});

afterEach(async () => {
  await client?.close();
  assert.equal(diagnostics, '', 'Server must not write unexpected protocol diagnostics');
  const temporaryRoot = resolve(root);
  assert.ok(temporaryRoot.startsWith(resolve(temporaryDirectory) + sep));
  assert.match(temporaryRoot.split(sep).at(-1), /^angular-mcp-test-/);
  await rm(temporaryRoot, { recursive: true, force: true });
});

function text(result) {
  return result.content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n');
}

test('initializes over stdio and advertises the two workshop tools with preview defaults', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['generate_component', 'run_migration']);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.properties.dryRun.default, true);
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.openWorldHint, false);
  }
});

test('previews without writing, then generates a standalone OnPush component through the real CLI', async () => {
  const args = { name: 'user-profile', path: 'src/app/components' };
  const file = join(root, 'src/app/components/user-profile.component.ts');
  const preview = await client.callTool({ name: 'generate_component', arguments: args });
  assert.equal(preview.isError, false, text(preview));
  assert.match(text(preview), /Preview only/);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  const applied = await client.callTool({ name: 'generate_component', arguments: { ...args, dryRun: false } });
  assert.equal(applied.isError, false, text(applied));
  const source = await readFile(file, 'utf8');
  assert.match(source, /ChangeDetectionStrategy.OnPush/);
  assert.match(source, /export class UserProfileComponent/);
  assert.doesNotMatch(source, /standalone: false/);
});

test('supports short component paths and reports CLI collisions without overwriting files', async () => {
  await mkdir(join(root, 'src/app/components'));
  const file = join(root, 'src/app/components/existing.component.ts');
  await writeFile(file, '// Keep this existing file.');
  const response = await client.callTool({
    name: 'generate_component',
    arguments: { name: 'existing', path: 'components', dryRun: false }
  });
  assert.equal(response.isError, true);
  assert.match(text(response), /Angular CLI error/);
  assert.equal(await readFile(file, 'utf8'), '// Keep this existing file.');
});

test('previews and applies a real control-flow migration while keeping the connection usable', async () => {
  const file = join(root, 'src/app/legacy.ts');
  const before = await readFile(file, 'utf8');
  const preview = await client.callTool({ name: 'run_migration', arguments: { migration: 'control-flow' } });
  assert.equal(preview.isError, false, text(preview));
  assert.equal(await readFile(file, 'utf8'), before);
  const applied = await client.callTool({
    name: 'run_migration',
    arguments: { migration: 'control-flow', dryRun: false }
  });
  assert.equal(applied.isError, false, text(applied));
  const after = await readFile(file, 'utf8');
  assert.match(after, /@if\s*\(visible\)/);
  assert.doesNotMatch(after, /\*ngIf/);
  assert.equal((await client.listTools()).tools.length, 2);
});

test('rejects command injection, traversal, absolute paths and unsupported migrations', async () => {
  for (const args of [
    { name: 'bad;echo-owned' },
    { name: '--help' },
    { name: '../escape' },
    { name: 'safe', path: '../escape' },
    { name: 'safe', path: 'src/app/../../tools' },
    { name: 'safe', path: 'C:/outside' },
    { name: 'safe', path: '/tmp/outside' },
    { name: 'safe', path: 'src/elsewhere' }
  ]) {
    const response = await client.callTool({ name: 'generate_component', arguments: { ...args, dryRun: false } });
    assert.equal(response.isError, true, JSON.stringify(args));
  }
  for (const args of [
    { migration: 'not-installed' },
    { migration: 'inject;echo-owned' },
    { migration: 'control-flow', path: '../escape' },
    { migration: 'control-flow', path: 'src/missing' },
    { migration: 'inject', mode: 'standalone-bootstrap' },
    { migration: 'cleanup-unused-imports', path: 'src/app' }
  ]) {
    const response = await client.callTool({ name: 'run_migration', arguments: { ...args, dryRun: false } });
    assert.equal(response.isError, true, JSON.stringify(args));
  }
});

test('every advertised migration previews successfully with the installed Angular version', async () => {
  const { tools } = await client.listTools();
  const migrations = tools.find(tool => tool.name === 'run_migration').inputSchema.properties.migration.enum;
  const file = join(root, 'src/app/legacy.ts');
  const before = await readFile(file, 'utf8');
  for (const migration of migrations) {
    const response = await client.callTool({ name: 'run_migration', arguments: { migration } });
    assert.equal(response.isError, false, `${migration}: ${text(response)}`);
    assert.equal(await readFile(file, 'utf8'), before);
  }
});

test('rejects source junctions before generation or migration', async () => {
  await mkdir(join(root, 'outside'));
  await symlink(join(root, 'outside'), join(root, 'src/app/linked'), 'junction');
  for (const request of [
    { name: 'generate_component', arguments: { name: 'safe', path: 'src/app/linked', dryRun: false } },
    { name: 'run_migration', arguments: { migration: 'control-flow', dryRun: false } }
  ]) {
    const response = await client.callTool(request);
    assert.equal(response.isError, true);
    assert.match(text(response), /symbolic links or junctions/);
  }
});

test('reports an invalid workspace and remains available for subsequent requests', async () => {
  await writeFile(join(root, 'angular.json'), '{}');
  const response = await client.callTool({ name: 'generate_component', arguments: { name: 'safe' } });
  assert.equal(response.isError, true);
  assert.match(text(response), /Expected one Angular project/);
  assert.equal((await client.listTools()).tools.length, 2);
});

test('serializes CLI operations instead of concurrently modifying the workspace', async () => {
  const responses = await Promise.all([
    client.callTool({ name: 'generate_component', arguments: { name: 'first' } }),
    client.callTool({ name: 'generate_component', arguments: { name: 'second' } })
  ]);
  assert.equal(responses.filter(response => !response.isError).length, 1);
  assert.match(text(responses.find(response => response.isError)), /Another Angular CLI operation/);
});
