const { test } = require('node:test');
const assert = require('node:assert/strict');
const { issueNumber, validateReport, readIssue, prepare, publish } = require('./issue-analysis.cjs');

function fixture({ issue = {}, comments = [], permission = 'write' } = {}) {
  const writes = [];
  const outputs = [];
  const snapshot = { number: 42, title: 'Example', body: 'Requirement', state: 'open', labels: [], ...issue };
  const methods = ['createLabel', 'addLabels', 'removeLabel', 'createComment', 'updateComment'];
  const issues = {
    get: async () => ({ data: snapshot }),
    listComments: () => {},
    getLabel: async () => ({ data: {} })
  };
  for (const method of methods) issues[method] = async args => writes.push({ method, args });
  const github = {
    rest: {
      issues,
      repos: { getCollaboratorPermissionLevel: async () => ({ data: { permission } }) }
    },
    paginate: async () => comments
  };
  const core = {
    info() {},
    warning() {},
    setOutput: (...args) => outputs.push(args),
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
    repo: { owner: 'owner', repo: 'repo' },
    actor: 'maintainer',
    payload: { issue: { number: 42 } },
    serverUrl: 'https://github.com',
    runId: 123
  };
  return { github, core, context, writes, outputs };
}

async function publishing(f, overrides = {}) {
  const { fingerprint } = await readIssue(f.github, f.context.repo, 42);
  const previous = { ...process.env };
  Object.assign(process.env, {
    ISSUE_NUMBER: '42',
    ISSUE_FINGERPRINT: fingerprint,
    CODEX_REPORT: JSON.stringify({ label: 'needs-clarification', report: 'Missing acceptance criteria.' }),
    ...overrides
  });
  try {
    await publish(f);
  } finally {
    for (const name of ['ISSUE_NUMBER', 'ISSUE_FINGERPRINT', 'CODEX_REPORT']) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test('rejects invalid issue numbers and unexpected output fields or labels', () => {
  for (const number of ['', '1; rm -rf /', '-1', '1.5', '9007199254740993']) {
    assert.throws(() => issueNumber(number));
  }
  assert.equal(issueNumber('42'), 42);
  for (const value of [
    null,
    [],
    { label: 'other', report: 'x' },
    { label: 'needs-clarification', report: '' },
    { label: 'needs-clarification', report: 'x', command: 'run me' }
  ]) {
    assert.throws(() => validateReport(JSON.stringify(value)));
  }
});

test('does not spend API usage for readers or analyze closed issues or pull requests', async () => {
  for (const options of [{ permission: 'read' }, { issue: { state: 'closed' } }, { issue: { pull_request: {} } }]) {
    const f = fixture(options);
    await prepare(f);
    assert.deepEqual(f.outputs, []);
    assert.deepEqual(f.writes, []);
  }
});

test('refuses stale, closed, or malformed results before any GitHub write', async () => {
  const f = fixture();
  await publishing(f, { ISSUE_FINGERPRINT: 'stale' });
  assert.deepEqual(f.writes, []);
  await publishing(fixture({ issue: { state: 'closed' } }));
  await assert.rejects(publishing(f, { CODEX_REPORT: '{"label":"delete-everything","report":"x"}' }));
  assert.deepEqual(f.writes, []);
});

test('sets only workflow labels, preserves unrelated labels and updates its own comment', async () => {
  const f = fixture({
    issue: { labels: [{ name: 'bug' }, { name: 'ready-for-implementation' }] },
    comments: [
      { id: 1, user: { login: 'human' }, body: '<!-- codex-issue-analysis --> human text' },
      { id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- codex-issue-analysis --> old result' }
    ]
  });
  await publishing(f);
  assert.deepEqual(
    f.writes.map(write => write.method),
    ['addLabels', 'removeLabel', 'updateComment']
  );
  assert.deepEqual(f.writes[0].args.labels, ['needs-clarification']);
  assert.equal(f.writes[1].args.name, 'ready-for-implementation');
  assert.equal(f.writes[2].args.comment_id, 2);
  assert.match(f.writes[2].args.body, /gpt-5\.6-luna/);
});

test('creates missing label and comment and keeps report content as data', async () => {
  const f = fixture();
  f.github.rest.issues.getLabel = async () => {
    throw Object.assign(new Error(), { status: 404 });
  };
  const report = '$(do-not-execute) `code`';
  await publishing(f, { CODEX_REPORT: JSON.stringify({ label: 'needs-clarification', report }) });
  assert.deepEqual(
    f.writes.map(write => write.method),
    ['createLabel', 'addLabels', 'createComment']
  );
  assert.ok(f.writes[2].args.body.includes(report));
});

test('bounds discussion context but still locates older bot comments for updates', async () => {
  const comments = Array.from({ length: 101 }, (_, id) => ({ id, user: { login: 'human' }, body: `${id}` }));
  comments.unshift({ id: 999, user: { login: 'github-actions[bot]' }, body: '<!-- codex-issue-analysis --> old' });
  const f = fixture({ comments });
  const { data } = await readIssue(f.github, f.context.repo, 42);
  assert.equal(data.comments_truncated, true);
  assert.equal(data.comments.length, 100);
  assert.equal(data.comments[0].id, 1);
  await publishing(f);
  assert.equal(f.writes.find(write => write.method === 'updateComment').args.comment_id, 999);
});
