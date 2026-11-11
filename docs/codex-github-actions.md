# Codex GitHub Actions

This adapts the workshop task **Prepare GitHub Workflows** to Codex. It prepares
authentication and a manually triggered connectivity check. The issue analysis
exercise and automatic implementation of ready issues are also included. PR
review, merge, deployment, and automatic repair of failed CI remain separate work.

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
pinning can be agreed when building the production workflow. Every API-backed
workflow using this repository's `OPENAI_API_KEY` must explicitly select
`gpt-5.6-luna`, the only model authorized for this key. Do not use a default model
or fall back to a different model.

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

## Issue analysis (workshop task 1584)

`.github/workflows/issue-analysis.yml` analyzes open issues on `issues.opened`,
`issues.edited`, and `issue_comment.created`. It also accepts an issue number
through **Actions → Issue Analysis with Codex → Run workflow**. The event workflow
must be on the default branch before automatic issue events will start it.

Only actors with repository write, maintain, or admin access can trigger paid
analysis. Bot comments and pull requests are excluded. Comments from outside
contributors remain reviewable context when a maintainer requests analysis.
Runs for the same issue are serialized. Each run reads the current issue and up
to the latest 100 discussion comments; a truncated discussion is explicitly
classified as needing clarification.

The analysis job has read-only repository and issue access. It sends the issue
context and checked-out source to `gpt-5.6-luna`, using the same dedicated-user,
read-only sandbox as the setup check. Issue text is treated as untrusted data.
The prompt does not execute the five development phases or create a sixth skill.
Codex returns a schema-constrained JSON report with one of two labels.

A separate job with `issues: write` validates the output and checks that the
issue is still open and unchanged. It then creates or updates its own analysis
comment and applies `ready-for-implementation` or `needs-clarification`, removing
only the opposite workflow label. Other labels and human comments are preserved.
This job uses the automatically supplied `GITHUB_TOKEN`; `PAT_TOKEN` and
`ANTHROPIC_API_KEY` are not used. A ready result explicitly dispatches the
implementation workflow after publishing the analysis. Ordinary label events
made with `GITHUB_TOKEN` do not start another workflow, so this publisher also
has `actions: write` for that dispatch. A clarification result never starts
implementation. API errors fail the analysis without a model fallback.

## Automatic implementation of ready issues

`.github/workflows/issue-implementation.yml` runs entirely on GitHub-hosted Ubuntu
runners. Your computer and local Codex session can be closed after starting it.
Every paid Codex call explicitly uses `gpt-5.6-luna` with `OPENAI_API_KEY`.

### Start and monitor a run

1. Merge the workflow into the default branch. In **Settings → Actions → General
   → Workflow permissions**, enable **Allow GitHub Actions to create and approve
   pull requests** if it is not already enabled. The workflow creates PRs; it
   never approves or merges them. No additional secret or broader PAT is needed.
2. Plan a feature with `j-feature-delivery` in chat. To keep planning separate
   from execution, request a draft only: **Plan this feature and prepare its issue
   draft; do not create the issue or start implementation yet.** Creating an
   issue can now lead directly from a ready analysis to implementation.
3. After agreeing the plan, request issue creation and GitHub implementation.
   The existing analysis sets `ready-for-implementation` and explicitly queues
   implementation when the requirement is complete. Alternatively, a maintainer
   can apply that label to an existing, agreed issue. Public issue authors cannot
   start paid implementation merely by opening an issue or commenting.
4. Open **Actions → Issue Implementation with Codex**. Follow the **prepare**,
   **implement**, **verify**, and **publish** jobs. The implementation comment
   links the run and the resulting PR. Build and browser-test output appears in
   the verification job logs.
5. Review the PR. Its `Closes #N` link closes the issue only when the PR is merged
   into the default branch. No automatic merge, deployment, or premature issue
   closure is included.

Already labeled issues do not emit a new label event when this workflow is
installed. Start each existing issue once with **Run workflow**, select the
default branch, enter its number in `issue_number`, and leave `fingerprint`
empty. The same manual dispatch retries a failed or blocked attempt after its
cause has been resolved. This is event-driven automation, not a periodic scan.

### Delivery and trust boundaries

- Preparation verifies maintainer access, current issue state, readiness, and
  absence of `needs-clarification`. An analysis-bot dispatch requires a matching
  requirement fingerprint. Duplicate implementation PRs and existing
  `codex/issue-N` branches are skipped before another paid request.
- Codex reads the existing orchestration and phase skills and records Red,
  Green, Blue, and finalisation evidence. It stops for unresolved decisions,
  dependencies, missing acceptance criteria, or unsupported testing. There is
  no interactive interview on the runner and no additional skill.
- The dedicated `codex-ci` user uses a custom profile extending `:workspace`,
  with network enabled for local browser tests and existing external resources
  such as Google Fonts. This profile permits direct network access; it does not
  claim domain filtering. The API key is held by the action's proxy, and the
  generation job has only repository read permission. Codex is the last step.
- Codex returns structured UTF-8 file contents, not commands for the publisher.
  A fresh job validates the schema and paths, installs trusted base dependencies,
  reconstructs the files, runs development and production builds, and runs every
  application Playwright spec under `tests/`, excluding `tests/example.spec.ts`.
  New browser specs are included. No secrets or GitHub write token are given to
  this job. These checks do not replace human review of acceptance coverage.
- The publisher receives the exact verified result digest. It rechecks readiness,
  requirements, and base SHA, then creates a Git tree, commit, branch, and PR
  through GitHub APIs. It does not execute generated source. It never force-pushes
  an existing branch. Independent checks must succeed for an implementation PR.

Supported changes are text files under `src/`, `tests/`, `docs/`, and `public/`,
plus root `ARCHITECTURE.md`, `REFACTORING.md`, and `README.md`. Instruction files,
skills, workflows, dependency/configuration changes, binary assets, and symlinks
require a separate maintainer change. Handoffs are limited to 30 files and
100,000 UTF-8 bytes, including the report; larger requirements must be split.
The repository's historical Karma problem remains a blocker for requirements
that need unavailable unit-test infrastructure; it is not silently repaired.

A blocked or already-satisfied result creates an evidence comment and leaves the
issue open without a PR. Invalid output, failed checks, API errors, and stale
requirements/base revisions fail the run without publishing code. Inspect the
failed job, fix the cause, and manually dispatch again. An ambiguous publication
failure may leave `codex/issue-N` without a PR: inspect the branch and run first,
then create the missing PR manually or remove the verified unused branch before
retrying. The workflow will not overwrite it.

GitHub may require approval for other workflows triggered by a PR created using
`GITHUB_TOKEN`. The implementation's independent checks have already run before
PR creation; inspect and approve additional PR checks in GitHub when requested.
The existing issue-only `PAT_TOKEN` is deliberately not used for code publishing.

Local automation checks, with mocked GitHub APIs and no paid model calls:

```sh
node --test .github/scripts/issue-analysis.test.cjs .github/scripts/issue-implementation.test.cjs
```

### Reproduce the workshop check

1. After merge, create an issue titled **Feature: Edit User Profile**, using the
   story and acceptance criteria supplied in task 1584.
2. In **Actions**, open the automatically triggered **Issue Analysis with Codex**
   run. Both jobs must succeed.
3. Check the issue for a seven-section analysis comment and the corresponding
   label. BookMonkey currently has no profile editor, authentication, or profile
   persistence; the report should identify that gap rather than invent paths.
4. Add clarification or edit the issue. A new run should update the existing bot
   comment rather than add duplicate analysis comments. Bot comments must not
   trigger another paid analysis.

The workshop example is a workflow test, not an approved profile feature.
Local publisher checks run with
`node --test .github/scripts/issue-analysis.test.cjs`; they use mocked GitHub
responses and do not call the API or use a key.

## Existing five-skill workflow

Keep these five phases and their existing skills:

| Phase    | Existing skill              | Required evidence before continuing                                                                       |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Define   | `requirements-interviewer`  | Confirmed story, stable acceptance criteria, resolved product decisions                                   |
| Red      | `developer-red`             | Criterion-to-test mapping, observed behavioral failures or already satisfied cases, commands and blockers |
| Green    | `developer-green`           | Agreed behavior implemented or already satisfied, current focused and regression results                  |
| Refactor | `developer-blue`            | Verified Green baseline, scoped findings resolved or justified no-change result                           |
| Finalise | `requirements-finalisation` | Acceptance matrix, required checks, delivery conditions and authorized issue actions                      |

The five phase skills, their `j-feature-delivery` orchestrator, and the existing
`context-recovery` helper under `.agents/skills/` are tracked and available after
checkout in GitHub Actions. The implementation prompt reuses them; the setup
check does not execute them.

The workshop's linked `solution--agentic-workflows-skills` baseline instead
contains tracked skills under `.claude/skills/`; it does not prescribe a secret
containing skill texts. That Claude-specific baseline is not reset or copied over
this repository. This Codex adaptation shares the existing repository workflow
skills directly through version control.

The skills currently refer to `context-recovery` when context is missing. This is
an existing conditional helper, not a sixth workflow phase or a formal `required`
dependency. The implementation runner must either receive complete context or stop with a
specific blocker. The existing helper is included in the checkout. Finalisation
currently has no mandatory Blue handoff, so the orchestrator must explicitly
require a Blue result (including a justified no-change result) for this five-phase
sequence.

The implementation handoff carries the issue identity, source revision, requirement
fingerprint, unchanged acceptance IDs, phase evidence, and changed files. A ready
label applied by a maintainer or the authorized analysis workflow approves this
bounded implementation and PR creation. It does not authorize merge or deployment.
An already-satisfied result records evidence without closing the issue.

## Pull request review (workshop task 1586)

`.github/workflows/pull-request-review.yml` adapts the workshop's Claude review
to the official OpenAI Codex Action. It uses the existing `OPENAI_API_KEY` and
explicitly selects `gpt-5.6-luna`, without a fallback. No new secret or skill is
required. The five existing phase skills remain unchanged.

- Opening, pushing commits to, or reopening a local PR targeting the default
  branch starts a review when the event actor has write, maintain, or admin
  permission. Other actors are skipped before a paid API call.
- The existing implementation publisher dispatches review explicitly after
  creating its verified PR. GitHub token event suppression makes an ordinary
  PR event insufficient for this handoff. Only that publisher receives the
  additional `actions: write` permission. The bot dispatch is restricted to its
  own local PR and the supplied head revision.
- A maintainer may select **Actions → Pull Request Review with Codex → Run
  workflow**, select the default branch, and enter `pull_number` to review an
  existing PR or a fork. Leave `head_sha` empty for a manual maintainer run.
- Codex examines code quality, correctness, performance, security, and test
  coverage using the diff, trusted base source, and locally linked issue bodies
  (`Closes #N`, `Fixes #N`, or `Resolves #N`). It returns constructive German
  Markdown with concrete findings and review limitations.
- A separate publisher updates one bot comment with the reviewed head/base
  revisions and workflow evidence. Human comments are preserved. No formal
  approval, merge, issue closure, or source change is performed.

### Trust boundary and limits

The workflow intentionally uses `pull_request_target` with **only the base SHA
checked out**, rather than executing the workshop's PR checkout under a key.
PR descriptions, diffs, and issue bodies are untrusted data. Changed prompts,
helpers, and agent instructions are reviewed as changes; they are never loaded
from the head for execution. The workflow does not install PR dependencies or
run PR builds, tests, scripts, or feature-delivery skills. Codex receives a
read-only sandbox, a dedicated unprivileged user, and no GitHub write token.
The publisher runs on a fresh runner with no OpenAI key.

Reviews support at most 100 changed files, five locally linked issues, 200 KB
of context, and 40 KB of structured output. Oversized or unavailable diffs
fail explicitly rather than producing a silently partial review. Binary changes,
missing head-only context, issue comments, external issue links, and runtime
behavior may remain unreviewed and must be identified in the report. Static
review cannot establish passing tests or overall correctness.

The trusted checkout must match the current PR base. Head/base revisions, PR
title/body, diff, and linked issue bodies form the review fingerprint. Changes
during collection or before publishing reject the result; retry against the
current base. An existing bot review of the same fingerprint suppresses another
paid call. Re-runs update the comment when there is a new reviewable revision.
GitHub does not offer an atomic comment-and-head comparison: a commit immediately
after the final check can still supersede the posted review. The displayed SHAs
identify its scope, and the next commit event schedules a new review.

### Verify after merging this workflow

1. Open a small disposable branch from the updated `main` and make a reviewable
   Angular change. To reproduce the workshop exercise, add an isolated TypeScript
   fixture containing a clear missing null check, unhandled request error, and
   missing tests; do not import it into the application or merge it into `main`.
2. Open a PR targeting `main` using a maintainer account. In Actions, inspect
   **Pull Request Review with Codex**. Confirm the context step accepts it, Codex
   uses `gpt-5.6-luna`, and the separate publisher succeeds.
3. Inspect the PR comment: five review areas, actionable findings, limitations,
   exact head/base revisions, and a working workflow link. Findings remain
   probabilistic and need human judgment; no finding is not a correctness proof.
4. Push a second commit that fixes one issue. Confirm another run updates the
   existing bot comment to the new head rather than adding a duplicate. Rerunning
   that same revision should skip the paid review.
5. Close the disposable PR without merging. For the full issue workflow, use a
   separately approved implementation issue and confirm its publisher queues
   review with the created PR number and expected head SHA.

Local checks use `node --test .github/scripts/*.test.cjs`. These tests exercise
authorization, fork/bot boundaries, bounded context, stale results, comment
preservation, and the implementation handoff with mocked GitHub responses. They
do not call OpenAI or prove the workflow works on GitHub. A real run is still
required after the workflow is available on the default branch.

## Troubleshooting

The [fixed-model connectivity check](https://github.com/jrubner/ki-software-engineer/actions/runs/42995490576)
succeeded on 2026-11-11 with `gpt-5.6-luna`, including the separate report job.
The failures below are historical evidence from earlier key/model configuration.

The [dedicated-user live check](https://github.com/jrubner/ki-software-engineer/actions/runs/42992303383)
passed runner preparation and started Codex, but the API returned
`Quota exceeded. Check your plan and billing details.` No model response or setup
report was produced. Before retrying, open the API platform's billing settings
for the organization and project associated with `OPENAI_API_KEY`. Check available
credits and applicable usage or spend limits, resolve the reported restriction,
then rerun the workflow with the dedicated-user fix selected. API quota errors
require a billing or limit change rather than repeated retries.

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
- [Workflow event and token behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Codex permission profiles](https://learn.chatgpt.com/docs/permissions)
- [Workshop preparation task](https://workshops.de/classroom/9007582545/tasks/1583)
- [Workshop issue analysis task](https://workshops.de/classroom/9007582545/tasks/1584)
- [Workshop pull request review task](https://workshops.de/classroom/9007582545/tasks/1586)
- [Workshop skill baseline](https://github.com/workshops-de/angular-workshop-agentic-ai-engineering/tree/solution--agentic-workflows-skills/.claude/skills)
