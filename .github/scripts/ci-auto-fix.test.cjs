const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { prepare, publish, notify, validateRepair, redact } = require('./ci-auto-fix.cjs');
const { digest } = require('./issue-implementation.cjs');

function fixture() {
  const outputs = {},
    writes = [];
  const run = {
    id: 42,
    name: 'Repository Validation',
    path: '.github/workflows/repository-validation.yml',
    status: 'completed',
    conclusion: 'failure',
    event: 'pull_request',
    head_sha: 'a'.repeat(40),
    head_branch: 'task/books',
    repository: { full_name: 'owner/repo' },
    head_repository: { full_name: 'owner/repo' },
    run_attempt: 1,
    actor: { login: 'maintainer' },
    html_url: 'https://github.com/owner/repo/actions/runs/42'
  };
  const state = {
    permission: 'write',
    sha: run.head_sha,
    message: 'feat: Books',
    pulls: [],
    issues: [],
    failLogs: false
  };
  let collected;
  const pr = {
    number: 8,
    html_url: 'https://github.com/owner/repo/pull/8',
    head: { ref: 'codex/auto-fix-42' },
    base: { ref: 'task/books' }
  };
  const github = {
    paginate: async method =>
      method === github.rest.actions.listJobsForWorkflowRun
        ? [
            {
              id: 7,
              name: 'Repository validation',
              conclusion: 'failure',
              steps: [{ name: 'Build', conclusion: 'failure' }]
            }
          ]
        : state.issues,
    rest: {
      actions: {
        getWorkflowRun: async () => ({ data: structuredClone(run) }),
        listJobsForWorkflowRun() {},
        downloadJobLogsForWorkflowRun: async () => {
          if (state.failLogs) throw new Error('Expired logs');
          return { data: 'x'.repeat(20000) + '\nerror TS2307: Cannot find module' };
        },
        createWorkflowDispatch: async args => writes.push({ method: 'dispatch', ...args })
      },
      repos: { getCollaboratorPermissionLevel: async () => ({ data: { permission: state.permission } }) },
      git: {
        getRef: async () => ({ data: { object: { sha: state.sha } } }),
        getCommit: async () => ({ data: { message: state.message, tree: { sha: 'old-tree' } } }),
        createTree: async args => {
          writes.push({ method: 'tree', ...args });
          return { data: { sha: 'new-tree' } };
        },
        createCommit: async args => {
          writes.push({ method: 'commit', ...args });
          return { data: { sha: 'repair-sha' } };
        },
        createRef: async args => writes.push({ method: 'ref', ...args })
      },
      pulls: {
        list: async () => ({ data: state.pulls }),
        create: async args => {
          writes.push({ method: 'pr', ...args });
          return { data: pr };
        },
        get: async () => ({ data: pr })
      },
      issues: {
        listForRepo() {},
        getLabel: async () => ({}),
        create: async args => {
          writes.push({ method: 'issue', ...args });
          state.issues.push({ ...args, number: 9, html_url: 'https://github.com/owner/repo/issues/9' });
          return { data: state.issues.at(-1) };
        },
        get: async () => ({ data: state.issues.at(-1) })
      }
    }
  };
  const context = {
    repo: { owner: 'owner', repo: 'repo' },
    payload: { workflow_run: { id: 42 } },
    serverUrl: 'https://github.com',
    runId: 100
  };
  const summary = {
    addHeading() {
      return this;
    },
    addRaw() {
      return this;
    },
    async write() {}
  };
  const core = { info() {}, setOutput: (name, value) => (outputs[name] = value), summary };
  return {
    github,
    context,
    core,
    run,
    state,
    outputs,
    writes,
    writeContext: text => (collected = JSON.parse(text)),
    collected: () => collected
  };
}

const result = () =>
  JSON.stringify({
    status: 'implemented',
    report: 'Import korrigiert; Prüfungen bestanden.',
    files: [{ path: 'src/app/books/book.ts', content: 'export interface Book {}\n' }]
  });
const environment = f => ({
  FAILED_RUN_ID: '42',
  FAILED_SHA: f.run.head_sha,
  FAILED_BRANCH: f.run.head_branch,
  CODEX_RESULT: result(),
  VERIFIED: 'true',
  VERIFIED_DIGEST: digest(result())
});

test('collects exact failed revision and bounded job log tails', async () => {
  const f = fixture();
  await prepare(f);
  assert.equal(f.outputs.repair, 'true');
  assert.equal(f.collected().sha, f.run.head_sha);
  assert.equal(f.collected().logs[0].log_tail.length, 16000);
  assert.equal(f.collected().logs[0].truncated, true);
  assert.match(f.collected().logs[0].log_tail, /TS2307/);
});

for (const [name, mutate] of [
  ['successful CI', f => (f.run.conclusion = 'success')],
  ['cancelled CI', f => (f.run.conclusion = 'cancelled')],
  ['unrelated workflow', f => (f.run.path = '.github/workflows/issue-analysis.yml')],
  ['fork', f => (f.run.head_repository.full_name = 'outsider/repo')],
  ['foreign repository', f => (f.run.repository.full_name = 'outsider/repo')],
  ['read-only author', f => (f.state.permission = 'read')],
  ['bot author', f => (f.run.actor.login = 'github-actions[bot]')],
  ['stale branch', f => (f.state.sha = 'b'.repeat(40))],
  ['rerun', f => (f.run.run_attempt = 2)],
  ['repair branch loop', f => (f.run.head_branch = 'codex/auto-fix-41')],
  ['merged repair loop', f => (f.state.message = 'fix(ci): Automatische CI-Reparatur für Lauf 41')],
  ['duplicate PR', f => f.state.pulls.push({ number: 8 })]
])
  test(`does not start paid repair on ${name}`, async () => {
    const f = fixture();
    mutate(f);
    await prepare(f);
    assert.equal(f.outputs.repair, undefined);
    assert.equal(f.collected(), undefined);
    assert.equal(f.writes.length, 0);
  });

test('unavailable logs preserve notification eligibility without running the agent', async () => {
  const f = fixture();
  f.state.failLogs = true;
  await assert.rejects(prepare(f), /Expired logs/);
  assert.equal(f.outputs.attempt, 'true');
  assert.equal(f.outputs.repair, undefined);
});

test('redacts common credentials before creating agent context', () => {
  const secret = 'sk-' + 'a'.repeat(30);
  assert.equal(redact(secret), '[REDACTED]');
  assert.equal(redact('Authorization: Bearer abc123'), 'Authorization: Bearer [REDACTED]');
});

test('rejects protected paths, duplicates and false success', () => {
  for (const path of [
    '.github/workflows/ci.yml',
    'package.json',
    'package-lock.json',
    'src/AGENTS.md',
    '../evil',
    'tests/../AGENTS.md'
  ]) {
    const value = JSON.parse(result());
    value.files[0].path = path;
    assert.throws(() => validateRepair(JSON.stringify(value)));
  }
  assert.throws(() => validateRepair(JSON.stringify({ status: 'already-satisfied', report: 'Fine', files: [] })));
  const duplicate = JSON.parse(result());
  duplicate.files.push(duplicate.files[0]);
  assert.throws(() => validateRepair(JSON.stringify(duplicate)));
});

test('publishes a verified fix to a new branch targeting the failed branch and queues CI', async () => {
  const f = fixture();
  await publish({ ...f, env: environment(f) });
  assert.deepEqual(
    f.writes.map(write => write.method),
    ['tree', 'commit', 'ref', 'pr', 'dispatch']
  );
  assert.equal(f.writes[1].parents[0], f.run.head_sha);
  assert.match(f.writes[1].message, /^fix\(ci\):/);
  assert.equal(f.writes[2].ref, 'refs/heads/codex/auto-fix-42');
  assert.equal(f.writes[3].base, 'task/books');
  assert.equal(f.writes[4].ref, 'codex/auto-fix-42');
});

test('rejects stale or unverified results before any repository write', async () => {
  for (const mutate of [
    (f, env) => (env.VERIFIED = 'false'),
    (f, env) => (env.VERIFIED_DIGEST = 'tampered'),
    (f, env) => (env.FAILED_SHA = 'b'.repeat(40)),
    f => (f.state.sha = 'b'.repeat(40))
  ]) {
    const f = fixture(),
      env = environment(f);
    mutate(f, env);
    await assert.rejects(publish({ ...f, env }));
    assert.equal(f.writes.length, 0);
  }
});

test('blocked output creates one labeled issue with run references and no PR', async () => {
  const f = fixture(),
    env = {
      FAILED_RUN_ID: '42',
      CODEX_RESULT: JSON.stringify({
        status: 'blocked',
        report: 'Dependency update requires manual review.',
        files: []
      })
    };
  await notify({ ...f, env });
  await notify({ ...f, env });
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0].labels, ['bug', 'auto-fix-failed', 'needs-attention']);
  assert.match(f.writes[0].body, /actions\/runs\/42/);
  assert.match(f.writes[0].body, /actions\/runs\/100/);
  assert.match(f.writes[0].body, /Dependency update/);
});

test('ambiguous branch creation is read back and never overwrites unrelated work', async () => {
  for (const matching of [true, false]) {
    const f = fixture();
    const originalCommit = f.github.rest.git.getCommit;
    f.github.rest.git.createRef = async () => {
      throw Object.assign(new Error('Already exists'), { status: 422 });
    };
    f.github.rest.git.getRef = async args => ({
      data: { object: { sha: args.ref.startsWith('heads/codex/') ? 'existing' : f.run.head_sha } }
    });
    f.github.rest.git.getCommit = async args =>
      args.commit_sha === 'existing'
        ? { data: { tree: { sha: matching ? 'new-tree' : 'unrelated' }, parents: [{ sha: f.run.head_sha }] } }
        : originalCommit(args);
    if (matching) {
      await publish({ ...f, env: environment(f) });
      assert.equal(f.writes.filter(write => write.method === 'pr').length, 1);
    } else {
      await assert.rejects(publish({ ...f, env: environment(f) }), /unrelated repair branch/);
      assert.equal(f.writes.filter(write => ['pr', 'dispatch'].includes(write.method)).length, 0);
    }
  }
});

test('does not publish a no-op tree or a blocked result', async () => {
  const f = fixture();
  f.github.rest.git.createTree = async () => ({ data: { sha: 'old-tree' } });
  await assert.rejects(publish({ ...f, env: environment(f) }), /changes no files/);
  assert.equal(f.writes.length, 0);
  const env = environment(f);
  env.CODEX_RESULT = JSON.stringify({ status: 'blocked', report: 'Manual configuration required.', files: [] });
  env.VERIFIED_DIGEST = digest(env.CODEX_RESULT);
  await assert.rejects(publish({ ...f, env }), /independent validation/);
  assert.equal(f.writes.length, 0);
});

test('missing notification labels are created and malformed output is not copied', async () => {
  const f = fixture();
  const labels = [];
  f.github.rest.issues.getLabel = async () => {
    throw Object.assign(new Error('Not found'), { status: 404 });
  };
  f.github.rest.issues.createLabel = async args => labels.push(args.name);
  await notify({ ...f, env: { FAILED_RUN_ID: '42', CODEX_RESULT: 'Untrusted malformed output' } });
  assert.deepEqual(labels, ['bug', 'auto-fix-failed', 'needs-attention']);
  assert.doesNotMatch(f.writes[0].body, /Untrusted malformed output/);
  assert.match(f.writes[0].body, /nicht bestätigt/);
});

test('notification write must be read back successfully', async () => {
  const f = fixture();
  f.github.rest.issues.get = async () => ({ data: { body: 'unexpected content' } });
  await assert.rejects(notify({ ...f, env: { FAILED_RUN_ID: '42' } }), /could not be confirmed/);
});

test('workflow isolates agent, verifier, publisher and notification credentials', () => {
  const yaml = readFileSync('.github/workflows/auto-fix.yml', 'utf8');
  assert.match(yaml, /workflows: \['Repository Validation'\]/);
  assert.equal((yaml.match(/secrets\.OPENAI_API_KEY/g) || []).length, 1);
  const agent = yaml.split('\n  repair:')[1].split('\n  verify:')[0];
  assert.doesNotMatch(agent, /contents: write|pull-requests: write|actions: write/);
  assert.match(agent, /model: gpt-5\.6-luna/);
  assert.match(agent, /safety-strategy: unprivileged-user/);
  const verifier = yaml.split('\n  verify:')[1].split('\n  publish:')[0];
  assert.doesNotMatch(verifier, /secrets\.|contents: write/);
  assert.match(verifier, /npm run build/);
  const publisher = yaml.split('\n  publish:')[1].split('\n  notify-failure:')[0];
  assert.doesNotMatch(publisher, /npm ci|npm run|secrets\./);
  assert.match(yaml, /always\(\) && needs\.prepare\.outputs\.attempt == 'true'/);
});
