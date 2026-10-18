# Bug: Monolithic UI Component Architecture Bloating Complexity in Core Shell and Marketplace Views

- **Bug ID**: BUG-M7-008
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads (Relates to Shell Architecture)
- **Severity**: Low / Code Quality Smell (Maintainability & Readability Degradation)
- **Target Files**:
  - `client/components/shell/Navbar.tsx` (496 lines)
  - `client/components/marketplace/MarketplaceCatalog.tsx` (389 lines)
  - `client/components/marketplace/CreateListingForm.tsx` (387 lines)
- **Status**: Identified

---

## 1. Description

Modern React component architecture recommends single-responsibility, cohesive components where presentation, state management, and data access are decomposed into sub-components and custom hooks.

In the Smex Store client codebase, multiple core views have evolved into monolithic, bloated files:

1. **`Navbar.tsx` (496 lines)**:
   Contains:
   - Theme hydration, localStorage syncing, and cycle handling.
   - Density hydration, localStorage syncing, and toggle handling.
   - Global keyboard event listeners (`Cmd+K` / `Ctrl+K`).
   - Profile dropdown state and click-outside listeners.
   - Mobile menu overlay and drawer state.
   - Search modal mounting.
   - NotificationCenter mounting.
   - Inline navigation links, route active checks, and extensive SVG iconography markup.
2. **`MarketplaceCatalog.tsx` (389 lines)**:
   Contains:
   - Search input state.
   - Rank tier multi-checkbox state.
   - Price floor/ceiling inputs and parsing.
   - Deal badge filter selector.
   - Sort dropdown state.
   - Direct `useEffect` asynchronous data fetching and client-side array post-filtering.
   - Responsive filter drawer and desktop sidebar markup.
   - Card grid layout, loading skeletons, and empty state JSX.
3. **`CreateListingForm.tsx` (387 lines)**:
   Contains:
   - File input handling and binary S3 upload progress tracking.
   - Upload error banner state.
   - Multi-step proof image thumbnail grid and remove handlers.
   - Dynamic price input and discount preview logic.
   - Form submission and validation.

---

## 2. Specification & Design Reference

- **Clean Architecture & Component Design Standard**: React components exceeding 250–300 lines should be refactored into cohesive sub-components and custom hooks (`useNavbarPreferences`, `useCatalogListings`, `<CatalogFilterSidebar />`, `<ListingGrid />`).

---

## 3. Impact

- **Cognitive Overload**: Debugging a minor styling or filter issue requires navigating massive 400–500 line files with deeply nested JSX trees.
- **High Re-render Blast Radius**: State changes (such as typing into the search input or toggling the mobile menu) trigger re-renders of the entire monolithic tree rather than isolated child components.
- **Reduced Reusability**: Components like the filter panel or image upload progress grid cannot be reused elsewhere on the platform (e.g. in Admin moderation views or Profile editing).

---

## 4. Recommended Remediation

1. Decompose `MarketplaceCatalog.tsx` into:
   - `client/components/marketplace/CatalogFilterSidebar.tsx` (Rank, price, and badge filters)
   - `client/components/marketplace/CatalogListingGrid.tsx` (Card presentation and skeletons)
   - `client/hooks/useCatalogListings.ts` (Data fetching, debounce, and query state)
2. Decompose `Navbar.tsx` into:
   - `client/components/shell/NavUserMenu.tsx` (Profile dropdown)
   - `client/components/shell/NavMobileDrawer.tsx` (Mobile slide-out)
   - `client/hooks/useNavbarPreferences.ts` (Theme and density state syncing)
