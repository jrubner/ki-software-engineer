const { createHash } = require('node:crypto');
const { mkdirSync, writeFileSync, unlinkSync, existsSync, lstatSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { issueNumber, readIssue } = require('./issue-analysis.cjs');

const readyLabel = 'ready-for-implementation';
const marker = '<!-- codex-issue-implementation -->';
const branchName = number => `codex/issue-${issueNumber(number)}`;
const digest = text => createHash('sha256').update(text).digest('hex');
const labeled = (issue, name) => issue.labels.some(label => (typeof label === 'string' ? label : label.name) === name);

function validateResult(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 100000)
    throw new Error('Implementation output exceeds 100 KB.');
  const result = JSON.parse(raw);
  if (
    !result ||
    Object.keys(result).sort().join(',') !== 'files,report,status' ||
    !['implemented', 'blocked', 'already-satisfied'].includes(result.status) ||
    typeof result.report !== 'string' ||
    !result.report.trim() ||
    result.report.length > 12000 ||
    !Array.isArray(result.files) ||
    result.files.length > 30
  )
    throw new Error('Invalid implementation result.');
  const paths = new Set();
  for (const file of result.files) {
    if (
      !file ||
      Object.keys(file).sort().join(',') !== 'content,path' ||
      typeof file.path !== 'string' ||
      !/^(?:(?:src|tests|docs|public)\/[a-zA-Z0-9_./-]+|ARCHITECTURE\.md|REFACTORING\.md|README\.md)$/.test(
        file.path
      ) ||
      file.path
        .split('/')
        .some(part => !part || part.startsWith('.') || part === 'AGENTS.md' || part === 'AGENTS.override.md') ||
      file.path.toLowerCase().endsWith('.exe') ||
      /\.(?:png|jpg|jpeg|gif|webp|woff2?|pdf|zip)$/i.test(file.path) ||
      (file.content !== null && (typeof file.content !== 'string' || file.content.includes('\0'))) ||
      paths.has(file.path.toLowerCase())
    )
      throw new Error('Invalid or protected implementation path.');
    paths.add(file.path.toLowerCase());
  }
  const hasChanges = result.files.length > 0;
  if ((result.status === 'implemented') !== hasChanges) throw new Error('Status and changes disagree.');
  return result;
}

function requirementData(data) {
  // The implementation's own status comment must not invalidate a retry.
  return {
    ...data,
    updated_at: undefined,
    comments: data.comments.filter(
      comment => !(comment.author === 'github-actions[bot]' && comment.body.startsWith(marker))
    )
  };
}

async function snapshot(github, repo, number) {
  const value = await readIssue(github, repo, number);
  const data = requirementData(value.data);
  return { ...value, data, fingerprint: digest(JSON.stringify(data)) };
}

async function findPullRequest(github, repo, number) {
  const { data } = await github.rest.pulls.list({
    ...repo,
    state: 'all',
    head: `${repo.owner}:${branchName(number)}`,
    per_page: 100
  });
  return data[0];
}

async function prepare({
  github,
  context,
  core,
  writeContext = text => writeFileSync('.github/codex/implementation-context.json', text)
}) {
  const number = issueNumber(context.payload.issue?.number ?? context.payload.inputs?.issue_number);
  const botDispatch = context.actor === 'github-actions[bot]' && context.eventName === 'workflow_dispatch';
  if (!botDispatch) {
    let permission;
    try {
      ({
        data: { permission }
      } = await github.rest.repos.getCollaboratorPermissionLevel({ ...context.repo, username: context.actor }));
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    if (!['write', 'maintain', 'admin'].includes(permission)) {
      core.info('Only maintainers may start paid implementation.');
      return;
    }
  }
  const current = await snapshot(github, context.repo, number);
  if (
    current.issue.state !== 'open' ||
    current.issue.pull_request ||
    !labeled(current.issue, readyLabel) ||
    !labeled(current.issue, 'implementation-approved') ||
    labeled(current.issue, 'needs-clarification')
  ) {
    core.info('Implementation requires an open, ready, explicitly approved issue without unresolved clarification.');
    return;
  }
  const expected = context.payload.inputs?.fingerprint;
  if ((botDispatch && !expected) || (expected && expected !== current.fingerprint)) {
    core.info('The queued issue has changed; analyze it again.');
    return;
  }
  if (current.data.comments_truncated)
    throw new Error('The discussion is too large; clarify it before implementation.');
  if (await findPullRequest(github, context.repo, number)) {
    core.info('This issue already has an implementation PR; no duplicate will be created.');
    return;
  }
  try {
    await github.rest.git.getRef({ ...context.repo, ref: `heads/${branchName(number)}` });
    core.info('An implementation branch already exists; inspect it before retrying.');
    return;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const { data: repository } = await github.rest.repos.get(context.repo);
  const base = repository.default_branch;
  const { data: ref } = await github.rest.git.getRef({ ...context.repo, ref: `heads/${base}` });
  const text = JSON.stringify(current.data);
  if (Buffer.byteLength(text) > 100000) throw new Error('Issue context exceeds 100 KB.');
  writeContext(text);
  for (const [name, value] of Object.entries({
    issue_number: number,
    fingerprint: current.fingerprint,
    base,
    sha: ref.object.sha,
    implement: 'true'
  }))
    core.setOutput(name, value);
}

function applyResult(raw, root = process.cwd()) {
  const result = validateResult(raw);
  // Validate every ancestor before touching any file; generated symlinks are unsupported.
  for (const file of result.files) {
    let current = root;
    for (const part of file.path.split('/')) {
      current = join(current, part);
      const stat = lstatSync(current, { throwIfNoEntry: false });
      if (stat && (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))) {
        throw new Error('Only regular files and directories may be changed.');
      }
    }
    if (file.content === null && (!existsSync(current) || !lstatSync(current).isFile()))
      throw new Error('Deletion requires an existing regular file.');
  }
  for (const file of result.files) {
    const target = join(root, file.path);
    if (file.content === null) unlinkSync(target);
    else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content, 'utf8');
    }
  }
  return result;
}

async function publish({ github, context, core, env = process.env }) {
  const number = issueNumber(env.ISSUE_NUMBER);
  const raw = env.CODEX_RESULT;
  const result = validateResult(raw);
  if (digest(raw) !== env.VERIFIED_DIGEST) throw new Error('Only the independently validated result can be published.');
  if (result.status === 'implemented' && env.VERIFIED !== 'true')
    throw new Error('Verification must pass before creating a PR.');
  const current = await snapshot(github, context.repo, number);
  const { data: base } = await github.rest.git.getRef({ ...context.repo, ref: `heads/${env.BASE_BRANCH}` });
  if (
    current.issue.state !== 'open' ||
    current.issue.pull_request ||
    !labeled(current.issue, readyLabel) ||
    !labeled(current.issue, 'implementation-approved') ||
    labeled(current.issue, 'needs-clarification') ||
    current.fingerprint !== env.ISSUE_FINGERPRINT ||
    base.object.sha !== env.BASE_SHA
  ) {
    throw new Error(
      'Issue readiness, requirements, or base revision changed. Retry against current requirements and source.'
    );
  }
  const target = { ...context.repo, issue_number: number };
  const run = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  let url;
  if (result.status === 'implemented') {
    const existing = await findPullRequest(github, context.repo, number);
    if (existing) {
      core.info(`Existing PR: ${existing.html_url}`);
      return;
    }
    const { data: commit } = await github.rest.git.getCommit({ ...context.repo, commit_sha: env.BASE_SHA });
    const { data: tree } = await github.rest.git.createTree({
      ...context.repo,
      base_tree: commit.tree.sha,
      tree: result.files.map(file => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        ...(file.content === null ? { sha: null } : { content: file.content })
      }))
    });
    if (tree.sha === commit.tree.sha) throw new Error('No source changes were produced.');
    const { data: created } = await github.rest.git.createCommit({
      ...context.repo,
      message: `feat(issue-${number}): Anforderung automatisch umsetzen`,
      tree: tree.sha,
      parents: [env.BASE_SHA]
    });
    // Never update or force-push an existing branch. An ambiguous failure is inspected on retry.
    await github.rest.git.createRef({ ...context.repo, ref: `refs/heads/${branchName(number)}`, sha: created.sha });
    const { data: pr } = await github.rest.pulls.create({
      ...context.repo,
      base: env.BASE_BRANCH,
      head: branchName(number),
      title: `feat(issue-${number}): ${current.issue.title}`.slice(0, 240),
      body:
        `Closes #${number}\n\nAutomatisch mit Codex (\`gpt-5.6-luna\`) umgesetzt.\n\n${result.report}\n\n` +
        `Unabhängig geprüft: Development- und Production-Build, Anwendungsregressionen und neue Playwright-Tests.\n\n` +
        `### Review\n\n- [ ] Akzeptanzkriterien und Testabdeckung prüfen\n- [ ] Code und Änderungen prüfen\n` +
        `- [ ] Workflow-Nachweise und Einschränkungen prüfen\n\n[Workflow-Nachweis](${run})\n\nReview und Merge stehen aus.`
    });
    url = pr.html_url;
  }
  const body =
    `${marker}\n## Codex implementation: ${result.status}\n\n${result.report}\n\n` +
    `${url ? `Branch: \`${branchName(number)}\`\n\nCommit: \`feat(issue-${number}): Anforderung automatisch umsetzen\`\n\nPull request: ${url}\n\n` : 'No PR created. The issue remains open; review the evidence or clarify the requirement before retrying.\n\n'}` +
    `[Workflow run](${run}) · Model: \`gpt-5.6-luna\``;
  const existingComment = current.comments.find(
    comment => comment.user?.login === 'github-actions[bot]' && comment.body?.startsWith(marker)
  );
  if (existingComment)
    await github.rest.issues.updateComment({ ...context.repo, comment_id: existingComment.id, body });
  else await github.rest.issues.createComment({ ...target, body });
  await core.summary
    .addHeading('Issue implementation')
    .addRaw(url || `Issue #${number}: ${result.status}`)
    .write();
}

function applicationTests(root = process.cwd()) {
  const { readdirSync } = require('node:fs');
  const walk = directory =>
    readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? walk(path)
        : path.endsWith('.spec.ts') && path !== 'tests/example.spec.ts'
          ? [path]
          : [];
    });
  const tests = walk('tests');
  if (!tests.length) throw new Error('No application regression tests found.');
  return tests.sort();
}

function runApplicationTests(root = process.cwd(), args = []) {
  const env = { ...process.env };
  if ('NO_COLOR' in env) {
    env.FORCE_COLOR = '0';
    delete env.NO_COLOR;
  }
  execFileSync(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      ...applicationTests(root),
      '--project=chromium',
      '--workers=1',
      ...args
    ],
    { cwd: root, stdio: 'inherit', env }
  );
}

module.exports = {
  readyLabel,
  marker,
  branchName,
  digest,
  validateResult,
  requirementData,
  snapshot,
  prepare,
  applyResult,
  publish,
  applicationTests,
  runApplicationTests
};

if (require.main === module) {
  if (process.argv[2] === 'apply') applyResult(process.env.CODEX_RESULT);
  else if (process.argv[2] === 'test') runApplicationTests(process.cwd(), process.argv.slice(3));
  else throw new Error('Expected apply or test.');
}
