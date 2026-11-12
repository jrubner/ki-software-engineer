---
name: context-recovery
description: Recover the active requirement or issue for this repository when its context or identifier is missing, or when tests, implementation, or refactoring need to reconnect with the agreed scope. Do not use to invent new requirements or start implementation.
---

# Context Recovery

Recover enough authoritative context to answer what should be implemented and hand it back to the current task or calling skill. Keep this operation read-only.

## Recover the requirement

1. Start with the active conversation and any handoff summary. Preserve the original objective, later user corrections, agreed acceptance criteria, decisions, and existing authorization. Distinguish the current task from workshop examples and earlier completed tasks. Do not claim access to conversations that are not available.
2. Confirm the repository and current branch. Inspect Git status and the relevant diff without changing them. Use branch names, recent commits, and remote metadata only as clues to the requirement, never as proof of an issue identifier or acceptance criteria.
3. Follow an explicit issue, work-item, pull-request, or requirements-document reference already associated with the task. Read it through an available connector or authenticated CLI; use the user's established browser connection if needed. Check that its repository or project matches this workspace. Include relevant decisions in comments or linked specifications when necessary to understand the agreed scope.
4. If the reference is missing, search narrowly using concrete clues from the conversation and repository. Inspect relevant repository documentation or connected issue metadata before asking the user for information already available there. Do not pick the first open issue or infer a ticket number from unrelated digits.
5. Separate requirements from implementation evidence. Existing code, tests, and documentation can explain current behavior, but do not automatically define requested behavior. Reconcile external requirements with explicit user decisions in this conversation; surface unresolved conflicts instead of silently choosing a different scope.
6. Stop once the objective, acceptance criteria, constraints, and next step are sufficiently clear. If multiple tasks remain plausible or a source is inaccessible, state the candidates or access limitation and ask one focused question for the missing reference or decision. Continue independent work only when it does not rely on that uncertainty.

## Return a compact handoff

Use the conversation's language. Include only relevant information:

- **Requirement:** the requested outcome and any verified issue or work-item identifier. A clear chat request is sufficient even when no external issue exists.
- **Sources:** links or repository paths actually read; distinguish current source reads from retained conversation context.
- **Acceptance criteria:** observable outcomes explicitly agreed in the sources. Label any proposed criteria as suggestions.
- **Scope and constraints:** included and excluded work, user decisions, and applicable repository instructions.
- **Current state:** completed work, actual verification results, and remaining work. Do not report historical test results as current checks.
- **Open points and next step:** unresolved facts and the smallest useful continuation within the authorized task.

Return this context to the calling workflow. When invoked on its own, provide the handoff to the user. Recovery does not authorize code edits, issue updates, commits, or other external writes, and must not create a context file unless requested.
