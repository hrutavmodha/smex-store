# Bug: Partial Light/Dark Mode Implementation with Contrast Inversion and Hardcoded Hex Tokens

- **Bug ID**: 29
- **Category**: UI / Theming / Accessibility / WCAG 2.1
- **Severity**: High
- **Target Files**:
  - `client/app/globals.css`
  - `client/hooks/useNavbarPreferences.ts`
  - `client/app/layout.tsx`
  - `client/app/page.tsx`
  - `client/app/boosting/page.tsx`
  - `client/components/boosting/Calculator.tsx`
  - `client/app/marketplace/page.tsx`
  - `client/app/marketplace/create/page.tsx`
  - `client/app/marketplace/[id]/page.tsx`
  - `client/components/marketplace/MarketplaceCatalog.tsx`
  - `client/components/marketplace/CatalogFilterSidebar.tsx`
  - `client/components/marketplace/CatalogListingGrid.tsx`
  - `client/components/marketplace/ListingDetailView.tsx`
  - `client/components/marketplace/ProofLightboxCarousel.tsx`
  - `client/components/marketplace/SellerContactModal.tsx`
  - `client/components/marketplace/ProofUploadGrid.tsx`
  - `client/components/marketplace/CreateListingForm.tsx`
  - `client/app/tournaments/page.tsx`
  - `client/app/tournaments/[id]/page.tsx`
  - `client/components/tournaments/BracketVisualizer.tsx`
  - `client/components/tournaments/TournamentLobbyRoom.tsx`
  - `client/app/admin/layout.tsx`
  - `client/app/admin/page.tsx`
  - `client/app/admin/rates/page.tsx`
- **Status**: Partially Remediated / Implementation In Progress

---

## 1. Description

The Smex Store application defines a two-tier semantic theme system in `client/app/globals.css`:
- **Dark Mode (Default)**: Deep obsidian canvas (`--bg-canvas: #0B0F12`), dark surfaces (`--bg-surface: #12181D`), and high-contrast light typography (`--text-primary: #EDEDED`).
- **Light Mode**: Clean canvas (`--bg-canvas: #F4FAF8`), crisp white surfaces (`--bg-surface: #FFFFFF`), and deep emerald typography (`--text-primary: #0B1A15`).

However, the application suffered from an incomplete theme migration where large portions of the codebase bypassed semantic design tokens and relied on hardcoded dark hex values (`bg-[#0B0F12]`, `bg-[#121C19]`, `bg-[#000000]`, `text-[#EDEDED]`, `text-[#E9F5F1]`, `text-[#8FA39C]`, `border-[#223530]`) or inline styles (`style={{ backgroundColor: '#000000' }}`).

### Symptoms & Root Causes
1. **Background Stuck on Black / Obsidian:**
   When the user toggles from Dark to Light mode, the root `<html>` attribute updates to `data-theme="light"`. However, major page layouts (`boosting/page.tsx`, `marketplace/page.tsx`, `marketplace/create/page.tsx`, `tournaments/page.tsx`, `admin/layout.tsx`) contained hardcoded `style={{ backgroundColor: '#000000' }}` or static `bg-[#0B0F12]`. These hardcoded styles override CSS variables, keeping the page background pitch black.
2. **Severe Contrast Inversion & Invisible Text:**
   In containers where semantic `bg-bg-surface` was applied, the background correctly turned pure white (`#FFFFFF`) in light mode. However, child elements within those containers still contained hardcoded classes such as `text-[#EDEDED]` or `text-[#E9F5F1]`. As a result, near-white text was rendered over a pure white background, resulting in a WCAG contrast ratio below 1.1:1 (completely unreadable).
3. **Stale AMOLED Mode Residuals:**
   The codebase previously supported an undocumented "amoled" mode in `useNavbarPreferences.ts`, cycling through `dark -> amoled -> light`. This caused confusing state transitions where users clicking the toggle landed on pure black before reaching light mode.

---

## 2. Current Status: Implemented vs. Remaining

### A. Completed Work
- **AMOLED Deprecation**: Removed `[data-theme="amoled"]` overrides from `client/app/globals.css` and restricted `ThemeMode` in `client/hooks/useNavbarPreferences.ts` to strictly `'dark' | 'light'`.
- **Theme Cycling Simplification**: Updated desktop and mobile toggles to cycle binary `dark <-> light`.
- **Core Landing & Shell Migration**: Replaced hardcoded hex classes in `client/app/page.tsx` (Hero, Platform Pillars, Security Banner), `client/components/shell/CookieConsentBanner.tsx`, `client/components/notifications/NotificationCenter.tsx`, and `client/components/search/UniversalSearchModal.tsx` with semantic Tailwind theme classes (`bg-bg-canvas`, `bg-bg-surface`, `bg-bg-surface-elevated`, `text-text-primary`, `border-border-subtle`).
- **Boosting Page & Calculator Overhaul**: Stripped inline `backgroundColor: '#000000'` from `client/app/boosting/page.tsx` and refactored `client/components/boosting/Calculator.tsx` to utilize semantic theme tokens across selectors, inputs, and order quote breakdowns.
- **Marketplace Entrypoint**: Removed inline black overrides from `client/app/marketplace/page.tsx` and `client/app/marketplace/create/page.tsx`.

### B. Remaining Work
- **Marketplace Catalog & Detail Components**:
  - `client/components/marketplace/MarketplaceCatalog.tsx` (hardcoded `bg-[#121C19]`, `bg-[#0B0F12]`, `text-[#E9F5F1]`).
  - `client/components/marketplace/CatalogFilterSidebar.tsx` (hardcoded filter background, border, and checkbox styling).
  - `client/components/marketplace/CatalogListingGrid.tsx` (listing cards and empty state).
  - `client/components/marketplace/ListingDetailView.tsx` (pricing boxes, seller information cards).
  - `client/components/marketplace/CreateListingForm.tsx` (form inputs, select dropdown options, safety notice).
  - `client/components/marketplace/ProofLightboxCarousel.tsx` (carousel background, counter badge, navigation arrows).
  - `client/components/marketplace/SellerContactModal.tsx` (modal content, summary cards).
- **Tournaments Platform**:
  - `client/app/tournaments/page.tsx` (hardcoded `bg-[#000000]`, tabs, tournament grid cards).
  - `client/app/tournaments/[id]/page.tsx` (hero header, tabs container).
  - `client/components/tournaments/BracketVisualizer.tsx` (bracket board background `bg-[#000000]`, match node cards, score badges, bezier SVG stroke colors).
  - `client/components/tournaments/TournamentLobbyRoom.tsx` (lobby container `bg-[#000000]`, participant rosters, match queue items).
- **Admin Portal**:
  - `client/app/admin/layout.tsx` (inline `backgroundColor: '#000000'` on loading, redirect, and main root containers).
  - `client/app/admin/page.tsx` (metric card backgrounds `bg-[#121C19]`, borders, and text colors).
  - `client/app/admin/rates/page.tsx` (rate adjustment forms and pricing breakdown panels).

---

## 3. Specification & Design Reference

- `docs/internal/design/lld/frontend-architecture.md` Section 6.1:
  > "Color & Contrast Invariants: Dark Mode surface system uses Obsidian (`#0B0F12`), while Light Mode provides full WCAG 2.1 AA compliance (>= 4.5:1 text-to-background ratio) using `#F4FAF8` canvas, `#FFFFFF` surfaces, and `#0B1A15` primary typography."
- Antigravity Global Engineering Mandate: Section 1.B:
  > "Production code serves the end-user and business domain. Tests serve to objectively verify production reality. NEVER contort or compromise production code with hardcoded styles to satisfy test assertions."

---

## 4. Reproduction Steps

1. Launch client: `pnpm --filter @smex/client dev`
2. Open `http://localhost:3000/marketplace` or `http://localhost:3000/tournaments` in the browser.
3. Click the theme toggle button (Moon icon) in the top navbar.
4. Observe the rendered DOM:
   - The `<html>` element switches to `data-theme="light"`.
   - On unmigrated pages, the background remains pitch black `#000000` or `#0B0F12`.
   - In areas where child cards turn white, text remains white `#EDEDED` or `#E9F5F1`, rendering the content unreadable.

---

## 5. Impact

- High visual degradation and total illegibility of platform features in Light Mode.
- Violates WCAG 2.1 AA accessibility guidelines on color contrast.
- Inconsistent branding across routes where some pages adapt while others remain dark obsidian.

---

## 6. Recommended Remediation Plan

1. Complete the replacement of all remaining instances of `bg-[#0B0F12]`, `bg-[#121C19]`, `bg-[#000000]`, and `style={{ backgroundColor: '#000000' }}` with `bg-bg-canvas`, `bg-bg-surface`, or `bg-bg-surface-elevated`.
2. Replace all static white text classes (`text-[#EDEDED]`, `text-[#E9F5F1]`, `text-white` on surface backgrounds) with semantic `text-text-primary`, `text-text-secondary`, and `text-text-muted`.
3. In `BracketVisualizer.tsx`, make SVG connector stroke lines adapt dynamically to theme border variables (`var(--border-subtle)` vs `var(--emerald-primary)`).
4. Update unit and a11y tests in `client/test/` to verify semantic theme classes rather than asserting artificial inline `style.backgroundColor === 'rgb(0, 0, 0)'`.
