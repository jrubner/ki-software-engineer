const { createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { issueNumber } = require('./issue-analysis.cjs');

const marker = '<!-- codex-pull-request-review -->';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const revision = pr => ({
  number: pr.number,
  state: pr.state,
  title: pr.title,
  body: pr.body || '',
  head: pr.head.sha,
  base: pr.base.sha,
  base_ref: pr.base.ref,
  head_repository: pr.head.repo?.full_name
});
const ownComment = comment => comment.user?.login === 'github-actions[bot]' && comment.body?.startsWith(marker);

function validateReport(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 40000) throw new Error('Review output exceeds 40 KB.');
  const value = JSON.parse(raw);
  if (!value || Object.keys(value).join(',') !== 'report' || typeof value.report !== 'string' || !value.report.trim())
    throw new Error('Invalid review output.');
  return value.report.trim();
}

async function readReview(github, repo, number) {
  const args = { ...repo, pull_number: number };
  const { data: pr } = await github.rest.pulls.get(args);
  if (pr.state !== 'open') throw new Error('Only open pull requests can be reviewed.');
  if (pr.changed_files > 100) throw new Error('Split this PR: reviews support at most 100 changed files.');
  const { data: diff } = await github.rest.pulls.get({ ...args, mediaType: { format: 'diff' } });
  if (typeof diff !== 'string' || !diff.trim()) throw new Error('GitHub returned no reviewable diff.');
  const linkedNumbers = [
    ...(pr.body || '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#([1-9]\d*)\b/gi)
  ].map(match => issueNumber(match[1]));
  const uniqueNumbers = [...new Set(linkedNumbers)];
  if (uniqueNumbers.length > 5) throw new Error('Reviews support at most five locally linked issues.');
  const issues = [];
  for (const issue_number of uniqueNumbers) {
    const { data: issue } = await github.rest.issues.get({ ...repo, issue_number });
    if (!issue.pull_request) issues.push({ number: issue.number, title: issue.title, body: issue.body || '' });
  }
  const data = { ...revision(pr), diff, linked_issues: issues };
  const text = JSON.stringify(data);
  if (Buffer.byteLength(text) > 200000) throw new Error('Split this PR: review context exceeds 200 KB.');
  const { data: latest } = await github.rest.pulls.get(args);
  if (hash(revision(latest)) !== hash(revision(pr))) throw new Error('PR changed while collecting the diff. Retry.');
  return { pr, text, fingerprint: hash(data) };
}

async function prepare({
  github,
  context,
  core,
  trustedBase = process.env.TRUSTED_BASE_SHA,
  writeContext = text => writeFileSync('.github/codex/review-context.json', text)
}) {
  const number = issueNumber(context.payload.pull_request?.number ?? context.payload.inputs?.pull_number);
  const { data: repository } = await github.rest.repos.get(context.repo);
  const manual = context.eventName === 'workflow_dispatch';
  if (manual && context.ref !== `refs/heads/${repository.default_branch}`) {
    throw new Error('Dispatch review from the default branch.');
  }
  const bot = context.actor === 'github-actions[bot]';
  const expectedHead = context.payload.inputs?.head_sha;
  if (bot && manual && !expectedHead) throw new Error('Bot dispatch requires an expected head revision.');
  if (!bot) {
    let permission;
    try {
      ({
        data: { permission }
      } = await github.rest.repos.getCollaboratorPermissionLevel({
        ...context.repo,
        username: context.actor
      }));
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    if (!['write', 'maintain', 'admin'].includes(permission)) {
      core.info('Only maintainers or the implementation bot may start paid reviews.');
      return;
    }
  }
  const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: number });
  if (pr.state !== 'open' || pr.base.ref !== repository.default_branch) {
    core.info('Only open PRs targeting the default branch are reviewed.');
    return;
  }
  const fullName = `${context.repo.owner}/${context.repo.repo}`;
  if (((!manual || bot) && pr.head.repo?.full_name !== fullName) || (bot && pr.user?.login !== 'github-actions[bot]')) {
    core.info('Fork reviews require a maintainer dispatch; the implementation bot may review only its own local PRs.');
    return;
  }
  const snapshot = await readReview(github, context.repo, number);
  if (snapshot.pr.base.sha !== trustedBase)
    throw new Error('The trusted checkout differs from the current PR base. Retry.');
  if (expectedHead && expectedHead !== snapshot.pr.head.sha) {
    core.info('The dispatched PR revision has changed.');
    return;
  }
  if (context.payload.pull_request && context.payload.pull_request.head.sha !== snapshot.pr.head.sha) {
    core.info('A newer commit has superseded this event.');
    return;
  }
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo,
    issue_number: number,
    per_page: 100
  });
  if (
    comments.some(comment => ownComment(comment) && comment.body.includes(`<!-- revision:${snapshot.fingerprint} -->`))
  ) {
    core.info('This exact PR revision already has a review.');
    return;
  }
  writeContext(snapshot.text);
  core.setOutput('number', number);
  core.setOutput('fingerprint', snapshot.fingerprint);
  core.setOutput('review', 'true');
}

async function queueImplementationReview({ github, context, number }) {
  const { data: repository } = await github.rest.repos.get(context.repo);
  const { data: prs } = await github.rest.pulls.list({
    ...context.repo,
    state: 'open',
    base: repository.default_branch,
    head: `${context.repo.owner}:codex/issue-${issueNumber(number)}`,
    per_page: 100
  });
  const pr = prs.find(
    pr =>
      pr.user?.login === 'github-actions[bot]' &&
      pr.head.repo?.full_name === `${context.repo.owner}/${context.repo.repo}`
  );
  if (!pr) throw new Error('No open implementation PR found for review dispatch.');
  await github.rest.actions.createWorkflowDispatch({
    ...context.repo,
    workflow_id: 'pull-request-review.yml',
    ref: repository.default_branch,
    inputs: { pull_number: String(pr.number), head_sha: pr.head.sha }
  });
}

async function publish({ github, context, core, env = process.env }) {
  const number = issueNumber(env.PULL_NUMBER);
  const report = validateReport(env.CODEX_REPORT);
  const current = await readReview(github, context.repo, number);
  if (current.fingerprint !== env.REVIEW_FINGERPRINT) {
    throw new Error('PR or linked requirements changed. No stale review was published; retry.');
  }
  const run = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const body =
    `${marker}\n<!-- revision:${current.fingerprint} -->\n## Codex PR-Review\n\n${report}\n\n` +
    `---\nStand: \`${current.pr.head.sha}\` gegen \`${current.pr.base.sha}\`. Modell: \`gpt-5.6-luna\`.\n` +
    `[Workflow-Nachweis](${run}). Statische Prüfung; keine Tests ausgeführt. Kein Approval oder Merge.\n`;
  const target = { ...context.repo, issue_number: number };
  const comments = await github.paginate(github.rest.issues.listComments, { ...target, per_page: 100 });
  const existing = comments.find(ownComment);
  if (existing?.body === body) return;
  const { data: saved } = existing
    ? await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body })
    : await github.rest.issues.createComment({ ...target, body });
  const { data: confirmed } = await github.rest.issues.getComment({ ...context.repo, comment_id: saved.id });
  if (confirmed.body !== body) throw new Error('The saved review comment could not be confirmed.');
  await core.summary
    .addHeading('Codex PR review')
    .addRaw(`PR #${number}: ${current.pr.head.sha}\n\n[Review](${confirmed.html_url})`)
    .write();
}

module.exports = { marker, revision, validateReport, readReview, prepare, publish, queueImplementationReview };
