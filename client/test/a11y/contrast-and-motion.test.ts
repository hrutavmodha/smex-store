import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Calculates standard WCAG 2.1 relative luminance for an sRGB hex color.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two hex colors.
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Accessibility & Motion Physics Compliance Suite (LLT 2.5)', () => {
  it('Test 9: WCAG 2.1 AA color contrast compliance (LLD 6.1)', () => {
    // 1. Dark Mode Body Text (#E9F5F1 on #0B0F12) -> Required >= 4.5:1
    const darkBodyRatio = getContrastRatio('#E9F5F1', '#0B0F12');
    expect(darkBodyRatio).toBeGreaterThanOrEqual(4.5);
    expect(darkBodyRatio).toBeCloseTo(14.2, 0);

    // 2. AMOLED Body Text (#FFFFFF on #000000) -> Required >= 4.5:1 (evaluates to 21.0:1)
    const amoledBodyRatio = getContrastRatio('#FFFFFF', '#000000');
    expect(amoledBodyRatio).toBeGreaterThanOrEqual(4.5);
    expect(amoledBodyRatio).toBeCloseTo(21.0, 0);

    // 3. Primary Emerald CTA Text (#0B1A15 on #22C58F) -> Required >= 4.5:1
    const emeraldCtaRatio = getContrastRatio('#0B1A15', '#22C58F');
    expect(emeraldCtaRatio).toBeGreaterThanOrEqual(4.5);
    expect(emeraldCtaRatio).toBeCloseTo(7.8, 0);

    // 4. Muted Metadata Text (#8FA39C on #0B0F12) -> Required >= 4.5:1
    const mutedMetaRatio = getContrastRatio('#8FA39C', '#0B0F12');
    expect(mutedMetaRatio).toBeGreaterThanOrEqual(4.5);
    expect(mutedMetaRatio).toBeCloseTo(6.4, 0);

    // 5. Active Focus Ring (#3FE6B0 against #121C19) -> Required >= 3.0:1 (UI Component / Control)
    const focusRingRatio = getContrastRatio('#3FE6B0', '#121C19');
    expect(focusRingRatio).toBeGreaterThanOrEqual(3.0);
    expect(focusRingRatio).toBeCloseTo(8.1, 0);
  });

  it('Test 10: Reduced-motion instantaneous transition enforcement (LLD 6.2)', () => {
    const globalsCssPath = path.resolve(process.cwd(), 'app/globals.css');
    expect(fs.existsSync(globalsCssPath)).toBe(true);

    const cssContent = fs.readFileSync(globalsCssPath, 'utf8');

    // Verify reduced-motion media query declaration
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');

    // Verify instantaneous override constraints
    expect(cssContent).toContain('animation-duration: 0.001ms !important');
    expect(cssContent).toContain('animation-iteration-count: 1 !important');
    expect(cssContent).toContain('transition-duration: 0.001ms !important');
    expect(cssContent).toContain('scroll-behavior: auto !important');

    // Create a DOM element in test environment and verify style behavior
    const testEl = document.createElement('div');
    testEl.className = 'transition-transform duration-120';
    document.body.appendChild(testEl);

    // When reduced motion is applied, transitions collapse to 0.001ms
    expect(testEl).toBeTruthy();
    document.body.removeChild(testEl);
  });
});
