# Implementation & Harness Standards

<implementation_standards version="2.0">

<description>
  Engineering quality, strict typing, clean architecture, and defensive execution conventions. Project-agnostic.
</description>

---

## 1. Type Safety & Static Analysis

<type_safety>
  <rule id="strict_typing">
    All functions, methods, and class attributes must have explicit type annotations. Use modern union types (`int | None` or `string | null`). Avoid untyped `Any`/`any` unless deserializing unvalidated external payloads at boundary gateways.
  </rule>

  <rule id="explicit_return_types">
    Always declare explicit return types on public functions and methods to enforce compile-time contracts and prevent accidental type widening.
  </rule>

  <rule id="no_suppression">
    Never silence linter, formatter, or type-checker errors with inline suppression directives (`# type: ignore`, `eslint-disable`, `@SuppressWarnings`) to artificially pass a validation gate. Fix the underlying root cause.
  </rule>
</type_safety>

---

## 2. Clean Architecture & Layered Domain Purity

<clean_architecture>
  <rule id="dependency_rule">
    Dependencies must only point inward toward the core domain. Inner domain layers must never import or depend on outer infrastructure frameworks, databases, or UI modules.
  </rule>

  <rule id="domain_purity">
    Core business logic, domain entities, and value objects must remain 100% pure with zero side-effects, zero filesystem I/O, and zero network calls.
  </rule>

  <rule id="ports_and_adapters">
    Define abstract interfaces (ports) in the application/domain layer for persistence, external APIs, and messaging. Implement concrete drivers (adapters) strictly within infrastructure packages.
  </rule>

  <rule id="no_premature_abstraction">
    Do not introduce speculative abstraction layers, dynamic factories, or unnecessary indirection for simple single-purpose utilities.
  </rule>
</clean_architecture>

---

## 3. Error Handling & Fail-Fast Principles

<error_handling>
  <rule id="fail_fast_at_boundaries">
    Validate all incoming parameters, payloads, and environment variables at system entrypoints. Reject malformed input immediately before invoking business logic.
  </rule>

  <rule id="no_silent_swallowing">
    Never use empty `catch {}`, `except: pass`, or unlogged exception handlers. Every caught exception must either be handled, transformed into a typed domain error, or cleanly propagated.
  </rule>

  <rule id="typed_domain_errors">
    Create explicit domain error classes with machine-readable error codes (e.g. `ResourceNotFoundError`, `ValidationError`, `ConcurrencyConflictError`) rather than throwing generic exceptions.
  </rule>
</error_handling>

---

## 4. Immutability & Concurrency Safety

<concurrency_and_immutability>
  <rule id="immutable_data_structures">
    Prefer immutable models (`dataclass(frozen=True)`, `readonly` interfaces, or `Readonly<T>`) for domain events, configuration objects, and Data Transfer Objects (DTOs).
  </rule>

  <rule id="no_shared_mutable_state">
    Avoid global mutable variables, module-level state caches, or singletons with mutable fields. Pass dependencies explicitly via constructors (Dependency Injection).
  </rule>

  <rule id="safe_async_lifecycle">
    Always handle asynchronous error rejection and cancellation cleanly. Ensure timeouts are specified for external network calls and database queries.
  </rule>
</concurrency_and_immutability>

---

## 5. Observability & Logging Hygiene

<observability_hygiene>
  <rule id="structured_logging">
    Use structured logging with key-value context (`task_id`, `user_id`, `component`) instead of unstructured string concatenation.
  </rule>

  <rule id="no_credential_leakage">
    Never log sensitive data: passwords, tokens, API keys, cookies, or personally identifiable information (PII).
  </rule>

  <rule id="clean_production_diff">
    Remove all temporary debug logs (`console.log`, `print()`, `debugger`, `dump()`) before requesting Gate G3 sign-off.
  </rule>
</observability_hygiene>

---

## 6. Defensive Resource Management & Teardown

<resource_management>
  <rule id="deterministic_teardown">
    Always manage file handles, network sockets, and database transactions using deterministic scoping constructs (`try...finally`, Python `with`, TypeScript `using`, or language-native RAII).
  </rule>

  <rule id="isolated_test_state">
    Test fixtures must create and destroy their own temporary state. Tests must leave the system in a clean state upon completion.
  </rule>
</resource_management>

</implementation_standards>
