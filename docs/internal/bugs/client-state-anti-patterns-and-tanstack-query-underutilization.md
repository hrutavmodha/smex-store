# Bug: Client State Anti-Patterns and Underutilization of Configured TanStack Query

- **Bug ID**: 27
- **Category**: Frontend Architecture / Maintainability
- **Severity**: Medium
- **Target Files**:
  - `client/components/boosting/Calculator.tsx` (lines 75–86)
  - `client/hooks/useCatalogListings.ts` (lines 8–80)
  - `client/app/layout.tsx` (lines 44–48)
  - `client/package.json` (line 15)
- **Status**: Identified

---

## 1. Description

The client package installs `@tanstack/react-query: ^5.104.1` and wraps the entire application shell with `<QueryProvider>` in `client/app/layout.tsx`.
Despite this foundational infrastructure, multiple core pages and components roll their own manual data-fetching logic using `useEffect + fetch`, combined with React state anti-patterns:

1. In `client/components/boosting/Calculator.tsx`:
   ```ts
   useEffect(() => {
     fetch('/api/v1/boosting/rates')
       .then((res) => {
         if (!res.ok) return null;
         return res.json();
       })
       .then((data) => {
         if (data?.rates) setRates(data.rates);
         if (data?.surcharges) setSurcharges(data.surcharges);
       })
       .catch(() => {});
   }, []);
   ```
   No caching, automatic retries, deduplication, error handling, or loading indicators are utilized.

2. In `client/hooks/useCatalogListings.ts`:
   Lines 34–40 perform synchronous state adjustments during the render phase:
   ```ts
   const filterKey = `${debouncedQuery}:${selectedRanks.join(',')}:${minPrice}:${maxPrice}:${selectedBadge}:${sortBy}`;
   const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

   if (filterKey !== prevFilterKey) {
     setPrevFilterKey(filterKey);
     setPage(1);
   }
   ```
   Setting state conditionally during the render body causes an immediate synchronous re-render in React 19. Furthermore, 12 distinct `useState` variables, a manual `cancelled` boolean, and an explicit debounce timer are maintained across ~140 lines of boilerplate.

---

## 2. Specification & Design Reference

- `docs/internal/roadmap.md` Section 1.2: "Next.js 16 App Router Setup: TanStack Query v5 integration with centralized query client."
- `docs/internal/design/lld/frontend-state.md` Section 2: "Server State vs Local State: All server entities must be managed via TanStack Query hooks with declarative query keys."

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect React DevTools Profiler while typing into the Marketplace search input or selecting filters.
2. Observe cascading double renders triggered by `setPrevFilterKey` and `setPage(1)` during render execution.
3. Rapidly navigate away and back to `/boosting`:
   Rates are re-fetched from the network every single mount without leveraging query cache.

---

## 4. Impact

Increased network bandwidth usage, absence of background caching/stale-while-revalidate behavior, unnecessary double re-renders on filter changes, and bloated component boilerplate that is difficult to maintain.

---

## 5. Recommended Remediation

1. Refactor `Calculator.tsx` to use `useQuery`:
   ```ts
   const { data } = useQuery({
     queryKey: ['boosting-rates'],
     queryFn: async () => {
       const res = await fetch('/api/v1/boosting/rates');
       if (!res.ok) throw new Error('Failed to fetch rates');
       return res.json();
     },
     staleTime: 5 * 60 * 1000, // 5 minutes
   });
   ```
2. Refactor `useCatalogListings.ts` to derive pagination and filter state via TanStack Query with `keepPreviousData: true` / `placeholderData: keepPreviousData`, eliminating synchronous render-time `setState` calls and manual `cancelled` flags.
