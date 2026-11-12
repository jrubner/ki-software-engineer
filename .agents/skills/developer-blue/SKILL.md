---
name: developer-blue
description: Refactor Angular components after a verified Green phase while preserving behavior and passing tests. Apply repository conventions, SOLID principles, consistent abstraction levels, and reactive composition to the agreed scope. Use for an explicitly requested Refactor step, review, or agreed refactoring plan; not for feature implementation.
---

# Developer Blue: Angular Refactoring

Complete the Refactor step of Red-Green-Refactor. Improve concrete maintenance problems in the agreed Angular implementation while preserving its observable behavior. Creating, editing, or explaining this skill does not start a refactoring review or authorize application changes.

## Establish scope and a Green baseline

- Use the Green handoff, agreed requirement, and current user request to identify the affected feature. Recover missing context through [context-recovery](../context-recovery/SKILL.md); do not choose an unrelated feature or treat every open finding as authorized work.
- Read the applicable `AGENTS.md` files, `ARCHITECTURE.md`, `REFACTORING.md`, Git status, the affected diff, and relevant source and tests. Verify documentation against current code. Preserve existing work and follow the user's current branch instructions.
- Follow the root repository's explicitly invoked refactoring workflow. A review-only request authorizes findings, not implementation. A request to perform this Refactor step authorizes scoped, behavior-preserving improvements without another routine approval round.
- Run the focused feature tests to establish the current baseline. A historical Green report is not a current result. If feature behavior is failing, distinguish an infrastructure or baseline problem from a missing implementation; return feature work to [developer-green](../developer-green/SKILL.md) when authorized rather than hiding it inside refactoring. Report unrelated failures separately.
- Record concrete findings in `REFACTORING.md` with source locations, evidence, maintenance impact, intended pattern, scope, and verification. Preserve prior findings and dated evidence; distinguish confirmed defects, untested risks, and intentional tradeoffs. Do not invent changes merely to populate the review.

## Refactor according to project conventions

Choose the smallest transformation that resolves a recorded issue. Keep orchestration at a consistent abstraction level: a method should explain a workflow or perform a focused detail, rather than interleave both throughout a large block. Extract meaningful operations and responsibilities, not wrappers that only rename a single expression.

### Angular boundaries

- Keep one Angular component per file. Extract child components for a cohesive presentation responsibility, useful reuse, or a clearer interaction boundary; avoid fragmenting a readable view into trivial components.
- Preserve the standalone architecture, strict TypeScript, strict template checking, naming conventions, and `.prettierrc`. Keep short templates inline when useful; place substantial views in colocated HTML files.
- Keep HTTP transport in API services and presentation in components. Retain feature-specific loading, empty, success, not-found, and error states. Do not move expected errors into a global handler or duplicate notifications as a generic cleanup.
- When extracting components, preserve inputs, outputs, selectors, routing, accessible semantics, keyboard behavior, responsive layout, light/dark styling, and style encapsulation. Moving markup can change scoped CSS and dependency-injection ownership; verify those boundaries rather than assuming extraction is visually neutral.
- Preserve initialization order, subscription timing, and destruction cleanup. Constructor setup is not inherently a defect: distinguish composing a lazy Observable from starting an eager side effect. Moving the same initialization to a lifecycle hook is not automatically an improvement.

### SOLID as a decision aid

- **Single responsibility:** separate concerns that change for different reasons, such as transport, domain calculations, and view orchestration, when their coupling creates a concrete maintenance problem.
- **Open/closed:** use existing extension points or a small focused strategy when real variation exists. Do not introduce a registry or plugin system for hypothetical future variants.
- **Liskov substitution:** preserve the behavioral contracts of services, components, and any existing subtypes, including errors and side effects.
- **Interface segregation:** expose the smallest useful inputs, outputs, or service contracts; do not force consumers to depend on unrelated operations.
- **Dependency inversion:** depend on appropriate Angular-injected collaborators at real boundaries. Add an interface or injection token only when multiple implementations, ownership, or test isolation actually justify it; do not add layers solely to demonstrate SOLID.

### Reactive composition and lifecycle

- Prefer a composed stream over nested subscriptions or scattered synchronization when an asynchronous workflow benefits from it. Derive state instead of maintaining redundant copies, using the project's existing RxJS or signal patterns where appropriate.
- Choose flattening operators by the existing contract. `switchMap` suits replaceable reads; it can incorrectly cancel writes. Preserve required ordering, concurrency, debounce timing, loading transitions, and error recovery. Keep request-local error handling inside a replaceable stream when later inputs must remain usable.
- Let `AsyncPipe`, `takeUntilDestroyed`, or explicit cleanup own subscriptions, event listeners, timers, and animations. Preserve cleanup for non-Observable effects as well.
- Do not convert working imperative code, Observables, or signals merely for uniformity. A change to cancellation, request count, caching, or timing may alter behavior: if it does, treat it as a separate requirement unless explicitly included in the authorized scope.

## Keep behavior and tests stable

Apply changes in small coherent increments and rerun affected tests after meaningful transformations. Preserve public contracts and acceptance assertions. Internal test setup may need adjustment after an authorized extraction, but do not weaken assertions, remove coverage, skip failures, or change expected behavior to accommodate the refactor.

Add focused characterization coverage only when needed to protect an otherwise unverified behavior affected by a meaningful change. Do not write tests that merely mirror private structure or require a particular extraction. For a pure template move, an equivalence check and existing behavior coverage may be sufficient.

If inspection reveals a product bug or a deferred issue outside scope, record it and leave it for an authorized follow-up. Do not silently turn behavior-preserving cleanup into a feature change, dependency migration, or test-infrastructure repair.

## Verify and hand off

- Follow current repository verification and service-control instructions. Reuse a suitable development server after checking workspace ownership and service state; do not restart unrelated services.
- Run the affected feature tests, applicable regression suites, and required builds or static checks. Inspect current configuration before choosing commands. Report blocked checks and unrelated failures separately; historical Karma limitations or network-dependent font builds are not proof of a current code failure.
- Inspect the final diff, check formatting, and run `git diff --check`. Update finding statuses in `REFACTORING.md` and architectural facts in `ARCHITECTURE.md` while preserving dated historical evidence. Follow repository screenshot rules; do not create images for an unchanged UI merely as process evidence.
- Report the concrete improvements, changed files, preserved contracts, exact verification commands and actual results, and any deferred findings or limitations. A justified no-change result is valid when the implementation already meets the relevant conventions.

Stop this phase after the scoped Refactor handoff. When called from an explicitly authorized overall workflow, return control to that workflow so it can continue within its existing authorization. Blue alone does not automatically begin another Red-Green cycle, update external issues, commit, push, or create or merge a pull request. Follow repository instructions and the user's explicit authorization for those actions.
