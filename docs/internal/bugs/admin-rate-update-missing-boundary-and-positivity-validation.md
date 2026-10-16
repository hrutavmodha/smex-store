# Bug: Admin Rate Override Lacks Positive Price & Star Boundary Invariant Validation

- **Bug ID**: BUG-M6-007
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: Medium (Input Validation Gap & DB Constraint Failure)
- **Target Files**:
  - `server/src/routes/admin/boosting.ts` (lines 5–10, 38–60)
  - `server/src/services/boosting-rate.service.ts` (lines 46–75)
- **Status**: Identified

---

## 1. Description

The administrative rate management endpoint `PATCH /api/v1/admin/boosting/rates/:id` defines input validation via Zod in `server/src/routes/admin/boosting.ts`:
```typescript
const updateRateSchema = z.object({
  priceInr: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
  minStars: z.number().int().optional(),
  maxStars: z.number().int().optional(),
});
```

### Flaws:

1. **Non-Positive Prices Accepted by Schema**:
   - The schema does not enforce `priceInr > 0`.
   - If an admin submits `priceInr: -50` or `0`, the application executes the UPDATE query against PostgreSQL.
   - Because the table has constraint `boosting_rates_price_positive_chk: check (price_inr > 0)`, the query fails at the database driver level with an unhandled error, returning a generic `500 Internal Server Error` instead of a structured `400 Bad Request`.
2. **Inverted or Negative Star Boundaries**:
   - The schema does not validate that `minStars >= 0` or that `maxStars >= minStars`.
   - If an admin submits `{ "minStars": 80, "maxStars": 20 }`, the database updates successfully.
   - When subsequent calculations execute `calculateStarBrackets`, `Math.min(s2, bracket.maxStars + 1) - Math.max(s1, bracket.minStars)` computes negative star intervals, resulting in completely broken quote calculations or silent zero-star calculations.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 4.3:
  > Invariant 1: `boosting_rates.price_inr > 0`: Base prices must be strictly positive.
  > Invariant 3: `boosting_rates.pricing_mode = 'per_star'`: Must specify non-null `star_tier`, `min_stars`, and `max_stars` with `max_stars >= min_stars`.

---

## 3. Reproduction Steps / Proof of Concept

1. As an admin, send `PATCH /api/v1/admin/boosting/rates/:id` with:
   ```json
   {
     "priceInr": -10.0
   }
   ```
2. The endpoint fails with HTTP 500 database check constraint violation.
3. Send `PATCH /api/v1/admin/boosting/rates/:perStarRateId` with:
   ```json
   {
     "minStars": 100,
     "maxStars": 10
   }
   ```
4. The endpoint responds with `200 OK`. The rate row now has `minStars > maxStars`, corrupting subsequent calculations.

---

## 4. Impact

- Unhandled 500 errors on invalid inputs.
- Potential corruption of star bracket traversal math.

---

## 5. Recommended Remediation

Refine `updateRateSchema` in `server/src/routes/admin/boosting.ts`:
```typescript
const updateRateSchema = z
  .object({
    priceInr: z
      .union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/)])
      .refine((val) => Number(val) > 0, { message: 'priceInr must be strictly positive' })
      .optional(),
    isActive: z.boolean().optional(),
    minStars: z.number().int().min(0).optional(),
    maxStars: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.minStars !== undefined && data.maxStars !== undefined) {
        return data.maxStars >= data.minStars;
      }
      return true;
    },
    { message: 'maxStars must be greater than or equal to minStars' }
  );
```
