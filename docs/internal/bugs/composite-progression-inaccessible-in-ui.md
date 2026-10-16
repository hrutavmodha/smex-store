# Bug: Composite Cross-Regime Progression Engine Inaccessible in Client Presentation UI (AI Fluff / Dead Code)

- **Bug ID**: BUG-M6-004
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: High (Feature Omission / Dead Business Logic in Production UI)
- **Target Files**:
  - `client/components/boosting/Calculator.tsx` (lines 17, 208–274)
  - `server/src/services/boosting-calc.service.ts` (lines 217–258)
  - `server/test/services/boosting-calc-composite.test.ts`
- **Status**: Identified

---

## 1. Description

Section 2.3 of `docs/internal/design/lld/mlbb-boosting.md` specifies **Composite Cross-Regime Progression**:
> "When a customer orders progression originating Sub-Mythic (e.g. Epic or Legend) and terminating at a specific Star count in Mythic or above (e.g. Mythical Honor 25★):
> CompositePrice = FixedTierJump(StartRank -> Mythic) + MythicBasePrice(0 -> S2)"

The calculation engine in `server/src/services/boosting-calc.service.ts` (lines 217–258) and `client/lib/boosting/calculator.ts` (lines 217–258) contains complete mathematical logic for composite calculations, and two tests in `server/test/services/boosting-calc-composite.test.ts` verify:
- Test 13: Legend to Mythical Honor 30★ (₹950.00).
- Test 14: Epic to Mythic 20★ (₹1,000.00).

### The Flaw in Presentation UI
In `client/components/boosting/Calculator.tsx`:
1. The mode selector provides only two mutually exclusive tabs:
   - "Fixed Tier Packages (Sub-Mythic)" (`pricingMode = 'fixed_tier'`)
   - "Per-Star Ladder (Mythic & Above)" (`pricingMode = 'per_star'`)
2. In "Fixed Tier Packages":
   - The starting rank dropdown is strictly limited to `['Epic', 'Legend']`.
   - The target rank dropdown is strictly limited to `['Legend', 'Mythic']`.
   - No star count input exists.
3. In "Per-Star Ladder":
   - The starting rank dropdown is strictly limited to `['Mythic', 'Mythical Honor', 'Mythical Glory', 'Mythical Immortal']`.
   - Neither Epic nor Legend can be selected as a starting rank.

Because of this rigid UI segregation, **it is physically impossible for any customer in the live web application to order a boost from Epic or Legend into Mythic Stars**.
The entire composite engine implementation, despite passing automated unit tests, represents completely dead, unreachable code for live end-users.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 2.3 & Section 6.1.
- **LLT Reference**: `docs/internal/testing/llt/mlbb-boosting.md` Section 2.3 (Tests 13 & 14).
- **Engineering Mandate**: Section 1 & Section 3.A (Production Reality Over Test Illusions).

---

## 3. Reproduction Steps / Proof of Concept

1. Open `/boosting` in a web browser.
2. Attempt to calculate a quote for boosting an account from **Legend** to **Mythical Honor 30★**.
3. Under "Fixed Tier Packages", target rank cannot be set to Mythical Honor or any star count.
4. Under "Per-Star Ladder", starting rank cannot be set to Legend or Epic.
5. **Observed**: The user cannot configure the composite order from the UI.

---

## 4. Impact

- Customers cannot order cross-regime boosts (Sub-Mythic to Mythic Stars), which is a common real-world rank boosting requirement.
- Core engine capability tested in test suites is completely disconnected from the live production frontend.

---

## 5. Recommended Remediation

1. In `client/components/boosting/Calculator.tsx`:
   - Either add a third mode tab: "Composite (Sub-Mythic to Stars)", OR
   - Unify the selector so that selecting a Sub-Mythic starting rank (Epic/Legend) and a Mythic star target automatically engages composite mode.
