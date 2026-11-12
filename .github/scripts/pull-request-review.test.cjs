const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
  marker,
  validateReport,
  readReview,
  prepare,
  publish,
  queueImplementationReview
} = require('./pull-request-review.cjs');

function fixture({ permission = 'write', actor = 'maintainer', manual = false, fork = false, comments = [] } = {}) {
  const writes = [];
  const outputs = {};
  let collected;
  const pr = {
    number: 43,
    state: 'open',
    title: 'Show books',
    body: 'Closes #42',
    changed_files: 2,
    user: { login: 'github-actions[bot]' },
    head: { sha: 'head', repo: { full_name: fork ? 'other/repo' : 'owner/repo' } },
    base: { sha: 'base', ref: 'main' }
  };
  const issue = { number: 42, title: 'Books', body: 'Display the books.' };
  const github = {
    paginate: async () => comments,
    rest: {
      repos: {
        get: async () => ({ data: { default_branch: 'main' } }),
        getCollaboratorPermissionLevel: async () => ({ data: { permission } })
      },
      pulls: {
        get: async args => ({ data: args.mediaType ? '+ changed code' : structuredClone(pr) }),
        list: async () => ({ data: [pr] })
      },
      issues: {
        get: async () => ({ data: issue }),
        listComments() {},
        createComment: async args => {
          writes.push({ method: 'create', ...args });
          return { data: { id: 10 } };
        },
        updateComment: async args => {
          writes.push({ method: 'update', ...args });
          return { data: { id: args.comment_id } };
        },
        getComment: async () => ({
          data: { body: writes.at(-1).body, html_url: 'https://github.com/owner/repo/pull/43#issuecomment-10' }
        })
      },
      actions: { createWorkflowDispatch: async args => writes.push({ method: 'dispatch', ...args }) }
    }
  };
  const context = {
    repo: { owner: 'owner', repo: 'repo' },
    actor,
    eventName: manual ? 'workflow_dispatch' : 'pull_request_target',
    ref: 'refs/heads/main',
    serverUrl: 'https://github.com',
    runId: 123,
    payload: manual ? { inputs: { pull_number: '43' } } : { pull_request: structuredClone(pr) }
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
  const core = {
    info() {},
    setOutput: (key, value) => {
      outputs[key] = value;
    },
    summary
  };
  return {
    github,
    context,
    core,
    pr,
    issue,
    writes,
    outputs,
    trustedBase: 'base',
    writeContext: text => {
      collected = JSON.parse(text);
    },
    get collected() {
      return collected;
    }
  };
}

async function publication(f) {
  const snapshot = await readReview(f.github, f.context.repo, 43);
  return {
    PULL_NUMBER: '43',
    REVIEW_FINGERPRINT: snapshot.fingerprint,
    CODEX_REPORT: JSON.stringify({ report: 'P2: src/books.ts:12: missing error recovery.' })
  };
}

test('maintainer review collects bounded diff and linked acceptance criteria', async () => {
  const f = fixture();
  await prepare(f);
  assert.equal(f.outputs.review, 'true');
  assert.equal(f.collected.head, 'head');
  assert.equal(f.collected.diff, '+ changed code');
  assert.equal(f.collected.linked_issues[0].body, f.issue.body);
  assert.equal(f.writes.length, 0);
});

test('read-only users and unknown collaborators cannot start paid reviews', async () => {
  for (const permission of ['read', 'triage', undefined]) {
    const f = fixture({ permission: permission || 'none' });
    await prepare(f);
    assert.equal(f.outputs.review, undefined);
  }
  const f = fixture();
  f.github.rest.repos.getCollaboratorPermissionLevel = async () => {
    throw Object.assign(new Error(), { status: 404 });
  };
  await prepare(f);
  assert.equal(f.outputs.review, undefined);
});

test('fork events are skipped; a maintainer can explicitly dispatch a fork review', async () => {
  const event = fixture({ fork: true });
  await prepare(event);
  assert.equal(event.outputs.review, undefined);
  const manual = fixture({ fork: true, manual: true });
  await prepare(manual);
  assert.equal(manual.outputs.review, 'true');
});

test('manual review must use default branch and the actual trusted base checkout', async () => {
  const f = fixture({ manual: true });
  f.context.ref = 'refs/heads/untrusted';
  await assert.rejects(prepare(f), /default branch/);
  f.context.ref = 'refs/heads/main';
  f.trustedBase = 'old-base';
  await assert.rejects(prepare(f), /trusted checkout/);
});

test('bot dispatch requires matching head and a bot-owned local PR', async () => {
  const f = fixture({ actor: 'github-actions[bot]', manual: true });
  await assert.rejects(prepare(f), /expected head/);
  f.context.payload.inputs.head_sha = 'old';
  await prepare(f);
  assert.equal(f.outputs.review, undefined);
  f.context.payload.inputs.head_sha = 'head';
  await prepare(f);
  assert.equal(f.outputs.review, 'true');
  for (const foreign of [false, true]) {
    const denied = fixture({ actor: 'github-actions[bot]', manual: true, fork: foreign });
    denied.context.payload.inputs.head_sha = 'head';
    if (!foreign) denied.pr.user.login = 'someone-else';
    await prepare(denied);
    assert.equal(denied.outputs.review, undefined);
  }
});

test('closed PRs, other base branches and superseded events skip the agent', async () => {
  for (const change of [
    f => {
      f.pr.state = 'closed';
    },
    f => {
      f.pr.base.ref = 'release';
    },
    f => {
      f.context.payload.pull_request.head.sha = 'old';
    }
  ]) {
    const f = fixture();
    change(f);
    await prepare(f);
    assert.equal(f.outputs.review, undefined);
  }
});

test('only an existing bot review suppresses a duplicate paid review', async () => {
  const f = fixture();
  const snapshot = await readReview(f.github, f.context.repo, 43);
  const comment = { user: { login: 'maintainer' }, body: `${marker}\n<!-- revision:${snapshot.fingerprint} -->` };
  f.github.paginate = async () => [comment];
  await prepare(f);
  assert.equal(f.outputs.review, 'true');
  delete f.outputs.review;
  comment.user.login = 'github-actions[bot]';
  await prepare(f);
  assert.equal(f.outputs.review, undefined);
});

test('fail closed for excessive files, context, linked issues and missing diff', async () => {
  const f = fixture();
  f.pr.changed_files = 101;
  await assert.rejects(readReview(f.github, f.context.repo, 43), /100 changed files/);
  f.pr.changed_files = 2;
  f.pr.body = 'Closes #1, fixes #2, resolves #3, closes #4, fixes #5, resolves #6';
  await assert.rejects(readReview(f.github, f.context.repo, 43), /five locally linked/);
  f.pr.body = 'x'.repeat(200001);
  await assert.rejects(readReview(f.github, f.context.repo, 43), /200 KB/);
  f.pr.body = '';
  f.github.rest.pulls.get = async args => ({ data: args.mediaType ? '' : structuredClone(f.pr) });
  await assert.rejects(readReview(f.github, f.context.repo, 43), /no reviewable diff/);
});

test('a PR changing during diff collection is rejected', async () => {
  const f = fixture();
  const original = f.github.rest.pulls.get;
  f.github.rest.pulls.get = async args => {
    const result = await original(args);
    if (args.mediaType) f.pr.head.sha = 'new';
    return result;
  };
  await assert.rejects(readReview(f.github, f.context.repo, 43), /collecting the diff/);
});

test('report validation rejects malformed, empty, oversized and extra output', () => {
  for (const raw of [
    'invalid',
    'null',
    '{}',
    '{"report":" "}',
    '{"report":"ok","files":[]}',
    JSON.stringify({ report: 'x'.repeat(40000) })
  ]) {
    assert.throws(() => validateReport(raw));
  }
  assert.equal(validateReport('{"report":" Checked. "}'), 'Checked.');
});

test('publisher preserves human comments, confirms its write and updates its single bot comment', async () => {
  const human = { id: 1, user: { login: 'maintainer' }, body: marker };
  const f = fixture({ comments: [human] });
  const env = await publication(f);
  await publish({ ...f, env });
  assert.equal(f.writes[0].method, 'create');
  assert.match(f.writes[0].body, /gpt-5\.6-luna/);
  assert.match(f.writes[0].body, /head.*base/);
  f.github.paginate = async () => [human, { id: 10, user: { login: 'github-actions[bot]' }, body: `${marker}\nold` }];
  await publish({ ...f, env });
  assert.equal(f.writes[1].method, 'update');
  assert.equal(f.writes[1].comment_id, 10);
  f.github.paginate = async () => [{ id: 10, user: { login: 'github-actions[bot]' }, body: f.writes.at(-1).body }];
  await publish({ ...f, env });
  assert.equal(f.writes.length, 2);
});

test('publisher never writes stale head, base, PR description or linked requirements', async () => {
  for (const change of [
    f => {
      f.pr.head.sha = 'new';
    },
    f => {
      f.pr.base.sha = 'new';
    },
    f => {
      f.pr.body += ' updated';
    },
    f => {
      f.issue.body += ' updated';
    },
    f => {
      f.pr.state = 'closed';
    }
  ]) {
    const f = fixture();
    const env = await publication(f);
    change(f);
    await assert.rejects(publish({ ...f, env }));
    assert.equal(f.writes.length, 0);
  }
});

test('publisher reports an unconfirmed GitHub write instead of claiming success', async () => {
  const f = fixture();
  const env = await publication(f);
  f.github.rest.issues.getComment = async () => ({ data: { body: 'different' } });
  await assert.rejects(publish({ ...f, env }), /could not be confirmed/);
  assert.equal(f.writes.length, 1);
});

test('implementation handoff dispatches the exact local bot PR head on main', async () => {
  const f = fixture();
  await queueImplementationReview({ ...f, number: 42 });
  assert.deepEqual(f.writes[0], {
    method: 'dispatch',
    owner: 'owner',
    repo: 'repo',
    workflow_id: 'pull-request-review.yml',
    ref: 'main',
    inputs: { pull_number: '43', head_sha: 'head' }
  });
  f.pr.user.login = 'someone-else';
  await assert.rejects(queueImplementationReview({ ...f, number: 42 }), /No open implementation PR/);
  assert.equal(f.writes.length, 1);
});

test('workflow trust boundary keeps PR head unexecuted and separates the publisher key', () => {
  const workflow = readFileSync('.github/workflows/pull-request-review.yml', 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /ref:.*(?:head|merge)|npm (?:ci|install)|npm run|PAT_TOKEN/);
  const [review, publisher] = workflow.split('\n  publish:');
  assert.match(review, /ref: \$\{\{ github.event.pull_request.base.sha \|\| github.sha \}\}/);
  assert.doesNotMatch(review, /(?:contents|issues|pull-requests): write/);
  assert.match(review, /model: gpt-5.6-luna/);
  assert.match(review, /sandbox: read-only/);
  assert.doesNotMatch(publisher, /OPENAI_API_KEY|openai\/codex-action/);
  assert.match(publisher, /pull-requests: write/);
  assert.match(publisher, /issues: read/);
  assert.doesNotMatch(publisher, /contents: write/);
});
