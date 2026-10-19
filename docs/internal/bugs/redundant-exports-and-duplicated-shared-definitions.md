# Bug: Redundant Intermediate Re-Exports and Duplicated Types/Functions Across Packages

- **Bug ID**: 31
- **Category**: Code Health / Architecture
- **Severity**: Medium
- **Target Files**:
  - `server/src/utils/errors.ts`
  - `server/src/plugins/sensible.ts`
  - `server/src/services/tournament-lifecycle.service.ts`
  - `server/src/services/boosting-calc.service.ts`
  - `client/lib/boosting/calculator.ts`
  - `server/src/services/boosting-dispatch.service.ts`
  - `client/lib/boosting/dispatcher.ts`
- **Status**: Identified

---

## 1. Description

Across the monorepo, multiple modules introduce redundant type aliases, pass-through intermediary re-export files, and duplicate implementations of business logic and domain types that already exist or belong in `@smex/shared`:

1. **Redundant Intermediary Pass-Through Module**:
   - `server/src/utils/errors.ts` acts solely as a 2-line wrapper:
     ```ts
     export { formatRfc7807, type Rfc7807Error } from '@smex/shared';
     ```
     Multiple route files (`admin/users.ts`, `marketplace/index.ts`, `marketplace/uploads.ts`, `notifications.ts`, `search.ts`, `teams.ts`, `tournaments.ts`) import from `../../utils/errors.js` instead of directly from `@smex/shared`.

2. **Redundant Type & Identifier Aliases**:
   - In `server/src/plugins/sensible.ts`:
     ```ts
     export type Rfc7807Problem = Rfc7807Error;
     export { formatRfc7807, formatRfc7807 as formatRfc7807Problem };
     ```
     creates redundant alias re-exports of `@smex/shared` identifiers that are never consumed externally.
   - In `client/lib/boosting/calculator.ts` and `server/src/services/boosting-calc.service.ts`:
     ```ts
     export const BoostingCalcError = ValidationError;
     ```
     exports an unused alias variable.

3. **Duplicated Types from `@smex/shared`**:
   - In `server/src/services/tournament-lifecycle.service.ts` (line 13):
     ```ts
     export type TournamentStatus = 'upcoming' | 'registration_open' | 'ongoing' | 'completed';
     ```
     duplicates `export type TournamentStatus` already declared in `shared/src/tournaments.ts`.

4. **Duplicated Business Logic & Calculator Implementations Across Server and Client**:
   - `calculateBoostingPrice`, `ValidationError`, and ladder constants (`RANK_ORDER`, `DEFAULT_FIXED_TIER_RATES`, `DEFAULT_STAR_BRACKETS`) are duplicated between `server/src/services/boosting-calc.service.ts` and `client/lib/boosting/calculator.ts` instead of residing in `@smex/shared`.
   - Dispatch generation and deep-link handoff helpers (`formatOrderMessage`, `generateOrderRef`, `getDispatchConfig`, `resolveWhatsAppHandoff`, `resolveInstagramHandoff`) are duplicated between `server/src/services/boosting-dispatch.service.ts` and `client/lib/boosting/dispatcher.ts`.

---

## 2. Specification & Design Reference

- `docs/internal/architecture.md` Section on Monorepo Package Boundaries: Core domain types, shared error interfaces, and shared calculation algorithms must be centralized in `@smex/shared` without intermediary wrapper re-exports or duplicated logic.
- Single Source of Truth: Types and utility functions must be exported once from their canonical home package and imported directly by consumers.

---

## 3. Reproduction Steps / Verification

1. Check for pass-through re-exports:
   ```bash
   git grep "from.*utils/errors"
   ```
   Notice routes routing through `server/src/utils/errors.ts` rather than `@smex/shared`.
2. Check for duplicate type declarations:
   ```bash
   git grep "type TournamentStatus"
   ```
   Notice identical union definitions in both `shared/src/tournaments.ts` and `server/src/services/tournament-lifecycle.service.ts`.
3. Check for duplicated boosting logic:
   ```bash
   diff client/lib/boosting/calculator.ts server/src/services/boosting-calc.service.ts
   diff client/lib/boosting/dispatcher.ts server/src/services/boosting-dispatch.service.ts
   ```
   Notice duplicated calculation and message formatting functions across client and server.

---

## 4. Remediation Plan

1. Delete redundant pass-through module `server/src/utils/errors.ts` and update all route imports to consume `@smex/shared` directly.
2. Remove redundant type aliases and unused re-exports (`Rfc7807Problem`, `formatRfc7807Problem`, `BoostingCalcError`).
3. Replace the local `TournamentStatus` definition in `server/src/services/tournament-lifecycle.service.ts` with direct import from `@smex/shared`.
4. Consolidate boosting calculation logic and dispatch formatting into `@smex/shared/src/boosting.ts`, removing duplicated code from `client/lib/boosting/` and `server/src/services/boosting-*.service.ts`.
