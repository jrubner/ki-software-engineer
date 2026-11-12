# Source instructions

- Preserve the standalone Angular architecture, strict TypeScript, and strict template checking. Use installed Angular/RxJS features without adding state libraries or production dependencies for routine changes.
- Follow `.prettierrc`. Keep short templates inline when useful; use a colocated HTML template for substantial multi-section views. Template extraction must preserve bindings, semantics, text, and styling.
- Keep HTTP transport in API services and presentation in components. Use explicit view states when loading and errors matter to the user. Do not hide expected feature-specific errors behind a global handler or duplicate notifications.
- Sequence replaceable requests with RxJS cancellation and keep errors inside the request stream when future inputs must continue working. Use `AsyncPipe`, `takeUntilDestroyed`, or explicit destruction cleanup for subscriptions/listeners/timers.
- Constructor setup is not automatically a defect. Distinguish composing a lazy Observable from starting a request. Keep necessary initialization and lifecycle cleanup explicit; avoid moving side effects without improving ownership or correctness.
- Use semantic tokens and shared classes from `styles.css`, including focus, status, and error styling. Preserve light/dark behavior, responsive layout, accessible names, and native keyboard interaction.
- The synchronous `public/theme.js` initializer and `ThemeService` operate at different lifecycle stages. Preserve the pre-bootstrap theme application, system default when no override is stored, persistent Light/Dark toggle, storage fallback, cross-tab synchronization, and listener cleanup. Do not expose a manual System choice. If theme resolution changes, check both implementations and `tests/theme.spec.ts` together.
- These are standing coding constraints, not an instruction to start refactoring automatically. The opt-in workflow is defined in the root `AGENTS.md`.
