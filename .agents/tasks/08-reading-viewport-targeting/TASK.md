# 08 — Reading viewport targeting

Status: COMPLETE. Working mode: DELEGATED for this user-requested prep → cook pass. Current phase: HANDOFF.

## Goal

Capture and resume the article the learner is reading, not a separately scrolling tutorial menu, on W3Schools and ordinary semantic pages.

## Invariants

- Only an explicit user action writes a learning marker. This change does not alter storage or consent.
- Keep canonical URL and existing anchor contract compatible with stored markers.
- Never delete or rewrite existing profile data or old markers automatically.
- No site-wide scraping: capture viewport-intersecting article elements within current limits. A partly visible long block may still contribute its full text.
- Explicit selection inside the article remains a deliberate override, even if the user scrolls after selecting. Menu selection is never used as this override.
- Preserve behavior on simple pages without `main` or `article`.

## Scope contract

Allowed source: `apps/firefox-extension/src/content/capture-current-viewport.ts`, `apps/firefox-extension/src/content/highlight-or-resume.ts`, and a small shared helper under `apps/firefox-extension/src/content/`. Allowed tests: the corresponding two test files. Allowed artifacts: this folder. No manifest, package, profile, API, memory schema, or unrelated UI edits.

## Acceptance criteria

- [x] W3Schools-style left menu heading cannot replace the visible article heading or article quote.
- [x] Content clipped inside an independent scroll pane does not enter captured text.
- [x] Resume chooses an article match over an earlier menu duplicate; an old menu-only anchor never highlights the menu. Ratio fallback for such markers is approximate.
- [x] Existing capture/resume tests, extension typecheck/build, and broader project tests pass.
- [x] Real Firefox interaction was verified in an isolated temporary profile.
