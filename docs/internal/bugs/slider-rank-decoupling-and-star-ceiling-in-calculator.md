# Bug: Per-Star Slider and Rank Dropdown Decoupling & 150-Star Artificial Ceiling

- **Bug ID**: BUG-M6-003
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: Medium (UI/UX Flaw & Ladder Model Inconsistency)
- **Target Files**:
  - `client/components/boosting/Calculator.tsx` (lines 284–335)
  - `server/src/services/boosting-calc.service.ts` (lines 145–151)
- **Status**: Resolved

---

## 1. Description

In Per-Star Ladder mode (`client/components/boosting/Calculator.tsx`), the interface presents two controls for each progression boundary (Starting and Target):
1. A dropdown selection: `starStartTier` / `starTargetTier` (Mythic, Mythical Honor, Mythical Glory, Mythical Immortal).
2. A range slider: `startingStars` / `targetStars`.

### A. Total Decoupling of Controls
The dropdown and the slider operate completely independently without bidirectional synchronization:
- Changing the dropdown (e.g. from "Mythic" to "Mythical Glory", which represents 50–99 stars) does **not** update the star slider value to 50★ or change the slider bounds.
- Dragging the slider (e.g. from 10★ to 60★) does **not** update the dropdown to "Mythical Glory".
- A user can configure incoherent combinations, such as:
  - Starting Rank: `Mythical Immortal` (defined as 100+ stars) with Slider: `0★`.
  - Target Rank: `Mythic` (defined as 0–24 stars) with Slider: `80★`.

Furthermore, `calculateBoostingPrice` on the server and client calculates prices purely from `startingStars` and `targetStars`, completely ignoring the selected `starStartTier` and `starTargetTier` strings when in per-star mode. The dropdown is purely cosmetic and misleading.

### B. Artificial 150-Star Ceiling
In `Calculator.tsx` lines 300 and 330:
```tsx
<input
  type="range"
  data-testid="starting-stars-slider"
  min={0}
  max={150}
  value={startingStars}
  ...
/>
```
The range sliders enforce an arbitrary `max={150}`.
However:
- The database schema check and rate tables define Mythical Immortal as spanning `min_stars: 100` to `max_stars: 999`.
- The calculation engine explicitly clamps stars to `999` (`docs/internal/design/lld/mlbb-boosting.md` Section 2.2).
- High-elo competitive players seeking progression to 200★, 300★, or beyond are physically unable to select their star targets on the client UI.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 2.2 & Section 6.1.
- **ADR Reference**: `docs/internal/adr/rank-boosting-model-pricing-system.md` (ADR 0002).

---

## 3. Reproduction Steps / Proof of Concept

1. Navigate to `/boosting` and select "Per-Star Ladder".
2. In "1. Current Rank & Stars", select "Mythical Immortal" from the dropdown.
3. Observe the star counter: it remains at `10★` (which is within base Mythic, not Immortal).
4. Attempt to drag the "Target Stars" slider to 250★.
5. **Observed**: The slider cannot be dragged past 150★.

---

## 4. Impact

- Confusing and contradictory UI state where displayed rank title and star count conflict.
- Customers cannot calculate quotes for high-star progressions (151–999★) supported by the backend engine.

---

## 5. Recommended Remediation

1. Synchronize the rank dropdown and star slider bidirectionally:
   - When selecting a tier in the dropdown, automatically adjust the slider to that tier's base stars (Mythic: 0, Honor: 25, Glory: 50, Immortal: 100).
   - When moving the slider across bracket thresholds (e.g. crossing 25, 50, 100), automatically update the selected dropdown option.
2. Provide a numeric text input alongside the slider, allowing users to type stars up to 999.
