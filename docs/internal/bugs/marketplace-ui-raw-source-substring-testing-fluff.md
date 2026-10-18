# Bug: Superficial Raw Source Code Substring Assertions in Marketplace UI Test Suite ("Green-Checkmark Fallacy")

- **Bug ID**: BUG-M7-006
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads
- **Severity**: Low / Code Quality Smell (AI Fluff / False-Security Test Anti-Pattern)
- **Target Files**:
  - `client/test/marketplace/marketplace-ui.test.tsx` (lines 11–15, 158–163, 174–194)
- **Status**: Identified

---

## 1. Description

The Antigravity Global Engineering Mandate strictly prohibits testing illusions and artificial test assertions:
> "A test suite that passes via production compromises is a fraudulent illusion... Avoid shallow, self-fulfilling tests that assert against their own local mocks while the production wiring remains broken, disconnected, or discarded."

In `client/test/marketplace/marketplace-ui.test.tsx`, tests import raw TypeScript source files as plain text strings using Vite's `?raw` loader:
```typescript
// client/test/marketplace/marketplace-ui.test.tsx:11-15
import catalogSource from '../../components/marketplace/MarketplaceCatalog.tsx?raw';
import carouselSource from '../../components/marketplace/ProofLightboxCarousel.tsx?raw';
import detailSource from '../../components/marketplace/ListingDetailView.tsx?raw';
import modalSource from '../../components/marketplace/SellerContactModal.tsx?raw';
import marketplacePageSource from '../../app/marketplace/page.tsx?raw';
```

The test asserts physical string presence in source code rather than testing actual DOM rendering, component output, CSS classes on rendered elements, or runtime behavior:
```typescript
// lines 182-194
for (const source of allMarketplaceSources) {
  // Prohibited: frosted glass blur
  expect(source.includes('backdrop-blur')).toBe(false);
  expect(source.includes('backdrop-filter: blur')).toBe(false);

  // Prohibited: opacity fade animations
  expect(source.includes('animate-fade')).toBe(false);
  expect(source.includes('fade-in')).toBe(false);

  // Mandated: 120ms hardware transitions
  expect(source.includes('duration-120')).toBe(true);
}
```

---

## 2. Specification & Design Reference

- **Engineering Mandate**: Mandate Section 1 & Section 3:
  > "Passing tests are a verification tool, never the product... Tests must exercise actual runtime integration."

---

## 3. Impact

- **Fragility**: Refactoring CSS class structures (e.g. into Tailwind `@layer components` or CSS modules) breaks the test even if the rendered DOM and styling are 100% compliant.
- **False Green Checkmarks**: A component could include `// duration-120` in a comment or on an unused nested container and pass the test, while the actual animated element has no transition or uses an invalid duration.
- **AI Fluff**: LLMs often write raw source string checks when they lack the ability or effort to properly query and assert computed styles or DOM attributes on rendered components.

---

## 4. Recommended Remediation

1. Remove all `?raw` source string imports from test files.
2. Render components using `@testing-library/react` and assert against the actual rendered DOM nodes and their computed classes or style attributes:
   ```typescript
   const { container } = render(<MarketplaceCatalog />);
   const animatedElements = container.querySelectorAll('.transition-transform');
   animatedElements.forEach((el) => {
     expect(el.classList.contains('duration-120')).toBe(true);
   });
   ```
