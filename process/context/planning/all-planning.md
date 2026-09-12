# Planning Standards & Calibration Context

<planning_context version="2.0">

<overview>
  Engineering guidelines for story point estimation, vertical slicing, rollback checkpointing, and capacity calibration.
</overview>

---

## 1. Quality Standards (INVEST Criteria)

<quality_standards>
  <standard name="INVEST">
    - **Independent:** Deliverable and verifiable without cross-story circular blockers.
    - **Negotiable:** Implementation details and technical approaches can be flexibly evaluated during the Innovate phase.
    - **Valuable:** Delivers demonstrable capability or verifiable engineering progress.
    - **Estimable:** Scoped tightly enough that effort and file touchpoints can be calculated.
    - **Small:** Sized to fit comfortably within 1–3 engineering days (or 1–3 Story Points).
    - **Testable:** Accompanied by unambiguous, verifiable Acceptance Criteria (`- [ ]`).
  </standard>
</quality_standards>

---

## 2. Vertical Slicing Discipline

<vertical_slicing>
  ### Vertical Slice vs Horizontal Silo
  - **The Vertical Slice Rule:** Each slice must cut through all required technical layers (e.g. Domain Model $\rightarrow$ Service/Logic $\rightarrow$ Port Adapter/API $\rightarrow$ Automated Test) to deliver one complete, verifiable increment of behavior.
  - **The Horizontal Silo Anti-Pattern:** Never slice horizontally (e.g., Slice 1: create all database tables, Slice 2: create all services, Slice 3: create all endpoints). Horizontal layers cannot be verified independently, leaving the system in a broken or unprovable state until the final slice.

  ### Vertical Slicing Workflow
  ```text
  [Slice 1: Thin End-to-End Core] ──► Domain Entity + In-Memory Repo + Minimal Endpoint + Passing Test
  [Slice 2: Persistence & Boundary] ──► Real Database Adapter + Migration + Integration Verifier
  [Slice 3: Edge Cases & Validation] ──► Strict Input Sanitization + Error Handlers + Boundary Tests
  ```
</vertical_slicing>

---

## 3. Slice Sizing, Atomic Verifiability & Checkpoints

<slice_sizing>
  <rule id="slice_cardinality">
    A standard task should contain between **2 and 5 vertical slices**. If a task requires more than 5 slices, it has high blast radius and must be decomposed into a Multi-Phase Program (`program-template.md.seed`).
  </rule>

  <rule id="autonomous_verifier">
    Every single slice in `plan.md` must have an explicit, executable `<verifier>` command (e.g. `npm run test -- test/path/test.js` or `pytest tests/unit/test_slice.py`). A slice is NOT complete until its verifier exits with code 0.
  </rule>

  <rule id="atomic_checkpoint">
    Commit or checkpoint each slice atomically upon verification passing. This guarantees clean git history and enables instant rollback if subsequent slices encounter irrecoverable regressions.
  </rule>
</slice_sizing>

---

## 4. Rollback Strategy per Slice

<rollback_strategy>
  Every slice in `plan.md` MUST specify a concrete `<rollback_point>`:
  - **Git Checkpoint:** `git checkout -- <allowed_files>` or revert commit hash.
  - **Stash Checkpoint:** `git stash pop` or dedicated WIP branch.
  - **Data/Schema Rollback:** Down-migration script or drop ephemeral test container.

  If the agent exhausts its 3-attempt retry budget on a slice, it must execute the rollback point before halting and escalating to human guidance.
</rollback_strategy>

---

## 5. Story Point Capacity Calibration

<capacity_calibration>
  <unit>1 Story Point (SP) ≈ 2–4 focused engineering hours</unit>
  <scale>
    - **1 SP:** Straightforward change with clear scope (1-3 files touched, 1-2 slices).
    - **2 SP:** Standard feature or refactoring (3-5 files touched, 2-3 slices).
    - **3 SP:** Moderately complex task touching domain contracts and persistence (4-7 files, 3-4 slices).
    - **5 SP:** Maximum size for a single active task in `process/features/active/`.
    - **> 5 SP:** Oversized. Must be split into multiple standalone tasks or organized under `program-template.md.seed`.
  </scale>
</capacity_calibration>

</planning_context>
