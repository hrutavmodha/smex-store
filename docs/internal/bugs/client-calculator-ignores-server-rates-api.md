# Bug: Client Calculator Never Fetches Active Rates from API, Relying on Static Hardcoded Prices

- **Bug ID**: BUG-M6-002
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: High (Architectural Disconnect & Price Quoting Desynchronization)
- **Target Files**:
  - `client/components/boosting/Calculator.tsx` (lines 62–99)
  - `client/lib/boosting/calculator.ts` (lines 101–112)
  - `server/src/routes/boosting.ts` (lines 56–62)
- **Status**: Resolved

---

## 1. Description

The system design explicitly specifies a dynamic pricing engine where administrators manage tier rates, star brackets, and surcharges via the database, and the public API exposes `GET /api/v1/boosting/rates` to deliver active matrices to the presentation layer:
- `docs/internal/design/lld/mlbb-boosting.md` Section 5.1 & 6.2.
- `server/src/routes/boosting.ts` lines 56–62 (`GET /api/v1/boosting/rates`).

However, the frontend component `Calculator.tsx` (`client/components/boosting/Calculator.tsx`):
1. **Never calls `GET /api/v1/boosting/rates`**: There is no `useEffect`, SWR, React Query, or `fetch` call anywhere in the client codebase targeting `boosting/rates`.
2. **Relies Exclusively on Static Hardcoded Constants**: The client imports `calculateBoostingPrice` from `client/lib/boosting/calculator.ts`, which uses hardcoded constants:
   - `DEFAULT_FIXED_TIER_RATES` (Epic to Legend: ₹400, Legend to Mythic: ₹300, Epic to Mythic: ₹600).
   - `DEFAULT_STAR_BRACKETS` (Mythic: ₹20, Honor: ₹30, Glory: ₹35, Immortal: ₹40).
   - `DEFAULT_SURCHARGES` (Role Priority: 15%, Hero Pool: ₹150, Duo: 25%).

### The Pricing Desynchronization Hazard
When an administrator modifies a rate in production (e.g. adjusts Mythical Honor to ₹35/star or updates the bundle discount via `PATCH /api/v1/admin/boosting/rates/:id`):
1. The web page continues quoting the old, hardcoded price (e.g. ₹450.00).
2. The customer reviews the on-screen summary: `TOTAL ESTIMATED PRICE: ₹450.00 INR`.
3. The customer clicks "1-Click WhatsApp".
4. The backend endpoint `POST /api/v1/boosting/orders` recalculates the price using live database rates (e.g. ₹550.00).
5. The pre-filled WhatsApp message dispatched to the booster states:
   `Calculated Price: ₹550.00 INR`.
6. The customer immediately discovers a price discrepancy between the web quote and the chat message, undermining customer trust and creating support disputes.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 5.1 & Section 6.2.
- **ADR Reference**: `docs/internal/adr/rank-boosting-model-pricing-system.md` (ADR 0002).

---

## 3. Reproduction Steps / Proof of Concept

1. As an administrator, call `PATCH /api/v1/admin/boosting/rates/:mythicHonorRateId` with `{ "priceInr": 35.00 }`.
2. Open `/boosting` on the client.
3. Select "Per-Star Ladder", starting at Mythic 10★ and target at Mythical Honor 30★.
4. **Observed on Client UI**: The price remains ₹450.00 (`15*20 + 5*30`), completely ignoring the new ₹35/star rate.
5. Fill in IGN and click "1-Click WhatsApp".
6. **Observed in Dispatched Message**: The generated text states `Calculated Price: ₹475.00 INR` (`15*20 + 5*35`).
7. The on-screen estimate (₹450) contradicts the dispatched order (₹475).

---

## 4. Impact

- Public `GET /api/v1/boosting/rates` endpoint is orphaned and unused in production.
- Live administrative rate changes do not propagate to the client calculator.
- Unavoidable price mismatch between browser UI and dispatched order messages.

---

## 5. Recommended Remediation

1. In `client/components/boosting/Calculator.tsx`, fetch active rates on component mount via `GET /api/v1/boosting/rates`:
   ```typescript
   useEffect(() => {
     fetch('/api/v1/boosting/rates')
       .then((res) => res.json())
       .then((data) => {
         if (data?.rates) setRates(data.rates);
         if (data?.surcharges) setSurcharges(data.surcharges);
       })
       .catch(() => {});
   }, []);
   ```
2. Pass `rates` and `surcharges` into `calculateBoostingPrice({ ... })` in `Calculator.tsx`.
