# BookMonkey Architecture

This summary describes the checked-out source and configuration reviewed on 2026-11-09, including local build checks and a limited browser smoke check. It describes observed implementation, not the team's intended architecture. Update it when routes, providers, dependencies, or feature boundaries change.

## Evidence and confidence

The review followed the bootstrap and provider configuration, routes, component imports and call sites, HTTP client, model, styling, build configuration, and test assertions. All current files under `src/` were inspected. Manifest declarations were compared with actual imports and providers rather than treated as implemented features.

- **Source-confirmed:** statements supported by the linked source files describe the current implementation. Absence claims are limited to the reviewed repository, not external systems.
- **Runtime-observed:** the dated checks below describe this local environment only. A successful build does not establish correctness, and a smoke check is not regression coverage.
- **Inferred risk:** possible failure modes found by reading code are labelled as such; they were not reproduced unless explicitly stated.
- **Unknown:** design rationale, production behavior, and the complete external API contract require other evidence or maintainer confirmation. No team review has taken place.

## Purpose and scope

BookMonkey is an Angular workshop application that displays a searchable book collection and individual book details. The repository contains the browser frontend; the fake Bookmonkey API is started separately. Both book features are read-only: there are no book editing, authentication, or book persistence flows. The selected color theme is stored locally in the browser.

## Technology and dependencies

Versions below are declarations from [package.json](package.json); ranges do not identify an exact installed version. [package-lock.json](package-lock.json) records dependency resolutions.

| Technology             | Declared version                       | Role in this repository                                                                     |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Angular                | Core packages 20.2.1; CLI/build 20.2.0 | Standalone components, routing, dependency injection, HTTP, and template-driven forms       |
| TypeScript             | 5.9.2                                  | Application types; strict compiler and template checks in [tsconfig.json](tsconfig.json)    |
| RxJS                   | 7.8.0                                  | Observable HTTP responses consumed through subscriptions                                    |
| Zone.js                | 0.15.0                                 | Change detection with event coalescing configured in [app.config.ts](src/app/app.config.ts) |
| Tailwind CSS / PostCSS | 4.1.12 / 8.5.6                         | Utility styling through [styles.css](src/styles.css) and [.postcssrc.json](.postcssrc.json) |
| Angular Material / CDK | ^20.2.0 / 20.2.0                       | Snackbar helper and snackbar theme overrides; the helper has no application callers         |
| Prettier               | 3.6.2                                  | Formatting configured in [.prettierrc](.prettierrc)                                         |
| Playwright             | ^1.55.0                                | Book detail feature tests with controlled API responses, alongside external-site examples   |

The manifest also declares `@ngrx/signals` 20.0.1, `@angular-architects/ngrx-toolkit` ^20.1.0, and `@tanstack/angular-query-experimental` ^5.85.5. None is imported or configured in the current application source; state lives in fields of [BookListComponent](src/app/books/book-list.component.ts). This was checked against imports throughout `src/` and the providers in [app.config.ts](src/app/app.config.ts).

Likewise, `@angular/ssr`, `@angular/platform-server`, and Express are declared, but there is no server entry point or SSR build configuration in [angular.json](angular.json). The implemented application is bootstrapped in the browser. Dependency presence alone does not establish an architectural capability.

## Source layout and responsibilities

| Path                                                                                 | Responsibility                                                                                             |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [src/main.ts](src/main.ts)                                                           | Calls `bootstrapApplication(App, appConfig)` and logs bootstrap failures                                   |
| [src/app/app.config.ts](src/app/app.config.ts)                                       | Registers router, HTTP client, animations, global browser error listeners, and zone-based change detection |
| [src/app/app.ts](src/app/app.ts), [app.html](src/app/app.html)                       | Root shell with header, router outlet, and footer                                                          |
| [src/app/app.routes.ts](src/app/app.routes.ts)                                       | Maps the empty path to the list, `books/:isbn` to details, and redirects other unmatched paths to the list |
| [src/app/books/book-list.component.ts](src/app/books/book-list.component.ts)         | Loads books, owns search/loading/results state, and renders list and empty states                          |
| [src/app/books/book-item.component.ts](src/app/books/book-item.component.ts)         | Renders the entire book card as one keyboard-accessible link using the book's ISBN                         |
| [src/app/books/book-detail.component.ts](src/app/books/book-detail.component.ts)     | Loads route-selected book details and renders loading, success, not-found, and API-error states            |
| [src/app/books/book-api-client.service.ts](src/app/books/book-api-client.service.ts) | Root-provided HTTP client for the external books endpoint                                                  |
| [src/app/books/book.ts](src/app/books/book.ts)                                       | Defines the frontend's expected book shape                                                                 |
| [src/app/shared/toast.service.ts](src/app/shared/toast.service.ts)                   | Root-provided `MatSnackBar` wrapper; currently unused by the book feature                                  |
| [public/](public/)                                                                   | Static assets copied by the Angular build                                                                  |
| [tests/](tests/), [tests-examples/](tests-examples/)                                 | BookMonkey feature tests plus Playwright samples; only `tests/` is selected by the current configuration   |

The structure groups the book feature under `books/` and reusable helpers under `shared/`. Components are standalone; there is no application NgModule. The list and detail components keep their larger views in colocated [book-list.component.html](src/app/books/book-list.component.html) and [book-detail.component.html](src/app/books/book-detail.component.html) files; request/state logic remains in the TypeScript components. The shorter card view remains inline. The [route configuration](src/app/app.routes.ts) imports the list and detail components directly, so no lazy-loaded feature boundary is configured. Why the original structure was chosen is not documented in the reviewed files; the detail feature follows it to keep this change scoped.

## Agent instructions and refactoring review

[AGENTS.md](AGENTS.md) defines project-wide constraints and an explicitly invoked refactoring workflow. [src/AGENTS.md](src/AGENTS.md) adds source conventions; [src/app/books/AGENTS.md](src/app/books/AGENTS.md) records book-specific contracts. Reading these files does not automatically start the workflow. [REFACTORING.md](REFACTORING.md) records concrete findings, retained design choices, deferred search risks, and verification for the user-authorized workshop task. Personal machine configuration is not part of these repository instructions.

### GitHub issue analysis, implementation, and PR review

The [PR review workflow](.github/workflows/pull-request-review.yml) uses
`pull_request_target` for opened, updated, and reopened PRs. It checks out only
the trusted base SHA, collects a bounded API diff and linked issue bodies, and
runs Codex with `gpt-5.6-luna` in a read-only sandbox under a dedicated user.
It does not install or run PR code. A fresh publisher without the API key
rechecks the PR and requirement fingerprint before creating or updating one
bot comment. Reviews do not approve, merge, or replace application tests.
Paid automatic reviews require a maintainer event or an own local bot PR;
fork reviews require an explicit maintainer dispatch on the default branch.
The implementation publisher explicitly dispatches review for its verified PR,
with `actions: write` limited to that publisher job. Bot handoffs require the
expected head SHA. Review instructions and publishing helpers come from the
base checkout, never the PR head. See the workflow documentation for bounds,
trust assumptions, and the live verification procedure.

Local workflow verification on 2026-11-11 passed all 36 Node helper tests
(15 for PR review), the new helper's syntax check, formatting checks for the
affected automation files, and Actionlint for all four workflows. Actionlint's
outdated built-in metadata warning for the existing `permission-profile` input
was excluded after checking the upstream action input definition. No paid API
call or live GitHub review was run for this change; end-to-end verification
remains pending publication on the default branch. Application code was not
changed, and application builds/browser regressions were not rerun.

The [Codex workflows](docs/codex-github-actions.md) separate API-based review from
GitHub writes. The issue-analysis job reads an issue and source with a read-only
token and sandbox; a separate publisher validates structured output and checks
the issue revision before updating its own comment and two workflow-owned labels.
All workflows using the repository's OpenAI key explicitly select `gpt-5.6-luna`.
Ready analysis results explicitly dispatch the implementation workflow; a
maintainer can also apply `ready-for-implementation` or manually dispatch it.
Implementation uses the tracked phase skills on a GitHub-hosted runner with a
workspace-writing, network-enabled permission profile and an unprivileged user.
The agent receives no GitHub write token. A fresh runner validates bounded text
file output, reconstructs the changes, and runs both builds and application
Playwright tests. A separate publisher rechecks issue readiness, requirement
fingerprint, source revision, and verification digest before creating a branch
and PR through the Git data API. PR merge remains a human action; `Closes #N`
defers issue closure until merge. See the workflow documentation for supported
paths, size limits, retries, and prerequisites. Source inspection and mocked
helper tests do not establish a successful live implementation run.

### Refactoring verification (2026-11-09)

- Extracted the list and detail templates without changing component logic, bindings, styles, or UI text. The extraction checked exact content before formatting; final review compared both templates after identical Angular formatting and verified that replacing the template declaration is the only TypeScript change.
- `node node_modules/@angular/cli/bin/ng.js build --configuration development` passed. `npm.cmd run build` passed with network access for the existing Google Fonts integration; initial bundle 408.91 kB, within the configured budget.
- `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts --project=chromium --workers=1 --reporter=line` passed all 13 existing cases. No new behavior or test dependency was added.
- The existing frontend returned HTTP 200 and was reused. The sandbox initially blocked the local socket check; the same read outside the sandbox succeeded. VS Code Debug MCP tools were unavailable; no service was started, stopped, or restarted.
- Formatting and final diff checks passed. No screenshot checks were performed, as requested. Firefox/WebKit and the historically blocked Karma setup were not run; this refactoring does not resolve the deferred list lifecycle risks.

## Runtime and data flow

```text
src/main.ts -> App + appConfig -> RouterOutlet -> BookListComponent
                                                   |
                                            BookApiClient
                                                   |
                                              HttpClient
                                                   |
                                  http://localhost:4730/books
                                                   |
                                           Observable<Book[]>
                                                   |
                                  component fields -> BookItemComponent[]
```

The following flow is supported by [BookListComponent](src/app/books/book-list.component.ts), [BookApiClient](src/app/books/book-api-client.service.ts), and [BookItemComponent](src/app/books/book-item.component.ts):

1. `BookListComponent.ngOnInit()` loads books with its `pageSize` input, which defaults to 10.
2. `BookApiClient.getBooks()` sends `GET http://localhost:4730/books` with `_limit`. When a search term is present, it also sends `q`. The API implementation and its exact search semantics are outside this repository. A local title search was observed to work; the service comment about searching title and author is not proof of the full server-side search contract.
3. The component subscribes directly, stores the response in `books`, and clears `loading`. Each book is passed to a presentation component; `trackById` uses its `id`.
4. Search uses `FormsModule` and two-way `ngModel` binding. Changes reset a 300 ms timeout before requesting results. Clearing the search immediately reloads the default list.
5. While loading, the UI shows a spinner. An empty array produces an empty state. Request errors are logged to the console and clear `loading`; there is no dedicated error message or retry control.

The [Book interface](src/app/books/book.ts) includes `id`, `isbn`, `title`, optional `subtitle`, `author`, `publisher`, `numPages`, `price`, `cover`, `abstract`, and `userId`. It also models optional `publishedAt?: string` and `coAuthors?: string[]`, based on the locally served API documentation. The HTTP generic expresses a compile-time expectation; no runtime response validation is implemented. A sample response alone does not establish field types or guarantees for all responses.

### Book details

The entire card in [BookItemComponent](src/app/books/book-item.component.ts) is a single router link to `/books/<isbn>`, including cover, text, and padding. Its accessible name is the book title; there are no nested links or click-only containers. It supports keyboard activation and a visible focus outline, while hover highlights the card border and title. ISBN is the documented route/API key; `id` remains the list's tracking key. They happen to be equal in the sampled real book, but equality is not assumed by the feature. A test fixture deliberately uses different values.

[BookDetailComponent](src/app/books/book-detail.component.ts) observes `ActivatedRoute.paramMap` and calls [BookApiClient.getBookByIsbn](src/app/books/book-api-client.service.ts), which sends `GET http://localhost:4730/books/<encoded-isbn>`. It loads independently of the list or navigation state, supporting direct navigation and local reload. The detail route precedes the wildcard redirect; an unknown ISBN stays on the detail page with a not-found message.

`distinctUntilChanged` avoids duplicate parameter loads, and `switchMap` unsubscribes from the previous HTTP request when the ISBN changes. Each request emits a loading state first, removing previous details. Request-local `catchError` maps HTTP 404 to not-found and other HTTP/network failures to an error state without terminating future parameter changes. The template's `AsyncPipe` owns the subscription and cleans it up when the component is destroyed.

Success renders bibliographic data, optional publication date and nonempty co-authors. Price stays a string as supplied by the API; descriptions use escaped text interpolation. Missing or failed covers use a placeholder, and cover failure state resets for a new ISBN. Every state includes a real router link back to `/`, independent of browser history. The implementation adds no dependencies and leaves the existing list/search lifecycle unchanged.

## Build, local services, and styling

### Scrolling shell (2026-11-09)

The root shell retains native `header`, `main`, and `footer` landmarks. [AutoHideHeaderDirective](src/app/shared/auto-hide-header.directive.ts) controls the header's visibility separately from theme and book logic. [app.css](src/app/app.css) positions the header sticky at the viewport top, above content, and slides it out with a transform without removing its layout space. The header stays visible within the first 160 px of scroll; beyond that, 28 px of cumulative travel in one direction hides it downward or reveals it upward. Small direction changes do not flicker the header. Moving a mouse or pen into the top 12 px reveals it; hovering or focusing inside the header keeps it open. Touch interaction uses scroll direction instead of hover. Route navigation reveals the header again.

Passive scroll/pointer listeners run outside Angular's zone and update a visibility signal only as needed; listeners and the router subscription are cleaned up on destruction. Focus remains keyboard-accessible even when visually hidden. The footer now has an explicit themed surface and remains in normal document flow: after long content and at the viewport bottom on short pages through the existing flex shell.

Animation correction (2026-11-09): the existing browser reported `prefers-reduced-motion: reduce`, which shortened the original transform transition to 0.01 ms through the global motion reset. The header now uses a native 320 ms transform transition with an ease-out curve for normal motion. Reduced motion uses a brief 120 ms opacity transition without spatial movement; its narrowly scoped duration overrides the global reset. Invisible headers in this mode do not intercept pointer input, while keyboard focus reveals navigation. This follows Angular's [CSS state transition guidance](https://angular.dev/guide/animations/css); the persistent header does not enter or leave the DOM and needs no new animation dependency.

After this animation correction, the development build and `npm.cmd run build` passed (production initial bundle 412.50 kB). The full Chromium command below passed 21 cases, including two new tests that inspect actual interpolated animation states during hiding and revealing in both motion modes. Existing hover, focus, routing, theme, book, and mobile regressions passed. A read of the existing browser confirmed the effective `opacity 0.12s ease-out` transition under reduced motion. Formatting and diff checks passed. The existing server returned HTTP 200 and was reused; VS Code Debug MCP tools were unavailable, and no service was started or stopped. No screenshots were taken; other browser engines remain untested.

Hover-exit correction (2026-11-09): leaving the header now hides it again when scrolled beyond 160 px, without requiring another scroll event. Leaving the top-edge reveal region before the animation finishes is also handled. Focus inside the header prevents hiding; once focus leaves and the pointer is outside, hiding resumes. Near the page top the header stays visible. The earlier implementation only cleared the hover flag on pointer exit and incorrectly left the header visible until another scroll.

After this correction, the development and production builds passed (production initial bundle 412.11 kB). The same full Chromium command below passed 19 cases, including two added regressions for hover exit without scrolling, rapid exit during reveal, top-of-page visibility, and focus retention/release. Formatting and diff checks also passed.

Verification: development build and `npm.cmd run build` passed (production initial bundle 411.00 kB). `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts tests/shell.spec.ts --project=chromium --workers=1 --reporter=line` passed all 17 Chromium cases. The four new shell cases cover overlap without layout shift, scroll direction, top-edge reveal and hover hold, keyboard focus, navigation, narrow layout and reduced motion, and footer placement on long/short pages. Tests use controlled book API responses. The existing server was reused after a successful HTTP 200 check; no service was started or stopped. No screenshots or manual browser checks were performed for this change. Other browser engines remain untested.

The [README](README.md) documents `npm install`, `npm start`, and a separately started `npx bookmonkey-api` on port 4730. The API URL is hard-coded in the service; no environment-based endpoint selection or proxy is configured.

[angular.json](angular.json) defines one application using `@angular/build:application`. `npm start` serves the development configuration; `npm run build` defaults to production with output hashing and bundle/style budgets. `npm run watch` builds continuously in development mode. No production hosting or deployment pipeline is defined in the reviewed files.

Tailwind utilities and shared component classes supply UI styling using semantic theme tokens in [styles.css](src/styles.css). [material-theme.scss](src/material-theme.scss) binds snackbar colors to the same CSS variables. [index.html](src/index.html) loads Roboto and Material Icons from Google Fonts, introducing an external resource dependency.

[.vscode/launch.json](.vscode/launch.json) provides `ng serve` and `ng test` browser debug configurations, backed by npm tasks in [.vscode/tasks.json](.vscode/tasks.json).

## Visual theme

The application supports light and dark Slate themes with teal accents, shared across the shell, search, book cards, detail view, loading/empty states, and errors. Light defaults are defined in the Tailwind v4 `@theme` block in [styles.css](src/styles.css), making them available as CSS custom properties and utilities such as `bg-canvas`, `text-ink`, and `text-accent`. The palette below lists the light defaults. The `:root[data-theme='dark']` rule overrides the same tokens with dark Slate surfaces, light text, brighter teal accents, and matching error colors; native controls use the appropriate `color-scheme`.

The header offers a labelled native selector for System, Light, and Dark. [ThemeService](src/app/shared/theme.service.ts) owns the preference, follows live system changes in System mode, and synchronizes changes across tabs. Explicit choices persist under the localStorage key `bookmonkey-theme`; System removes the stored override. Blocked storage falls back to system defaults while allowing in-page switching. Event listeners are removed on service destruction. [public/theme.js](public/theme.js), loaded synchronously from [index.html](src/index.html), applies the initial preference before Angular bootstrap to avoid showing the opposite palette first. No theme dependency was added.

| Token                                                            | Value                             | Purpose                                 |
| ---------------------------------------------------------------- | --------------------------------- | --------------------------------------- |
| `--color-canvas`                                                 | `#e2e8f0` (Slate 200)             | Page background                         |
| `--color-surface` / `--color-surface-raised`                     | `#f8fafc` / `#ffffff`             | Panels, header, cards, and search field |
| `--color-surface-soft` / `--color-line`                          | `#f1f5f9` / `#cbd5e1`             | Cover/metadata backgrounds and borders  |
| `--color-ink` / `--color-muted`                                  | `#0f172a` / `#475569`             | Primary and supporting text             |
| `--color-accent` / `--color-accent-hover`                        | `#0f766e` / `#115e59`             | Links, buttons, hover, and focus        |
| `--color-accent-soft` / `--color-on-accent`                      | `#ccfbf1` / `#ffffff`             | Subtle accents and button text          |
| `--color-danger` / `--color-danger-soft` / `--color-danger-line` | `#9f1239` / `#fff1f2` / `#fecdd3` | Error text, background, and border      |

Shared CSS classes include `page-shell`, `surface-panel`, `status-panel`, `text-link`, `button-primary`, `icon-button`, and `book-metadata`. Card/panel radii and card shadows also have theme tokens. This is a small shared styling foundation, not a standalone component library or a complete design system. Responsive composition remains in the Angular templates. Global focus styling, a labelled search field, a named clear-search button, and reduced-motion handling support accessibility.

### Dark mode verification (2026-11-09)

- `node node_modules/@angular/cli/bin/ng.js build --configuration development` and `npm.cmd run build` passed; the production initial bundle is 408.89 kB, within the configured budget. Production compilation used network access for the existing Google Fonts integration.
- `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts --project=chromium --workers=1 --reporter=line` passed all 13 cases. The four new [theme tests](tests/theme.spec.ts) cover live system changes, keyboard selection, explicit overrides and reload persistence, reset to system, pre-bootstrap application, cross-tab synchronization, and unavailable storage. The nine existing feature tests still pass.
- The existing Chrome DevTools connection confirmed dark system mode on the real list, a canvas background of `rgb(2, 6, 23)`, and no horizontal overflow at an actual 1920 x 1080 viewport. One visible desktop screenshot was displayed before the user requested no further screenshot validation. Additional manual mobile/light/detail checks were not performed for this change. The temporary tab was closed and existing browser tabs/services were preserved.
- The VS Code Debug MCP remains unavailable. No service was started or stopped. This is Chromium coverage, not a full accessibility or cross-browser audit.

### Historical light theme and card interaction verification (2026-11-09)

- Development build and `npm.cmd run build` passed after the visual and card-link changes. The production initial bundle is 406.64 kB, within the existing budget.
- The targeted command `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts --project=chromium --workers=1 --reporter=line` passed all nine cases. The navigation case now also clicks card padding away from the title and checks the resulting details.
- The existing Chrome DevTools connection was used for the real app/API. Desktop viewport measured 1920 x 1080; mobile measured 390 x 844. Both list and detail layouts had no horizontal overflow. Mobile cards rendered in a single column, and clicking the real book cover opened its details.
- The browser confirmed the page background as `rgb(226, 232, 240)`, the search focus border as `rgb(15, 118, 110)`, and the simulated offline alert's background/text as `rgb(255, 241, 242)` / `rgb(159, 18, 57)`. Empty search results, clear-search, and real 404 were also checked. Visible screenshots of the changed desktop list and detail view were displayed; screenshots were not added to the repository.
- This was a visual and functional smoke check, not a full accessibility audit. The existing browser and running services were reused; only the temporary verification tab was created for this change.

## Historical onboarding verification (2026-11-09, before book details)

Checks used the existing local dependencies with Node v24.22.1 and npm 11.21.1. No dependencies or application configuration were changed.

| Check                                                                        | Result                                                               | What it establishes                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node node_modules/@angular/cli/bin/ng.js build --configuration development` | Passed                                                               | The application compiles in development configuration                                                                                                                                           |
| `npm.cmd run build`                                                          | Passed outside the restricted sandbox; initial bundle 383.54 kB      | Production compilation and configured bundle budgets passed in this environment                                                                                                                 |
| `npm test`                                                                   | Failed before test execution: `Cannot find module 'karma-jasmine'`   | The current unit-test setup is not runnable with the available dependencies; this is not an application assertion failure                                                                       |
| `node node_modules/@playwright/test/cli.js test --list`                      | Listed 6 cases in `tests/example.spec.ts`, across 3 browser projects | Test discovery works; no browser test cases were executed by this command                                                                                                                       |
| HTTP GET of `http://localhost:4200`                                          | HTTP 200 with HTML                                                   | The already running frontend was reachable                                                                                                                                                      |
| HTTP GET of `http://localhost:4730/books?_limit=1`                           | HTTP 200 with a one-element JSON array                               | A sample API response was reachable; not a complete contract check                                                                                                                              |
| Manual smoke check through the existing Chrome DevTools connection           | Passed in the existing browser at a 1666 x 861 viewport              | Initial list rendered 10 books; searching `Java Web Scraping Handbook` rendered one matching title; `zzzx-no-book-architecture-check` showed the empty state; clearing search restored 10 books |

The production build initially failed inside the sandbox with `getaddrinfo ENOTFOUND fonts.googleapis.com` during font inlining. Repeating it with network access succeeded. Thus the current production build depends on fetching the fonts linked in [index.html](src/index.html); the initial failure was environmental, not evidence of a TypeScript compilation defect. Sandbox HTTP probes were similarly blocked with `EACCES`; subsequent probes outside the sandbox returned the successful results above.

The browser's network log showed `GET /books?_limit=10` (304) and the no-match search request with `q` (200), and the UI rendered the results. This provides limited evidence that cross-origin API access works for the tested browser origin. CORS policies for other origins, deployment environments, and methods remain unknown. The temporary inspection tab was closed; the pre-existing browser and services were retained.

The local VS Code Debug MCP was not exposed among the available tools. Build checks therefore used shell commands. No service was started, stopped, or restarted; the reachable services were already running. Their debug/task ownership was not established.

## Book detail verification (2026-11-09)

The detail feature was checked separately from the earlier onboarding review. Existing local frontend/API processes were reused; the VS Code Debug MCP was still unavailable. No service was started, stopped, or restarted. Existing changes in README.md, package.json, and package-lock.json were preserved.

| Check                                                                                                                     | Result                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local API documentation at `http://localhost:4730/`                                                                       | Confirms `GET /books/:isbn`, optional ISO-8601 `publishedAt`, and optional string-array `coAuthors`                                                                    |
| Real `GET /books/1001606140805`                                                                                           | HTTP 200; title, author, publisher, ISBN, price, pages, description, and publication date matched the rendered detail                                                  |
| Real `GET /books/0000000000000`                                                                                           | HTTP 404 with `{}`; browser displayed `Book not found` and the back link                                                                                               |
| `node node_modules/@angular/cli/bin/ng.js build --configuration development`                                              | Passed                                                                                                                                                                 |
| `npm.cmd run build` with network access for Google Fonts                                                                  | Passed; initial bundle 398.54 kB, within configured budgets                                                                                                            |
| `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts --project=chromium --workers=1 --reporter=line` | 9 passed; Chromium only                                                                                                                                                |
| Existing Chrome DevTools connection with the real API                                                                     | List-to-detail navigation, independent new-tab direct URL, reload, back link, and real 404 verified                                                                    |
| Browser-controlled offline and Slow 3G simulation                                                                         | Offline showed `Unable to load book`; a DOM observer confirmed `Loading book...`, removal of old details, and availability of the back link before the delayed success |
| Desktop and mobile layout                                                                                                 | Actual desktop viewport verified at 1920 x 1080 after adjusting for browser zoom; mobile verified at 390 x 844, with no horizontal overflow                            |

[tests/book-detail.spec.ts](tests/book-detail.spec.ts) intercepts API requests deterministically. Its nine cases cover distinct ID/ISBN values and keyboard navigation; list/detail/back flow; direct URL and reload without list requests; delayed loading; 404, 500, and network failure with recovery on parameter changes; absent optional fields and broken-cover fallback; cancellation of stale requests and subsequent cover rendering; search, wildcard routing, and mobile overflow. Co-authors, publication date, price, and escaped description text are asserted in the success case. The controlled tests do not establish the behavior of every real API response.

The first automated run could not launch because Playwright's matching Chromium Headless Shell was missing. It was installed with `node node_modules/@playwright/test/cli.js install chromium --only-shell`. A subsequent run exposed a test interception pattern that did not cover nested API paths; the matcher was corrected before all nine cases passed. No production dependency or shared service was changed. The earlier Karma failure was not rerun because this feature uses Playwright.

## Current limitations and open questions

- [playwright.config.ts](playwright.config.ts) selects Chromium, Firefox, and WebKit and configures `npm start` as its web server. However, [tests/example.spec.ts](tests/example.spec.ts) visits `https://playwright.dev/`, so passing those tests would not verify BookMonkey. The TodoMVC sample in `tests-examples/` is outside the configured test directory.
- `npm test` targets Karma in [angular.json](angular.json), and [tsconfig.spec.json](tsconfig.spec.json) references Jasmine types. The [manifest](package.json) does not declare Karma/Jasmine packages, and there are no application `*.spec.ts` files under `src/`. The onboarding run confirmed a missing `karma-jasmine` module. Application unit tests remain absent; the detail feature now has dedicated automated browser coverage.
- **Inferred concurrency/lifecycle risks:** [BookListComponent](src/app/books/book-list.component.ts) subscribes independently to each request without cancellation or response sequencing. An older response could overwrite newer results. The search timeout has no destruction cleanup, and `clearSearch()` does not cancel a pending timeout. These failure scenarios were not reproduced by the smoke check.
- **Unverified failure behavior:** the component logs request errors and clears `loading`; empty or previously loaded results can then remain visible without an explicit error state. API outages, delayed responses, malformed data, and recovery were not tested.
- **External contract unknowns:** one API sample and two search examples do not establish all supported fields, matching rules, pagination, authentication, CORS policies, or production availability. Backend source and an authoritative contract are not part of this repository.
- **Production deep links:** direct URL and reload were verified on the local Angular development server. Production hosting still needs a SPA fallback to `index.html`; no production hosting behavior was verified.
- **Coverage boundaries:** Firefox/WebKit, malformed API responses, and real server data containing nonempty co-authors were not tested. HTTP 500, network failure, timing, and optional-field combinations were controlled test inputs; the manual offline check was a browser simulation.
- **Maintainer questions:** Why are the unused state/query/SSR packages present? Is client-only rendering intentional? What deployment topology, API contract, and test coverage are expected? Confirm these before treating current implementation as an architectural decision.

## Reflection: using AI for project onboarding

An AI summary can speed up navigation and make component relationships easier to find, but it needs review against source evidence:

- **Invented capabilities:** installed libraries may be mistaken for implemented features. Here, NgRx, query caching, and SSR dependencies would give a misleading picture if treated as active architecture.
- **Incomplete evidence:** frontend types do not prove the API contract, and static inspection cannot prove runtime behavior or successful builds.
- **Misleading tests and comments:** sample tests and stale comments can sound authoritative without describing the current application. Follow imports, providers, routes, and actual assertions.
- **Stale documentation:** the summary is a snapshot, not an automatically synchronized source of truth. Review it alongside architectural changes and keep its source links current.
- **Data exposure:** check which source files and secrets may be shared with an AI service before analyzing private repositories.

For group discussion: Which claims can be checked directly in code? Which require execution or a maintainer's knowledge? Who will review and maintain the summary as the project evolves?

## Keeping this summary trustworthy

When changing architecture, review this document in the same change as the implementation. Recheck [package.json](package.json) against imports, follow the bootstrap/providers/routes into the affected feature, and update links and the review date. Mark new claims as source-confirmed, runtime-observed, inferred, or unknown; retain failed checks and their causes alongside successful ones.

Run relevant builds and application-specific tests when behavior changes, and record commands, outcomes, and limits. External-site sample tests cannot substitute for BookMonkey coverage. Review architectural intent and unresolved contract questions with a maintainer; do not fill gaps with assumptions. This document has no automated synchronization or assigned maintenance owner.

Before future AI-assisted reviews, confirm the approved service and repository scope with the team, exclude credentials and sensitive data, and share only the necessary material. No organization-specific approval policy or data-handling compliance was verified by this technical review.
