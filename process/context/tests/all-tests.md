# Testing Standards & Harness Strategy Context

<testing_context version="2.0">

<overview>
  Guidelines for test pyramid calibration, isolation policies, mock conventions, fixture hygiene, and automated verification harness across the system.
</overview>

---

## 1. Test Pyramid & Layer Calibration

<test_pyramid>
  <layer name="Unit Tests" path="tests/unit/">
    - **Scope:** Pure domain models, business logic calculations, utility functions, edge-case branching.
    - **Speed & Constraints:** Ultra-fast (< 50ms per test). Zero network calls, zero disk I/O, zero real database connections.
    - **Mocking Policy:** Mock all port interfaces, external clients, and I/O boundaries.
  </layer>

  <layer name="Integration Tests" path="tests/integration/">
    - **Scope:** Repository persistence adapters, database queries, migration scripts, HTTP client wrappers, framework wiring.
    - **Isolation:** Ephemeral test containers (e.g. Testcontainers), in-memory databases, or isolated schema instances per test worker.
    - **Teardown:** Must guarantee 100% state cleanup with zero leakage across test runs.
  </layer>

  <layer name="End-to-End Tests" path="tests/e2e/">
    - **Scope:** Critical user journeys, public API lifecycle, full authentication flows, regression smoke tests.
    - **Verification:** Validates end-to-end contract integrity across the entire system.
  </layer>
</test_pyramid>

---

## 2. Mocking Boundaries & Anti-Patterns

<mocking_boundaries>
  <rule id="mock_at_architectural_boundary">
    **Mock at the boundaries, never at the core.** Only mock external infrastructure: third-party HTTP APIs, message brokers, email services, or system clock.
  </rule>

  <rule id="do_not_mock_domain_or_sut">
    Never mock the System Under Test (SUT) or pure domain entities/value objects. If a domain entity is hard to instantiate without mocks, its design is coupled and requires refactoring.
  </rule>

  <rule id="verify_mock_interactions_sparingly">
    Prefer asserting on return values and observable state changes rather than verifying exact method call counts (`toHaveBeenCalledTimes`), which couples tests to private implementation details.
  </rule>
</mocking_boundaries>

---

## 3. Test Fixture & Data Factory Hygiene

<fixture_hygiene>
  <rule id="data_factories_over_preseeded_db">
    Use explicit test factories (or builder functions) with sensible defaults rather than relying on brittle, shared SQL seed dumps.
  </rule>

  <rule id="no_shared_mutable_fixtures">
    Every test must instantiate its own data fixtures. Never share mutable state or global test variables between tests.
  </rule>

  <rule id="deterministic_teardown">
    Always clean up database records, temp files, or mock registries in `afterEach` / `teardown` hooks to prevent cascading cross-test failures.
  </rule>
</fixture_hygiene>

---

## 4. Determinism & Flaky Test Zero-Tolerance

<determinism>
  <rule id="frozen_clock">
    Never use real wall-clock time (`Date.now()`, `datetime.now()`) in time-sensitive assertions. Use frozen clocks or fake timers to ensure absolute reproducibility.
  </rule>

  <rule id="order_independence">
    Tests must pass when run individually or in random order (`--randomize`). Never rely on one test running before another.
  </rule>

  <rule id="no_arbitrary_sleeps">
    Never use arbitrary `sleep(1000)` in async tests. Use explicit polling helpers with timeouts (`waitFor`, `eventually`) that resolve as soon as the expected condition is met.
  </rule>
</determinism>

---

## 5. Assertion Precision & Failure Clarity

<assertion_precision>
  <rule id="exact_assertions">
    Avoid vague assertions (e.g. `expect(res).toBeTruthy()`). Always assert exact expected values, HTTP status codes, and error codes.
  </rule>

  <rule id="actionable_failure_messages">
    When custom assertions are used, provide clear error messages indicating what input was given and what specific invariant was violated.
  </rule>
</assertion_precision>

---

## 6. Verification Commands Mapping

<verification_commands>
  <!-- Keep aligned with AGENTS.md <validation_commands> -->
  <command type="unit">Run fast unit test suite (< 30 seconds total)</command>
  <command type="integration">Run isolated integration/e2e tests</command>
  <command type="typecheck">Run static type checker (zero errors, strict mode)</command>
  <command type="lint">Run linter and format checker (zero warnings)</command>
  <command type="coverage">Run test coverage report and threshold check</command>
</verification_commands>

</testing_context>
