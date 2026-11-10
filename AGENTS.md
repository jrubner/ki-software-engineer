# Project instructions

## Context and scope

- Read `ARCHITECTURE.md` before architectural changes. Verify relevant claims against current source; dated checks are historical evidence, not current test results.
- Inspect Git status and the affected diff before editing. Preserve existing work and avoid unrelated formatting, dependency changes, and refactors.
- Communicate with the user in German. Write new repository documentation, identifiers, comments, and UI text in English, following existing conventions.
- Follow the more specific instructions under `src/` and the book feature without duplicating their rules here.
- Keep personal skills, credentials, machine-specific paths, browser profiles, and MCP configuration out of the repository. Respect the user's current service/browser instructions.

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
- Application regression suite: `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts tests/shell.spec.ts --project=chromium --workers=1 --reporter=line`.
- The Playwright website samples do not verify BookMonkey. The historical Karma failure is documented in `ARCHITECTURE.md`; do not repair that infrastructure without an explicit task.
- Inspect the final diff and run `git diff --check`. Do not claim successful tests when execution was blocked. Update architectural facts alongside code changes and preserve dated historical evidence.
- Do not create screenshots unless requested or needed by an explicitly agreed workflow. Commit and push only when requested.
