# 07 — Cross-site learning memory

Status: IN PROGRESS — implementation requested by the engineer on 2026-09-17. Working mode: PAIR. Current phase: EXECUTE.

## Goal

When the learner explicitly saves checkpoints on two allowed HTML websites, both sites retain their own checkpoints. On an explicit question on site 2, the Agent may use a bounded selection of confirmed checkpoints from site 1 and must describe the learner's self-reported status accurately.

## Invariants

- A memory write requires a user click. Opening or switching a tab never writes a marker.
- A site switch must never send the prior tab's viewport, chat, or pending proposal as the new tab's context.
- While the sidebar is open, switching the active tab or navigating it updates the displayed page context automatically; this reads only the newly active page after source-policy approval and never saves a marker.
- The current-page marker list and Resume action remain restricted to the current canonical URL.
- Cross-site recall excludes sites currently blocked by source policy and never uploads the whole memory store.
- No numeric mastery percentage is inferred; “50% Promise / 25% async” is an illustrative example, per the user's clarification.
- Existing `vlc:markers:v1` data remains readable; no profile-file edits or destructive migration.

## Scope contract for later implementation

Allowed source/test paths are listed exactly in `plan.md`. Planning artifacts may be edited only within this task folder. Forbidden: `.firefox-demo-profile/**`, `.env*`, `dist/**`, `package.json`, `package-lock.json`, `manifest.json`, CI files, unrelated apps/packages, and production/external state.

## Acceptance criteria (unchecked until later implementation verification)

- [ ] Sequential confirmed saves on site 1 and site 2 leave both markers in `browser.storage.local` across sidebar close/reopen and a `demo:firefox` restart with the same profile.
- [ ] On site 2, the current-page UI/Resume never targets site 1; a question can include site 1's confirmed checkpoint in a maximum of five turn memories.
- [ ] The open sidebar follows active-tab switches/navigation without requiring a manual refresh, and old asynchronous work cannot repaint the new page.
- [ ] Blocked-source markers never enter the Agent request; recall failure does not reuse stale markers.
- [ ] Switching tabs/URLs during an in-flight ask cannot render the old answer or save its proposal on the new page.
- [ ] Agent answers label statuses as user-confirmed checkpoints, attribute the actual source, and do not claim a measured percentage.
- [ ] Unit/integration gates and the manual two-site Firefox golden flow in `plan.md` pass.
