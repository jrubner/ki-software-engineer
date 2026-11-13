# Playwright application tests

These instructions apply to specs and supporting files under `tests/`.

- Keep application acceptance tests here, grouped by feature or route. Do not move them to a separate `e2e/` tree or add a Gherkin runner.
- Describe observable user behavior with `test.describe` and scenario names that make the precondition, action, and outcome clear. Use Given/When/Then comments when they clarify a longer scenario.
- Prefer `getByRole` with an accessible name and `getByLabel`. Use `data-testid` only when semantic locators cannot identify a stable target. Avoid selectors coupled to styling or Angular internals.
- Assert visible results, navigation, validation, and recovery using Playwright's retrying assertions. Do not treat an outgoing request alone as proof that the UI works. Do not add fixed sleeps or `waitForTimeout`.
- Mock application API calls before navigation. Use deterministic fixtures with distinct technical IDs and ISBNs, and preserve the pagination header contract. Check relevant request parameters and writes without reproducing production business logic in mocks.
- Cover the happy path and applicable loading, empty, validation, error, and retry states. Preserve direct navigation, reload, keyboard access, and mobile coverage where relevant. Do not invent authorization scenarios: this application has no authentication.
- Keep browser storage and mock state isolated per test. Share fixtures or Page Objects only for repeated setup or interactions; keep scenario-specific expectations visible in the spec.
- Use controllable responses for intermediate loading states. Release held responses in `finally` blocks so failed assertions do not leave requests pending.
- Keep pure calculation assertions in the unit suite. Avoid repeatedly playing full animated sequences when a shorter journey proves the same behavior. Outcome-only tests may accelerate native animations; tests asserting motion or intermediate states must retain real timing.
- Run `npm run test:e2e` for all application specs in Chromium with one worker. This uses the same discovery as CI and excludes `example.spec.ts`, which tests the external Playwright website. For a focused run use `node node_modules/@playwright/test/cli.js test tests/book-list.spec.ts --project=chromium --workers=1`.
- Follow the root service instructions before execution. Reuse a suitable existing development server. When none is running, Playwright's configured `webServer` starts and owns the test server. Do not restart unrelated services.
- Use `npm run test:e2e:headed` for a visible browser, or forward Playwright options with `npm run test:e2e -- --headed`. Install full Chromium for headed execution, not only its headless shell.
- Keep screenshots disabled unless explicitly requested. The HTML report is generated in ignored `playwright-report/`; traces are collected on the first retry. Report actual results and limitations, and never commit generated reports or browser artifacts.
