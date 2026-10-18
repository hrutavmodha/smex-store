# Bug: Mobile Navbar Hamburger Opener and Theme Mode Toggler Buttons Unresponsive

- **Bug ID**: 30
- **Category**: UI / Navigation / Mobile Responsiveness
- **Severity**: High
- **Target Files**:
  - `client/components/shell/Navbar.tsx` (lines 186–223)
  - `client/components/shell/NavMobileDrawer.tsx` (lines 31–47)
  - `client/hooks/useNavbarPreferences.ts`
- **Status**: Identified

---

## 1. Description

On mobile viewports (`< 640px`, Tailwind `sm` breakpoint), the navigation bar renders a mobile controls cluster consisting of:
1. A **Mobile Theme Toggler Button** (`data-testid="mobile-theme-toggle"`).
2. A **Mobile Hamburger Menu Button** (`aria-label="Open Navigation Menu"` / `aria-label="Close Navigation Menu"`).

In live mobile browsers (mobile Safari, Android Chrome, and touch emulation), tapping these controls either fails to respond or exhibits erratic behavior:
- The hamburger button fails to reliably open the mobile navigation drawer, or the drawer does not become visible.
- The mobile theme toggler button does not trigger the theme transition between Light and Dark mode, or requires multiple taps without visual feedback.

---

## 2. Root Cause Analysis

### A. Nested Drawer Inside Constrained Sticky Header
In `client/components/shell/Navbar.tsx`:
```tsx
<header className="sticky top-0 z-50 h-16 w-full border-b border-border-subtle bg-bg-surface transition-colors duration-[120ms]">
  <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    {/* Brand, Desktop Nav, Mobile triggers */}
    <div className="flex items-center gap-2 sm:hidden">
      <button onClick={handleCycleTheme} data-testid="mobile-theme-toggle">...</button>
      <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>...</button>
    </div>
  </div>

  {/* Mobile Slide-Out Drawer rendered INSIDE header */}
  <NavMobileDrawer
    isOpen={isMobileMenuOpen}
    onClose={() => setIsMobileMenuOpen(false)}
    ...
  />
</header>
```
1. **Stacking Context & Height Bounds:**
   The `<header>` element is constrained to `h-16` (64px) with `position: sticky`. In CSS, nesting a full-screen drawer (`fixed inset-y-0 right-0 z-50 w-72`) inside an element with defined height and sticky positioning causes mobile WebKit/Blink engines to bound or clip fixed elements to the header container or disrupt stacking order when scrolling.
2. **Missing Backdrop Dismissal Layer:**
   `NavMobileDrawer` has no modal backdrop (`fixed inset-0 bg-black/60`). There is no click-outside dismiss surface, and background content remains interactable while the drawer is open.

### B. Single-Window `useSyncExternalStore` Theme Reactivity Flaw
In `client/hooks/useNavbarPreferences.ts`:
```ts
function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function useNavbarPreferences() {
  const theme = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => { ... },
    () => 'dark'
  );
  ...
}
```
1. The DOM standard `storage` event is **only dispatched cross-window** (between different browser tabs/windows). It does not natively fire within the originating document when `window.localStorage.setItem()` is executed.
2. While `handleCycleTheme` dispatches `window.dispatchEvent(new Event('storage'))`, synthetic events in mobile touch contexts can experience microtask timing delays or fail to trigger subscriber re-evaluations under React 19's concurrent scheduler if the component does not manage state transitions deterministically.
3. Furthermore, when `document.documentElement.setAttribute('data-theme', nextTheme)` executes, if the parent layout or unmigrated child elements contain hardcoded dark classes or lack reactive re-renders, the mobile navbar controls appear completely frozen to the user.

### C. Touch Event Handling & Mobile Tap Interference
1. The mobile triggers rely solely on generic `onClick` handlers. On touch devices, mobile browser gesture recognizers (e.g. scroll detection) can suppress synthetic `click` events if touch actions are not explicitly set (`touch-action: manipulation`).
2. The hamburger button icon alternates between `Menu` and `X` while the drawer *also* contains an internal `X` close button, creating out-of-sync toggle states when users close the drawer using the internal button and subsequently tap the hamburger trigger.

---

## 3. Specification & Design Reference

- `docs/internal/design/lld/frontend-architecture.md` Section 3.2:
  > "Mobile Shell & Touch Optimization: All interactive touch targets on mobile viewports must meet minimum physical touch bounds of 44x44px. Modal and drawer surfaces must mount to top-level portal roots to escape header clipping."
- UI Hardware Physics Guide: Section 2:
  > "Snappy, deterministic transitions: 120ms max hardware accelerated transforms. Drawers must provide a full-screen backdrop overlay for click-outside dismissal."

---

## 4. Reproduction Steps

1. Open Chrome DevTools and toggle **Device Emulation** (e.g. iPhone 14 Pro, viewport width 393px).
2. Navigate to `http://localhost:3000/`.
3. Locate the mobile controls in the top-right of the navigation bar.
4. **Test Hamburger Menu:**
   - Tap the hamburger menu button (`Menu` icon).
   - Observe that either the drawer fails to slide out smoothly, or is clipped/obscured by the sticky header boundary, and lacks a backdrop to close upon outside tapping.
5. **Test Mobile Theme Toggler:**
   - Tap the mobile theme toggle button (`Moon` icon).
   - Observe that the button fails to update its icon to `Sun` and the document background remains black due to storage event desynchronization and hardcoded hex overrides.

---

## 5. Impact

- Mobile users (which account for the majority of esports tournament and gaming marketplace traffic) are unable to access the main navigation menu, squad recruitment, or account settings.
- Mobile users cannot toggle between Light and Dark mode.

---

## 6. Recommended Remediation

1. **Mount Mobile Drawer via React Portal:**
   Move `<NavMobileDrawer />` out of `<header>` or render it via `createPortal(..., document.body)` so it mounts directly to `document.body` outside the 64px header height constraint.
2. **Add Full-Screen Backdrop Overlay:**
   Add a backdrop layer (`fixed inset-0 bg-black/60 z-40 sm:hidden`) to `NavMobileDrawer` with an `onClick={onClose}` handler to enable click-outside dismissal and lock body scroll when open.
3. **Deterministic Theme State Management:**
   Augment `useNavbarPreferences` to maintain an explicit React state with a custom DOM event (e.g. `'smex:theme-change'`) in addition to localStorage, ensuring immediate synchronous UI updates on touch devices without relying exclusively on synthetic storage events.
4. **Touch Target Hardening:**
   Add `touch-action: manipulation` and active state feedback (`active:scale-95`) to both mobile navbar trigger buttons.
