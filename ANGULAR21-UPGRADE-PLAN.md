# Angular 21 upgrade and modernization plan

Status: local implementation and automated verification complete on
`feat/angular21-signal-forms`; manual browser acceptance pending. Commit, push and
PR creation authorized on 2026-11-13; merge requires separate authorization.
Prepared: 2026-11-13. Source baseline: merged `main` at `b416a65`.

## Implementation evidence (2026-11-13)

- Branch baseline: `b416a65`, matching the existing `origin/main`; local `main`
  was two commits behind. The original untracked plan was preserved. Verification
  completed before the user separately authorized commit, push and PR creation.
- Environment: Node 24.22.1, npm 11.21.1, TypeScript 5.9.2, RxJS 7.8.0.
- Baseline: 78 Karma/Jasmine tests passed in headless Chrome 157; development
  and production builds passed. The first sandboxed attempts could not launch
  Chrome or resolve Google Fonts; authorized execution outside the sandbox passed.
  The existing game stylesheet warning remains 7.78 kB / 4 kB (8 kB error budget).
- Official framework/CLI update: `ng update @angular/cli@21 @angular/core@21
--allow-dirty`. The flag preserves this uncommitted plan without creating a
  checkpoint commit. No peer-conflict bypass flags were used.
- CLI migrations (default Karma config, bundler module resolution, ES2022 lib)
  and core migrations (server bootstrap context, ApplicationConfig import,
  bootstrap options, block control flow, lastSuccessfulNavigation) completed
  without source changes. The application already uses the application builder,
  and has no getCurrentNavigation calls; both optional migrations are no-ops by
  source inspection.
- Selected framework 21.2.26; CLI/build/SSR 21.2.30; Material/CDK 21.2.14.
- All existing companion libraries are retained. NgRx Signals/toolkit need their
  Angular-21 releases; the toolkit's @ngrx/store peer is optional. TanStack Query
  declares Angular >=16; platform-server and animations track core, SSR tracks CLI.
- Live CI inspection is currently unavailable through `gh` (CLI not installed).
  The previously recorded invalidated OpenAI secret remains historical evidence,
  not a newly verified failure. No paid API requests were made.
- Official Material update: `ng update @angular/material@21 --allow-dirty`;
  Material/CDK migrations completed without source changes. The migration gate
  passed all 78 original tests and both builds before form changes started.
- Final companion versions: NgRx Signals 21.1.1, ngrx-toolkit 21.0.1, TanStack
  Query 5.107.1. Existing unused libraries, SSR and animations remain installed
  intentionally; no new SSR or caching architecture was introduced.
- Final test stack: Vitest and browser-webdriverio 4.1.12, WebdriverIO 10.2.0,
  jsdom 27.4.0. Node engines are `^22.23.4 || ^24.22.1` to satisfy both Angular
  and WebdriverIO. Playwright was compatibly patched to 1.65.0 but not executed.
- `npm ci` passed in an ignored, separate source copy, followed serially by
  `npm test -- --watch=false` (103 tests, 11 files), the development build and
  `npm run build`. The same 103 unit tests also passed in the working tree.
  A newly running, unrelated development server locked native modules during
  an initial working-tree clean install; it was left running. `npm install`
  restored that installation; the isolated clean install avoids its file locks.
- `node --test .github/scripts/*.test.cjs`: 61 passed. Scoped Prettier checks,
  both updated phase-skill validators and `git diff --check` passed.
- Production initial bundle: 369.41 kB; lazy game chunk: 49.91 kB. The existing
  7.78 kB game CSS warning remains below the unchanged 8 kB error budget.
- No legacy application form bindings, Zone.js dependency/polyfills, Jasmine
  calls or zone-based async tests remain. Production JavaScript contains no
  `ZoneAwarePromise` or `__zone_symbol__` runtime markers. No actual legacy
  Angular animation bindings were found; `provideAnimations()` and its library
  remain intentionally for compatibility, alongside existing native animations.
- Representative HTTP, native events, media/storage callbacks, timers and
  animation completion tests render through normal Angular stabilization.
  Search tests retain the 299/300 ms boundary and cancellation assertions;
  form tests retain validation, payloads, double-submit guards and error retries.
- The official Jasmine-to-Vitest schematic was reviewed; accidental edits to
  Playwright specs were restored. Partial fake timers leave Angular scheduling
  active. `restoreMocks` isolates spies, and failure screenshots are disabled.
  Three automatically generated screenshots from an initial failing test run
  were removed; no interactive browser or Playwright run was performed.
- Final dependency audit: 19 moderate findings remain in the Angular CLI
  glob/minimatch tree. No high or critical findings remain. The suggested
  Angular CLI 22 upgrade is outside the explicitly selected Angular 21 scope.

## Outcome and scope

Upgrade the complete application to Angular 21, execute the official migrations
against this repository, adopt Signal Forms for application forms, remove the
Zone.js runtime and test dependency, and modernize the unit-test workflow.
Preserve all existing book, reading-list, theme, shell, and game behavior.

Target the latest compatible **21.x** release available when implementation starts;
do not accidentally install Angular 22 through an unqualified `latest` tag.
Record exact resolved versions in `package-lock.json` and the delivery evidence.

Zoneless is the default in Angular 21. Signal Forms are experimental in Angular
21; their adoption is explicitly requested here. Use the API shipped with the
selected 21.x version, including its matching field-binding directive, rather
than copying examples for another major version. See the official
[Angular 21 announcement](https://blog.angular.dev/announcing-angular-v21-57946c34f14b)
and [versioned Signal Forms tutorial](https://v21.angular.dev/tutorials/signal-forms).

Modernization includes every application area, but does not mean replacing every
Observable, timer, or browser API. Keep RxJS where it provides HTTP cancellation
and stream composition; use signals for template state and computed derivations.
Keep native Web Animations for the game. Do not add SSR, new business features,
Angular Aria, or experimental resource APIs solely because they exist.

## Pre-upgrade repository inventory

| Area               | Current state                                                                                                 | Work required                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Framework          | Core 20.2.1; CLI/build 20.2.0; Material/CDK 20.2.x                                                            | Official framework/CLI and Material migrations to 21.x                          |
| Toolchain          | TypeScript 5.9.2, RxJS 7.8.0; CI uses Node 22                                                                 | Verify installed and CI versions against the selected Angular release           |
| Bootstrap          | `app.config.ts` explicitly provides zone-based change detection                                               | Remove that provider; use the Angular 21 zoneless default                       |
| Polyfills          | Build loads `zone.js`; Karma additionally loads `zone.js/testing`                                             | Remove both runtime and test dependencies after their respective gates pass     |
| Creation/editing   | Typed Reactive Forms in `book-create.component.*` and `book-edit.component.*`                                 | Signal models, schema validation, field bindings, submission and server errors  |
| Search             | `FormsModule`, `ngModel`, signal search state, 300 ms timer                                                   | Signal-based field binding while preserving search and pagination timing        |
| Other UI           | Standalone, OnPush, built-in control flow and many signals already used                                       | Audit gaps rather than repeating completed migrations                           |
| External callbacks | Header uses `NgZone.runOutsideAngular`; theme uses browser listeners; game uses timers and animation promises | Check scheduling, signal updates and cleanup without Zone.js                    |
| Reading list       | Signal store, localStorage, CDK drag/drop, cancellable metadata refresh                                       | Verify zoneless rendering and preserve ordering, membership and storage version |
| Tests              | Karma/Jasmine; list tests use `fakeAsync`/`tick`; some tests measure actual CSS                               | Migrate to Angular-supported Vitest and preserve browser-dependent coverage     |
| Automation         | Validation, issue implementation and auto-fix workflows contain Karma-specific commands                       | Update all test entry points together with the runner                           |

The previous delivery reported 78 successful Angular unit tests and both builds.
The fresh baseline above independently reproduced these results. PR #22 was merged using a
bypass; its pipeline must not be treated as a successful upgrade baseline.

## Execution order and checklist

### 0. Establish a reproducible baseline — main thread

- [x] Read current `AGENTS.md`, source instructions, `ARCHITECTURE.md`, and this plan again.
- [x] Start an implementation branch from the then-current `main`; preserve unrelated changes.
- [x] Record Git SHA, `node --version`, `npm.cmd --version`, local `ng version`, and dependency tree.
- [x] Select exact Angular 21 framework, CLI/build, Material/CDK, Node, and test-runner versions.
- [x] Check every Angular-dependent package's peer requirements, including NgRx Signals, ngrx-toolkit, TanStack Angular Query, animations, SSR and platform-server.
- [x] Upgrade used dependencies to compatible versions. For confirmed unused packages, record an explicit keep/update/remove decision; do not hide incompatibilities with `--force` or `--legacy-peer-deps`.
- [x] Re-run the current unit suite and both builds before changing framework versions. Record existing failures separately.
- [x] Check browser-test fixtures against the pagination contract, including `X-Total-Count`, before interpreting navigation failures as upgrade regressions.
- [x] Record existing game stylesheet budget warning and Google Fonts network requirement; do not relax budgets to mask new failures.
- [ ] Inspect the actual CI status and expired `OPENAI_API_KEY` review failure. Keep that external configuration problem separate from application correctness.

Angular 21.0's documented baseline supports Node `^20.19.0`, `^22.12.0`, or
`^24.0.0`, TypeScript `>=5.9.0 <6.0.0`, and RxJS `^6.5.3` or `^7.4.0`.
Recheck the exact chosen 21.x row before installing. See
[Angular compatibility](https://v21.angular.dev/reference/versions).

### 1. Execute official Angular 21 migrations — main thread, exclusive writes

- [x] Preserve the uncommitted plan using `--allow-dirty`; do not create an unauthorized checkpoint commit.
- [x] Review the official 20 → 21 update guide and installed migration collections.
- [x] Execute the framework and CLI update against this project, not a newly generated replacement application.
- [x] Execute Material's update and inspect the resulting CDK, theme, tooltip and drag/drop changes.
- [x] Record every migration run, its output, changed files, skipped items and manual follow-up.
- [x] Review optional migrations exposed by the selected 21.x CLI; run applicable ones explicitly and record no-op decisions for existing modern code.
- [x] Inspect `package.json`, lockfile, bootstrap, compiler options and builders. Run a clean install, regression unit tests and both builds.

Planned commands, run sequentially from the repository root:

```powershell
node node_modules/@angular/cli/bin/ng.js update @angular/cli@21 @angular/core@21
node node_modules/@angular/cli/bin/ng.js update @angular/material@21
```

Let the updater select its required temporary CLI when necessary. Do not merely
edit version strings. If a migration needs replaying, use its actual installed
name and recorded from/to versions with `ng update --migrate-only`; do not invent
schematic names or blindly rerun all transformations. See
[official ng update](https://angular.dev/cli/update).

**Gate:** compatible Angular 21 dependencies installed, migrations reviewed,
application builds, and failures classified before parallel feature edits begin.

### 2. Define shared contracts — main thread

- [x] Inspect the selected `@angular/forms/signals` API and agree model types, field binding, validation and submit conventions before delegation.
- [x] Define nullable number/date handling, trimmed required strings, field errors, touched/dirty state, and async request locking.
- [x] Keep form models distinct from transport payloads where textarea lines or optional values require mapping.
- [x] Define zoneless-compatible async test conventions and runner ownership.
- [x] Assign exclusive files and verification responsibilities to agents using the table below.

### 3. Migrate forms and application state — delegated slices

- [x] **Create form:** replace `FormGroup`/`FormControl` and `formControlName` with a typed signal model, Signal Forms schema and field bindings.
- [x] Preserve nonblank ISBN/title/author, positive integer pages, free-text price, optional metadata, multiline co-authors, omitted empty publication date and `userId: 1`.
- [x] Preserve GET-before-POST: only 404 permits creation, duplicate ISBN is a field error, other lookup errors prevent POST, and a submit produces at most one POST.
- [x] **Edit form:** load/reset the model on ISBN changes; preserve route cancellation, saved values, immutable identity, validation, one PUT, retry and cancel behavior.
- [x] For both forms, maintain visible errors, focus/labels, disabled fields and actions during requests, and entered values after failure. Test server errors and re-submission after correcting a field.
- [x] **List search:** replace template-driven binding with Signal Forms using a signal search model.
- [x] Preserve 300 ms debounce, immediate clear, page reset, applied search on paging/retry, stale-request cancellation, totals and correction to the last valid page.
- [x] Replace remaining derived mutable UI state with `computed` where appropriate; retain useful RxJS request composition and `AsyncPipe`.
- [x] Confirm no remaining application `ngModel`, `FormGroup`, `FormControl`, `ReactiveFormsModule` or `FormsModule` usage except documented compatibility cases.

**Gate:** real input/blur/submit interactions produce the same API payloads,
validation and navigation results under Signal Forms. No duplicated requests.

### 4. Complete zoneless operation — main thread plus delegated audit

- [x] Remove `provideZoneChangeDetection` from bootstrap. Angular 21 is zoneless by default; use `provideZonelessChangeDetection()` explicitly only where a test or integration needs to override a zone-based setup.
- [x] Remove build `zone.js` polyfills; remove test polyfills when the test migration is ready; finally uninstall `zone.js`.
- [x] Audit all UI updates from HTTP subscriptions, timeouts, media/storage listeners, native events and animation completion callbacks. Use signals or targeted Angular notification APIs where required.
- [x] Review `AutoHideHeaderDirective`: retain passive listeners, thresholds, focus behavior and cleanup; remove unnecessary NgZone plumbing only after equivalent behavior is demonstrated.
- [x] Verify theme startup before bootstrap, Light/Dark toggle, system fallback, storage errors and cross-tab synchronization.
- [x] Verify CDK whole-card dragging, empty-column placeholder behavior, ordering, persistence, membership toggling and removal during metadata refresh.
- [x] Audit game speed/reduced-motion paths and test spin locks, credits, bonus timers, autospin cleanup, native fullscreen events and animation completion without zone scheduling. Complete visual game acceptance manually below.
- [x] Review legacy `provideAnimations()` and `@angular/animations` usage. Migrate actual legacy Angular animation bindings to current native/CSS APIs if present; preserve Material behavior and existing Web Animations.
- [x] Verify normal rendering without forced `detectChanges()` loops that could hide missed zoneless notifications.

See [Angular's zoneless guide](https://angular.dev/guide/zoneless). Removing
Zone.js does not require deleting every `NgZone` use or every Observable.

### 5. Adopt the Angular 21 test workflow — main thread owns infrastructure

- [x] Migrate the existing application-builder project to Angular's Vitest unit-test builder using options supported by the selected 21.x release.
- [x] Choose a compatible Vitest/DOM environment and migrate Jasmine spies, matchers and imports. Use the official `refactor-jasmine-vitest` schematic where available; review every generated TODO.
- [x] Replace zone-based `fakeAsync`/`tick` with async stabilization and appropriate Vitest timer controls. Verify exactly the 299 ms/300 ms search boundary, not just eventual completion.
- [x] Preserve HTTP and router harness coverage, request cancellation tests, forms, storage recovery and late metadata responses.
- [x] Keep CSS/layout-dependent tests in a real headless browser environment or preserve their equivalent browser coverage; jsdom alone cannot verify computed layout and CDK pointer dragging.
- [x] Use actual scheduling/`whenStable()` assertions for representative zoneless callbacks instead of manually forcing rendering in every test.
- [x] Remove obsolete Karma/Jasmine packages and configuration only after migrated coverage passes.
- [x] Update `tsconfig.spec.json`, npm scripts, all three CI workflows, automation helper assumptions, prompts and README commands atomically. Remove runner-specific `--browsers=ChromeHeadless` where incompatible.
- [x] Keep automation guard tests and application browser tests as separate verification layers.

Vitest support and migration tooling have different maturity levels. Inspect
the selected version's schematic and builder before execution; the schematic
does not configure the entire runner automatically. See the
[official Vitest migration guide](https://angular.dev/guide/testing/migrating-to-vitest).

### 6. Integration, evidence and delivery — main thread

- [x] Integrate agent handoffs and review the complete diff against the baseline and acceptance criteria.
- [x] Run the final unit suite, development build and production build serially with all agents paused.
- [x] Run automation guard tests and verify updated CI commands actually work from a clean install.
- [x] Perform no interactive browser or Playwright execution; disable automatic failure screenshots, remove initial runner-generated images and prepare the manual checklist below.
- [ ] User browser acceptance: direct/reload routes, form validation and retry, pagination/search, reading-list drag/drop and toggle, theme/header, and game/bonus/fullscreen flows.
- [x] Scan for legacy form bindings, Zone.js imports/providers, unsupported Angular APIs, migration TODOs and stale runner commands.
- [x] Confirm production bundles no longer contain the Zone.js runtime and no feature relies on it at test time.
- [x] Run scoped formatting and `git diff --check`; inspect dependency/lockfile changes and bundle/style budgets.
- [x] Update `ARCHITECTURE.md`, README, relevant source instructions and automation prompts to describe the implemented Angular 21 conventions. Preserve dated historical evidence.
- [x] Record exact versions, migration commands, test results, retained tradeoffs, experimental API exposure and remaining external/manual checks.
- [x] Obtain separate authorization for commit, push and PR creation for this upgrade (2026-11-13). Merge remains unauthorized.

## Main-thread supervision and subagents

Keep planning, dependency updates, global migrations, shared contracts,
integration, verification and publication supervision in the main thread as far
as possible. Delegate bounded implementation work to subagents explicitly using
**`model: "gpt-6-luna"`**. Do not silently substitute a different model.
No agents need to be started merely to write this plan.

| Owner               | Exclusive files / responsibility                                                                                                 | Dependencies                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Main thread         | Manifest/lockfile, Angular/TypeScript configuration, bootstrap, test infrastructure, CI, shared contracts, docs and final checks | Owns phases 0–2; coordinates every integration gate               |
| Luna A              | `book-create.component.*` and its tests                                                                                          | Angular 21 installed; Signal Forms contract agreed                |
| Luna B              | `book-edit.component.*` and its tests                                                                                            | Same contract as A; no independent shared abstraction             |
| Luna C, first wave  | `book-list.component.*` and its tests                                                                                            | Angular 21 and test conventions agreed                            |
| Luna C, second wave | Scoped header/theme/reading-list/game zoneless audit and assigned fixes/tests                                                    | First wave handed off; main thread explicitly assigns exact files |

Run at most three subagents alongside the coordinator. Once the forms/list
handoffs are complete, reuse available Luna agents for scoped regression fixes.
Do not let one agent modify another's slice or global configuration implicitly.

- [x] Give each agent complete criteria, exact file ownership, interfaces, installed API version and verification limits.
- [x] Use Red → Green → Blue for each behavioral slice; a missing symbol/compiler error is not behavioral Red evidence.
- [x] Keep phases sequential within a slice. Pause other writers before central test/build evidence runs.
- [x] Require handoffs listing files, fulfilled criteria, actual checks, unresolved questions, integration needs and confirmation that writing has stopped.
- [x] Route shared-file requests through the main thread. No independent branch switches, resets, broad formatting, dependency installs, commits or publishing.
- [x] Main thread monitors progress, resolves conflicts and owns final acceptance. Parallel agent completion alone does not prove integrated correctness.

## Completion criteria

- [x] All framework and companion dependencies resolve compatibly on Angular 21; official migration output is reviewed and recorded.
- [x] All application forms use Signal Forms, with representative zoneless rendering verified automatically; visual browser acceptance remains separate.
- [x] Unit tests run through the agreed Angular 21 Vitest workflow without losing existing behavioral or browser-dependent coverage.
- [x] CI, automation and documentation use the same verified commands and conventions.
- [x] All executed checks pass; manual, external and blocked checks are clearly identified.
- [x] Publication occurs only within the authorization given for the actual upgrade.

## Manual browser acceptance (pending, user-owned)

Use the existing development server, preferably at a 1920 × 1080 viewport;
also check a narrow viewport. These checks were deliberately not executed by
the agent and do not block the completed local automated upgrade.

- [ ] Open and reload list, detail, create, edit, reading-list and game routes;
      check navigation, focus, header scrolling and narrow-screen overflow.
- [ ] Create/edit books with blank and whitespace-only required values, invalid
      page counts, optional metadata and multiline co-authors. Check visible errors,
      request locking, duplicate ISBN correction, failed requests and successful retry.
- [ ] Search, clear immediately and change pages; confirm totals, last-page
      correction, loading/error states and retry retain the applied query.
- [ ] Toggle reading-list membership, reorder whole cards, move the last card
      from a column and verify empty-column placeholders and reload persistence.
- [ ] Toggle Light/Dark, check system fallback and a second tab's theme changes.
- [ ] Exercise game speeds, reduced motion, spin locks/credits, autospin stop,
      bonus selection/retrigger, fullscreen entry/exit and navigation during motion.
