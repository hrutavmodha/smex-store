# Bug: Marketplace Catalog Ignores Server Total Count & Hardcodes Single-Page Results

- **Bug ID**: BUG-M7-007
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads
- **Severity**: Medium (Data Contract Drift / Missing Pagination Architecture)
- **Target Files**:
  - `client/components/marketplace/MarketplaceCatalog.tsx` (lines 48, 79–81)
  - `shared/src/marketplace.ts` (lines 53–59)
  - `server/src/routes/marketplace/index.ts` (lines 85–92)
- **Status**: Identified

---

## 1. Description

The shared contract between server and client in `shared/src/marketplace.ts` defines paginated listing responses:
```typescript
// shared/src/marketplace.ts:53-59
export interface GetListingsResponse {
  listings: MarketplaceListingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

The Fastify server route (`server/src/routes/marketplace/index.ts` lines 85–92) returns these exact fields:
```typescript
return reply.code(200).send({
  listings,
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});
```

However, in `client/components/marketplace/MarketplaceCatalog.tsx`:
1. The client hardcodes `limit: 50` on initial load (line 48) and never provides any page selector, "Load More" button, or pagination controls.
2. When parsing the server response:
   ```typescript
   // client/components/marketplace/MarketplaceCatalog.tsx:79-80
   setListings(filtered);
   setTotalCount(filtered.length);
   ```
   The client completely discards `data.total` and `data.totalPages` returned by the server, overwriting `totalCount` with the array length of the local page slice (`filtered.length`).

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 7 Section 7.5:
  > "Build Marketplace catalog page with rank filters, price range sliders, and dynamic deal badges."
- **Contract Standard**: Front-end consumers must consume authoritative server metadata (`data.total`, `data.totalPages`) rather than deriving total counts from local client-side array slices.

---

## 3. Reproduction Steps / Proof of Concept

1. Populate the database with 75 active marketplace listings.
2. Open `/marketplace` in the browser.
3. Observe the catalog UI:
   - Header shows: `"Showing 50 listings"` instead of `"Showing 50 of 75 listings"`.
   - The remaining 25 listings are inaccessible because there are no pagination controls or "Next Page" buttons.

---

## 4. Impact

- **Permanent Inaccessibility of Catalogs > 50 Items**: Any listing beyond the first 50 results is permanently invisible to users.
- **Contract Inconsistency**: Server and client diverge on pagination semantics.

---

## 5. Recommended Remediation

1. In `client/components/marketplace/MarketplaceCatalog.tsx`:
   - Store and use `data.total` and `data.totalPages` from the server response:
     ```typescript
     setListings(data.listings);
     setTotalCount(data.total);
     setTotalPages(data.totalPages);
     ```
   - Implement pagination controls (Previous / Next page buttons) or infinite scroll utilizing `params.page`.
