# Subagent Delegation & Orchestration Protocol

<orchestration_protocol version="2.0">

<description>
  Engineering guidelines for delegating, isolating, and coordinating subagents during complex, multi-phase tasks. Project-agnostic.
</description>

---

## 1. Delegation Criteria & Workload Triage

<delegation_criteria>
  Subagents should be spawned deliberately for bounded, high-leverage subtasks. Do NOT spawn subagents for trivial steps.

  ### When to Delegate to a Subagent:
  - **Isolated Research Spikes:** Exploring unfamiliar libraries, auditing legacy subsystems, or reading documentation without polluting the parent agent's context window.
  - **Dedicated Quality Audits:** Independent security vulnerability audits, accessibility reviews (a11y), or strict lint/formatting passes.
  - **Orthogonal Test Authoring:** Writing standalone unit test fixtures or integration harnesses for a frozen interface contract.
  - **Parallel Independent Slices:** Implementing non-overlapping, orthogonal components that touch distinct file boundaries.

  ### When Parent Agent MUST Retain Control (Do NOT Delegate):
  - **Architectural Trade-offs & Decisions:** Authoring `decision.md` options and Gate 1 sign-offs.
  - **Master Task Contract & Planning:** Defining `task.md`, vertical slice contracts in `plan.md`, and Gate 2 sign-offs.
  - **Quality Gates & User Approval:** Conducting Gate G3 review sign-off and final `handoff.md` generation.
  - **Interactive User Clarification:** Any prompt requiring direct user guidance or requirement resolution.
</delegation_criteria>

---

## 2. Context Containment & Scoping Rules

<context_containment>
  <rule id="explicit_file_manifest">
    Always provide the subagent with an explicit list of file paths to inspect or modify. Never prompt a subagent with open-ended instructions like "explore the project" or "look around the codebase".
  </rule>

  <rule id="port_and_interface_focus">
    Constrain the subagent's inputs to relevant port interfaces, domain entities, and accompanying test suites. Keep infrastructure noise out of the subagent prompt.
  </rule>

  <rule id="structured_output_contract">
    Always demand a structured output format from the subagent (e.g. unified diff, bulleted findings categorized by Confirmed/Observed/Hypothesized, or JSON/markdown table).
  </rule>
</context_containment>

---

## 3. Concurrency, Isolation & Write Permissions

<concurrency_and_isolation>
  <rule id="zero_write_collision">
    Multiple subagents must NEVER be given write access to the same files or shared mutable database tables concurrently. Overlapping writes cause silent regressions and merge conflicts.
  </rule>

  <rule id="read_only_by_default">
    Default subagents to read-only mode whenever possible (e.g. research, code exploration, audit). Only grant write permissions when the target files are strictly isolated to that subagent.
  </rule>

  <rule id="workspace_isolation">
    If subagents support isolated workspaces (e.g. branch or worktree mode), use them for speculative spike experiments to ensure the parent working tree remains clean.
  </rule>
</concurrency_and_isolation>

---

## 4. State Synchronization & Parent Re-Integration

<state_synchronization>
  <rule id="parent_owns_master_state">
    Subagents must NEVER directly edit the parent's master task artifacts (`task.md`, `state.md`, `review.md`). Only the parent agent reconciles subagent outputs into master state files.
  </rule>

  <rule id="verification_before_acceptance">
    When a subagent returns modified source code or findings, the parent agent must inspect the diff and execute the slice's designated verifier command before accepting the work.
  </rule>

  <rule id="evidence_crystallization">
    Extract verified facts from subagent reports and append them to `state.md > <verification_evidence>`. Discard transient subagent conversation logs to preserve context hygiene.
  </rule>
</state_synchronization>

---

## 5. Reactive Coordination, Timeouts & Failure Recovery

<coordination_and_recovery>
  <rule id="no_polling_loops">
    Never implement sleep-and-poll loops (`while true; sleep 5; check_status`) to monitor subagents. Rely on the system's reactive message wakeup mechanism to resume execution upon subagent completion.
  </rule>

  <rule id="retry_budget_enforcement">
    If a subagent encounters a tool error or recurring failure, enforce the 3-attempt retry budget. If exhausted, record the failure signature in `state.md > <failure_memory>` and escalate to human guidance.
  </rule>

  <rule id="teardown_and_cleanup">
    Terminate idle or failed subagents cleanly. Ensure any temporary scratch files or experiment branches created by the subagent are deleted before completing the slice.
  </rule>
</coordination_and_recovery>

---

## 6. Cross-Harness & Independent Review Protocol

<cross_harness_review>
  <rule id="implementer_cannot_review">
    The subagent or harness that authored an implementation must NEVER act as the sole approver of that slice.
    To prevent confirmation bias, delegate the verification of complex or security-sensitive slices to an independent review subagent, or require human gate sign-off.
  </rule>

  <rule id="adversarial_verification">
    Review subagents must be tasked with finding edge-case regressions, compliance violations, and scope breaches against `<scope_contract>`, rather than merely validating the author's declared success.
  </rule>

  <rule id="fresh_context_mandate">
    Independent review subagents should operate with clean context: they receive the task requirements, the git diff, and the test command, without the conversational baggage or speculative rationale of the implementation loop.
  </rule>
</cross_harness_review>

</orchestration_protocol>
