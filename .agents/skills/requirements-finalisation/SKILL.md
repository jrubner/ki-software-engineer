---
name: requirements-finalisation
description: Verify an implemented feature against its agreed acceptance criteria, run tests and builds, record delivery evidence in its GitHub issue, and close the issue when completion is verified and authorized. Use at the end of the requirements workflow; not to define a new feature or start implementation.
---

# Requirements Finalisation

Finish an implemented requirement with evidence and traceability. Creating or editing this skill does not start finalisation or authorize a GitHub write.

## Recover the delivery contract

- Read the agreed user story, original acceptance criteria, and explicit later amendments. Use [context-recovery](../context-recovery/SKILL.md) if the active requirement or issue is missing. Resolve material contradictions with the user; do not derive acceptance criteria from whatever the implementation happens to do.
- Verify the repository, current branch, Git status, and affected diff. Read applicable repository instructions and the implementation/test handoffs. Preserve unrelated changes and follow current branch and service-control instructions.
- Read the associated GitHub issue, including relevant decisions in comments or linked specifications. Confirm its repository and identity using verified metadata; a branch name alone does not establish the target issue. Discover available GitHub tools or use an authenticated CLI.
- Establish what completion means for this requirement. Distinguish implemented, verified, merged, deployed, and accepted states; require merging or deployment only when the agreed workflow requires it. Do not claim delivery to an environment that was not checked.
- If there is no associated issue, continue local verification and report that external traceability and closure are unavailable. Do not create an issue or select an unrelated one to satisfy the workflow.

## Reconcile acceptance criteria with evidence

Build a compact acceptance matrix retaining the original criterion identifiers or wording:

| Criterion | Implementation evidence | Verification evidence | Result |
| --- | --- | --- | --- |
| Agreed observable outcome | Relevant source location or observed behavior | Test/scenario and actual result | Met / Unmet / Unverified |

Include every agreed criterion, including relevant error paths and boundaries. Separate explicit amendments from the original definition. Source code and passing tests are evidence, not substitutes for the agreed behavior. A mock only proves the behavior exercised by that mock; a green build alone proves no user-facing acceptance criterion.

Record missing behavior, missing coverage, and untested dependencies precisely. Do not change criteria, weaken assertions, skip tests, or mark unchecked behavior complete to make the matrix green. Finalisation does not itself start implementation or refactoring. If fixes are already authorized, complete only those scoped fixes through the applicable development workflow and repeat affected verification; otherwise return the concrete gaps for follow-up.

## Verify the final implementation

1. Inspect current test/build configuration and follow repository verification instructions. Check service state and workspace ownership before starting or stopping services; reuse a suitable server.
2. Run tests covering the agreed feature, relevant application regressions, and required development/production builds and static checks. Use actual application suites rather than external-site examples. Use browser checks when needed to verify observable criteria, following the user's browser and screenshot instructions.
3. Record exact commands, actual pass/fail results, warnings, and blocked or unexecuted checks. Separate product failures from unavailable services, missing credentials, network-dependent builds, and unrelated baseline failures. Historical successful checks are not current verification.
4. Inspect the final diff and run `git diff --check`. Update architectural documentation only when changed architectural facts require it. Tie evidence to the tested commit, branch, and relevant working-tree changes; do not attribute uncommitted changes to a commit that does not contain them.

Do not repair unrelated infrastructure or repeatedly rerun an unchanged blocked check. Missing or blocked evidence leaves the affected criterion unverified. Finish independent checks and report what is needed to complete verification.

## Update the GitHub issue and close the loop

Prepare a concrete delivery note containing the acceptance matrix, concise implementation summary, verification commands/results, remaining limitations, and available commit or pull-request links. State whether the tested work includes uncommitted changes. Do not invent links, upload raw logs containing private data, or represent local verification as a deployment.

Before writing, confirm that the user's current request authorizes the intended issue update and closure. An explicit request to run this finalisation workflow on the identified issue can provide that authorization; preserve authorization already given. A request only for local verification or for creating this skill does not. If authorization is missing, finish verification, present the prepared note and target issue, and ask for the missing issue action as the final step.

- Refresh the issue immediately before writing. Preserve original requirements, unrelated body text, labels, assignments, and other contributors' decisions. Incorporate new relevant decisions or resolve conflicts before proceeding.
- Add the delivery evidence using an issue comment or an established delivery section. Mark existing acceptance checkboxes complete only where the corresponding outcome is verified. Do not rewrite the original requirement to match the implementation.
- Close as completed only when every agreed criterion is met, all required checks passed, required delivery conditions are satisfied, and closure is authorized. Otherwise keep the issue open and record gaps or blockers when an update is authorized. Do not use closure as a substitute for verification or acceptance.
- Read back the issue after updates and after closure. Confirm the saved evidence and actual state. After a timeout or ambiguous response, inspect the issue and its recent activity before retrying; avoid duplicate delivery notes. If the same verified result is already recorded, do not post it again. Do not reopen an already closed issue automatically.
- If access or a write fails, preserve the prepared note, report which actions actually succeeded and which did not, and leave the unconfirmed action incomplete. Do not claim an issue was updated or closed without read-back evidence.

## Return the completion summary

Respond briefly in the conversation's language with:

- Requirement and verified issue link, when available.
- Acceptance outcome and any unmet or unverified criteria.
- Actual test/build results, warnings, and material limitations.
- Tested revision or working-tree scope and available delivery links.
- Confirmed issue state and external writes performed, or the precise remaining action.

Use a completed, incomplete, or blocked conclusion supported by the evidence. Do not call the requirement complete while a criterion or required check remains unresolved. Follow repository instructions and existing authorization for commits and pull requests; this skill does not independently authorize committing, pushing, merging, deploying, or starting another workflow.
