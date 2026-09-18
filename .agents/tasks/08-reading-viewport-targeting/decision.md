# Decision

| Option | Change | Strength | Cost / risk |
|---|---|---|---|
| A. W3Schools-only `#main` | Select `#main` on this host | Smallest immediate patch | Breaks on other tutorial sites and leaves capture/resume divergence |
| B. Shared semantic reading scope | Prefer `main`, `[role=main]`, `#main`, then `article`; exclude navigation; reuse for Capture and Resume | Fixes both paths and keeps simple-page fallback | Needs a few shared tests and care around empty roots |
| C. Visual region scoring | Score visible blocks by area, location, text density | Works on unstructured sites | Heuristic, complex, and difficult to audit or explain |

Recommendation: B. Add ancestor clipping to capture and prefer paragraph text for the quote. Keep the existing window scroll-ratio contract because W3Schools article uses document scrolling.

Engineer decision: [AUTO: DELEGATED] The user requested `$prep` and `$cook` in this pass, including code and tests. Proceed with B after adversarial review.

