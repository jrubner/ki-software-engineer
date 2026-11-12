const { writeFileSync } = require('node:fs');
const { validateResult, applyResult, digest } = require('./issue-implementation.cjs');

const marker = id => `<!-- codex-ci-auto-fix:${id} -->`;
const branchName = id => `codex/auto-fix-${id}`;
const fullName = repo => `${repo.owner}/${repo.repo}`;

function runNumber(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('A positive workflow run ID is required.');
  return Number(value);
}

async function readRun(github, context, id) {
  const { data: run } = await github.rest.actions.getWorkflowRun({ ...context.repo, run_id: runNumber(id) });
  return run;
}

async function authorizedRun(github, context, id) {
  const run = await readRun(github, context, id);
  if (
    run.name !== 'Repository Validation' ||
    run.path !== '.github/workflows/repository-validation.yml' ||
    run.status !== 'completed' ||
    run.conclusion !== 'failure' ||
    !['push', 'pull_request', 'workflow_dispatch'].includes(run.event) ||
    run.repository?.full_name !== fullName(context.repo) ||
    run.head_repository?.full_name !== fullName(context.repo) ||
    !/^[a-f0-9]{40}$/.test(run.head_sha) ||
    !run.head_branch ||
    run.head_branch.startsWith('codex/auto-fix-') ||
    run.run_attempt !== 1
  )
    return;
  const actor = run.actor?.login;
  if (!actor || actor.endsWith('[bot]')) return;
  let permission;
  try {
    ({
      data: { permission }
    } = await github.rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username: actor
    }));
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  if (!['write', 'maintain', 'admin'].includes(permission)) return;
  const { data: ref } = await github.rest.git.getRef({ ...context.repo, ref: `heads/${run.head_branch}` });
  if (ref.object.sha !== run.head_sha) return;
  // A merged repair must not start another paid attempt on its target branch.
  const { data: commit } = await github.rest.git.getCommit({ ...context.repo, commit_sha: run.head_sha });
  if (commit.message.startsWith('fix(ci): Automatische CI-Reparatur')) return;
  return run;
}

async function findPull(github, context, run) {
  const { data } = await github.rest.pulls.list({
    ...context.repo,
    state: 'all',
    head: `${context.repo.owner}:${branchName(run.id)}`,
    per_page: 100
  });
  return data[0];
}

function redact(text) {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/g, '[REDACTED]')
    .replace(/(authorization\s*[:=]\s*(?:bearer|basic)\s+)\S+/gi, '$1[REDACTED]');
}

async function prepare({
  github,
  context,
  core,
  writeContext = text => writeFileSync('.github/codex/ci-failure.json', text)
}) {
  const run = await authorizedRun(github, context, context.payload.workflow_run.id);
  if (!run) {
    core.info('Skip untrusted, stale, repeated, or successful CI run.');
    return;
  }
  if (await findPull(github, context, run)) {
    core.info('A repair PR already exists.');
    return;
  }
  core.setOutput('run_id', String(run.id));
  core.setOutput('branch', run.head_branch);
  core.setOutput('sha', run.head_sha);
  // Mark the attempt before log collection so unavailable logs produce a notification.
  core.setOutput('attempt', 'true');
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    ...context.repo,
    run_id: run.id,
    filter: 'latest',
    per_page: 100
  });
  const failed = jobs.filter(job => job.conclusion === 'failure');
  if (!failed.length) throw new Error('No failed job logs are available.');
  const logs = [];
  for (const job of failed.slice(0, 3)) {
    const { data } = await github.rest.actions.downloadJobLogsForWorkflowRun({ ...context.repo, job_id: job.id });
    const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    logs.push({
      job: job.name,
      failed_steps: job.steps?.filter(step => step.conclusion === 'failure').map(step => step.name),
      log_tail: redact(text.slice(-16000)),
      truncated: text.length > 16000
    });
  }
  const collected = JSON.stringify({ run_id: run.id, branch: run.head_branch, sha: run.head_sha, logs });
  writeContext(collected);
  core.setOutput('failure_context', collected);
  core.setOutput('repair', 'true');
}

function validateRepair(raw) {
  const result = validateResult(raw);
  if (result.status === 'already-satisfied') throw new Error('A failed CI needs a verified fix or a blocker.');
  return result;
}

function applyRepair(raw, root = 'source') {
  validateRepair(raw);
  return applyResult(raw, root);
}

async function publish({ github, context, core, env = process.env }) {
  const run = await authorizedRun(github, context, env.FAILED_RUN_ID);
  if (!run || run.head_sha !== env.FAILED_SHA || run.head_branch !== env.FAILED_BRANCH)
    throw new Error('The failed run or target revision changed; no repair published.');
  const result = validateRepair(env.CODEX_RESULT);
  if (result.status !== 'implemented' || env.VERIFIED !== 'true' || digest(env.CODEX_RESULT) !== env.VERIFIED_DIGEST)
    throw new Error('A repair must pass independent validation before publication.');
  let pr = await findPull(github, context, run);
  if (!pr) {
    const { data: commit } = await github.rest.git.getCommit({ ...context.repo, commit_sha: run.head_sha });
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
    if (tree.sha === commit.tree.sha) throw new Error('The proposed fix changes no files.');
    const { data: created } = await github.rest.git.createCommit({
      ...context.repo,
      tree: tree.sha,
      parents: [run.head_sha],
      message: `fix(ci): Automatische CI-Reparatur für Lauf ${run.id}`
    });
    // Never force-push or overwrite a branch after an ambiguous API response.
    try {
      await github.rest.git.createRef({ ...context.repo, ref: `refs/heads/${branchName(run.id)}`, sha: created.sha });
    } catch (error) {
      if (error.status !== 422) throw error;
      const { data: existing } = await github.rest.git.getRef({ ...context.repo, ref: `heads/${branchName(run.id)}` });
      const { data: oldCommit } = await github.rest.git.getCommit({ ...context.repo, commit_sha: existing.object.sha });
      if (
        oldCommit.tree.sha !== tree.sha ||
        oldCommit.parents.length !== 1 ||
        oldCommit.parents[0].sha !== run.head_sha
      )
        throw new Error('An unrelated repair branch already exists.');
    }
    ({ data: pr } = await github.rest.pulls.create({
      ...context.repo,
      base: run.head_branch,
      head: branchName(run.id),
      title: `fix(ci): Fehlgeschlagenen CI-Lauf ${run.id} reparieren`,
      body:
        `${marker(run.id)}\nAutomatisch mit Codex (\`gpt-5.6-luna\`) vorbereitet.\n\n${redact(result.report)}\n\n` +
        `Ausgangscommit: \`${run.head_sha}\`\n[Fehlgeschlagene CI](${run.html_url})\n\n` +
        `Unabhängig geprüft: Automatisierungstests, Angular-Unit-Tests, beide Builds und Anwendungs-Browsertests.\n\n` +
        `- [ ] Ursache und minimalen Fix prüfen\n- [ ] Nachweise und Einschränkungen prüfen\n\nKein automatischer Merge.`
    }));
  }
  const { data: saved } = await github.rest.pulls.get({ ...context.repo, pull_number: pr.number });
  if (saved.head.ref !== branchName(run.id) || saved.base.ref !== run.head_branch)
    throw new Error('The published repair PR does not match its target.');
  core.setOutput('pull_url', saved.html_url);
  // Explicit dispatch also works when GITHUB_TOKEN PR events do not start CI.
  await github.rest.actions.createWorkflowDispatch({
    ...context.repo,
    workflow_id: 'repository-validation.yml',
    ref: branchName(run.id)
  });
  await core.summary.addHeading('CI repair').addRaw(saved.html_url).write();
}

async function notify({ github, context, core, env = process.env }) {
  const run = await readRun(github, context, env.FAILED_RUN_ID);
  if (run.repository?.full_name !== fullName(context.repo)) throw new Error('Unexpected notification repository.');
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo,
    creator: 'github-actions[bot]',
    state: 'all',
    per_page: 100
  });
  const existing = issues.find(issue => !issue.pull_request && issue.body?.startsWith(marker(run.id)));
  if (existing) {
    core.info(`Existing failure notification: ${existing.html_url}`);
    return;
  }
  for (const name of ['bug', 'auto-fix-failed', 'needs-attention']) {
    try {
      await github.rest.issues.getLabel({ ...context.repo, name });
    } catch (error) {
      if (error.status !== 404) throw error;
      await github.rest.issues.createLabel({ ...context.repo, name, color: 'd73a4a' });
    }
  }
  let report = 'Automatische Reparatur oder unabhängige Prüfung fehlgeschlagen. Bitte die Job-Logs prüfen.';
  try {
    report = redact(validateRepair(env.CODEX_RESULT).report);
  } catch {
    /* Invalid output is not published. */
  }
  const { data: issue } = await github.rest.issues.create({
    ...context.repo,
    title: `CI-Reparatur fehlgeschlagen: Lauf ${run.id}`,
    labels: ['bug', 'auto-fix-failed', 'needs-attention'],
    body:
      `${marker(run.id)}\nEine erfolgreiche Reparatur einschließlich Prüfung und Veröffentlichung wurde nicht bestätigt.\n\n` +
      `Agentenbericht (kein unabhängiger Erfolgsnachweis):\n${report}\n\nBranch: \`${run.head_branch}\`\nCommit: \`${run.head_sha}\`\n\n` +
      `[Fehlgeschlagene CI](${run.html_url})\n` +
      `[Reparaturversuch](${context.serverUrl}/${fullName(context.repo)}/actions/runs/${context.runId})\n\n` +
      'Manuelle Prüfung erforderlich. Kein automatischer Merge oder erneuter Reparaturversuch.'
  });
  const { data: saved } = await github.rest.issues.get({ ...context.repo, issue_number: issue.number });
  if (!saved.body?.startsWith(marker(run.id))) throw new Error('Failure notification could not be confirmed.');
  await core.summary.addHeading('Manual intervention required').addRaw(saved.html_url).write();
}

module.exports = {
  runNumber,
  marker,
  branchName,
  redact,
  authorizedRun,
  prepare,
  validateRepair,
  applyRepair,
  publish,
  notify
};
if (require.main === module) {
  if (process.argv[2] === 'apply') applyRepair(process.env.CODEX_RESULT);
  else throw new Error('Expected apply.');
}
