# Vibe Coding - Feature Delivery checklist

Source: [Workshop task 1570](https://workshops.de/classroom/9007582545/tasks/1570)

Use the prepared Skills for delivery, review each result, and refine the Skills when an iteration reveals improvements. Completion here means locally implemented and automatically verified. The user explicitly owns interactive browser acceptance; no Playwright runs or screenshots are required for this delivery. Checked items do not claim manual acceptance or completion in the external classroom.

## 1. Book editing

- [x] Add a form for editing an existing book.
- [x] Review the result and verify the editing flow.
- [x] Review the Skills used and refine them if needed.

Status (2026-11-13): implemented locally on `feature/workshop-feature-delivery`.
All 21 Angular unit tests and both builds pass. The scoped code/Skill review
found no additional refactor or Skill change necessary. At the user's request,
UI browser validation is left to the user; feature and detail/theme/shell browser
checks remain unverified against the finished implementation. The agreed local
completion condition is met. See `ARCHITECTURE.md` for API limitations.

## 2. Book creation

- [x] Add a form for creating a new book.
- [x] Review the result and verify the creation flow.
- [x] Review the Skills used and refine them if needed.

## 3. Book list pagination

- [x] Add pagination to the book list.
- [x] Review the result and verify navigation between pages.
- [x] Review the Skills used and refine them if needed.

## 4. Reading list kanban board

- [x] Add a reading list kanban board with the states `want to read`, `currently reading`, and `read`.
- [x] Persist the board state in local storage.
- [x] Use `@angular/cdk` drag and drop to move book cards between the board's lists.
- [x] Review the result and verify moving cards and restoring the board state after a reload.
- [x] Review the Skills used and refine them if needed.

Status for tasks 2–4 (2026-11-13): implemented and integrated locally by three
parallel `gpt-6-luna` agents with central verification. All 78 Angular unit tests
(including task 1), development build, and production build pass after Blue.
Tests exercise forms, HTTP contracts, router integration, page/search sequencing,
CDK drop handlers, whole-card drag configuration, and store recreation from local
storage. This does not claim real pointer dragging, browser reload acceptance,
or a persisted POST against the live API. See `ARCHITECTURE.md` for the criterion
matrix, commands, and limits. The workflow Skill now covers optional parallel
slices and coordinated verification; scoped code/Skill reviews are recorded.

The user's follow-up revised the board presentation and K3: status changes use
drag and drop on the entire card, without a selector or separate handle. Cover
thumbnails, column counts, and drop feedback replace the original plain layout.
The 74-test result and both builds include this revision and the correction
that hides an empty column's message while a drag placeholder is present; visual acceptance
remains with the user.

The detail actions now share a responsive button row with icons and Material
tooltips. Navigation and tooltip rendering are covered by the unit suite;
both builds pass, with the existing game stylesheet budget warning unchanged.

A further follow-up styles tooltips through semantic Material overrides and
allows removing membership with the same detail button. Removal is persisted,
normalizes remaining order, and cancels pending metadata refreshes. All 78 unit
tests and both builds pass; visual acceptance remains with the user.

## Workshop completion

- [x] Confirm that all four features have been completed and reviewed.
- [ ] Mark the task as completed in the workshop classroom.
