const { createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');

const marker = '<!-- codex-issue-analysis -->';
const labels = ['ready-for-implementation', 'needs-clarification'];

function issueNumber(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error('A positive integer issue number is required.');
  }
  return Number(value);
}

function isAnalysisComment(comment) {
  return comment.user?.login === 'github-actions[bot]' && comment.body?.startsWith(marker);
}

async function readIssue(github, repo, number) {
  const { data: issue } = await github.rest.issues.get({ ...repo, issue_number: number });
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...repo,
    issue_number: number,
    per_page: 100
  });
  const discussion = comments.filter(comment => !isAnalysisComment(comment));
  const data = {
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    updated_at: issue.updated_at,
    comments_truncated: discussion.length > 100,
    comments: discussion.slice(-100).map(comment => ({
      id: comment.id,
      author: comment.user?.login,
      body: comment.body || '',
      updated_at: comment.updated_at
    }))
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return { issue, comments, data, fingerprint };
}

function validateReport(raw) {
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'label,report' ||
    !labels.includes(value.label) ||
    typeof value.report !== 'string' ||
    value.report.trim().length === 0 ||
    value.report.length > 40000
  ) {
    throw new Error('Codex returned an invalid analysis report.');
  }
  return { label: value.label, report: value.report.trim() };
}

async function prepare({ github, context, core }) {
  const number = issueNumber(context.payload.issue?.number ?? context.payload.inputs?.issue_number);
  let access;
  try {
    ({ data: access } = await github.rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username: context.actor
    }));
  } catch (error) {
    if (error.status !== 404) throw error;
    core.info('Skipping API usage for an actor without repository access.');
    return;
  }
  if (!['admin', 'maintain', 'write'].includes(access.permission)) {
    core.info('Skipping API usage for an actor without repository write access.');
    return;
  }
  const snapshot = await readIssue(github, context.repo, number);
  if (snapshot.issue.pull_request || snapshot.issue.state !== 'open') {
    core.info('Only open issues are analyzed.');
    return;
  }
  const text = JSON.stringify(snapshot.data);
  if (text.length > 120000) {
    throw new Error('Issue context is too large for this analysis workflow.');
  }
  writeFileSync('.github/codex/issue-context.json', text, 'utf8');
  core.setOutput('issue_number', number);
  core.setOutput('fingerprint', snapshot.fingerprint);
  core.setOutput('analyze', 'true');
}

async function publish({ github, context, core }) {
  const number = issueNumber(process.env.ISSUE_NUMBER);
  const result = validateReport(process.env.CODEX_REPORT);
  const snapshot = await readIssue(github, context.repo, number);
  if (
    snapshot.issue.pull_request ||
    snapshot.issue.state !== 'open' ||
    snapshot.fingerprint !== process.env.ISSUE_FINGERPRINT
  ) {
    core.warning('Issue changed or closed during analysis; no stale result will be published.');
    return;
  }
  const target = { ...context.repo, issue_number: number };
  try {
    await github.rest.issues.getLabel({ ...context.repo, name: result.label });
  } catch (error) {
    if (error.status !== 404) throw error;
    try {
      await github.rest.issues.createLabel({
        ...context.repo,
        name: result.label,
        color: result.label === 'ready-for-implementation' ? '0e8a16' : 'fbca04'
      });
    } catch (error) {
      if (error.status !== 422) throw error;
    }
  }
  await github.rest.issues.addLabels({ ...target, labels: [result.label] });
  const opposite = labels.find(label => label !== result.label);
  if (snapshot.issue.labels.some(label => (typeof label === 'string' ? label : label.name) === opposite)) {
    try {
      await github.rest.issues.removeLabel({ ...target, name: opposite });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  const body =
    `${marker}\n## 🤖 Automated Issue Analysis by Codex\n\n${result.report}\n\n` +
    `---\nModel: \`gpt-5.6-luna\`. [Workflow run](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}).`;
  const existing = snapshot.comments.find(isAnalysisComment);
  if (existing) {
    await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ ...target, body });
  }
  await core.summary.addHeading('Issue analysis').addRaw(`Issue #${number}: ${result.label}`).write();
  if (result.label === 'ready-for-implementation') {
    // GITHUB_TOKEN label events do not start another workflow. Dispatch explicitly.
    const { snapshot: implementationSnapshot, requirementData, digest } = require('./issue-implementation.cjs');
    const current = await implementationSnapshot(github, context.repo, number);
    if (
      !current.issue.labels.some(
        label => (typeof label === 'string' ? label : label.name) === 'implementation-approved'
      )
    ) {
      core.info('Analysis is ready; a maintainer must apply implementation-approved before implementation.');
      return;
    }
    if (current.fingerprint !== digest(JSON.stringify(requirementData(snapshot.data)))) {
      core.warning('Requirements changed during publication; analyze again before implementation.');
      return;
    }
    const { data: repository } = await github.rest.repos.get(context.repo);
    await github.rest.actions.createWorkflowDispatch({
      ...context.repo,
      workflow_id: 'issue-implementation.yml',
      ref: repository.default_branch,
      inputs: { issue_number: String(number), fingerprint: current.fingerprint }
    });
    core.info(`Queued implementation for issue #${number}.`);
  }
}

module.exports = { issueNumber, validateReport, readIssue, prepare, publish, isAnalysisComment };
