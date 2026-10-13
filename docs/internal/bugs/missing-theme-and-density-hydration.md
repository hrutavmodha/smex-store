# Bug: Missing Initial Theme & Density Hydration Breaks Preference Persistence

- **Bug ID**: BUG-M2-003
- **Milestone**: Milestone 2: Data Layer and Client UI Shell
- **Severity**: Medium (Design & Usability Violation)
- **Target Files**:
  - `client/components/shell/Navbar.tsx` (lines 79–114)
  - `client/app/layout.tsx` (lines 28–35)
- **Status**: Identified

---

## 1. Description

The application supports three theme modes (`dark`, `amoled`, `light`) and three interface densities (`compact`, `comfortable`, `spacious`), which are intended to persist across user sessions using `localStorage`.

In `client/components/shell/Navbar.tsx`, `useSyncExternalStore` reads the stored values from `localStorage`:
```typescript
const theme = useSyncExternalStore<ThemeMode>(
  subscribeStorage,
  () => {
    if (typeof window === 'undefined' || !window.localStorage) return 'dark';
    const stored = window.localStorage.getItem('smex_theme') as ThemeMode;
    return stored || 'dark';
  },
  () => 'dark'
);
```

However, `document.documentElement.setAttribute('data-theme', nextTheme)` and `document.documentElement.setAttribute('data-density', nextDensity)` are **only** executed inside the button click handlers `handleCycleTheme()` and `handleCycleDensity()`.

There is no client hydration effect, hook, or inline initialization script in `layout.tsx` or `Navbar.tsx` that applies the saved `localStorage` values to `<html>` upon initial page load or page reload.

In `client/app/layout.tsx`:
```tsx
<html
  lang="en"
  data-theme="dark"
  data-density="comfortable"
  ...
>
```
The root `<html>` element is hardcoded with `data-theme="dark"` and `data-density="comfortable"`.

When a user selects `amoled` (or `light`) or `compact` and refreshes the page:
1. `layout.tsx` renders with `data-theme="dark"`.
2. `Navbar`'s toggle button reads `'amoled'` from `localStorage` and renders the AMOLED phone icon.
3. But the DOM `<html>` element retains `data-theme="dark"`.
4. The page visual style is displayed in **Dark Mode**, not AMOLED Mode.
5. The user's persisted preferences are ignored until the user clicks the cycle buttons again.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 1:
  > Presentation Tier Flowchart specifies: `LAYOUT --> THEME_INIT["AMOLED / Dark Theme Hydration"]`.
- **SRS Reference**: `docs/internal/requirements.md` Section 6.13 & Section 22 Item 12:
  > "Dark, Light, and AMOLED modes persist across user sessions."

---

## 3. Reproduction Steps / Proof of Concept

1. Load the client application in a browser.
2. Click the theme toggle button to switch to AMOLED mode (`data-theme="amoled"`).
3. Confirm the background turns black.
4. Refresh the page (`F5` or `Cmd+R`).
5. Observe the background: it reverts to obsidian dark (`#0B0F12`), not black (`#000000`).
6. Inspect the DOM element `<html>`:
   - `document.documentElement.getAttribute('data-theme')` is `"dark"`.
   - `localStorage.getItem('smex_theme')` is `"amoled"`.
   The theme did not persist across reload.

---

## 4. Impact

- Violation of user preference persistence requirement.
- Inconsistency between UI icon state (showing AMOLED/Light) and actual rendered CSS styles (rendering Dark).

---

## 5. Recommended Remediation

Add an initial theme and density hydration script or `useLayoutEffect` / `useEffect` in a client provider or `RootLayout`:
```typescript
useEffect(() => {
  const savedTheme = localStorage.getItem('smex_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  const savedDensity = localStorage.getItem('smex_density');
  if (savedDensity) {
    document.documentElement.setAttribute('data-density', savedDensity);
  }
}, []);
```
Or include a blocking inline `<script>` in `<head>` to prevent Flash of Unstyled Content (FOUC).
