---
name: developer-green
description: Implement minimal production code to satisfy the failing tests from developer-red and verify the feature and regression tests. Use for the TDD Green phase after an agreed requirement and Red handoff; do not weaken tests or start a separate refactoring phase.
---

# Developer Green

Complete the Red-Green loop by implementing the agreed behavior behind existing failing tests. Creating or editing this skill does not start that implementation workflow.

## Establish the implementation contract

- Read the Red handoff, agreed user story, acceptance criteria, affected tests, and relevant production code. If the requirement is missing, use [context-recovery](../context-recovery/SKILL.md). If material behavior remains undecided, return to [requirements-interviewer](../requirements-interviewer/SKILL.md) rather than inventing it.
- Inspect repository instructions, Git status, and the affected diff. Preserve existing work and follow the user's current branch instructions. Do not reset code to reproduce a historical Red result.
- Parse each failing test's setup, action, assertions, fixtures, and mocks to identify its expected observable behavior and public contract. Relate these expectations to the agreed acceptance criteria; test scaffolding is implementation evidence, not permission to expand the requirement.
- Inspect current test configuration and supported commands, then run the focused tests to establish the present baseline. Distinguish missing behavior from broken fixtures, compilation errors, unavailable services, and unrelated regressions. Report already passing tests honestly; do not break them to manufacture Red.

## Implement the smallest complete behavior

Change production code only where needed to satisfy the agreed contract. Follow existing architecture and conventions, and implement behavior for the supported inputs rather than hardcoding fixture values, detecting test execution, or returning canned results.

- Work in small increments and rerun the affected tests after meaningful changes. Read actual failures before choosing the next change.
- Preserve existing behavior outside the agreed scope. Do not add speculative capabilities, dependencies, unrelated cleanup, or a separate refactoring phase merely to make the implementation more elaborate.
- Keep test files, assertions, fixtures, and runner configuration unchanged unless there is concrete evidence of a test defect. A failing assertion by itself is not such evidence.
- A test correction is justified when its setup is broken, its assertion contradicts the agreed behavior, or it relies on an invalid assumption. Explain the defect and the authoritative requirement, make the smallest correction, preserve meaningful coverage, and rerun the corrected test. Correct a flawed expectation to match the requirement, never to match an implementation shortcut.
- Do not skip tests, remove assertions, mark expected failures, loosen checks, or replace production behavior with mocks to obtain a green report. If code and tests imply conflicting product decisions, clarify the specific conflict before changing the contract; continue independent work where possible.

## Verify Green

Follow the repository's service-control and verification instructions. Check workspace ownership and service state before starting or stopping anything; reuse a suitable development server.

1. Run all tests associated with the Red handoff and agreed acceptance criteria. Confirm that their previously missing behavior now passes.
2. Run the relevant existing regression suites and required builds or static checks. Do not limit verification to one newly passing assertion, and do not substitute external-site samples for application tests.
3. Inspect the final production and test diffs, check for accidental scope changes, and run `git diff --check`. Update architecture documentation when the implementation changes architectural facts.
4. Report infrastructure failures, unrelated baseline failures, and unexecuted checks separately. Do not claim all tests pass unless every test in the stated verification scope actually passed. Do not repeatedly rerun an unchanged blocked suite or repair unrelated infrastructure without authorization.

### Repository test setup

Verify current files before relying on these pointers:

- Application tests live in `tests/` and use Playwright; `tests-examples/` contains unrelated website samples. Reuse the current runner, helpers, and applicable repository commands.
- `npm test` uses Angular/Karma, while `ARCHITECTURE.md` records a historical missing `karma-jasmine` dependency. A historical report does not establish today's result. If the required unit runner remains blocked, state the exact limitation; do not silently install packages or alter the runner to bypass it.

## Hand off the result

Return a concise report in the conversation's language:

- The implemented requirement and relevant production files.
- Which Red expectations now pass and any justified test corrections, including their reasons.
- Exact verification commands and actual results, distinguishing focused tests, regressions, builds, and blocked or unexecuted checks.
- Remaining limitations or the next scoped step, if any.

Stop when the agreed behavior and applicable checks are complete. Green does not automatically start refactoring, update issues, commit, push, or create a pull request; follow existing repository instructions and explicit user authorization for those actions.
