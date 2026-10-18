# Bug: Marketplace Client Multi-Rank Filter Bypasses Server-Side Query & Truncates Catalog Results

- **Bug ID**: BUG-M7-003
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads
- **Severity**: Medium (Client-Side State Inconsistency & Data Truncation Flaw)
- **Target Files**:
  - `client/components/marketplace/MarketplaceCatalog.tsx` (lines 55–58, 73–81)
- **Status**: Identified

---

## 1. Description

The backend marketplace service (`server/src/services/listing.service.ts` line 265) and route (`server/src/routes/marketplace/index.ts` line 43) fully support filtering by multiple rank tiers via arrays:
```typescript
// server/src/routes/marketplace/index.ts:43
rankTier: z.union([z.string(), z.array(z.string())]).optional(),

// server/src/services/listing.service.ts:265-269
if (params.rankTier) {
  if (Array.isArray(params.rankTier)) {
    conditions.push(inArray(marketplaceListings.rankTier, params.rankTier));
  } else {
    conditions.push(eq(marketplaceListings.rankTier, params.rankTier));
  }
}
```
Furthermore, `client/lib/marketplace/api.ts` supports `rankTier?: string | string[]` and formats it using URLSearchParams.

However, in `client/components/marketplace/MarketplaceCatalog.tsx`:
```typescript
// lines 55-58
if (selectedRanks.length === 1) {
  params.rankTier = selectedRanks[0];
}

// lines 73-81
const data = await fetchMarketplaceListings(params);

if (!cancelled) {
  let filtered = data.listings || [];
  if (selectedRanks.length > 1) {
    filtered = filtered.filter((l) => selectedRanks.includes(l.rankTier));
  }

  setListings(filtered);
  setTotalCount(filtered.length);
}
```

When a user selects two or more ranks (e.g. "Mythic" and "Mythical Glory"):
1. The client omits `params.rankTier` entirely from the HTTP request to the server.
2. The server returns the first 50 listings of **any** rank tier.
3. The client filters only those 50 returned items in memory.
4. `setTotalCount` is overwritten with the length of that local slice (`filtered.length`) instead of the server's true `totalCount`.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 7 Section 7.5:
  > "Build Marketplace catalog page with rank filters, price range sliders, and dynamic deal badges."
- **Architecture Mandate**: Data filtering and pagination must be processed server-side to guarantee deterministic pagination across dataset partitions.

---

## 3. Reproduction Steps / Proof of Concept

1. Populate the database with:
   - 50 listings of rank `Epic`.
   - 20 listings of rank `Mythic`.
   - 10 listings of rank `Mythical Glory`.
2. Open the Marketplace Catalog page in the browser.
3. Select "Mythic" and "Mythical Glory" in the rank tier checkboxes.
4. **Result**:
   - The client fetches `limit: 50` without rank filter, receiving the 50 `Epic` accounts.
   - The client-side filter filters out all 50 `Epic` accounts.
   - The UI displays: `"No listings found matching your criteria"` and `"Showing 0 listings"`, even though there are 30 matching listings in the database!

---

## 4. Impact

- **Silent Results Truncation**: As the catalog grows, users selecting multiple rank tiers will miss valid listings or see empty pages when valid matching accounts exist on subsequent database pages.
- **Inaccurate Listing Counts**: Total count displays the count of the filtered 50-item page rather than the total matching listings in the database.

---

## 5. Recommended Remediation

1. In `client/components/marketplace/MarketplaceCatalog.tsx`:
   Pass `selectedRanks` directly to `params.rankTier`:
   ```typescript
   if (selectedRanks.length > 0) {
     params.rankTier = selectedRanks.length === 1 ? selectedRanks[0] : selectedRanks;
   }
   ```
2. Remove the redundant and harmful client-side post-filter:
   ```typescript
   setListings(data.listings || []);
   setTotalCount(data.totalCount || 0);
   ```
