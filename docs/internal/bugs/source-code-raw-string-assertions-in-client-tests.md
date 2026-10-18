# Bug: Fragile Source Code String Assertions in Client UI Tests

- **Bug ID**: 28
- **Category**: Testing / Code Quality
- **Severity**: Low
- **Target Files**:
  - `client/test/teams-ui.test.tsx` (lines 9–11, 266–292)
- **Status**: Identified

---

## 1. Description

In `client/test/teams-ui.test.tsx`, tests import raw TypeScript source code strings via Vite's `?raw` loader and assert on the presence or absence of exact substrings:

```ts
// lines 9–11
import teamCardSource from '../components/teams/TeamCard.tsx?raw';
import teamModalSource from '../components/teams/TeamDetailModal.tsx?raw';
import teamsPageSource from '../app/teams/page.tsx?raw';

// lines 266–274
expect(teamCardSource.includes('backdrop-blur')).toBe(false);
expect(teamCardSource.includes('backdrop-filter')).toBe(false);

expect(teamCardSource.includes('fade-in')).toBe(false);
expect(teamCardSource.includes('opacity-0')).toBe(false);

expect(teamCardSource.includes('duration-[120ms]') || teamCardSource.includes('duration-[80ms]')).toBe(true);
expect(teamCardSource.includes('bg-bg-surface')).toBe(true);
```

Asserting directly against raw file content strings is a known testing anti-pattern:
1. **False Positives/Negatives:**
   If a comment contains the word `backdrop-blur` (e.g. `// ensure backdrop-blur is not used`), the test fails even though the actual rendered component has zero backdrop blur.
   Conversely, if dynamic classnames or imported constants are used (e.g., `clsx(STYLES.blur)`), raw string assertions pass even if the forbidden class is rendered at runtime.
2. **Refactoring Hazard:**
   Benign refactorings (such as moving classes into Tailwind utility configurations, template literals, or CSS modules) break test suites despite preserving 100% of the runtime DOM behavior and visual presentation.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/frontend-architecture.md` Section 6: "Testing Discipline: Tests must verify runtime DOM attributes, computed styles, and accessibility semantics, never raw text tokens."
- Engineering Mandate: Section 3.A: "Tests Must Exercise Actual Runtime Integration. Avoid shallow, self-fulfilling tests that assert against artificial mocks or raw file text."

---

## 3. Reproduction Steps / Proof of Concept

1. In `client/components/teams/TeamCard.tsx`, add an innocuous explanatory comment:
   `// Refactor note: we chose solid backgrounds over backdrop-blur for performance.`
2. Run client unit tests:
   `pnpm --filter @smex/client test`
3. Result:
   Test fails at line 266: `expect(teamCardSource.includes('backdrop-blur')).toBe(false)` because the string `backdrop-blur` is present in the source file, even though no such CSS class is applied to any element.

---

## 4. Impact

Creates high maintenance overhead and brittle CI tests that break on code formatting, whitespace, or comments rather than actual regression in rendered component behavior.

---

## 5. Recommended Remediation

Replace raw source string checks with DOM rendered queries using `@testing-library/react` and computed style/class assertions:

```tsx
it('renders team card without forbidden backdrop blur classes', () => {
  const { container } = render(<TeamCard team={mockTeams[0]} onSelectTeam={vi.fn()} />);
  const elementsWithBlur = container.querySelectorAll('[class*="backdrop-blur"]');
  expect(elementsWithBlur.length).toBe(0);

  const cardElement = container.firstChild as HTMLElement;
  expect(cardElement.className).toContain('bg-bg-surface');
});
```
