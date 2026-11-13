---
name: developer-red
description: Turn an agreed user story and Given/When/Then acceptance criteria into unit and UI tests for the TDD Red phase, and verify that missing behavior causes the expected failures. Use before implementation; do not implement features or refactor production code.
---

# Developer Red

Create meaningful failing tests from an agreed requirement. Finish with an evidence-based handoff for the Green phase, without implementing the feature.

## Establish the test contract

- Use the confirmed user story, scope, and acceptance criteria from the conversation or a verified issue. If the active requirement is missing, use [context-recovery](../context-recovery/SKILL.md). If material behavior is still undecided, return to [requirements-interviewer](../requirements-interviewer/SKILL.md) rather than inventing acceptance criteria.
- Read applicable repository instructions, Git status, the affected diff, and relevant source and tests. Preserve existing work and follow the current branch instructions. Do not reset changes to manufacture a Red state.
- Inspect the installed test tools and configuration before selecting commands. Reuse existing conventions and helpers. A package script or historical test report does not prove the runner currently works.
- Map every agreed Given/When/Then scenario to an identifiable test case. Reuse an existing case if it already verifies the exact scenario; identify gaps instead of creating duplicate coverage. Record the mapping in the handoff or clear test names, without creating a separate tracking document unless requested.

## Write behavior-focused tests

Use the appropriate level for each scenario. Add focused unit tests for logic and service contracts and UI tests for observable interactions and integration behavior when the requirement calls for them. Do not duplicate every criterion at both levels merely to populate both suites.

- Translate **Given** into deterministic setup, **When** into the action or event, and **Then** into assertions on the agreed observable result. Keep scenarios independently runnable and give them descriptive names.
- Assert the desired behavior, not the current implementation. Prefer public contracts and accessible UI locators over private members, incidental DOM structure, or arbitrary timing delays.
- Keep fixtures and mocks minimal. Mock external dependencies at their boundaries; do not mock the behavior under test or replace production responses with the desired result.
- Cover the success, boundary, and error scenarios actually agreed. Do not add requirements through tests.
- Do not use unconditional failures, deliberately malformed code, empty test bodies, skipped tests, or expected-failure annotations to simulate Red. Tests must be capable of passing once the requirement is implemented.
- Modify test files and necessary test-only fixtures or helpers. Do not change production code, weaken existing assertions, or introduce production stubs just to make the suite compile. If a required public contract does not exist, identify that specific gap; an import or type failure is not evidence of an observed behavioral failure.

## Verify the Red phase

Run the focused tests using the repository's supported commands. Check service state and workspace ownership before starting any required server, following the repository's service-control instructions. Reuse a suitable running server and isolate test data from personal browser state.

For each new or affected case, determine why it passed or failed:

- **Expected Red:** The test reaches the relevant behavior and fails because an agreed capability is missing or incorrect. A UI locator timeout can qualify when the application is ready and the missing control itself is the requirement.
- **Already satisfied:** The test passes because the behavior already exists. Report this honestly and keep useful coverage; do not break production code or change the requirement to force a failure.
- **Blocked or invalid:** Missing dependencies, compilation errors, unavailable services, authentication problems, broken fixtures, and unrelated regressions do not establish behavioral Red. Correct defects in the new tests within scope. Report infrastructure limitations separately and do not install dependencies or repair unrelated test infrastructure without authorization.

Run relevant existing tests when needed to distinguish new failures from regressions or baseline problems. Inspect the final diff and run `git diff --check`. Do not repeatedly run an unchanged blocked suite or claim a Red result for tests that never executed.

### Repository test setup

Check current files before relying on these pointers:

- Application UI tests live in `tests/` and use Playwright. `tests-examples/` contains website samples and does not verify BookMonkey. Follow the current Playwright configuration and applicable repository verification instructions.
- Angular unit tests are colocated under `src/` and run with `npm test -- --watch=false` through Angular 21's Vitest builder and WebdriverIO headless Chrome. Use async Angular stabilization and Vitest timers instead of Zone.js `fakeAsync`. Confirm the current setup; report unavailable Chrome/driver or infrastructure failures separately from behavioral Red and do not silently change dependencies.

## Hand off to Green

Return a concise report in the conversation's language:

- The agreed requirement or verified issue reference and the changed test files.
- The mapping from acceptance scenarios to tests, including any missing coverage.
- Exact commands run, actual results, and the assertion or observable behavior behind each expected failure.
- Cases already satisfied and any blocked tests or infrastructure limitations.
- The smallest implementation outcome needed next, without writing that implementation.

Stop this phase after the Red handoff. When called from an explicitly authorized overall workflow, return control to that workflow so it can continue within its existing authorization. Invoking Red alone does not authorize the Green phase, issue writes, commits, pushes, or pull requests.
