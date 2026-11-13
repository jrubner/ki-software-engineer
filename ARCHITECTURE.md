# BookMonkey Architecture

This summary describes the checked-out source and configuration, initially reviewed on 2026-11-09 and updated for feature delivery on 2026-11-13. Dated verification sections retain their historical scope. It describes observed implementation, not the team's intended architecture. Update it when routes, providers, dependencies, or feature boundaries change.

## Evidence and confidence

The review followed the bootstrap and provider configuration, routes, component imports and call sites, HTTP client, model, styling, build configuration, and test assertions. All current files under `src/` were inspected. Manifest declarations were compared with actual imports and providers rather than treated as implemented features.

- **Source-confirmed:** statements supported by the linked source files describe the current implementation. Absence claims are limited to the reviewed repository, not external systems.
- **Runtime-observed:** the dated checks below describe this local environment only. A successful build does not establish correctness, and a smoke check is not regression coverage.
- **Inferred risk:** possible failure modes found by reading code are labelled as such; they were not reproduced unless explicitly stated.
- **Unknown:** design rationale, production behavior, and the complete external API contract require other evidence or maintainer confirmation. No team review has taken place.

## Purpose and scope

BookMonkey is an Angular workshop application with a searchable, paginated book collection, individual details, and forms for creating and editing books. The repository contains the browser frontend; the fake Bookmonkey API is started separately. Shared editorial recommendations persist as optional fields on books in that API. A personal reading-list board persists locally in the browser; authentication is not implemented. The selected color theme is also stored locally. The additional `/gamba` route hosts Book of CK, a client-only slot game using fictional credits; it has no payments or backend persistence.

## Technology and dependencies

Versions below are declarations from [package.json](package.json); ranges do not identify an exact installed version. [package-lock.json](package-lock.json) records dependency resolutions.

| Technology             | Declared version                         | Role in this repository                                                                      |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Angular                | Core packages 21.2.26; CLI/build 21.2.30 | Standalone components, routing, dependency injection, HTTP, and experimental Signal Forms    |
| TypeScript             | 5.9.2                                    | Application types; strict compiler and template checks in [tsconfig.json](tsconfig.json)     |
| RxJS                   | 7.8.0                                    | Observable HTTP responses consumed through subscriptions                                     |
| Change detection       | Angular 21 zoneless default              | Signals, template events and Angular notifications schedule rendering; no Zone.js dependency |
| Tailwind CSS / PostCSS | 4.1.12 / 8.5.6                           | Utility styling through [styles.css](src/styles.css) and [.postcssrc.json](.postcssrc.json)  |
| Angular Material / CDK | ^21.2.14 / 21.2.14                       | Reading-list drag and drop; unused snackbar helper and theme overrides                       |
| Prettier               | 3.6.2                                    | Formatting configured in [.prettierrc](.prettierrc)                                          |
| Vitest / WebdriverIO   | ^4.1.12 / ^10.2.0                        | Angular unit tests in headless Chrome, including real CSS/CDK behavior                       |
| Playwright             | ^1.65.0                                  | Separate acceptance suite; not executed during the Angular 21 upgrade                        |

The manifest also declares `@ngrx/signals` ^21.1.1, `@angular-architects/ngrx-toolkit` ^21.0.1, and `@tanstack/angular-query-experimental` ^5.107.1. These libraries are intentionally retained and updated to compatible versions; none is imported or configured in the current application source. List state uses Angular signals in [BookListComponent](src/app/books/book-list.component.ts).

Likewise, `@angular/ssr`, `@angular/platform-server`, and Express are declared, but there is no server entry point or SSR build configuration in [angular.json](angular.json). The implemented application is bootstrapped in the browser. Dependency presence alone does not establish an architectural capability.

## Source layout and responsibilities

| Path                                                                                                         | Responsibility                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [src/main.ts](src/main.ts)                                                                                   | Calls `bootstrapApplication(App, appConfig)` and logs bootstrap failures                                                    |
| [src/app/app.config.ts](src/app/app.config.ts)                                                               | Registers router, HTTP client, animations and global browser error listeners; Angular 21 supplies zoneless change detection |
| [src/app/app.ts](src/app/app.ts), [app.html](src/app/app.html)                                               | Root shell with header, router outlet, and footer                                                                           |
| [src/app/app.routes.ts](src/app/app.routes.ts)                                                               | Lazy-loads collection, creation, editing, details, reading list, and game; redirects unmatched paths to the list            |
| [src/app/books/book-list.component.ts](src/app/books/book-list.component.ts)                                 | Loads books, owns search/loading/results state, and renders list and empty states                                           |
| [src/app/books/book-item.component.ts](src/app/books/book-item.component.ts)                                 | Renders the entire book card as one keyboard-accessible link using the book's ISBN                                          |
| [src/app/books/book-detail.component.ts](src/app/books/book-detail.component.ts)                             | Loads route-selected book details and renders loading, success, not-found, and API-error states                             |
| [src/app/books/book-edit.component.ts](src/app/books/book-edit.component.ts)                                 | Loads an existing book, owns a typed Signal Form, validates changes, saves, and handles failures                            |
| [src/app/books/book-create.component.ts](src/app/books/book-create.component.ts)                             | Validates a new book, checks ISBN availability, and saves through the API                                                   |
| [src/app/reading-list/reading-list.store.ts](src/app/reading-list/reading-list.store.ts)                     | Owns reading-list membership, order, storage, and metadata refresh                                                          |
| [src/app/reading-list/reading-list-board.component.ts](src/app/reading-list/reading-list-board.component.ts) | Renders status columns, book covers, counts, and whole-card CDK drag and drop                                               |
| [src/app/books/book-api-client.service.ts](src/app/books/book-api-client.service.ts)                         | Root-provided HTTP client for the external books endpoint                                                                   |
| [src/app/books/book.ts](src/app/books/book.ts)                                                               | Defines the frontend's expected book shape                                                                                  |
| [src/app/shared/toast.service.ts](src/app/shared/toast.service.ts)                                           | Root-provided `MatSnackBar` wrapper; currently unused by the book feature                                                   |
| [public/](public/)                                                                                           | Static assets copied by the Angular build                                                                                   |
| [tests/](tests/), [tests-examples/](tests-examples/)                                                         | BookMonkey feature tests plus Playwright samples; only `tests/` is selected by the current configuration                    |

The structure groups books under `books/`, the local board under `reading-list/`, and reusable helpers under `shared/`. Components are standalone; there is no application NgModule. Substantial views use colocated HTML files; request/state logic remains in TypeScript. The shorter book card remains inline. The [route configuration](src/app/app.routes.ts) lazy-loads the list, detail, edit, create, reading-list board, and game components through `loadComponent`. Components use `OnPush`, built-in control flow, signal inputs, and local signals. Detail request state remains an Observable consumed by `AsyncPipe`.

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
Ready analysis results dispatch implementation only when a maintainer has also
applied `implementation-approved`. Both labels are required for manual starts
and are rechecked before publication; analysis cannot grant approval.
Implementation uses the tracked phase skills on a GitHub-hosted runner with a
workspace-writing, network-enabled permission profile and an unprivileged user.
The agent receives no GitHub write token. A fresh runner validates bounded text
file output, reconstructs the changes, and runs Angular unit tests, both builds,
and application Playwright tests. A separate publisher rechecks approval, issue readiness, requirement
fingerprint, source revision, and verification digest before creating a branch
and PR through the Git data API. PR merge remains a human action; `Closes #N`
defers issue closure until merge. See the workflow documentation for supported
paths, size limits, retries, and prerequisites. Source inspection and mocked
helper tests do not establish a successful live implementation run.

### Self-healing CI design (2026-11-12)

The [CI repair workflow](.github/workflows/auto-fix.yml) watches failed
`Repository Validation` runs through `workflow_run`. Its trusted controls come
from the default-branch checkout; the exact failed revision is reconstructed
separately in `source/`. Preparation authorizes the initiating maintainer and
collects bounded log tails. Codex, independent verification, Git publication,
and failure notification use separate jobs. Only the agent receives the OpenAI
key; only the publisher can create code and PRs. The fixed model remains
`gpt-5.6-luna`.

The publisher requires a verified output digest and an unchanged target revision,
creates one minimal `fix(ci)` commit on a new repair branch, and opens a PR to
the failed branch. It explicitly dispatches secret-free validation, never merges,
and never force-pushes. Unsupported or failed attempts create a deduplicated
manual-intervention issue. Existing output size/path guards are reused, so
dependency, workflow, and build/test configuration changes require human work.
Repair branches, recognized repair commits, and reruns are excluded to bound
automatic attempts. See the [workflow documentation](docs/codex-github-actions.md)
for activation requirements, limits, and isolated-branch live-test instructions.

This is a source-confirmed design, not evidence of a successful live repair.
The workflow cannot activate until it is present on the default branch.
Application code and dependencies are unchanged.

Local verification on 2026-11-12 passed all 61 Node helper tests (24 new repair
tests), Prettier for the new automation files and workflow documentation, and
`git diff --check`. Actionlint 1.7.12 passed all six workflows with its known
outdated-input warning for `permission-profile` excluded. Application builds and
browser regressions were not rerun for this automation-only change. No paid
repair request, repair PR, or failure notification has been exercised live yet.

The subsequent isolated live test on 2026-11-12 supersedes that untested state:
[test PR #15](https://github.com/jrubner/ki-software-engineer/pull/15) introduced
one extra closing parenthesis, locally confirmed as TypeScript TS1005.
[CI run 43185250566](https://github.com/jrubner/ki-software-engineer/actions/runs/43185250566)
failed and automatically triggered
[repair run 43185416779](https://github.com/jrubner/ki-software-engineer/actions/runs/43185416779).
Preparation passed, but Codex failed to initialize its in-process app-server with
`Permission denied`, before producing a repair. Independent verification and
publication were skipped. Notification succeeded and created
[issue #16](https://github.com/jrubner/ki-software-engineer/issues/16).
No repair PR or successful end-to-end repair is verified.

The custom Codex home was owned by `runner`, unlike the account executing Codex.
The proposed correction assigns it to `codex-ci`, retains runner-group write
access for action configuration, and checks ownership and write access as
`codex-ci` before starting the action. This is a candidate correction pending
a fresh Linux live test after merge, not a confirmed resolution. The existing
issue-implementation workflow uses the same ownership pattern and was not changed
as part of this CI-repair test.

### Refactoring verification (2026-11-09)

- Extracted the list and detail templates without changing component logic, bindings, styles, or UI text. The extraction checked exact content before formatting; final review compared both templates after identical Angular formatting and verified that replacing the template declaration is the only TypeScript change.
- `node node_modules/@angular/cli/bin/ng.js build --configuration development` passed. `npm.cmd run build` passed with network access for the existing Google Fonts integration; initial bundle 408.91 kB, within the configured budget.
- `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts --project=chromium --workers=1 --reporter=line` passed all 13 existing cases. No new behavior or test dependency was added.
- The existing frontend returned HTTP 200 and was reused. The sandbox initially blocked the local socket check; the same read outside the sandbox succeeded. VS Code Debug MCP tools were unavailable; no service was started, stopped, or restarted.
- Formatting and final diff checks passed. No screenshot checks were performed, as requested. Firefox/WebKit and the historically blocked Karma setup were not run; this refactoring does not resolve the deferred list lifecycle risks.

## Runtime and data flow

### Angular CLI MCP modernisation verification (2026-11-12)

The user-authorised task 1569 used the installed Angular CLI MCP 20.2.0 server's
actual `list_projects` and `get_best_practices` responses. Personal Codex MCP
configuration was backed up and registered outside this repository. Its setup
and the applied conventions are documented in [Angular CLI MCP with Codex](docs/angular-cli-mcp.md).
No dependencies, application URLs, search timing, theme initialization, API
contracts, or business behavior were intentionally changed. The existing list
request/timer lifecycle limitations remain deferred.

Development and production builds passed. Production output has a 360.67 kB
initial bundle and separate lazy list/detail chunks. All six Angular unit tests
and all 21 existing Chromium application tests passed. Two new list tests protect
nondefault page size, asynchronous loading/empty rendering, 300 ms search timing,
and immediate clearing. The running development server was verified by process
command line and reused; no service restart was needed. Prettier passed for all
changed application files and the new setup guide; `git diff --check` passed.
Transient stale Vite
overlays were cleared by recompiling unchanged/completed source before successful
full reruns; see [REFACTORING.md](REFACTORING.md). These results supersede the
historical eager-route/mutable-state description and four-test count for current
application code while retaining the dated earlier evidence.

```text
src/main.ts -> App + appConfig -> RouterOutlet -> BookListComponent
                                                   |
                                            BookApiClient
                                                   |
                                              HttpClient
                                                   |
                                  http://localhost:4730/books
                                                   |
                                           Observable<BookPage>
                                                   |
                                  component signals -> BookItemComponent[]
```

The following flow is supported by [BookListComponent](src/app/books/book-list.component.ts), [BookApiClient](src/app/books/book-api-client.service.ts), and [BookItemComponent](src/app/books/book-item.component.ts):

1. `BookListComponent.ngOnInit()` loads books with its `pageSize` input, which defaults to 10.
2. `BookApiClient.getBooksPage()` sends `GET http://localhost:4730/books` with `_page`, `_limit`, and optional `q`. It returns `BookPage`, reading `X-Total-Count` as a nonnegative safe integer; missing or invalid totals fail the request. The compatible `getBooks()` method remains available. Exact server search semantics and CORS exposure of the total header require external API verification.
3. A `switchMap` stream cancels replaced requests. Signals own loading, errors, page, total, and cards; stale cards are cleared during loading. Each card has a required signal input and `@for` tracks its `id`.
4. Search uses a typed signal model, `form()` and `[formField]`. A destruction-owned 300 ms timer applies the search on page one; clearing cancels that timer and immediately resets. Paging retains the applied query; page count is computed from totals and page size.
5. Previous/Next controls disable at boundaries and while loading. Errors offer retry of the same page/query. A response that makes the current page invalid triggers a corrected request for the last valid page. Zero totals render the empty state.

The [Book interface](src/app/books/book.ts) includes `id`, `isbn`, `title`, optional `subtitle`, `author`, `publisher`, `numPages`, `price`, `cover`, `abstract`, and `userId`. It also models optional `publishedAt?: string` and `coAuthors?: string[]`, based on the locally served API documentation. The HTTP generic expresses a compile-time expectation; no runtime response validation is implemented. A sample response alone does not establish field types or guarantees for all responses.

### Editorial recommendations

[BookRecommendationsComponent](src/app/books/book-recommendations.component.ts) renders below successful book details with the requested heading `Empfehlungen der Redaktion`, without a portrait. A shared selection contains up to four books; the current ISBN is excluded from display, so a selected book's own page shows at most three. Each card is a single accessible ISBN router link with cover, author and title. The grid uses four desktop columns and two mobile columns, with existing theme tokens and a missing/broken-cover placeholder.

[EditorialRecommendationsPageComponent](src/app/books/editorial-recommendations-page.component.ts) provides the independent, lazy-loaded `/editorial-recommendations` overview. Main navigation links to it as Recommendations, and detail sections link to it as Manage recommendations. The overview renders the shared selection without excluding an ISBN and has its own page heading and document title. Add books opens the selection dialog within this route.

[EditorialSelectionDialogComponent](src/app/books/editorial-selection-dialog.component.ts) uses CDK Dialog with focus trapping/restoration, Escape cancellation, and a typed Signal Forms search. Cancellable searches use existing `BookApiClient.getBooksPage()` requests, eight results per page and a 300 ms input delay. Selection order follows the order in which books are added. Selection stays in the dialog until Save; removing all books clears the shared recommendations. Closing the dialog returns to the overview and reloads its saved selection.

[EditorialRecommendationsService](src/app/books/editorial-recommendations.service.ts) reads `GET /books?editorialRecommendation_like=^true$`, filters strict boolean values and sorts by optional `editorialRecommendationOrder`. The regex query also excludes records without the new field in the installed json-server API. Saving first reloads the current selection, then sequentially patches removals and additions using encoded ISBNs. PATCH bodies contain only `editorialRecommendation` and `editorialRecommendationOrder`; bibliographic data is preserved. No backend source, dependency or separate service was added. Existing edit forms spread the loaded book when saving, preserving these fields.

The existing API has no editorial authorization or multi-record transaction. Concurrent editors can overwrite or combine selections; the display remains capped at four. A failed save can leave partial updates. The dialog reports this, retains the draft for retry, and reloads saved state on cancellation. These limits require a different backend contract to eliminate.

#### Verification (2026-11-13)

- All 106 Angular unit tests passed, including HTTP field isolation, encoded ISBN addressing, order, and retry after partial writes.
- All 30 Chromium Playwright cases passed across book details, recommendations, theme and shell. Six recommendation cases cover the independent overview route and navigation, reload without detail requests, selection/search/paging, limits, persistence, cancellation/focus, error recovery and mobile dark mode. Existing list mocks now expose pagination totals; shell assertions account for the existing Add book link and use a not-found page for the short-page footer assertion.
- Development and production builds passed. Production retains the unrelated game CSS budget warning (7.78 kB against a 4 kB warning threshold).
- The existing Chrome session and real Bookmonkey API verified four selected books, loaded covers, preserved bibliographic fields, detail navigation, reload persistence and exclusion of the current ISBN. The temporary selection was cleared afterward. The independent overview route, its heading/navigation and its Add books dialog were subsequently checked in the same browser session. Desktop viewport measured 1383 × 924; automated mobile checks used 390 × 844. No screenshots were retained.
- The previous development server served stale bundles and did not respond to file changes. With no VS Code Debug MCP available, its verified repository-specific process was restarted using a shell fallback. The backend was reused unchanged. Firefox/WebKit and production hosting were not verified.

### Book details

The entire card in [BookItemComponent](src/app/books/book-item.component.ts) is a single router link to `/books/<isbn>`, including cover, text, and padding. Its accessible name is the book title; there are no nested links or click-only containers. It supports keyboard activation and a visible focus outline, while hover highlights the card border and title. ISBN is the documented route/API key; `id` remains the list's tracking key. They happen to be equal in the sampled real book, but equality is not assumed by the feature. A test fixture deliberately uses different values.

[BookDetailComponent](src/app/books/book-detail.component.ts) observes `ActivatedRoute.paramMap` and calls [BookApiClient.getBookByIsbn](src/app/books/book-api-client.service.ts), which sends `GET http://localhost:4730/books/<encoded-isbn>`. It loads independently of the list or navigation state, supporting direct navigation and local reload. The detail route precedes the wildcard redirect; an unknown ISBN stays on the detail page with a not-found message.

`distinctUntilChanged` avoids duplicate parameter loads, and `switchMap` unsubscribes from the previous HTTP request when the ISBN changes. Each request emits a loading state first, removing previous details. Request-local `catchError` maps HTTP 404 to not-found and other HTTP/network failures to an error state without terminating future parameter changes. The template's `AsyncPipe` owns the subscription and cleans it up when the component is destroyed.

Success renders bibliographic data, optional publication date and nonempty co-authors. Price stays a string as supplied by the API; descriptions use escaped text interpolation. Missing or failed covers use a placeholder, and cover failure state resets for a new ISBN. Every state includes a real router link back to `/`, independent of browser history. A responsive action group below the author contains labeled buttons with decorative SVG icons and Material tooltips: native links open the editor and reading board, and a membership button adds or removes the ISBN. Membership is shown through `aria-pressed`, a checkmark, and the label `In reading list`; its tooltip and accessible name explain removal. Tooltip colors, typography, and rounded corners are defined through Material overrides using semantic theme tokens.

## Build, local services, and styling

### Book editing (2026-11-13)

Source-confirmed: the detail page links to `/books/:isbn/edit`. The lazy editor
loads independently through `getBookByIsbn()`, uses typed Signal Forms and
`OnPush`, and retains ISBN, `id`, and `userId` in the outgoing book. Replaceable
reads use `switchMap`; route changes reset form/error state and cancel stale
reads. Destruction owns both read and write subscriptions. A late write response
for a different route cannot navigate or alter the new editor state.

Titles/authors must contain non-whitespace text, and pages must be a positive
integer. Other fields may be empty; price remains free text. Co-authors are
trimmed nonempty lines. Empty publication dates are omitted from the full PUT
replacement so the optional property is deleted. The form and its navigation
actions are disabled while saving; a synchronous guard prevents duplicate
submissions. Success navigates to a freshly loaded detail page. Failure keeps
inputs, re-enables the form, and offers retry. Cancel navigates without writing.
Descriptions remain escaped text.

The installed Bookmonkey API 3.3.0 was read locally before implementation; its
README documents `PUT /books/:isbn`. Its validation middleware accepts optional
ISO-8601 dates but rejects an empty date string, and overwrites `id` with ISBN.
The frontend sends the unchanged original identity; preservation of a distinct
`id` by that server is therefore outside the frontend's control. Existing sampled
API records have equal values. No real API write was made during verification.

Verification applies to the uncommitted work on
`feature/workshop-feature-delivery`, based on `4506063`:

- `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless`
  passed 21 tests (13 editor, six HTTP contracts, two existing list tests).
- Development and production builds passed. Production initial bundle: 382.87 kB;
  lazy editor: 8.67 kB. The existing game CSS warning remains 7.78 kB against a
  4 kB warning threshold, below the unchanged 8 kB error budget.
- Before implementation, the Playwright feature run stopped after two expected
  failures: the loaded detail page had no Edit book link, and the edit URL had
  no form. The initial HTTP tests could not compile because `updateBook` did not
  exist; this was a missing contract, not a behavioral Red result.
- The user subsequently reserved UI browser validation for themselves. The 16
  prepared editor scenarios and existing detail/theme/shell regressions were not
  run against the completed feature. Direct/reload routing, keyboard use, themes,
  and mobile appearance remain unverified in a live browser for this change.
  No screenshots were taken. Existing services were reused; the session exposed
  no VS Code Debug MCP tools. The already connected personal browser was retained;
  test-runner browsers closed when their runs ended.

| Criterion               | Implementation and unit evidence                                                                        | Remaining evidence                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| AC1: open and prefill   | Lazy route, detail link, independent ISBN load and prefill unit test                                    | Live navigation and reload                     |
| AC2: save once and lock | Complete PUT/encoded ISBN contracts, duplicate submission/disabled controls and optional deletion tests | End-to-end detail refresh and real persistence |
| AC3: invalid fields     | Blank/whitespace title and author plus empty, zero, negative and fractional pages tested without writes | User browser review                            |
| AC4: cancel             | Navigation to original ISBN with no write tested                                                        | User browser review                            |
| AC5: failures           | 404/500/network recovery, stale-read cancellation and save retry unit tests                             | User browser review                            |

Under the user's amended completion condition, local implementation and review
complete the checklist; browser acceptance is reserved for the user and is not claimed.
No GitHub issue, commit, push, or pull request was created.

### Creation, pagination, and reading list (2026-11-13)

Source-confirmed: `/books/new` precedes the ISBN routes and lazy-loads an independent
typed Reactive Form. Required trimmed ISBN/title/author and positive integer pages
are validated locally; there is no ISBN checksum validation. Optional values may
be empty, price stays free text, and co-authors are normalized lines. Creation
uses `NewBook = Omit<Book, 'id'>`, omits an empty publication date, and sets the
workshop default `userId: 1`. Only a 404 from the preceding ISBN lookup permits
POST `/books`; other lookup errors and duplicate ISBNs prevent it. Save/lookup
errors retain input, a synchronous guard prevents duplicate submission, and
success navigates using the returned ISBN. Real POST persistence is unverified.

`/reading-list` lazy-loads a CDK board linked from the main navigation. The root
store adds once by ISBN, preserves status and order, and stores version 1 entries
under `reading-list:v1` with last-known book metadata. Drag and drop supports
column changes and sorting using the entire card. Following the user's UI
revision, there are no status selectors or separate drag handles. Book covers,
author/title metadata, column counts, and highlighted drop targets define the
board presentation; the title remains a details link. Opening the board refreshes each ISBN independently.
Refresh responses replace only book metadata, preserving moves made while reads
are pending. Failed reads, including 404, retain entries and offer Retry. Invalid
or unavailable local storage produces a notice and leaves in-memory use available.
The detail membership button also removes entries, persists the result, normalizes
remaining column orders, and cancels any pending refresh for that ISBN. Adding it
again starts in Want to read. There is no cross-tab synchronization, authentication,
or backend write for reading-list changes. Existing Angular CDK is reused without new dependencies.

#### Local acceptance evidence

The uncommitted working tree on `feature/workshop-feature-delivery` includes the
preserved editor and the three parallel slices implemented with `gpt-6-luna`.
The following outcomes are met within deterministic Angular unit tests and source
review; real API persistence and the user's browser acceptance remain unverified.

| Criteria | Implementation                                             | Verification evidence                                                                                                                  |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| C1       | Collection link and ordered lazy creation route            | List and router-harness tests cover entry, direct resolution, and recreation after navigation; actual browser reload is unverified.    |
| C2       | Independent typed creation form                            | Creation tests cover required whitespace, positive whole pages, optional data, free-text price, and co-author normalization.           |
| C3       | Guarded GET-then-POST and returned-ISBN navigation         | Creation/HTTP tests cover a single POST, disabled actions, payload without `id`, and success navigation.                               |
| C4       | Duplicate field error and recoverable lookup/save failures | Creation tests cover existing ISBN, non-404 lookup errors, POST conflict, retained inputs, and retry.                                  |
| C5       | Cancel returns to the collection                           | Creation test asserts navigation with no write.                                                                                        |
| P1       | Counts, page controls, input page size, and empty state    | List and HTTP tests cover defaults, nondefault size, totals, boundaries, and zero results.                                             |
| P2       | Debounced search and immediate clear reset page one        | List tests cover 300 ms timing, retained applied search on paging, and pending-timer cancellation.                                     |
| P3       | Replaceable reads clear cards and disable paging           | List tests cover cancellation, stale-card hiding, loading controls, and destruction cleanup.                                           |
| P4       | Same-request retry and corrected last page                 | List tests cover page/query retry and shrinking totals; HTTP tests reject missing/invalid total headers.                               |
| K1       | Detail action and ISBN-based idempotent add                | Router/store tests use distinct ID/ISBN and preserve existing status/order on duplicate add.                                           |
| K2       | Lazy route, main navigation, three columns                 | Router/board tests cover resolution and columns; navigation reviewed in source.                                                        |
| K3       | Whole-card CDK moves/sorting (amended by user)             | Board/store tests cover whole-card drag binding, no status controls, drop handlers, and ordering; real pointer dragging is unverified. |
| K4       | Versioned local storage with cached metadata               | Store tests persist and restore membership, status, order, and metadata in the test browser.                                           |
| K5       | Per-ISBN refresh updates metadata only                     | Board/store tests cover opening refresh, superseded reads, and moves during pending reads.                                             |
| K6       | Retained entries, Retry, and storage notice                | Store/board tests cover 404 recovery, corrupt data, and throwing storage reads/writes.                                                 |

The shared transport and integration review retained separate creation/edit forms
and store/view responsibilities. Blue removed duplicate page-state assignments
and a duplicate test type; no further abstraction was justified. Early missing
API/component symbols were compilation blockers, not behavioral Red evidence.
The navigation Red run demonstrated the missing creation route and detail action.
Two initial pagination failures were test scheduling/fixture defects, corrected
without weakening their assertions. See the final verification below.

Final verification after Blue on 2026-11-13:

- `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless`:
  all 71 tests passed, including the preserved editing feature. ChromeHeadless
  required execution outside the sandbox and exited with the test runner.
- `node node_modules/@angular/cli/bin/ng.js build --configuration development`:
  passed with separate lazy creation and reading-list chunks.
- `npm.cmd run build`: passed with network access for existing Google Fonts
  after sandbox DNS resolution failed. Production initial bundle: 389.11 kB.
  The unchanged game stylesheet still warns at 7.78 kB against its 4 kB warning
  budget, below the 8 kB error limit.
- Targeted Prettier and `git diff --check` passed. Final review included new
  files and retained the prior editing changes. No application service was
  started, stopped, or restarted; no Playwright or interactive browser checks,
  screenshots, real POSTs, issues, commits, pushes, or PRs were performed.
- The workflow Skill passed YAML syntax, current scalar frontmatter, naming,
  description, placeholder, and all six local-link checks using Node/Prettier.
  The bundled Python `quick_validate.py` could not start because PyYAML is not
  installed; the stated checks are the alternative validation, not a claimed
  successful run of that script. Existing permission and phase gates remain.

The workshop checklist records local completion, leaving the external classroom
action open. There is no associated issue to update or close. Manual browser
acceptance, production SPA fallback, total-header CORS exposure, and real API
write persistence remain outside this verification.

#### Reading-list presentation revision (2026-11-13)

The user amended K3 to whole-card drag and drop only, removing the native status
selector and separate drag handle. The board now has cover thumbnails with an
initial fallback, author/title/page metadata, column counts, empty drop areas,
and CDK preview, placeholder, and receiving styles. Theme tokens and responsive
columns remain in use. Images and title links disable native dragging so CDK
owns the card gesture; normal title-link activation still opens details. Touch
dragging has a brief hold delay. Persistence and refresh ownership are unchanged.

After this revision, all 73 Angular unit tests and both builds passed. Board
tests cover whole-card CDK binding without controls/handles, cross-column moves,
persisted status, sorting, and broken-cover fallback. Production initial bundle:
388.74 kB; only the existing game stylesheet budget warning remains. Targeted
Prettier and `git diff --check` passed. Interactive drag appearance and gestures
remain for user browser acceptance; no Playwright or screenshots were used.

Drag empty-state correction (2026-11-13): a drop zone hides its empty-state
message whenever it contains the CDK drag placeholder. Leaving the zone restores
the message automatically, without changing stored membership during hovering.
The regression test failed on the visible message before the CSS fix, then all
74 unit tests and both builds passed. It also verifies that other empty columns
remain visible and the placeholder retains its reduced opacity. Interactive
browser verification remains with the user.

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

The header offers one native toggle button with sun and moon icons; the active mode is highlighted. Its stable accessible name is `Dark mode`, with `aria-pressed` reflecting the resolved dark state. There is no tooltip or manual System option. [ThemeService](src/app/shared/theme.service.ts) owns the preference and exposes the resolved dark state as a signal. Without a stored override it follows the system default, including live changes. Toggling chooses an explicit Light or Dark override, persisted under the localStorage key `bookmonkey-theme` and synchronized across tabs. Blocked storage still allows in-page switching and falls back to the system default on reload. Event listeners are removed on service destruction. [public/theme.js](public/theme.js), loaded synchronously from [index.html](src/index.html), retains the same initial resolution before Angular bootstrap to avoid showing the opposite palette first. No theme dependency was added.

The toggle's active marker slides between icons over 240 ms, with small icon scale/rotation transitions. Hover uses a shadow without moving the button or adding a border or outline; the global keyboard focus outline remains. Base-layer color transitions animate backgrounds, text, borders, and shadows across the application over 240 ms, while component-specific transitions preserve header behavior and the moving toggle marker. Reduced motion suppresses marker/icon movement while retaining a brief 180 ms color fade; the header retains its 120 ms opacity/color transitions.

### Theme toggle verification (2026-11-10)

- Development build and `npm.cmd run build` passed; the production initial bundle is 415.18 kB, within the configured budget. Production compilation used network access for the existing Google Fonts integration.
- The application regression command with `tests/book-detail.spec.ts`, `tests/theme.spec.ts`, and `tests/shell.spec.ts`, Chromium, one worker, and the line reporter passed all 22 cases. Theme coverage includes initial system resolution, live system changes before selection, Space/Enter activation, both explicit overrides across reloads, active icons, hover/focus tooltip and Escape dismissal, pre-bootstrap application, cross-tab synchronization, and blocked storage. Existing shell and book cases passed with the new button.
- The existing frontend returned HTTP 200 and was reused. The VS Code Debug MCP was bound to the unrelated `ivoris` workspace; no service was started, stopped, or restarted. Firefox/WebKit and the historical Karma setup were not run.
- A smoke check through the user's approved personal Chrome debug connection confirmed both icons, the hover tooltip, and a Dark-to-Light click with matching pressed state and updated tooltip. The actual viewport was 2133 x 1200 with no horizontal overflow. The temporary tab was closed, the previous stored preference was restored, and the personal browser was left open. No screenshots were taken.
- After adding the marker animation and hover elevation, both builds passed again (production initial bundle 415.68 kB), and the full Chromium regression suite passed all 23 cases. The additional browser test samples the marker at an intermediate animation position in both directions and checks borderless hover elevation and reduced-motion behavior. The personal-Chrome smoke check above predates this animation update; it was not repeated.
- After correcting hover elevation to shadow only and adding application-wide theme color transitions, both builds passed (production initial bundle 416.39 kB), and all 24 Chromium cases passed. The added regression samples intermediate background colors on the body, header, and footer in both directions, checks reduced-motion duration, and confirms that hover does not transform the toggle. No additional personal-Chrome check or screenshot was performed.
- A subsequent check in the personal Chrome confirmed `prefers-reduced-motion: reduce` and exposed the global reset shortening color transitions to 0.01 ms. The fix retains a 180 ms non-spatial color fade; another real-browser read confirmed the effective 0.18 s duration. Regression coverage now checks interpolated surface colors in both motion modes. The first run found a test-only mismatch between a repeated CSS duration list and a single duration; correcting the assertion yielded 25 passing cases.
- The tooltip was then removed as requested, including its event handlers, description reference, wrapper, styles, and dedicated test. Active-icon checks remain in the main theme test. Both final builds passed (production initial bundle 415.56 kB), all 24 remaining Chromium cases passed, and formatting/diff checks passed. No additional personal-Chrome check was performed after removing the tooltip.

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

## Historical onboarding limitations and open questions

- [playwright.config.ts](playwright.config.ts) selects Chromium, Firefox, and WebKit and configures `npm start` as its web server. However, [tests/example.spec.ts](tests/example.spec.ts) visits `https://playwright.dev/`, so passing those tests would not verify BookMonkey. The TodoMVC sample in `tests-examples/` is outside the configured test directory.
- `npm test` targets Karma in [angular.json](angular.json), and [tsconfig.spec.json](tsconfig.spec.json) references Jasmine types. The [manifest](package.json) does not declare Karma/Jasmine packages, and there are no application `*.spec.ts` files under `src/`. The onboarding run confirmed a missing `karma-jasmine` module. Application unit tests remain absent; the detail feature now has dedicated automated browser coverage.
- **Inferred concurrency/lifecycle risks:** [BookListComponent](src/app/books/book-list.component.ts) subscribes independently to each request without cancellation or response sequencing. An older response could overwrite newer results. The search timeout has no destruction cleanup, and `clearSearch()` does not cancel a pending timeout. These failure scenarios were not reproduced by the smoke check.
- **Unverified failure behavior:** the component logs request errors and clears `loading`; empty or previously loaded results can then remain visible without an explicit error state. API outages, delayed responses, malformed data, and recovery were not tested.
- **External contract unknowns:** one API sample and two search examples do not establish all supported fields, matching rules, pagination, authentication, CORS policies, or production availability. Backend source and an authoritative contract are not part of this repository.
- **Production deep links:** direct URL and reload were verified on the local Angular development server. Production hosting still needs a SPA fallback to `index.html`; no production hosting behavior was verified.
- **Coverage boundaries:** Firefox/WebKit, malformed API responses, and real server data containing nonempty co-authors were not tested. HTTP 500, network failure, timing, and optional-field combinations were controlled test inputs; the manual offline check was a browser simulation.
- **Maintainer questions:** Why are the unused state/query/SSR packages present? Is client-only rendering intentional? What deployment topology, API contract, and test coverage are expected? Confirm these before treating current implementation as an architectural decision.

The three onboarding findings above about missing unit infrastructure, list
request sequencing, and list error rendering are historical. The authorized
unit-runner repair and 2026-11-13 pagination delivery supersede them: the runner
works, reads cancel, timers have cleanup, and failures show an explicit retry
state. External contract and browser coverage limitations still apply.

The Angular 21 upgrade described below also supersedes the historical Karma and
Jasmine setup. Current unit tests run through Vitest in headless Chrome.

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

## Book of CK (2026-11-10)

- `/gamba` lazy-loads `src/app/gamba/gamba.component.ts` and is linked from the shared header. Its colocated template and stylesheet render five animated reels with three visible rows, ten fixed paylines, selectable total bets, and session-only virtual credits.
- `src/app/gamba/slot-engine.ts` contains reel strips, random stop selection, and pure payout evaluation. Ivoris icons substitute as wilds, pay as scatters, and award ten free spins for three or more icons. Books are regular symbols. Retriggers add ten spins. The bonus keeps the triggering bet and randomly chooses one of the eight regular expanding symbols; three or more reels containing it qualify for a nonadjacent expansion payout. Each line receives the higher of its ordinary or expansion payout, plus separate scatter winnings.
- The component owns credits, spin locks, and free-spin state. Web Animations move actual symbol strips from the previous grid to the next result with staggered deceleration. Space starts one spin; held-key repeats and native controls are protected. Paid spins debit once; free spins debit nothing. No state is persisted across reloads. The game uses `Math.random` for recreational virtual play and makes no regulated randomness or return-to-player claim.
- `free-spin-bonus.component.ts` presents an explicitly centered native modal dialog with a win celebration and a three-position selection reel. The user starts the symbol spin; its middle position stops on the randomly selected symbol. Stopping early reveals the same result before continuing. Retriggers retain it. A dashboard above the game reels displays the selected symbol, remaining free spins, and accumulated bonus winnings.
- Free-spin expansion first reveals the qualifying reels in a staggered sequence from the symbol's original row, then settles credits and highlights winning symbols. The spin lock covers the complete sequence. Animations, autospin scheduling, and the bonus introduction timer are cancelled on destruction. Core reel motion remains visible with reduced-motion preferences; decorative effects are disabled and expansion uses a short fade.
- `reel-motion.ts` shares percentage-based, accelerating and decelerating strip animation between the game and bonus selection. Normal, Fast, and Turbo change the next spin's duration. Percentage translations and container-sized rows keep the three visible symbols aligned when the game changes size.
- Once two Ivoris scatters have landed and at least one reel is still moving, anticipation highlights the pending reels and focuses the next one to stop. Pending strips receive an additional full turn while preserving their current visible position, then stop slowly in order at speed-dependent intervals. Moving symbols and the previous grid do not count toward anticipation; a second scatter on the final reel does not start it.
- From the third landed scatter, visible scatter icons glow and rotate forward and backward together. Newly landed icons join a restarted celebration. After the final reel, the complete celebration must finish before payout, free-spin selection/retrigger dialogs, and autospin scheduling proceed. Reduced-motion preferences replace the icon rotation with a short fade and disable the pulsing focus overlay. Pending reel and celebration animations are cancelled on navigation.
- Autospin offers 10, 25, 50, 100, 250, or 500 paid spins. Bonus spins are additional and retain the paid-spin count. Selection and retrigger dialogs pause scheduling until confirmed; stopping also works inside the dialog. Stopping finishes the current spin; completion or insufficient credits stops scheduling. Manual spin, bet, credit reset, and count controls are locked during autospin.
- The game container uses the browser Fullscreen API. A flexible cabinet fills the available viewport with proportional reel rows and symbols, including compact landscape controls. Fullscreen keeps controls and bonus dialogs inside the game, tracks native fullscreen changes (including Escape), and displays a recoverable error when access is denied. It does not change browser permissions or restart services.
- `public/gamba/ivoris-icon.svg` is the user-supplied program icon, copied unchanged. `public/gamba/symbols.svg` contains custom book and Egyptian-style vector symbols. Assets are local; the game does not request third-party images at runtime.
- Pure engine tests run through the existing Playwright runner in `tests/gamba-engine.spec.ts`; browser scenarios live in `tests/gamba.spec.ts`. No Karma/Jasmine repair or dependency change was required.

### Book of CK verification (2026-11-10)

- Development and production builds passed after the fullscreen and expanded bonus animation additions. Production initial bundle: 437.43 kB; lazy game chunk: 39.40 kB. The base game stylesheet emits a 4 kB warning at 7.78 kB, below the 8 kB error budget; new effects and fullscreen styles are colocated in `gamba-effects.css`. Budgets were not changed.
- All 36 cases passed across the latest Chromium run and a targeted rerun: five pure engine cases, seven game browser cases, and 24 existing book-detail/theme/shell regression cases. The combined run passed 35 cases; the expansion test initially expected three qualifying reels although its deterministic grid contained four. After correcting that expectation, the complete free-spin scenario passed. Coverage includes desktop/mobile dialog centering, manually started selection-reel motion, staggered expansion with locked controls before payout, paid-spin locking, Space/repeat handling, reset, retriggering and exhausting 19 free spins without debits, local assets, mobile overflow, actual fullscreen entry/exit with a bonus dialog, and denied fullscreen access.
- The existing development server was reused. VS Code Debug MCP reported the unrelated `ivoris` workspace; no existing service was restarted. An initial sandboxed test attempt could not reach the server and was stopped; browser tests ran with local network access. No screenshots were created. Firefox/WebKit and Karma were not run.
- Formatting and whitespace checks passed. The supplied icon and its local copy have identical SHA-256 hashes.

### Playback and viewport follow-up (2026-11-10)

- Development and production builds passed. Production initial bundle: 437.88 kB; lazy game chunk: 46.48 kB. The existing base stylesheet warning remains 7.78 kB against the 4 kB warning budget, below the 8 kB error limit.
- All 46 distinct Chromium cases passed across the game run, targeted follow-up runs, and the 29-case engine/application regression run. The 17 game scenarios now sample actual elapsed reel movement without seeking animations, including bonus selection and reduced-motion preferences. They cover three speed timings; all six autospin choices; exact paid-spin accounting; manual-control locks; stopping mid-spin and inside bonus selection; resuming through additional free spins; and stopping on insufficient credits.
- Fullscreen geometry checks passed at 1920 x 1080, 1280 x 720, 390 x 844, and 844 x 390: the cabinet fills the viewport, three rows remain proportionate, moving rows match settled rows, and playback controls remain inside the viewport both before and during the bonus. The first four geometry checks reached their moving-row assertion before Angular rendered the strip; after adding an explicit render wait, all four passed. No production change was needed for that test timing issue.
- Existing services were reused; no service restart, screenshot, dependency change, or browser configuration change was required. Firefox/WebKit and Karma remain untested.

### Anticipation and scatter celebration follow-up (2026-11-10)

- Development and production builds passed. Production initial bundle: 438.34 kB; lazy game chunk: 50.05 kB. The existing 7.78 kB base stylesheet warning remains below the 8 kB error budget.
- All 51 distinct Chromium cases passed across the combined run and two targeted reruns: 22 game scenarios, five engine cases, and 24 book-detail/theme/shell regressions. Five added scenarios cover sequential pending-reel focus and actual slower rolling, no anticipation when the second scatter lands on the final reel, immediate celebration at the third scatter, synchronized forward/backward icon motion and highlighting before the dialog, autospin locking through celebration, and navigation cleanup.
- The combined run passed 49 cases. A final rotation-direction adjustment during that run caused HMR to reset the long free-spin scenario and left the running worker with its previous keyframe assertion. Both affected cases passed when rerun against the unchanged final code, including retriggering and exhausting the free spins. Game assertions allow the intentionally extended anticipation and celebration sequence.
- Formatting and whitespace checks passed. The existing local development server was reused; the VS Code Debug MCP still reported the unrelated `ivoris` workspace. No services, browser configuration, dependencies, or payout rules were changed. No screenshots were taken; Firefox/WebKit and Karma were not run.

### Workshop remediation checks (2026-11-11)

The explicitly authorized unit-test repair adds the missing Karma/Jasmine development
packages for the existing Angular 20 builder and four HTTP contract tests in
`src/app/books/book-api-client.service.spec.ts`. Headless Chrome passed all four;
a temporarily incorrect expected page size produced the expected failing assertion
and was restored. This supersedes the historical missing-runner finding below
without changing its dated evidence. Automation guards passed 37 tests, and the
existing browser suite passed 21 cases. Development and production builds passed.

`repository-validation.yml` adds deterministic, secret-free PR validation. The
implementation verifier also runs unit tests. Both preparation and publication
require the maintainer-controlled `implementation-approved` label in addition to
readiness; analysis cannot authorize implementation. Workflows pin verified action
commits and Ubuntu 24.04. These changes remain pending until their new PR is merged.

GitHub validation passed for PR #11 in run `43086376012`. Live testing of the
previously merged workflows exposed two infrastructure failures: PR review
generated a report but its publisher received HTTP 403 with issue write / PR read
permissions (run `43086372112`); issue #12 implementation stopped before Codex
because Playwright 1.55 cannot install Chromium on the Ubuntu 26.04 runner selected
by `ubuntu-latest` (run `43087080538`). PR #11 corrects the publisher scope and pins
Ubuntu 24.04. Neither end-to-end publishing nor automatic implementation is
verified until those corrections reach `main` and the live runs succeed.

### Branch integration verification (2026-11-12)

- Integrated the Angular modernization and workshop documentation into Book of CK. Route resolution preserves lazy-loaded book pages and the game before the wildcard route.
- Development and production builds passed, as did all six Angular unit tests, 61 automation checks, and the complete 51-case Chromium engine/application suite. Production initial bundle: 382.12 kB; lazy game chunk: 50.04 kB. The existing 7.78 kB game stylesheet warning remains below the unchanged 8 kB error budget.
- The initial browser run passed 50 cases and missed one transient anticipation focus state. Three isolated repeats confirmed the polling issue. Sampling the same class assertions every 50 ms passed three targeted repeats and the full 51-case rerun; production animation behavior was unchanged.
- Whitespace checks and formatting with the checkout's existing line endings passed. Existing services were reused. No screenshots were taken; Firefox and WebKit were not run.
- GitHub repository validation passed for the modernization and documentation pull requests. Automated Codex review remains blocked by an invalidated `OPENAI_API_KEY` repository secret (HTTP 401); a maintainer must replace that secret before review can run successfully.

## Angular 21 upgrade (2026-11-13)

The official framework/CLI and Material migrations ran on baseline `b416a65`.
Their installed migrations needed no source transformations; the existing
application builder, block control flow and compiler settings were already
compatible. Resolved versions are Angular 21.2.26, CLI/build/SSR 21.2.30 and
Material/CDK 21.2.14. All existing companion libraries are retained and updated
compatibly, including currently unused NgRx, query and server packages.

Application bootstrap uses Angular 21's default zoneless scheduling. Zone.js,
its test support and all polyfills have been removed. Header listeners no longer
need NgZone wrapping. Theme, reading-list and game callbacks already write signals;
their browser-event, HTTP, timer and animation-completion behavior now has
representative zoneless unit coverage. Native Web Animations, RxJS cancellation,
routes, payload identity and localStorage formats remain unchanged. No legacy
Angular animation bindings were found; the existing `provideAnimations()` and
animations dependency remain intentionally for library compatibility.

All application forms now use the explicitly requested experimental Angular 21
Signal Forms API. Create/edit use typed signal models, schema validation and
`FormField`; number inputs retain nullable numeric values, dates remain optional
text, and textarea co-authors are mapped to transport arrays. Required/minimum
metadata comes from the schema. Whitespace and integer validators preserve the
existing contract. Native submit handlers prevent navigation, mark validated
fields touched individually and guard concurrent requests. Schema disabling
tracks saving state; server errors preserve entered values. Edit resets both
model and form state when the route changes. Search uses a Signal Forms field,
retains the 300 ms debounce and immediate clear, and derives total pages with
`computed` while preserving request cancellation and applied-query pagination.

The unit builder is `@angular/build:unit-test`, using Vitest/browser-webdriverio
4.1.12 and WebdriverIO 10.2.0 in headless Chrome at 1920 × 1080. Node engines are
`^22.23.4 || ^24.22.1`, reflecting the stricter browser-provider requirement.
The reviewed official Jasmine migration is supplemented by async stabilization,
partial fake timers for debounce and isolated/restored spies. Automatic failure
screenshots are disabled. Existing Playwright application scenarios remain a
separate acceptance layer and were not executed for this upgrade.

### Upgrade verification and limitations

- Baseline and post-migration gates each passed 78 original tests and both builds.
  The final suite passes 103 tests in 11 files, including the previous coverage,
  five pure game-engine cases and additional zoneless callback regressions.
  Assertions use normal Angular stability after external work completes rather
  than repeated forced rendering. The final automation guard suite passes 61 tests.
- A separate ignored copy of current sources passed `npm ci`, all 103 unit tests
  and both builds in sequence. This avoids native module locks from an independently
  running development server, which was not stopped. The working tree also passed
  all 103 tests. No additional application server was started.
- Production initial bundle is 369.41 kB; the lazy game chunk is 49.91 kB. Existing
  game CSS remains 7.78 kB against the unchanged 4 kB warning / 8 kB error budgets.
  Production builds still require Google Fonts network access. Dependency and
  bundle scans find no installed Zone.js or its runtime markers.
- CI workflows, automation instructions, README and the tracked Red/Green skill
  runner pointers use the verified `npm test -- --watch=false` command. Scoped
  formatting, both skill validators and whitespace checks pass. Live GitHub CI and
  the previously invalidated API secret were not rechecked; `gh` is unavailable.
- Compatible patch updates remove high/critical audit findings. Nineteen moderate
  transitive CLI glob/minimatch findings remain; the proposed CLI 22 remedy exceeds
  the Angular 21 target. Signal Forms remain experimental by explicit decision.
- No interactive browser or Playwright execution was authorized. Visual drag,
  responsive layout and complete game acceptance remain user-owned, with the
  checklist in [ANGULAR21-UPGRADE-PLAN.md](ANGULAR21-UPGRADE-PLAN.md). Three initial
  automatic Vitest failure captures were removed before disabling that feature.
  No screenshots are retained. Verification completed before the user separately
  authorized commit, push and PR creation; merge requires separate authorization.

## Playwright acceptance conventions (2026-11-13)

`tests/AGENTS.md` scopes acceptance-test rules to the existing test directory:
semantic locators, deterministic API interception, isolated state, observable
outcomes, and feature-specific scenarios. The ten scenarios in
`tests/book-list.spec.ts` cover first-page rendering, ISBN links, pagination and
loading locks, search debounce and page reset, clearing search by both input and
button, empty collection/results, and retry after HTTP, network, or pagination
header failures. The edit suite now mocks editorial recommendations separately
and excludes that query from its collection-independence assertion.

`npm run test:e2e` uses the existing recursive application-spec discovery and
serial Chromium runner; the external website example remains excluded. The
runner now respects the configured console and HTML reporters instead of
overriding them. Desktop projects use a 1920 × 1080 viewport; individual mobile
scenarios can still override it. Screenshots are disabled. HTML reports remain
local ignored artifacts, with automatic opening disabled. Repository validation
and implementation verification upload them even after test failure, unless
the workflow is cancelled, retaining them for seven days. These changes add no
application behavior or dependencies. Book-creation and reading-list acceptance
journeys remain outside this first implementation step.

Verification: the complete Chromium application run passed 82 of 83 cases; its
only failure exposed the edit suite's recommendation-query counting issue
described above. After correcting that fixture, all 26 book-list and book-edit
cases passed, covering the previously failing case and all ten new scenarios.
The 61 automation guards, scoped TypeScript check, formatting, and whitespace
checks passed. The local HTML report was generated successfully. Live CI artifact
upload, Firefox, WebKit, and standalone production builds were not exercised.

### Headed execution and game-test scope (2026-11-13)

The application runner now forwards arguments following npm's `--` separator.
`npm run test:e2e:headed` is the direct visible-browser alias. Headed execution
requires full Chromium; installing only the headless shell does not supply it.
The runner translates inherited `NO_COLOR` into `FORCE_COLOR=0` for its child
process so Playwright's color defaults cannot produce conflicting-variable
warnings. A runner regression test verifies forwarded arguments and environment.

Five pure slot-engine cases were removed from Playwright because the same
assertions already exist in `src/app/gamba/slot-engine.spec.ts`. The scatter UI
journey now verifies the award, retrigger, preserved symbol, expansion, and free
bet accounting using one representative subsequent spin instead of replaying
all nineteen. Bonus completion and restored controls remain covered by the
autospin bonus journey. Three outcome-only autospin tests use a page-local native
animation playback rate of 20; real motion tests retain original timing.
Dialog-centering assertions use the document's available client dimensions,
excluding Windows headed-browser scrollbars, while retaining their pixel
tolerance. No production code or game timings were changed.

The Angular unit suite uses its existing WebdriverIO headless Chrome provider;
neither its configuration nor application dependencies changed in this task.
Native Chrome USB-descriptor errors and TensorFlow Lite/XNNPACK initialization
messages are browser-process diagnostics, not application test assertions.

Final verification: all 78 Chromium application cases passed headless in
172.9 seconds with no retries, skips, or flaky results. The shortened scatter
journey took 16.3 seconds; the three accelerated autospin cases took 2.3, 5.7,
and 2.3 seconds. In the headed run, the two scrollbar-sensitive assertions
failed before correction and one existing hover-reveal case failed once; all
three passed in a targeted headed rerun (31 seconds). The hover test required
no code change and also passed in the final headless run. All 106 Angular unit
tests and 62 automation guards passed. Scoped TypeScript, formatting, and
whitespace checks passed; HTML and local JSON reports were generated without
screenshots. No Playwright browser processes remained after completion. Live CI
upload, Firefox, WebKit, and standalone production builds remain unverified.
