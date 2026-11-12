# Refactoring review

## Authorization and baseline

The user explicitly requested implementation of the agreed workshop refactoring plan in chat on 2026-11-09. Loading `AGENTS.md` alone does not trigger this workflow. The reviewed baseline is commit `2ce2442`; the working tree was clean before this change. Review context: `ARCHITECTURE.md`, the book components and API client, theme bootstrap/service, and the existing Playwright suite.

The goal is clearer maintenance boundaries with unchanged UI and behavior. No new feature, search rewrite, global error handler, dependency, or component-paradigm migration is included.

## Findings and target patterns

| Finding and source                                                          | Evidence and maintenance impact                                                                                                                                                                                                                                                    | Target and disposition                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long inline view in `src/app/books/book-list.component.ts`                  | Search controls, loading UI, empty UI, and card layout share the same file as request/search logic, making either concern harder to scan and review. This is a readability issue, not a demonstrated runtime defect.                                                               | Extract the complete view to `book-list.component.html`; keep bindings, styles, text, imports, and class behavior unchanged. Implemented in this change; validation below.                                                                     |
| Long inline view in `src/app/books/book-detail.component.ts`                | Loading/error/success markup, cover rendering, and metadata obscure the small route-to-state pipeline.                                                                                                                                                                             | Extract the complete view to `book-detail.component.html`; keep state and request sequencing in the component. Implemented in this change; validation below.                                                                                   |
| Search timers and overlapping requests in `BookListComponent`               | `searchTimeout` is `any`; the timer lacks destruction cleanup; `clearSearch()` does not cancel a pending search; independently subscribed requests can finish out of order. The source establishes these mechanisms, but the failure scenarios were not reproduced in this review. | Deferred, outside the agreed refactoring. A separate task should preserve the 300 ms delay while sequencing requests and cleaning up timers/subscriptions, with timing/recovery tests. Do not silently fix this while extracting the template. |
| Theme resolution in `public/theme.js` and `src/app/shared/theme.service.ts` | Both read the same storage key and resolve system preference. Changes can drift, but the early script runs before Angular so the correct palette is available immediately.                                                                                                         | Intentional duplication at a lifecycle boundary. Retain both implementations and their existing pre-bootstrap/runtime regression tests. No shared build pipeline or configuration abstraction is justified here.                               |

## Reviewed patterns retained

- `BookDetailComponent` composes a lazy Observable in its constructor; it does not subscribe or issue an eager constructor HTTP request. `AsyncPipe` owns the subscription. `switchMap` cancels obsolete requests, and request-local `catchError` keeps later route changes usable. Retain this structure.
- `ThemeService` initializes browser state and registers system/storage listeners in its constructor. It already removes those listeners through `DestroyRef` and handles blocked storage. Moving the same initialization elsewhere would not by itself improve correctness.
- Expected detail failures belong to the detail view: HTTP 404 and other failures have different messages. A global interceptor/toast would risk hiding those distinctions or producing duplicate messages. Do not add global error handling merely because it is a workshop example.
- The card template is short enough to remain inline. Shared semantic CSS tokens already centralize the palette. Neither needs extra components or generic abstractions for this task.

## Verification and review

- Passed: exact extraction comparison before formatting, followed by equivalent Angular-formatted template comparison against commit `2ce2442` and verification that only the template declarations changed in TypeScript.
- Passed: `node node_modules/@angular/cli/bin/ng.js build --configuration development`.
- Passed: `npm.cmd run build`, with network access for existing Google Fonts; initial bundle 408.91 kB, within configured budgets.
- Passed: `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts --project=chromium --workers=1 --reporter=line`: all 13 cases. The existing suite covers feature and theme behavior; no tests were added for a template-only extraction.
- Passed: formatting check and final diff/whitespace review. Only the intended templates, their declarations, instructions, and documentation changed.
- The running frontend was confirmed with HTTP 200 and reused. The first socket check was sandbox-blocked; repeating it with the required access succeeded. VS Code Debug MCP was unavailable; no service was started or stopped. Firefox/WebKit and Karma were not run.

No screenshot validation is requested. No commit or push is included in this task.

## Sequential workshop acceptance review (2026-11-09)

Following the user's explicit request to execute the task steps in order, the workshop text at `https://workshops.de/classroom/9007582545/tasks/1727` was reread and the existing implementation was checked sequentially:

1. **Project instructions:** checked the root `AGENTS.md` and its architecture reference, then the technical instructions under `src/` and the book-specific instructions. The opt-in refactoring workflow is present.
2. **Review generated code:** reread the list/detail components and extracted templates, API client, routes, and theme bootstrap/service. The recorded template maintenance issues are addressed. The search risks and intentional theme duplication remain accurately classified rather than presented as fixed.
3. **Document target patterns:** checked the findings, intended changes, retained patterns, and verification above against the code. A global error handler and constructor migration are examples from the workshop, not mandatory changes.
4. **Apply the refactoring:** confirmed that both components reference their extracted templates. Repeated comparison against baseline `2ce2442` verified equivalent Angular-formatted markup and unchanged TypeScript apart from `templateUrl`. No further source changes were necessary to complete the agreed refactoring.
5. **Review resulting changes:** inspected bindings, state handling, routing, and relevant test assertions. The previously executed development/production builds and 13 passing Chromium cases apply to this unchanged application code; they were not rerun for this documentation-only acceptance review.

All three technical workshop success criteria are satisfied. This records an agent review of the resulting changes; it does not claim that the participant has personally reviewed them or that the classroom page has been marked complete.

## Angular CLI MCP modernisation (2026-11-12)

The user authorised implementation of workshop task 1569 using Codex instead of
Cursor. The clean starting revision is `f41c449`. The installed Angular CLI MCP
server (20.2.0) successfully answered `initialize`, `tools/list`, `list_projects`,
and `get_best_practices`. Its guidance is applied to the existing Angular 20 app;
no framework upgrade, dependency migration, or product redesign is required.

| Source-confirmed finding | Target and scope | Verification |
| --- | --- | --- |
| List, detail, and card templates use structural directives and broad `CommonModule` imports. | Use built-in control flow, preserve DOM elements and track books by `id`, and import only required pipes/directives. | Existing detail, keyboard, empty/loading, shell, and theme browser cases; both builds. |
| List/card inputs use decorators; list rendering depends on mutable fields and default change detection. | Use signal inputs, signal-backed local state, and `OnPush` for all components; preserve page-size defaults, request timing, and view states. | HTTP unit contracts and application browser suite, including asynchronous detail/cover updates. |
| Services and book components use constructor parameter injection. | Prefer `inject()` while retaining the existing detail Observable composition and lifecycle ownership. | HTTP unit tests and route/error recovery browser cases. |
| Both feature routes are imported eagerly. | Load standalone list/detail components lazily without changing URLs or route order. | Direct URL, reload, wildcard, back, and parameter-change browser cases; production chunk output. |
| Redundant `standalone: true`, explicit inferable types, one `any` timer, and a stale card comment obscure current conventions. | Remove redundant declarations/comment and type the existing timer; preserve the separately deferred search lifecycle behavior. | Strict compilation, formatting, and final diff review. |

Already compliant: standalone architecture, strict checking, host bindings,
root-provided services, signal-based theme state, listener cleanup, escaped book
descriptions, and request-local detail errors. These remain intact. Book covers
are dynamic API URLs rather than static image assets; retain their existing
fallback behavior. The single search field keeps template-driven binding; a
reactive form abstraction would not improve this behavior-preserving migration.
Zoneless change detection and the previously deferred search cancellation/timer
cleanup are not part of this change.

Personal MCP configuration is backed up and configured outside the repository;
machine paths and MCP configuration are not committed. Codex needs to reload the
configuration before the new tools appear in its session; direct stdio MCP calls
provided the guidance used for this implementation.

All five findings above are implemented. Verification:

- The initial browser baseline had 20 passing cases and one click blocked by a
  stale Vite TS1005 overlay from the earlier intentional CI failure; source already
  contained the correct line. Recompiling that unchanged file produced a clean
  baseline: 21 Chromium cases and four Angular HTTP unit cases passed.
- `node node_modules/@angular/cli/bin/ng.js build --configuration development`
  and `npm.cmd run build` passed after implementation. The production initial
  bundle is 360.67 kB; separate list and detail chunks confirm lazy loading.
- `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless`
  passed all six cases, including two new list contracts covering a nondefault
  page size, asynchronous empty/loading rendering, the 300 ms search delay, and
  immediate clear. The test waits for Angular's asynchronous `ngModel` update;
  production behavior and assertions were preserved.
- `node node_modules/@playwright/test/cli.js test tests/book-detail.spec.ts tests/theme.spec.ts tests/shell.spec.ts --project=chromium --workers=1 --reporter=line`
  passed all 21 existing cases. A transient HMR overlay from the intermediate
  migration blocked the first attempt; recompiling the completed detail component
  cleared it before the successful full rerun.
- The existing development server was attributed to this repository by its
  process command line and reused. VS Code Debug MCP was connected to a different
  workspace (`ivoris`); it was not used to control this project's services.
  No application service was started, stopped, or restarted.
- `codex mcp get angular-cli` recognised the enabled stdio configuration, command,
  arguments, and workspace. Session-native tool discovery still needs a reload;
  actual MCP calls were tested directly. No API key or paid API request is needed
  for these local Angular MCP tools.
- Formatting and whitespace checks are recorded in the architecture update.
  No visible UI redesign or screenshot change is included. Firefox/WebKit were
  not run. Existing search lifecycle risks remain deferred as described above.

### MCP follow-up review (2026-11-12)

Repeated direct stdio MCP calls to `get_best_practices` and `list_projects`
succeeded. `search_documentation` also succeeded with network access after the
sandboxed request reported unreachable hosts, returning the official Angular
signals documentation. These tools supply guidance and project context; the
code review below compares that guidance with the actual diff.

The implementation follows the applicable recommendations for signal inputs,
local signal state, `OnPush`, built-in control flow, `inject()`, lazy feature
routes, strict typing, and standalone defaults. No new correctness regression
was identified in the reviewed changes. Remaining findings are pre-existing:

- **P2: Search request ordering.** `BookListComponent.loadBooks()` subscribes to
  each request independently. An older response can overwrite results for a
  newer query because there is no cancellation or response ordering guard.
- **P2: Search lifecycle cleanup.** `onSearchChange()` schedules a timer without
  destruction cleanup, and `clearSearch()` does not cancel a pending timer.
  Requests also lack destruction-bound cleanup. This permits redundant work
  after clearing the field or leaving the list. These mechanisms are confirmed
  by source inspection; their failure scenarios were not newly exercised.
- **P3: Intentional guidance exception.** The search template retains `ngModel`,
  whereas the MCP recommends preferring Reactive Forms. This is a documented
  choice for the existing single-field search, not a newly observed defect.

No application code changed during this follow-up review. The six unit tests,
21 Chromium cases, and both builds recorded above cover this same source state
and were not rerun for a documentation-only review update.
