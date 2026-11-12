---
name: j-feature-delivery
description: Coordinate a complete feature workflow from a requirements interview through GitHub issues, TDD Red and Green, Blue refactoring, and finalisation using the existing phase skills. Use to start or resume the whole workflow, not for a single phase or a request to edit skills.
---

# Feature Delivery

Guide the user from an idea to verified delivery. Coordinate the existing phase skills in this conversation; read each linked skill when entering its phase. Creating, reviewing, or explaining this skill does not start the workflow.

## Start or resume

- Use the idea and decisions already supplied. If no idea is available, ask what the user wants to plan or implement, then wait for their answer.
- For an ongoing feature, use [context-recovery](../context-recovery/SKILL.md) when context is missing. Reconcile the handoff with the current source, working tree, and verified issue before choosing the next phase. Do not restart a completed interview or repeat an uncertain external write without checking its result.
- Inspect applicable repository instructions and Git status. Preserve unrelated work and use the repository's task-branch rules before edits.

## Define the delivery plan

Use [requirements-interviewer](../requirements-interviewer/SKILL.md) to clarify behavior step by step. Show the concrete requirement for confirmation; leave material product decisions open until answered.

Before proceeding, make the following clear in the proposed plan:

- The user story, scope, stable acceptance-criterion identifiers, and verification approach.
- One issue for a coherent feature, or several independently testable slices when the scope warrants them. For multiple issues, show their concrete drafts, dependencies, and execution order before creation. Avoid splitting tests, implementation, and refactoring into disconnected feature issues.
- The verified target repository and any existing issue to reuse or explicitly amend.
- The delivery condition: locally verified, merged, or deployed, according to the user's request and repository instructions.
- Which actions are already authorized and which need a decision, including issue creation, implementation with Red/Green/Blue, finalisation updates and closure, and publication through commits or pull requests.

Honor authorization already given. Ask only for missing decisions after preparing the concrete plan or action. Requirement confirmation alone does not authorize external writes. Once the complete workflow and plan are authorized, continue through its phases without requesting the same permission at every handoff. Preserve any separate repository requirement for approving a completed PR proposal or merge.

## Create or reuse issues

Use the interviewer's issue-creation procedure for approved drafts. Preserve acceptance identifiers in the issue and read back every created or amended issue. Retain its URL and number; check for an existing result before retrying an ambiguous write.

If GitHub access is blocked, retain the concrete drafts and report the limitation. Continue local work only if authorized and compatible with the agreed plan; leave issue creation and external traceability pending.

When repository automation analyzes the issue, inspect the available report and run status. Treat its findings as suggestions to reconcile with the agreed scope, not new requirements or permission to implement. Resolve material gaps before dependent implementation. Report a missing or pending run honestly; do not repeatedly edit or comment merely to trigger automation.

## Execute each slice

Follow dependency order. For each approved slice, carry the same requirement, criterion identifiers, issue reference, and current evidence through these phases:

| Phase | Skill | Required handoff |
| --- | --- | --- |
| Red | [developer-red](../developer-red/SKILL.md) | Criteria mapped to tests, actual behavioral failures, already-satisfied cases, and blockers. |
| Green | [developer-green](../developer-green/SKILL.md) | Agreed behavior passes focused tests and applicable regressions/checks; test corrections are explained. |
| Blue | [developer-blue](../developer-blue/SKILL.md) | Scoped refactoring preserves verified behavior, or a justified no-change result. |
| Finalisation | [requirements-finalisation](../requirements-finalisation/SKILL.md) | Acceptance matrix, final verification, delivery evidence, and confirmed issue state. |

Return from each phase to this workflow. Their standalone stopping boundaries do not require ending an already authorized overall workflow.

- A test that already passes is valid evidence; do not force Red or invent production changes. Green may verify that no implementation is needed before Blue.
- Compilation errors, broken fixtures, or unavailable runners do not prove behavioral Red. Resolve authorized test defects or report the blocker before dependent Green work. Do not claim a phase passed while required evidence is missing.
- Keep Blue in this complete workflow, while allowing its justified no-change outcome. Do not create refactoring work merely to satisfy the sequence.
- If a requirement changes materially, settle the changed contract and update the affected tests before implementing it. Return failed behavior to Green, or incorrect/missing coverage to Red, within the authorized scope.

## Finalise and deliver

Use finalisation to verify all agreed criteria and prepare the delivery note. Complete any required, authorized commit, PR, merge, or deployment steps under repository rules before declaring that delivery condition met or closing the issue. A prepared PR is not a merge; local checks are not CI results or deployment evidence.

Keep incomplete issues open. For multiple slices, report each slice separately; one successful slice does not complete blocked dependents or the whole feature. After external writes, verify the saved state before reporting success.

Maintain a compact handoff in the conversation: requirement and issue links, criterion-to-test mapping, branch and tested revision or working-tree scope, current phase, actual commands/results, blockers, existing authorization, and next step. Do not introduce a tracking file unless requested.

Finish with verified outcomes, actual checks, delivery links, and remaining actions. This skill coordinates Codex work; it does not install or imply a GitHub Actions pipeline for every phase.
