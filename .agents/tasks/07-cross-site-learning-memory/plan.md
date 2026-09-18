# Plan: cross-site learning memory

> No product open questions. The user confirmed that 50%/25% is illustrative, not a literal progress metric. The engineer requested implementation and browser testing on 2026-09-17; Gate G2 is signed by that request.

## Goal and chosen approach

Keep `vlc:markers:v1` and same-page UI/Resume behavior. On an explicit Ask only, select up to five summaries from confirmed markers on currently allowed sites, mixing current-page and other-site evidence. While the sidebar is open, Firefox tab activation and URL changes automatically rebind the visible current-page context after source-policy approval; do not capture pages while the sidebar is closed. Revalidate before user actions and discard stale asynchronous results. Preserve self-reported status and source attribution. Serialize marker writes across extension pages using Firefox Web Locks so concurrent saves cannot replace each other.

`browser.storage.local` is extension-local, not backend storage. `navigator.locks.request()` is the chosen same-origin exclusive-write primitive; Firefox runtime verification is an explicit gate. References: [MDN storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [web-ext profile preservation](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/).

## Alternatives considered

| Option | Benefit | Why not selected |
|---|---|---|
| Per-site storage records / v2 migration | Natural write isolation | Existing source identity already separates sites; migration and tombstones add risk. |
| Global local catalog, bounded deterministic selection (chosen) | Small change, no DB or provider call for ranking | Can miss older semantically related knowledge; disclose top-five limit. |
| Embeddings/vector index or model-ranked retrieval | Better semantic recall at scale | New model/storage dependency, privacy surface, and latency exceed this two-site requirement. |
| Manual-only selection of past memories | Exact user control | Adds another step to every question and does not meet the expected automatic two-site flow. |

## Scope contract

Allowed files for future `cook` (no other source edits):

- `packages/contracts/src/memory.ts`
- `packages/memory/src/memory-repository.ts`
- `packages/memory/src/browser-storage-memory-repository.ts`
- `packages/memory/src/memory.test.ts`
- `apps/firefox-extension/src/services/browser-runtime.ts`
- `apps/firefox-extension/src/pipeline/ask-agent-pipeline.ts`
- `apps/firefox-extension/src/pipeline/select-turn-memories.ts` (new)
- `apps/firefox-extension/src/sidebar/active-tab-context.ts` (new)
- `apps/firefox-extension/src/sidebar/main.ts`
- `apps/firefox-extension/src/sidebar/styles.css`
- `apps/firefox-extension/index.html`
- `apps/firefox-extension/tests/pipelines.test.ts`
- `apps/firefox-extension/tests/select-turn-memories.test.ts` (new)
- `apps/firefox-extension/tests/active-tab-context.test.ts` (new)
- `apps/agent-api/src/agent/system-prompt.ts`
- `apps/agent-api/src/agent/tool-registry.ts`
- `apps/agent-api/src/agent/run-agent-turn.ts`
- `apps/agent-api/tests/agent-loop.test.ts`
- `apps/agent-api/tests/tool-registry.test.ts`

Forbidden: `.firefox-demo-profile/**`, `.env*`, generated files, package manifests/lockfile, `manifest.json`, all other source files, and external writes. A real profile is never copied, parsed, or modified by the implementation harness. Use a separate disposable test profile for the requested Firefox run.

## Phases

| Phase | Dependency | Artifact | Verifier | Expected evidence | Rollback point |
|---|---|---|---|---|---|
| 1. Safe catalog and writes | none | [phase-01-memory.md](phase-01-memory.md) | `npm test --workspace @vlc/memory` | same-page unchanged; two concurrent saves both survive | revert only Phase 1 scoped diff; stored v1 record untouched |
| 2. Browser selection and rebinding | 1 | [phase-02-extension.md](phase-02-extension.md) | `npm test --workspace @vlc/firefox-extension` plus open-sidebar tab-switch test | two-site selection, blocked-source exclusion, immediate active-tab context, stale-tab abort | revert Phase 2; no storage migration |
| 3. Agent evidence and end-to-end gate | 2 | [phase-03-agent-verify.md](phase-03-agent-verify.md) | `npm run verify` plus manual Firefox flow | actual marker cited; old responses suppressed; profile persistence observed | revert Phase 3; markers remain stored |

## Cross-phase file map

| Phase | Files |
|---|---|
| 1 | `packages/contracts/src/memory.ts`; `packages/memory/src/{memory-repository,browser-storage-memory-repository,memory.test}.ts`; `apps/firefox-extension/src/services/browser-runtime.ts` |
| 2 | `apps/firefox-extension/src/pipeline/{select-turn-memories,ask-agent-pipeline}.ts`; `apps/firefox-extension/src/sidebar/main.ts`; `apps/firefox-extension/index.html`; `apps/firefox-extension/tests/{pipelines,select-turn-memories}.test.ts` |
| 3 | `apps/agent-api/src/agent/{system-prompt,tool-registry,run-agent-turn}.ts`; `apps/agent-api/tests/{agent-loop,tool-registry}.test.ts` |

## Selection and privacy rules

- Current-page `session.relatedMemories` is never globalized. It remains the only source for page list, delete, and Resume.
- A turn can contain at most five summaries. With both categories present: at most three current-page and at most two cross-site; unused slots may be filled from the other category. Deduplicate by marker ID.
- Cross-site candidates must pass the current `checkSourcePolicy` against current settings. Do not preload them when merely opening the sidebar. Rank by lexical overlap of question/current heading/short viewport excerpt with stored title/heading/note/question/answer summary, then `updatedAt`; zero-overlap fallback is newest confirmed markers. This is candidate selection, not semantic understanding.
- The Ask UI tells the learner that up to five allowed-site marker summaries may be sent to the configured model. It does not silently upload the whole catalog.
- A failed catalog read or policy read aborts Ask before HTTP. A failed page recall clears stale `relatedMemories` and aborts Ask. Never silently downgrade to old memories.
- The Agent is told that a status is the learner's own checkpoint, not a measured skill. If no relevant marker is supplied, it must not claim knowledge of web 1.
- Memory summaries sent to the local Agent API/model may contain prior-page notes and short quotes. No raw 4,000-character viewport history is stored or sent as long-term memory.

## Test strategy and acceptance

| Test | Path | Assertion |
|---|---|---|
| Repository | `packages/memory/src/memory.test.ts` | two-site sequential and concurrent writes, legacy v1 key remains readable, catalog returns markers |
| Selector | `apps/firefox-extension/tests/select-turn-memories.test.ts` | Promise marker selected for async question; no page/global mixing; five-item budget/dedupe |
| Pipeline | `apps/firefox-extension/tests/pipelines.test.ts` | blocked marker not sent; storage/policy errors abort; page recall failure clears stale data |
| Tab switching | `apps/firefox-extension/tests/active-tab-context.test.ts` | active-tab/URL events choose newest context and old responses cannot replace it |
| Agent | `apps/agent-api/tests/{tool-registry,agent-loop}.test.ts` | global candidate search; no false `MEMORY` on empty result; exact source reference |
| Manual Firefox | dedicated test profile, two allowed HTML sites | save web1, save web2, ask on web2, return web1, close/reopen Firefox with the same test profile, confirm both remain; switch during Ask and confirm stale response is discarded |

Acceptance checkboxes are in `TASK.md`; do not tick them from static inspection. Final automated gate: `npm run verify` (exit 0, no lint errors/warnings). Manual Firefox evidence must be recorded separately from automated tests. No numeric progress UI, cloud sync, vector DB, background reading, or PDF/social-site support is included.

## Debate

Three independent read-only critics challenged overengineering, failure modes, and alternate architecture. Every objection and disposition is in [debate-synthesis.md](research/debate-synthesis.md). No critic edited source or approved Gate G2.
