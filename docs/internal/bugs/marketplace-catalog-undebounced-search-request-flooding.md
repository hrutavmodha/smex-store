# Bug: Marketplace Catalog Search Input Lacks Debounce Timer Causing Network Request Flooding

- **Bug ID**: BUG-M7-004
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads
- **Severity**: Medium (Client Performance / Network Resource Waste / AI Fluff)
- **Target Files**:
  - `client/components/marketplace/MarketplaceCatalog.tsx` (lines 41–99)
- **Status**: Identified

---

## 1. Description

In `client/components/marketplace/MarketplaceCatalog.tsx`, the search bar directly updates the state `searchQuery`:
```tsx
<input
  type="text"
  placeholder="Search accounts by title or keywords..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="..."
/>
```

The data loading `useEffect` hook depends directly on `searchQuery`:
```tsx
useEffect(() => {
  let cancelled = false;
  const load = async () => {
    // ...
    if (searchQuery.trim()) {
      params.q = searchQuery.trim();
    }
    const data = await fetchMarketplaceListings(params);
    // ...
  };
  void load();
  return () => { cancelled = true; };
}, [searchQuery, selectedRanks, minPrice, maxPrice, selectedBadge, sortBy]);
```

There is zero debounce delay. Every single keystroke (e.g. typing a 15-character query "mythic account") fires 15 immediate concurrent HTTP GET requests to `/api/v1/marketplace/listings`.

In contrast, `UniversalSearchModal.tsx` in Milestone 8 implements a standard 300ms debounce timer to prevent request flooding.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 7 Section 7.5:
  > "Build Marketplace catalog page with rank filters, price range sliders, and dynamic deal badges."
- **Performance Standard**: Search inputs that query backend APIs over the network must debounce keystrokes (typically 250–350ms) to prevent server overload and race conditions.

---

## 3. Reproduction Steps / Proof of Concept

1. Open the browser Network DevTools tab on `/marketplace`.
2. Type "glory account" into the search field at normal typing speed.
3. Observe the Network tab:
   - 13 separate HTTP GET requests are fired in rapid succession (< 1.5 seconds).
   - Server handles 13 database queries instead of 1.

---

## 4. Impact

- **Network Request Flooding**: Degrades client responsiveness and generates unnecessary database query volume on the backend.
- **Race Condition Latency**: Slower earlier responses may finish after faster later responses if cancellation is delayed or network packets reorder.

---

## 5. Recommended Remediation

1. Introduce a debounced search state or standard debounce hook (300ms) in `client/components/marketplace/MarketplaceCatalog.tsx`:
   ```typescript
   const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

   useEffect(() => {
     const timer = setTimeout(() => {
       setDebouncedQuery(searchQuery);
     }, 300);
     return () => clearTimeout(timer);
   }, [searchQuery]);
   ```
2. Replace `searchQuery` with `debouncedQuery` in the catalog fetch effect dependency array.
