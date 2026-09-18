# Research

## Confirmed in source

- `capture-current-viewport.ts` queries matching text across the entire document, then chooses the first visible heading in DOM order.
- It excludes semantic `nav` but not a `div` sidebar. Its viewport rectangle check does not clip to scroll ancestors.
- `visibleText`, quote, and fingerprint inherit this candidate order. `scrollRatio` uses window scroll position only.
- `highlight-or-resume.ts` searches the entire document for quote and heading. It can resume to menu text.
- Current tests use flat fake elements. Baseline: `npm test --workspace @vlc/firefox-extension` → 9 files, 55 tests passed.

## Observed on public W3Schools page

- On `https://www.w3schools.com/js/js_async_await.asp`, `#sidenav > #leftmenuinner > #leftmenuinnerinner` contains `JS Advanced` before the article `#main > h1` (`Asynchronous Functions`) in DOM order.
- The menu has its own vertical overflow. The article is in normal document flow. The user's screenshot shows the menu heading selected as the saved target.
- Public source: https://www.w3schools.com/js/js_async_await.asp and https://www.w3schools.com/lib/w3schools/main.v1.0.4.css

## Hypotheses to test

- When the menu heading is on screen, current capture reports `JS Advanced`, even when the article is visible.
- A menu quote can displace article text in the 4,000-character budget and make Resume scroll the menu.
- A rectangle within the browser viewport may still be hidden behind the clipping boundary of a separate scroll pane.

## Boundary

- The independent sidebar scroll does not imply the article has an independent scroll position. W3Schools article progress still follows `window.scrollY`.
- Browser automation availability remains under investigation. The currently open user profile is not a test fixture.

