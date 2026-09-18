# Debate synthesis

Three independent critics read the draft and relevant source files. They performed no writes. The parent checked their claims against current code before revising the plan. “Accept” means reflected in the final plan; “Reject” means excluded with a stated reason.

## YAGNI critic

| Objection | Decision | Change or reason |
|---|---|---|
| A per-site store/index/migration is unnecessary because `vlc:markers:v1` already holds all sites. | Accept | Keep the key and schema version; no migration. |
| A new “semantic” ranking subsystem overstates a lexical heuristic. | Accept | One deterministic, bounded selector; call it candidate selection and document older-marker misses. |
| Putting cross-site hits in `ShortSession.relatedMemories` breaks current-page Resume. | Accept | Only combine lists in `AgentTurnRequest`; page session remains page-only. |
| Tab listeners would become background monitoring. | Accept | Rebind only on initial open and explicit Ask/Save/Refresh/Resume/Block; verify active tab after awaits. |
| A percentage/progress model is unwarranted; existing note suffices. | Accept | Add one optional user-authored note field, no percentage schema/UI. |
| Grounding does not require a new taxonomy. | Accept | Reuse `MEMORY`/`VIEWPORT`, fix returned-marker IDs and source links. |
| A new E2E automation harness is disproportionate. | Accept | Existing Vitest gates plus manual two-site Firefox golden flow. |

## Failure-mode critic

| Objection | Decision | Change or reason |
|---|---|---|
| Whole-record get→set can lose concurrent saves from separate sidebars. | Accept | Phase 1 injects a Firefox-origin exclusive Web Lock around every marker mutation and tests two repository instances. No migration. |
| Failed page recall leaves prior `session.relatedMemories` for HTTP. | Accept | Clear the array and abort the Ask before HTTP. |
| Tab switch during asynchronous Ask/Save can render stale answer/proposal. | Accept | Explicit active-tab binding before action; identity check after await; discard old UI/proposal, never reapply it to new page. |
| `MEMORY` grounding can be set by an empty search and cite `relatedMemories[0]` falsely. | Accept | Track IDs actually returned by search/read; only those produce memory refs. |
| Global recency fallback can expose notes from user-blocked or hard-blocked sites. | Accept | Check each candidate with current source policy before selection, and recall only on explicit Ask. |
| Lexical top five does not guarantee semantic Promise→async relation with a large catalog. | Accept | Test the specified two-site scenario; state top-five/lexical limitation and never claim full personal-history knowledge. Semantic retrieval is a separate future decision. |
| Current-page list/Resume must never receive cross-site summaries. | Accept | Preserve page-only session state and test budget/source separation. |
| Status is self-report, not verified mastery or a percentage. | Accept | Agent prompt and acceptance wording explicitly label it user-confirmed. |
| Appending global memories after five page markers loses one category. | Accept | Deterministic budget: normally three page plus two cross-site; unused capacity is filled without exceeding five. |

## Architecture critic

| Objection | Decision | Change or reason |
|---|---|---|
| Read-only cross-site retrieval is simpler than storage migration. | Accept | `listMarkers()` reads the existing record; no extra persistent index. |
| Keep cross-site hits out of page-scoped session fields. | Accept | Turn-local candidate list only. |
| Server tools cannot search all Firefox storage, only preloaded candidates. | Accept | Prompt/tool copy says “up to five supplied candidates”, not total history; no server storage route. |
| Percentages need a separate product definition. | Accept | User clarified examples only; no numeric model. |
| Blocked-source filtering belongs at extension boundary. | Accept | Reuse `checkSourcePolicy` before sending candidates. |
| `lastVisitedAt` is not updated, so it is not a recency signal. | Accept | Sort by `updatedAt`; no visit tracking. |
| Specific grounding can be wrong; either track returned IDs or cite conservatively. | Accept | Track returned IDs and label references as returned evidence, not proof the model used every item. |

## CHANGELOG from the first draft

- Removed any per-site storage schema or vector-index proposal.
- Added explicit read-only catalog, policy filter, fixed five-item page/cross-site allocation, and a visible top-five limitation.
- Replaced tab event listeners with user-action-bound rebinding and post-await stale-result checks.
- Added a cross-context Web Lock around the existing marker record to address genuine lost writes.
- Added fail-closed recall handling and actual memory-reference attribution.
- Converted the progress-percent example to an optional learner note and self-report language.

## Residual limits / review points

- The selected approach gives bounded lexical+recency candidate selection, not semantic knowledge retrieval over an arbitrarily large history. This is an explicit product limit, not an unresolved implementation choice.
- The Phase 1 Web Lock must be verified in the real Firefox sidebar during the manual gate. If unavailable there, Gate G3 fails; do not silently run writes without a lock.
- No critic signs G1/G2/G3. The engineer should approve the plan and scope before `cook` begins source changes.
