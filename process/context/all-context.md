# Root Context Router

<context_router version="1.0">

<description>
  Central durable knowledge index routing to specialized domain context groups across the system.
</description>

## Context Directory Index

<!--
  CONTEXT ROUTING GUIDELINES:
  - Central index for all project domain knowledge, architecture, and invariants.
  - When adding a new context file or directory (e.g. context/auth/, context/database/),
    ALWAYS register a new <group> entry below.
  - Specify clear `scope` so agents know exactly when to load this context group without
    unnecessary full-directory scanning.
-->

<context_groups>
<group id="planning">
<title>Planning Standards & Calibration</title>
<path>[`planning/all-planning.md`](planning/all-planning.md)</path>
<scope>INVEST criteria, vertical slicing rules, Story Point capacity calibration</scope>
</group>

  <group id="seeds">
    <title>Seeds & Archetypes Guide</title>
    <path>[`../_seeds/_GUIDE.md`](../_seeds/_GUIDE.md)</path>
    <scope>Scaffolding seeds for tasks, research, decisions, plans, state, reviews, handoffs, pause, cancellation, benchmarks, and programs. Full artifact chain and instantiation commands.</scope>
  </group>

  <group id="tests">
    <title>Testing Standards & Harness Strategy</title>
    <path>[`tests/all-tests.md`](tests/all-tests.md)</path>
    <scope>Test pyramid, unit/integration isolation policies, mock conventions, and test fixtures</scope>
  </group>

  <group id="protocols">
    <title>Development Protocols Index</title>
    <path>[`../development-protocols/all-development-protocols.md`](../development-protocols/all-development-protocols.md)</path>
    <scope>Engineering harness, subagent orchestration, and code standards</scope>
  </group>

  <!-- Example: Register custom domain context below
  <group id="domain-billing">
    <title>Billing & Invoicing Architecture</title>
    <path>[`billing/billing-context.md`](billing/billing-context.md)</path>
    <scope>Payment gateway integrations, invoice calculation invariants, tax handling</scope>
  </group>
  -->

  <group id="arhitecture specs">
    <title>Architecture specs</title>
    <path>`architecture/</path>
  </group>
</context_groups>

</context_router>
