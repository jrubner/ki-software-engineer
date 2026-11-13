# Project instructions

## Context and scope

- Read `ARCHITECTURE.md` before architectural changes. Verify relevant claims against current source; dated checks are historical evidence, not current test results.
- Inspect Git status and the affected diff before editing. Preserve existing work and avoid unrelated formatting, dependency changes, and refactors.
- Communicate with the user in German. Write new repository documentation, identifiers, comments, and UI text in English, following existing conventions.
- Follow the more specific instructions under `src/` and the book feature without duplicating their rules here.
- Track the five phase skills, the `j-feature-delivery` orchestration skill, and
  their existing `context-recovery` helper under `.agents/skills/`. Keep other
  personal skills, credentials, machine-specific
  paths, browser profiles, and MCP configuration out of the repository. Respect the
  user's current service/browser instructions.

## Task branches and pull requests

- Use `gpt-5.6-luna` explicitly for every API call authenticated with this repository's `OPENAI_API_KEY`. Do not rely on a default model or fall back to another model.

- Use a separate branch for each task. Before editing, create a descriptive task branch from `main`, or continue on the existing branch dedicated to that task. Do not implement tasks directly on `main`; preserve unrelated uncommitted work.
- Complete the requested changes and applicable verification, then ask the user whether the task should be merged into `main` through a GitHub pull request. Include a brief summary of the changes and actual verification results so the decision is reviewable.
- After the user agrees, commit the task changes, push the task branch, and create a pull request on GitHub targeting `main`. This approval authorizes those steps. Return the pull request link; merge it only when the user explicitly authorizes the merge.
- If the user declines or has not answered, keep the work on the task branch without committing, pushing, or creating a pull request unless those actions were separately requested.

## Explicitly invoked refactoring workflow

Reading this file does not start a refactoring review or authorize code changes. Run the following workflow only when the user explicitly requests a refactoring review, application of `REFACTORING.md`, or implementation of an agreed refactoring plan in chat.

1. Read `ARCHITECTURE.md`, applicable instructions, the current diff, and the affected code and tests.
2. Record concrete maintenance issues, source locations, impact, target patterns, scope, and verification in `REFACTORING.md`. Distinguish confirmed code facts from untested risks and intentional tradeoffs.
3. Apply only the requested or agreed changes. Keep externally visible behavior unless a behavior change was explicitly authorized. Do not introduce abstractions merely to satisfy an example in the workshop.
4. Review the resulting diff, run appropriate checks, update finding statuses and `ARCHITECTURE.md`, and report actual results and limitations.

## Verification

- Reuse an existing suitable development server. Check service state before starting or stopping anything; never stop an unrelated service.
- Development build: `node node_modules/@angular/cli/bin/ng.js build --configuration development`.
- Production build: `npm.cmd run build` on Windows. The existing Google Fonts integration requires network access; distinguish network failures from code failures.
- Application regression suite: `npm run test:e2e` (`npm.cmd run test:e2e` on Windows). This discovers all application specs under `tests/`, excludes the external website example, and runs Chromium with one worker. Follow `tests/AGENTS.md` when adding or changing acceptance tests.
- The Playwright website samples do not verify BookMonkey. The historical Karma failure is documented in `ARCHITECTURE.md`; do not repair that infrastructure without an explicit task.
- Inspect the final diff and run `git diff --check`. Do not claim successful tests when execution was blocked. Update architectural facts alongside code changes and preserve dated historical evidence.
- Do not create screenshots unless requested or needed by an explicitly agreed workflow. Commit and push only when requested.
