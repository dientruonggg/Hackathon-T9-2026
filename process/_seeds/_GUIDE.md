# Seeds & Archetypes Scaffolding Guide

<seeds_guide version="2.0" framework="RIPER-5">

<scope>
  `_seeds/` is a read-only scaffolding directory containing blueprint templates.
  Copy and instantiate these seeds when defining new tasks, programs, or context groups.
  Never edit seeds in-place — always copy first.
</scope>

<architectural_rationale>
  ### Seeds Architectural Rationale: Understanding "Why" & "How"
  * **Why the `.seed` extension? (Why):** The `.seed` suffix acts as an immutable boundary. It prevents automated AI discovery tools (`find`, `grep`) from confusing archetype templates with active `*.md` task files. This guarantees agents will never accidentally overwrite master blueprints during execution.
  * **Why separate seeds per phase? (Why):** Each phase of RIPER-5 requires a distinct cognitive posture and permission boundary (Research vs Innovate vs Plan vs Execute vs Review). Splitting archetypes prevents context window bloat (Anti-Context Saturation), avoids hallucinations, and anchors each Quality Gate (G1–G3) to an auditable physical artifact.
  * **Copy-On-Demand Protocol (How):** Never bulk-copy all seeds into a task directory. Start exclusively with `task.md`. Sequentially instantiate subsequent artifacts (`research.md` $\rightarrow$ `decision.md` $\rightarrow$ `plan.md` $\rightarrow$ `state.md` $\rightarrow$ `review.md` $\rightarrow$ `handoff.md`) only as the task progresses into each phase. In PAIR mode, the agent pauses for human gate approvals; in DELEGATED / Fast-Track mode, the agent auto-instantiates subsequent seeds, auto-certifies gates, and executes continuously without interruptions.
  * **Prompt-Driven Task Initialization (How):** Eliminates the friction of manual terminal commands. Users simply issue a prompt containing routing keywords: `big task`, `feature`, `big changes` (for `features/active/`) or `small task`, `general changes`, `small changes` (for `general-plans/active/`). The Agent automatically creates the directory, copies the seed blueprint, hydrates `<goal>` and criteria, and kicks off execution.
</architectural_rationale>

---

## 1. Blueprint Catalog

<catalog>

  <seed type="task" path="task-template.md.seed">
    Master contract and state record for the full RIPER-5 lifecycle (Full Track: 7 artifacts).
    Contains: Task Control metadata (working_mode PAIR/DELEGATED), Spec, Context Boundaries, Verification Strategy,
    Decisions, RIPER-5 Execution Plan (with Gates G0–G3), and Guardrails.
    Recommended for: Complex features, architectural refactors, and Epics in `process/features/`.
  </seed>

  <seed type="task-lite" path="task-lite.md.seed">
    Consolidated single-file contract for RIPER-5 Lite Track (1 artifact).
    Combines: Intent, Invariants, Scope Contract (<allowed_files>), Compact Vertical Slices,
    and Consolidated Verification Gates (G1/G2/G3).
    Recommended for: Small tasks, bugfixes, micro-features, and hotfixes in `process/general-plans/`.
    Reduces token tax and context overhead by over 70%.
  </seed>

  <seed type="research" path="context-group.md.seed">
    Research phase artifact. READ-ONLY during production.
    Contains: Current Behavior, Execution Flow, Components, Boundaries, Existing Tests,
    Runtime/Config, Source-of-Truth Analysis, Evidence Classification
    (Confirmed / Observed / Hypothesized), Assumptions, Impacted Files,
    Open Decisions, and Research Exit Criteria.
  </seed>

  <seed type="decision" path="decision-template.md.seed">
    Innovate phase artifact. Gate 1 memory.
    Contains: Decision question, Options (A/B/C) with trade-off matrix,
    Recommendation, Implementation Decision (filled by engineer in PAIR, or auto-selected in DELEGATED), Constraints Created,
    Evidence Still Required, and Gate 1 checklist.
  </seed>

  <seed type="plan" path="plan-template.md.seed">
    Plan phase artifact. Execution contract.
    Contains: Input Artifacts, Execution Constraints (allowed/forbidden files,
    allowed commands), Slice Summary table, Slice Details (objective, change,
    verifier, expected evidence, rollback point, stop conditions),
    Scope Contract, Verification Matrix, and Gate 2 checklist.
  </seed>

  <seed type="state" path="state-template.md.seed">
    Execute loop persistent memory. Updated after every slice.
    Contains: Current Phase/Gate, Task Ref, Goal/Invariants, Approved Decisions,
    Completed Slices, Current Slice, Current Diff, Verification Evidence,
    Failure Memory (signature/hypothesis/experiment/result), Retry Budget,
    Scope Changes, Open Risks, Next Action, and Context Freshness Check.
  </seed>

  <seed type="review" path="review-template.md.seed">
    Review phase artifact. Distinct from Handoff.
    Contains: Review Scope, Behavior Review, Architecture Review, Data Review,
    Security Review, Regression Review, Findings table (category/severity/type),
    Verification Matrix, Residual Risk, Review Decision, and Gate 3 checklist.
  </seed>

  <seed type="handoff" path="handoff-template.md.seed">
    Final projection artifact. Intentionally short.
    Answers: What changed? Why? What proves it? What remains risky?
    Does NOT duplicate research/plan/review artifacts.
  </seed>

  <seed type="program" path="program-template.md.seed">
    Multi-phase program blueprint with umbrella planning, phase breakdown,
    blast radius registries, and phase gate rules.
  </seed>

  <seed type="cancellation" path="cancellation-template.md.seed">
    Task cancellation record. Preserves investigation findings, decision rationale,
    reusable prototypes/tests, and rollback verification when an in-flight task is cancelled.
  </seed>

  <seed type="pause" path="pause-template.md.seed">
    Task pause and parking record. Preserves working tree state, slice snapshot,
    resumption criteria, and stale-risk assessment when an in-flight task is temporarily frozen.
  </seed>

  <seed type="results" path="results-template.tsv.seed">
    Benchmark and quantitative metrics evaluation registry.
    Use for tracking latency, throughput, memory, or eval scores across iterations and vertical slices.
  </seed>

</catalog>

---

## 2. Artifact Chain per Task

Every active task follows this artifact chain:

```text
task.md         ← Master contract & RIPER state record
research.md     ← Research phase output (READ-ONLY mode)
decision.md     ← Innovate phase output, Gate 1 memory
plan.md         ← Plan phase output, execution contract, Gate 2
state.md        ← Execute loop persistent memory (updated per slice)
review.md       ← Review phase output, Gate 3
handoff.md      ← Final projection (short)
```

### Concept → Artifact mapping

| Concept | Artifact |
|---|---|
| Task/Spec | `task.md` |
| Research / Context | `research.md` |
| Innovate / Decision | `decision.md` |
| Plan | `plan.md` |
| Loop state | `state.md` |
| Execute | source code + tests + `state.md` |
| Review | `review.md` |
| Handoff | `handoff.md` |
| Pause / Park | `paused.md` (clean freeze & resumption checklist) |
| Cancellation | `cancelled.md` (knowledge preservation upon abort) |
| Benchmark / Metrics | `results.tsv` (performance and eval metrics) |
| Program | `program.md` (multi-phase umbrella epic blueprint) |
| Gate 1 | `decision.md` approval (Engineer or Auto-DELEGATED) |
| Gate 2 | `plan.md` approval (Engineer or Auto-DELEGATED) |
| Gate 3 | `review.md` approval (Engineer or Auto-DELEGATED) |

---

## 3. Recommended Task Workspace Layout

### Standard Single-Project Layout
```text
process/features/active/CHG-017-your-feature/
├── task.md          ← instantiated from task-template.md.seed (Master Spec & AC)
├── research.md      ← instantiated from context-group.md.seed (Research Output)
├── decision.md      ← instantiated from decision-template.md.seed (Gate 1 Options)
├── plan.md          ← instantiated from plan-template.md.seed (Gate 2 Execution Contract)
├── state.md         ← instantiated from state-template.md.seed (Execute Memory)
├── review.md        ← instantiated from review-template.md.seed (Gate 3 Audit)
├── handoff.md       ← instantiated from handoff-template.md.seed (Final Projection)
├── results.tsv      ← (Optional) instantiated from results-template.tsv.seed (Metrics/Benchmarks)
├── paused.md        ← (If paused) instantiated from pause-template.md.seed
└── cancelled.md     ← (If cancelled) instantiated from cancellation-template.md.seed
```

### Monorepo / Multi-Domain Layout (Optional)
When working in monorepos with independent domains (e.g. `mobile-app`, `billing-service`), partition features by domain:
```text
process/features/{domain-slug}/
├── active/
│   └── CHG-XXX-your-feature/
├── backlog/
└── completed/
```

Not all artifacts are required at start. Create them progressively as the task advances through RIPER phases.

---

## 4. Instantiation Methods: Prompt-Driven vs Manual Commands

### Method 1: Prompt & Slash Command Initialization (Recommended)
Instead of manually executing terminal commands, you can initiate a task directly through your prompt using convenient slash prefixes (**Pseudo-Slash Commands**) or natural keywords:
- **`process/features/active/{task-slug}/`**: Use commands `/feature`, `/big-task`, `/epic` or keywords `big task`, `feature`, `big changes`, `epic`.
- **`process/general-plans/active/{task-slug}/`**: Use commands `/task`, `/small-task`, `/bug`, `/quick-fix` or keywords `small task`, `general changes`, `small changes`.
- **Special Command**: `/hotfix` (emergency production bugfix, automatically triggers DELEGATED mode).

The Agent will automatically create the required directory, copy `task-template.md.seed` $\rightarrow$ `task.md`, hydrate `<goal>` and `<acceptance_criteria>` from your prompt, and begin the Research phase immediately.

### Method 2: Manual Terminal Commands (Copy Commands)

```bash
# Create a new task workspace
mkdir -p process/features/active/CHG-XXX-your-feature

# Instantiate primary seeds into the workspace
cp process/_seeds/task-template.md.seed     process/features/active/CHG-XXX-your-feature/task.md
cp process/_seeds/context-group.md.seed    process/features/active/CHG-XXX-your-feature/research.md
cp process/_seeds/decision-template.md.seed process/features/active/CHG-XXX-your-feature/decision.md
cp process/_seeds/plan-template.md.seed    process/features/active/CHG-XXX-your-feature/plan.md
cp process/_seeds/state-template.md.seed   process/features/active/CHG-XXX-your-feature/state.md
cp process/_seeds/review-template.md.seed  process/features/active/CHG-XXX-your-feature/review.md
cp process/_seeds/handoff-template.md.seed process/features/active/CHG-XXX-your-feature/handoff.md

# (Optional) Tracking performance or evaluation metrics:
cp process/_seeds/results-template.tsv.seed process/features/active/CHG-XXX-your-feature/results.tsv

# (When pausing or parking an in-flight task):
cp process/_seeds/pause-template.md.seed process/features/active/CHG-XXX-your-feature/paused.md

# (When cancelling an in-flight task):
cp process/_seeds/cancellation-template.md.seed process/features/active/CHG-XXX-your-feature/cancelled.md
```

</seeds_guide>
