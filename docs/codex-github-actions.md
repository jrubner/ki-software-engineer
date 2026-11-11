# Codex GitHub Actions setup

This adapts the workshop task **Prepare GitHub Workflows** to Codex. It prepares
authentication and a manually triggered connectivity check. The subsequent issue
analysis, implementation, PR review, and CI repair exercises are separate work.

## Included behavior

`.github/workflows/codex-setup.yml` runs only through `workflow_dispatch`. It checks
that `OPENAI_API_KEY` exists, checks out the selected revision, and runs
`openai/codex-action@v1` on a GitHub-hosted Ubuntu runner. Codex receives a read-only
sandbox and runs as the dedicated `codex-ci` system user through the
`unprivileged-user` safety strategy. The user can traverse the runner's workspace
and read the checkout. Checkout does not persist credentials.
The final Codex response is written to the run summary in a separate job.

The workflow has only `contents: read` permission. It does not change source,
create issues or pull requests, close issues, merge, deploy, or start automatically
when somebody opens an issue or pull request. No personal access token is needed
for this check. The action and CLI use their upstream version defaults; dependency
pinning can be agreed when building the production workflow.

## Manual setup: API authentication

1. In the OpenAI API platform, select the intended project. Configure API billing
   and review the project's usage controls before making a paid API request.
2. Create a project API key that permits the Codex API requests. Keep the key out
   of chat, repository files, and workflow YAML. This workflow authenticates using
   an API key, rather than a local interactive Codex login.
3. Open this GitHub repository's **Settings → Secrets and variables → Actions →
   New repository secret**. Set the name to exactly `OPENAI_API_KEY`, paste the
   key as its value, and save it. GitHub will not show the saved value again.
4. After the workflow has been reviewed and merged into the default branch, open
   **Actions → Codex setup check → Run workflow**. Select `main` and start it.
   GitHub requires a manually dispatched workflow to be present on the default
   branch before the normal dispatch UI is available.
5. Open the run. Both **Check Codex connectivity** and **Publish setup report**
   should succeed. The summary should identify the application and list the five
   planned phases. This proves an API request and checkout read, not application
   correctness or successful execution of the five skills.

For this repository, the secret settings are at
<https://github.com/jrubner/ki-software-engineer/settings/secrets/actions>.
Use `OPENAI_API_KEY` in place of the workshop's `ANTHROPIC_API_KEY`. The preparation
check does not require the workshop's `PAT_TOKEN` or the repository setting that
allows Actions to create pull requests.

## Manual setup: workshop PAT

The workshop explicitly asks for a PAT for its subsequent issue automation. To
complete that preparation as written:

1. Open <https://github.com/settings/personal-access-tokens> and choose **Generate
   new token** under **Fine-grained tokens**. Complete personal authentication if
   GitHub requests it.
2. Use the name `github-actions-issue-analysis`, choose an appropriate expiration
   (the task suggests 90 days), and select the intended resource owner.
3. Under **Repository access**, choose **Only select repositories** and select
   `ki-software-engineer`.
4. Grant **Issues: Read and write**. **Metadata: Read-only** is automatically
   required. These are the permissions specified in this preparation task; they
   do not grant permission to push code or create pull requests.
5. Generate the token and immediately store it as the repository Actions secret
   `PAT_TOKEN`, using the same secret settings as above. Do not paste it into chat
   or a repository file.

The Codex adaptation's workshop checkpoint is therefore `OPENAI_API_KEY` plus
`PAT_TOKEN`. The included setup check uses only the former. Decide the actual token
and event strategy when implementing the following exercises; issue comments and
labels can also use an appropriately permissioned `GITHUB_TOKEN`.

## Existing five-skill workflow

Keep these five phases and their existing skills:

| Phase    | Existing skill              | Required evidence before continuing                                                                       |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Define   | `requirements-interviewer`  | Confirmed story, stable acceptance criteria, resolved product decisions                                   |
| Red      | `developer-red`             | Criterion-to-test mapping, observed behavioral failures or already satisfied cases, commands and blockers |
| Green    | `developer-green`           | Agreed behavior implemented or already satisfied, current focused and regression results                  |
| Refactor | `developer-blue`            | Verified Green baseline, scoped findings resolved or justified no-change result                           |
| Finalise | `requirements-finalisation` | Acceptance matrix, required checks, delivery conditions and authorized issue actions                      |

Personal skills under `.agents/skills/` remain local and are not checked out by
GitHub Actions. This setup does not copy or synchronize them into tracked files
and creates no additional skill. Their availability on a runner must be agreed
before implementing the full workflow.

The workshop's linked `solution--agentic-workflows-skills` baseline instead
contains tracked skills under `.claude/skills/`; it does not prescribe a secret
containing skill texts. That Claude-specific baseline is not reset or copied over
this repository. Adapting it to Codex while keeping personal skills local requires
an explicit decision about which instructions can be shared with CI.

The skills currently refer to `context-recovery` when context is missing. This is
an existing conditional helper, not a sixth workflow phase or a formal `required`
dependency. The future runner must either receive complete context or stop with a
specific blocker; it cannot assume a local helper is installed. Finalisation
currently has no mandatory Blue handoff, so the orchestrator must explicitly
require a Blue result (including a justified no-change result) for this five-phase
sequence.

Before automation, define a shared handoff containing the issue identity, source
revision, unchanged acceptance criterion IDs, phase outcome, changed paths,
commands and actual results, and blockers. Do not advance after missing evidence.
An already satisfied Red result needs an explicit Green no-change path. Each
phase's existing stopping and authorization rules still apply. A workflow run
does not itself authorize publishing changes, merging, or closing an issue.

Use narrowly scoped `GITHUB_TOKEN` permissions for future issue/PR operations.
Choose explicit dispatch or a GitHub App if later runs need to trigger each other;
do not add a broad PAT merely to imitate the Claude example. Evaluate event
behavior and repository PR permissions for the actual implementation.

## Troubleshooting

- **Runner socket restriction error:** The first live run on `ubuntu-latest`
  failed in the action's `drop-sudo` setup while restricting
  `/run/dbus/system_bus_socket`, before Codex made an API request. This workflow
  uses OpenAI's supported dedicated-user strategy to avoid that failing path,
  while retaining a read-only Codex sandbox.
- **Missing key:** Add or correct the `OPENAI_API_KEY` repository secret and rerun.
- **Authentication or model access error:** Check the key's project, permissions,
  and available model access. Replace a revoked key through GitHub secret settings.
- **Quota or rate-limit error:** Check API billing, project usage, and rate limits.
  Repeatedly rerunning without fixing the cause does not resolve the error.
- **No Run workflow button:** Verify the workflow is on the default branch and
  that your GitHub account has the required repository access.
- **Checkout or action installation fails:** Inspect the failed step. This is an
  infrastructure failure, not proof that application tests failed.

## References

- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)
- [Action inputs](https://github.com/openai/codex-action/blob/v1/action.yml)
- [OpenAI dedicated-user example](https://github.com/openai/codex-action/blob/v1/examples/unprivileged-user.yml)
- [Manually running a workflow](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow)
- [GITHUB_TOKEN authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [Workshop preparation task](https://workshops.de/classroom/9007582545/tasks/1583)
- [Workshop skill baseline](https://github.com/workshops-de/angular-workshop-agentic-ai-engineering/tree/solution--agentic-workflows-skills/.claude/skills)
