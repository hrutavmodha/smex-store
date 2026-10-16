# Bug: Orphaned Re-Export Stubs in `client/src/` (AI Fluff for Misnamed Spec Headings)

- **Bug ID**: BUG-M6-009
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: Low (Repository Cleanliness / AI Fluff)
- **Target Files**:
  - `client/src/app/boosting/page.tsx`
  - `client/src/lib/boosting/calculator.ts`
  - `client/src/lib/boosting/dispatcher.ts`
- **Status**: Resolved

---

## 1. Description

The frontend project architecture places all application routes in `client/app/` and shared libraries in `client/lib/` (and components in `client/components/`). There is no `src/` directory in the Next.js setup for this repository.

However, in `docs/internal/design/lld/mlbb-boosting.md`, the author mistakenly typed path references with a `src/` prefix:
- Line 69: `client/src/lib/boosting/calculator.ts`
- Line 207: `client/src/lib/boosting/dispatcher.ts`
- Line 452: `client/src/app/boosting/page.tsx`

Instead of fixing the path references in the design document, three dummy 1-line re-export stub files were created:
1. `client/src/app/boosting/page.tsx`:
   ```typescript
   export { default } from '../../../app/boosting/page';
   ```
2. `client/src/lib/boosting/calculator.ts`:
   ```typescript
   export * from '../../../lib/boosting/calculator';
   ```
3. `client/src/lib/boosting/dispatcher.ts`:
   ```typescript
   export * from '../../../lib/boosting/dispatcher';
   ```

These files serve zero functional purpose, are not routed by Next.js, are never imported by runtime production code or tests, and pollute the repository with fake mirror folders.

---

## 2. Specification & Design Reference

- **Engineering Mandate**: Section 1 & Section 2.A (Clean Codebase & Production Purity).

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect `client/src/app/boosting/page.tsx`, `client/src/lib/boosting/calculator.ts`, and `client/src/lib/boosting/dispatcher.ts`.
2. Notice they are purely re-exports of `client/app/` and `client/lib/`.
3. Check `client/test/` and `client/app/`: no file imports from `client/src/`.

---

## 4. Impact

- Repository pollution and architectural inconsistency.

---

## 5. Recommended Remediation

1. Delete the `client/src/` directory and its stub files.
2. Correct the file path headings in `docs/internal/design/lld/mlbb-boosting.md` from `client/src/...` to `client/app/...` and `client/lib/...`.
