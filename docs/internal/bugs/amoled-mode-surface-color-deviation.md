# Bug: AMOLED Mode Surface Color Token Configured as `#0A0A0A` Instead of Pure `#000000`

- **Bug ID**: BUG-M2-004
- **Milestone**: Milestone 2: Data Layer and Client UI Shell (relates to UI design constraints)
- **Severity**: Medium (Design Specification & Visual Token Deviation)
- **Target Files**:
  - `client/app/globals.css` (lines 32–38)
- **Status**: Identified

---

## 1. Description

In `client/app/globals.css`, the AMOLED theme overrides are declared as:
```css
/* Pure AMOLED Overrides */
[data-theme="amoled"] {
  --bg-canvas: #000000;
  --bg-surface: #0A0A0A;
  --bg-surface-elevated: #121212;
  --border-subtle: #1F1F1F;
  --border-prominent: #2E2E2E;
}
```

Here, `--bg-surface` is set to `#0A0A0A`.

Components such as `Navbar` (`<header className="... bg-bg-surface ...">`), `Footer` (`<footer className="... bg-bg-surface ...">`), mobile drawers, profile dropdowns, and cards rely on `bg-bg-surface` (which resolves to `--bg-surface`).

However, the design specification across multiple internal documents strictly prohibits `#0A0A0A` in AMOLED mode:
- `docs/internal/design/lld/auth-and-sessions.md` Section 11.1 explicitly states:
  > "AMOLED Mode: Pure True-Black `#000000` with subtle border `#1F1F1F` (strictly complying with `ui.md` line 24 & line 38 so OLED pixels turn off completely; zero `#0A0A0A`)."
- `client/test/auth-ui.test.tsx` (LLT Test 29) explicitly verifies:
  > "1. Prohibited: zero #0A0A0A in modal component. 2. Pure True-Black: AMOLED surface must explicitly use #000000."
- `docs/internal/design/ui.md` line 24 & 38 states that the base and surface for AMOLED is `#000000` so OLED pixels turn off completely.

Because `globals.css` configured `--bg-surface: #0A0A0A;`, the Navbar, Footer, and other surfaces in AMOLED mode render as very dark gray (`#0A0A0A`) rather than pure true black (`#000000`), keeping OLED pixels illuminated and causing visual contrast mismatch with `--bg-canvas`.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 7.3 Item 1:
  > "Positioning: sticky top-0 z-50 with solid surface background (`bg-bg-surface` / `#0B0F12` or AMOLED `#000000`)."
- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 11.1:
  > Pure True-Black `#000000` with subtle border `#1F1F1F`; zero `#0A0A0A`.
- **UI Guide Reference**: `docs/internal/design/ui.md` Section 1.1 line 24 & Section 2 Item 2.

---

## 3. Reproduction Steps / Proof of Concept

1. Set `data-theme="amoled"` on `<html>`.
2. Inspect the computed background color of `<header>` (the Navbar):
   - Computes to `rgb(10, 10, 10)` (`#0A0A0A`).
3. Compare against expected AMOLED specification: `rgb(0, 0, 0)` (`#000000`).

---

## 4. Impact

- OLED mobile screens do not completely power down subpixels on navigation and card surfaces.
- Inconsistent visual rendering across components (e.g. `AuthModal` worked around this with `[data-theme=amoled]_&:bg-[#000000]`, while `Navbar` and other shell components still render `#0A0A0A`).

---

## 5. Recommended Remediation

Update `client/app/globals.css`:
```css
/* Pure AMOLED Overrides */
[data-theme="amoled"] {
  --bg-canvas: #000000;
  --bg-surface: #000000;
  --bg-surface-elevated: #0B0B0B;
  --border-subtle: #1F1F1F;
  --border-prominent: #2E2E2E;
}
```
