---
name: requirements-interviewer
description: Interview the user step by step to turn a rough feature idea or unclear requirement into a user story, Given/When/Then acceptance criteria, and technical notes, then offer to create a GitHub issue after the definition is agreed. Do not use merely to recover an already agreed requirement.
---

# Requirements Interviewer

Build a shared definition of success for a feature in this repository. Conduct the interview; do not implement the feature or write tests as part of it.

## Establish context

- Start with the user's idea and decisions already available in the conversation. If the active requirement or issue context is missing, use [context-recovery](../context-recovery/SKILL.md), then return to the interview.
- Read relevant repository instructions and inspect focused source or documentation when they can answer technical questions. Distinguish observed current behavior from desired behavior; do not ask the user to rediscover facts available in the repository.
- Do not require an issue number or invent a feature when none was supplied. If there is no idea to interview about, ask what feature or problem the user wants to explore.

## Interview step by step

Ask one focused question at a time, beginning with the unresolved decision that most affects the outcome. Use the available user-input mechanism and wait for the answer before moving to dependent questions. Do not treat silence, a suggested answer, or an unselected default as agreement.

Adapt the questions to the feature rather than following a fixed questionnaire. Clarify what is relevant:

- Who needs the feature, what problem they face, and what useful outcome they expect.
- The main interaction and observable result, including relevant starting conditions.
- Scope boundaries: what is included, what is excluded, and what must remain unchanged.
- Constraints such as permissions, data, compatibility, or performance when they materially affect the feature.
- Relevant invalid input, empty states, errors, and boundary cases needed for testable acceptance criteria.

Offer a few concrete choices when that makes a decision easier, but allow the user to describe another answer. Prefer repository conventions for routine technical choices; ask about product decisions and unresolved tradeoffs. Explain the consequence of a choice briefly when necessary.

Preserve earlier answers and later corrections. Do not repeat settled questions or add speculative features. If answers conflict, resolve the specific contradiction. Stop asking when the agreed behavior is sufficiently precise to write useful tests; do not prolong the interview to fill irrelevant categories.

## Produce the requirement

Return a concise requirement in the conversation's language. Follow an established repository document language or format if the user separately requests saving it.

Include:

1. **Title and user story:** As a specific user or role, I want a capability, so that I gain the agreed benefit.
2. **Scope:** Included behavior, explicit exclusions, and constraints that affect acceptance.
3. **Acceptance criteria:** Numbered scenarios using the literal labels **Given**, **When**, and **Then**. Describe a relevant precondition, one action or event, and an observable outcome. Cover the main success path and the edge or failure cases established in the interview. Avoid implementation details unless they are an explicit requirement.
4. **Technical notes:** Relevant existing code, interfaces, conventions, dependencies, and likely verification approach. Separate repository facts from implementation proposals and unverified assumptions.
5. **Open points:** Unresolved decisions, if any. If a material decision remains open, mark the requirement as a draft rather than presenting it as ready for implementation.

Check that every acceptance criterion follows from the user's answers or an explicit source, and that the scenarios can be verified without guessing the intended behavior. Summarize the resulting requirement and ask the user to confirm or correct it. If they choose to stop early, return the partial draft with its open points.

## Offer to create a GitHub issue

After the user has confirmed the complete requirement and all material decisions are resolved, use existing explicit authorization to create the issue, or ask for it if missing. Agreement on the requirement alone is not approval to publish it. If the user requests corrections, incorporate them and settle the definition before offering creation.

Before creation or asking for missing authorization, prepare a concrete issue title and body from the agreed user story, scope, acceptance criteria, and technical notes. Determine the target GitHub repository from verified repository metadata or the user's explicit destination. Show the destination and proposed content, or refer to the exact final definition already visible in the conversation. Do not guess the repository if the remotes are missing, ambiguous, or point to a different service.

- If creation is not already explicitly authorized, ask a direct question such as: "Should I create this agreed requirement as a GitHub issue in OWNER/REPO?" Wait for an explicit answer; if the user declines or has not answered, leave the requirement in chat and do not create an issue.
- On approval, use an available GitHub connector or authenticated CLI to create the issue in that repository using the agreed content. Follow applicable issue templates without adding unagreed requirements. Set labels, assignees, or project membership only when requested or required by an applicable repository workflow.
- If an issue was already linked as the active requirement, do not silently duplicate or update it. Use the explicitly requested issue action, or clarify it before writing if unclear.
- Read back the created issue and return its URL and number for subsequent skills. If a write times out or has an unclear result, check for the issue before retrying to avoid duplicates.
- If GitHub access is unavailable, report the concrete limitation and preserve the prepared content in chat; do not claim creation or change authentication/configuration without authorization.

An agreed requirement can be handed to the testing or implementation workflow, but neither its confirmation nor approval to create an issue requests starting that workflow. When called from an explicitly authorized overall workflow, return the handoff to that workflow. Do not create repository files unless separately requested.
