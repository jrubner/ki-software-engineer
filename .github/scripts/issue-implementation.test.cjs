const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync, symlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  validateResult,
  digest,
  snapshot,
  prepare,
  applyResult,
  publish,
  applicationTests
} = require('./issue-implementation.cjs');

const implemented = JSON.stringify({
  status: 'implemented',
  report: 'Red: missing heading. Green and Blue: browser tests pass.',
  files: [{ path: 'src/example.ts', content: 'export const heading = "Books";\n' }]
});
const blocked = JSON.stringify({ status: 'blocked', report: 'Which persistence API is required?', files: [] });

function fixture({
  permission = 'write',
  labels = ['ready-for-implementation'],
  state = 'open',
  actor = 'maintainer',
  eventName = 'issues',
  comments = []
} = {}) {
  const writes = [];
  const outputs = {};
  const issue = { number: 42, title: 'Show a heading', body: 'Given the list, then show Books.', state, labels };
  const github = {
    paginate: async () => comments,
    rest: {
      issues: {
        get: async () => ({ data: issue }),
        listComments() {},
        createComment: async args => writes.push({ method: 'comment', args }),
        updateComment: async args => writes.push({ method: 'updateComment', args })
      },
      repos: {
        getCollaboratorPermissionLevel: async () => ({ data: { permission } }),
        get: async () => ({ data: { default_branch: 'main' } })
      },
      pulls: {
        list: async () => ({ data: [] }),
        create: async args => {
          writes.push({ method: 'pr', args });
          return { data: { html_url: 'https://github.com/owner/repo/pull/43' } };
        }
      },
      git: {
        getRef: async args => {
          if (args.ref === 'heads/main') return { data: { object: { sha: 'base-sha' } } };
          throw Object.assign(new Error('Not found'), { status: 404 });
        },
        getCommit: async () => ({ data: { tree: { sha: 'base-tree' } } }),
        createTree: async args => {
          writes.push({ method: 'tree', args });
          return { data: { sha: 'new-tree' } };
        },
        createCommit: async args => {
          writes.push({ method: 'commit', args });
          return { data: { sha: 'new-commit' } };
        },
        createRef: async args => writes.push({ method: 'ref', args })
      }
    }
  };
  const core = {
    info() {},
    setOutput: (name, value) => {
      outputs[name] = value;
    },
    summary: {
      addHeading() {
        return this;
      },
      addRaw() {
        return this;
      },
      async write() {}
    }
  };
  const context = {
    actor,
    eventName,
    repo: { owner: 'owner', repo: 'repo' },
    payload: { issue: { number: 42 } },
    serverUrl: 'https://github.com',
    runId: 123
  };
  const options = {
    github,
    context,
    core,
    writeContext: text => {
      outputs.context = JSON.parse(text);
    }
  };
  return { ...options, issue, comments, writes, outputs };
}

async function publication(f, overrides = {}) {
  const current = await snapshot(f.github, f.context.repo, 42);
  return publish({
    ...f,
    env: {
      ISSUE_NUMBER: '42',
      ISSUE_FINGERPRINT: current.fingerprint,
      BASE_BRANCH: 'main',
      BASE_SHA: 'base-sha',
      CODEX_RESULT: implemented,
      VERIFIED_DIGEST: digest(implemented),
      VERIFIED: 'true',
      ...overrides
    }
  });
}

test('rejects protected paths, traversal, binary data, duplicate paths, excessive output, and inconsistent status', () => {
  assert.equal(validateResult(implemented).status, 'implemented');
  assert.equal(validateResult(blocked).files.length, 0);
  for (const path of [
    '.github/workflows/attack.yml',
    '.agents/skills/x/SKILL.md',
    'package.json',
    'src/../package.json',
    'src/.env',
    'src/AGENTS.md',
    'docs/AGENTS.override.md',
    'src//x',
    'src/evil.exe',
    'public/image.png',
    'src\\x',
    '/src/x'
  ]) {
    const result = JSON.parse(implemented);
    result.files[0].path = path;
    assert.throws(() => validateResult(JSON.stringify(result)), path);
  }
  for (const change of [
    result => {
      result.files[0].content = '\0';
    },
    result => {
      result.files.push({ path: 'SRC/example.ts', content: '' });
    },
    result => {
      result.files.push({ path: 'src/EXAMPLE.ts', content: '' });
    },
    result => {
      result.status = 'blocked';
    },
    result => {
      result.files = [];
    },
    result => {
      result.command = 'do not run';
    }
  ]) {
    const result = JSON.parse(implemented);
    change(result);
    assert.throws(() => validateResult(JSON.stringify(result)));
  }
  assert.throws(() => validateResult(' '.repeat(100001)));
});

test('checks access, issue readiness, PR kind, and discussion completeness before paid work', async () => {
  for (const options of [
    { permission: 'read' },
    { state: 'closed' },
    { labels: [] },
    { labels: ['ready-for-implementation', 'needs-clarification'] }
  ]) {
    const f = fixture(options);
    await prepare(f);
    assert.deepEqual(f.outputs, {});
  }
  const pr = fixture();
  pr.issue.pull_request = {};
  await prepare(pr);
  assert.deepEqual(pr.outputs, {});
  const f = fixture();
  await prepare(f);
  assert.equal(f.outputs.implement, 'true');
  assert.equal(f.outputs.sha, 'base-sha');
  assert.equal(f.outputs.context.number, 42);
  const huge = fixture({
    comments: Array.from({ length: 101 }, (_, id) => ({ id, user: { login: 'human' }, body: 'Clarification' }))
  });
  await assert.rejects(prepare(huge), /discussion/);
});

test('accepts trusted bot dispatch only with a current requirements fingerprint', async () => {
  const f = fixture({ actor: 'github-actions[bot]', eventName: 'workflow_dispatch', permission: 'read' });
  f.context.payload = { inputs: { issue_number: '42' } };
  await prepare(f);
  assert.deepEqual(f.outputs, {});
  f.context.payload.inputs.fingerprint = 'stale';
  await prepare(f);
  assert.deepEqual(f.outputs, {});
  f.context.payload.inputs.fingerprint = (await snapshot(f.github, f.context.repo, 42)).fingerprint;
  await prepare(f);
  assert.equal(f.outputs.implement, 'true');
});

test('does not pay for duplicate PRs or overwrite an existing branch', async () => {
  const f = fixture();
  f.github.rest.pulls.list = async () => ({ data: [{ html_url: 'existing' }] });
  await prepare(f);
  assert.deepEqual(f.outputs, {});
  f.github.rest.pulls.list = async () => ({ data: [] });
  f.github.rest.git.getRef = async () => ({ data: { object: { sha: 'existing' } } });
  await prepare(f);
  assert.deepEqual(f.outputs, {});
});

test('reconstructs exact UTF-8 content, additions, and deletions without a shell', () => {
  const root = mkdtempSync(join(tmpdir(), 'issue-implementation-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/old.ts'), 'old');
    const result = JSON.parse(implemented);
    result.files.push(
      { path: 'src/old.ts', content: null },
      { path: 'docs/new.md', content: 'Größe\n$(this-is-data)\n' }
    );
    applyResult(JSON.stringify(result), root);
    assert.equal(readFileSync(join(root, 'docs/new.md'), 'utf8'), 'Größe\n$(this-is-data)\n');
    assert.equal(readFileSync(join(root, 'src/example.ts'), 'utf8'), result.files[0].content);
    assert.throws(() => readFileSync(join(root, 'src/old.ts')));
    assert.throws(() => applyResult(JSON.stringify(result), root), /Deletion/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses unverified, changed, no-longer-ready, or stale-base output before writes', async () => {
  for (const overrides of [
    { VERIFIED: '' },
    { VERIFIED_DIGEST: 'forged' },
    { ISSUE_FINGERPRINT: 'stale' },
    { BASE_SHA: 'old' }
  ]) {
    const f = fixture();
    await assert.rejects(publication(f, overrides));
    assert.deepEqual(f.writes, []);
  }
  for (const options of [
    { state: 'closed' },
    { labels: [] },
    { labels: ['ready-for-implementation', 'needs-clarification'] }
  ]) {
    const f = fixture(options);
    await assert.rejects(publication(f));
    assert.deepEqual(f.writes, []);
  }
});

test('publishes only verified files through the Git API and links closure to the PR merge', async () => {
  const f = fixture();
  await publication(f);
  assert.deepEqual(
    f.writes.map(write => write.method),
    ['tree', 'commit', 'ref', 'pr', 'comment']
  );
  assert.equal(f.writes[0].args.tree[0].content, JSON.parse(implemented).files[0].content);
  assert.equal(f.writes[1].args.parents[0], 'base-sha');
  assert.equal(f.writes[1].args.message, 'feat(issue-42): Anforderung automatisch umsetzen');
  assert.equal(f.writes[2].args.ref, 'refs/heads/codex/issue-42');
  assert.equal(f.writes[3].args.base, 'main');
  assert.equal(f.writes[3].args.title, 'feat(issue-42): Show a heading');
  assert.match(f.writes[3].args.body, /Closes #42/);
  assert.match(f.writes[3].args.body, /- \[ \] Akzeptanzkriterien/);
  assert.match(f.writes[3].args.body, /gpt-5\.6-luna/);
  assert.match(f.writes[4].args.body, /pull\/43/);
  assert.match(f.writes[4].args.body, /Branch: `codex\/issue-42`/);
  assert.match(f.writes[4].args.body, /Commit: `feat\(issue-42\):/);
  assert.equal(f.issue.state, 'open');
});

test('reports blockers without writing code, creating a PR, or closing an issue', async () => {
  const f = fixture();
  await publication(f, { CODEX_RESULT: blocked, VERIFIED_DIGEST: digest(blocked), VERIFIED: '' });
  assert.deepEqual(
    f.writes.map(write => write.method),
    ['comment']
  );
  assert.match(f.writes[0].args.body, /persistence API/);
  assert.equal(f.issue.state, 'open');
});

test('ignores its own status comments but detects changed requirements on retry', async () => {
  const f = fixture();
  const first = await snapshot(f.github, f.context.repo, 42);
  f.issue.updated_at = 'later';
  f.comments.push({ id: 1, user: { login: 'github-actions[bot]' }, body: '<!-- codex-issue-implementation --> old' });
  assert.equal((await snapshot(f.github, f.context.repo, 42)).fingerprint, first.fingerprint);
  f.comments.push({ id: 2, user: { login: 'maintainer' }, body: 'New requirement' });
  assert.notEqual((await snapshot(f.github, f.context.repo, 42)).fingerprint, first.fingerprint);
});

test('discovers new nested application specs and excludes the unrelated website example', () => {
  const root = mkdtempSync(join(tmpdir(), 'issue-test-discovery-'));
  try {
    mkdirSync(join(root, 'tests/new-feature'), { recursive: true });
    for (const file of [
      'book-detail.spec.ts',
      'theme.spec.ts',
      'shell.spec.ts',
      'example.spec.ts',
      'new-feature/edit.spec.ts',
      'helper.ts'
    ]) {
      writeFileSync(join(root, 'tests', file), '');
    }
    assert.deepEqual(applicationTests(root), [
      'tests/book-detail.spec.ts',
      'tests/new-feature/edit.spec.ts',
      'tests/shell.spec.ts',
      'tests/theme.spec.ts'
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('does not recreate an existing PR or publish a no-op tree', async () => {
  const f = fixture();
  f.github.rest.pulls.list = async () => ({ data: [{ html_url: 'existing' }] });
  await publication(f);
  assert.deepEqual(f.writes, []);
  f.github.rest.pulls.list = async () => ({ data: [] });
  f.github.rest.git.createTree = async () => ({ data: { sha: 'base-tree' } });
  await assert.rejects(publication(f), /No source changes/);
  assert.deepEqual(f.writes, []);
});

test('records an already-satisfied result as evidence without closing the issue', async () => {
  const f = fixture();
  const result = JSON.stringify({
    status: 'already-satisfied',
    report: 'All acceptance criteria already pass.',
    files: []
  });
  await publication(f, { CODEX_RESULT: result, VERIFIED_DIGEST: digest(result), VERIFIED: '' });
  assert.deepEqual(
    f.writes.map(write => write.method),
    ['comment']
  );
  assert.match(f.writes[0].args.body, /already-satisfied/);
  assert.equal(f.issue.state, 'open');
});

test('refuses existing directory links before writing through them', () => {
  const parent = mkdtempSync(join(tmpdir(), 'issue-link-check-'));
  const root = join(parent, 'checkout');
  const outside = join(parent, 'outside');
  try {
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(outside, 'example.ts'), 'unchanged');
    symlinkSync(outside, join(root, 'src'), 'junction');
    assert.throws(() => applyResult(implemented, root), /regular files/);
    assert.equal(readFileSync(join(outside, 'example.ts'), 'utf8'), 'unchanged');
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
