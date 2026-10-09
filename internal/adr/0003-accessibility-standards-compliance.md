# ADR 0003: Accessibility Standards Compliance

## Status
Accepted

## Date
2026-10-09

## Context & Problem Statement
The platform features an immersive esports visual design system, including deep dark modes (Dark `#0B0F12`, AMOLED `#000000`), emerald/teal accent colors, neon state badges, and dynamic animations.

Dark-themed gaming applications frequently suffer from severe accessibility shortcomings:
- Extremely low contrast between text and background surfaces (unreadable dark grays).
- Omission of visible keyboard focus rings to maintain a "clean" aesthetic.
- Inaccessible custom UI elements (sliders, tab pickers, theme switches) that lack ARIA attributes.
- Jarring motion effects that cause discomfort for users with vestibular or motion sensitivities.

A clear, non-negotiable accessibility standard is needed to guide UI component design and prevent visual regressions.

## Decision
We formally standardize on **WCAG 2.1 Level AA** compliance across the entire platform.

### Mandatory Technical Implementations:

1. **Color Contrast Thresholds**:
   - All standard body text and informational copy must achieve a minimum contrast ratio of **4.5:1** against underlying container backgrounds.
   - Large text (≥ 18pt or bold ≥ 14pt) and essential UI components (icons, borders, active inputs) must achieve a minimum contrast ratio of **3:1**.
   - Design tokens across Dark, AMOLED, and Light modes must be locked against these ratios during Tailwind configuration.

2. **Keyboard Navigation & Visible Focus Rings**:
   - Every interactive control (buttons, links, inputs, selects, modals) must be 100% operable via keyboard navigation alone (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
   - All focusable elements must display a distinct, high-contrast focus indicator (e.g., `ring-2 ring-emerald-400 focus-visible:outline-none`). Removing focus outlines without an accessible replacement is strictly prohibited.

3. **Semantic ARIA Markup**:
   - Custom controls (density toggles, theme pickers, star rating widgets, modal dialogs) must include valid ARIA attributes (`role`, `aria-label`, `aria-expanded`, `aria-checked`).

4. **Reduced Motion Compliance**:
   - The CSS motion system and JavaScript animation libraries must respect the user's OS-level `prefers-reduced-motion: reduce` preference. When detected, non-essential transitional motion and scale animations must immediately resolve to instantaneous state switches.

## Consequences

### Positive
- **Guaranteed Usability**: The platform remains readable and navigable under diverse lighting conditions, low-end displays, and across users with visual or motor impairments.
- **Measurable CI/Audit Standards**: Automated accessibility tooling (e.g., Axe, Lighthouse Accessibility) can run against concrete, pass/fail metrics.

### Negative / Trade-offs
- **Design Constraint Discipline**: Visual styling cannot rely on subtle low-contrast gray text or outline-less buttons; every UI token must be audited against contrast calculation formulas.
