# UI Design & Interaction Specification

This document defines the complete visual design system, color tokens, typography, theme modes, interface densities, motion physics, prohibited effects, and responsive breakpoints for the platform frontend.

---

## 1. Visual Theme & Design Tokens

The visual theme embodies a modern, premium esports aesthetic centered on deep dark bases and luminous emerald/teal accents.

### 1.1 Color Tokens Reference

| Token Name | Hex / Value | CSS Variable | Component Application |
| :--- | :--- | :--- | :--- |
| **Dark Surface (Default)** | `#0B0F12` | `--surface-dark` | Primary application background in Dark Mode |
| **Card / Panel Surface** | `#121C19` – `#16211D` | `--surface-card` | Content cards, dialog panels, modals |
| **Primary Accent (Emerald)** | `#1FAE7A` – `#22C58F` | `--accent-primary` | Primary CTAs, active pills, badges, highlights |
| **Secondary Accent (Teal)** | `#1B8F97` – `#20A6AE` | `--accent-secondary` | Secondary actions, progress bars, links |
| **Gradient Accent** | `linear-gradient(135deg, #1B8F97 0%, #22C58F 100%)` | `--gradient-primary` | Hero highlights, key action buttons |
| **Accent Glow** | `#3FE6B0` (15–20% opacity) | `--glow-accent` | Subtle focus rings and active card borders |
| **Text — Primary (Dark Mode)** | `#E9F5F1` | `--text-primary` | Headings and primary body copy |
| **Text — Muted** | `#8FA39C` | `--text-muted` | Metadata, timestamps, helper labels |
| **Border / Divider** | `#223530` | `--border-subtle` | Structural borders, container outlines, dividers |
| **AMOLED Base** | `#000000` | `--surface-amoled` | True-black OLED background surface |
| **Light Mode Base** | `#F4FAF8` | `--surface-light` | Clean, crisp light surface background |
| **Light Mode Surface** | `#FFFFFF` | `--surface-light-card` | Content cards and modals in Light Mode |
| **Light Mode Text** | `#0B1A15` | `--text-light-primary` | High-contrast body text in Light Mode |

---

## 2. Multi-Theme System

The application natively supports three theme modes persisted across user sessions:

1. **Dark Mode (Default)**:
   - Deep obsidian/charcoal background (`#0B0F12`) with dark emerald panels (`#121C19`).
   - Emerald/teal interactive highlights and high-contrast text (`#E9F5F1`).
2. **AMOLED True-Black Mode**:
   - Pure black background (`#000000`) engineered for OLED mobile displays to eliminate power consumption and deliver maximum visual contrast.
   - Minimal subtle borders (`#1A2A25`) to demarcate cards without light bleeding.
3. **Light Mode**:
   - Crisp mint-tinted light background (`#F4FAF8`) with pure white card surfaces (`#FFFFFF`).
   - Deep forest green text (`#0B1A15`) ensuring WCAG 2.1 AA contrast compliance (minimum 4.5:1 ratio).

---

## 3. Interface Density System

Users can toggle sitewide layout density based on their device class or personal preference:

| Density Mode | Layout Spacing & Padding | Touch Target Size | Typical Usage |
| :--- | :--- | :--- | :--- |
| **Compact** | Reduced padding (e.g., `py-1.5 px-3`, `gap-2`), higher data density | 36px | Desktop power users, tournament bracket tables |
| **Comfortable (Default)** | Balanced standard padding (e.g., `py-2.5 px-4`, `gap-4`) | 44px | General browsing across mobile and desktop |
| **Spacious** | Relaxed padding (e.g., `py-3.5 px-6`, `gap-6`), larger touch zones | 48px+ | Tablet users, accessibility focus, relaxed reading |

---

## 4. Motion, Physics & Animation Guardrails

Interactive motion must remain purposeful, snappy, and hardware-accelerated. Motion communicates hierarchy and state change rather than serving as visual decoration.

### 4.1 Allowed UI Transitions
- **Button Active Press**: Fast micro-scale depression (`transform: scale(0.98)` over 80ms).
- **Card Hover Elevation**: Subtle lift (`transform: translateY(-2px)` over 150ms ease-out).
- **Slide-out Navigation**: Hardware-accelerated sliding transforms (`transform: translateX(...)`).
- **Modal Reveals**: Directional drop or scale pop originating smoothly from the triggering element.
- **Micro-State Changes**: 150–200ms ease-out transitions for border color shifts, background color changes, and badge updates.

### 4.2 Prohibited Visual Effects & Animations
To protect runtime performance, prevent frame drops on mobile devices, and maintain a sharp native feel, the following are **strictly prohibited**:

1. **No Opacity Fade Animations**:
   - Zero `opacity` fade-in or fade-out effects on page transitions, route changes, or modal entrances.
   - Instead, use crisp directional sliding (`transform: translateX/Y`), subtle scale reveals, or direct instant state rendering.
2. **No Frosted Glass (Glassmorphism)**:
   - Zero `backdrop-filter: blur(...)` surfaces. Blur filters cause massive GPU redraw overhead and frame stuttering on low-to-mid-range mobile devices.
   - Use solid or subtly tinted semi-opaque panels (`#121C19` at solid opacity) instead.
3. **No Heavy or Multi-Layer Edge Glows**:
   - Avoid diffuse, blurry neon drop-shadows. Glows must remain minimal, subtle, and strictly localized to active focus rings (`#3FE6B0` at 15–20% opacity).
4. **No Sticky Navigation Bar Layout Jitter or Freezing**:
   - The global navbar must remain fixed/sticky without layout jitter, freezing, or scroll desynchronization during rapid scrolling or viewport resizing.

### 4.3 Animation Performance Constraints
- **GPU Compositing**: Animate strictly GPU-composited CSS properties (`transform`, `clip-path`). Never animate geometry properties that trigger layout re-calculation (`top`, `left`, `width`, `height`, `margin`, `padding`).
- **Frame Rate Target**: 60 FPS minimum maintained across mobile hardware without dropping frames.
- **Input Priority**: Motion must never block or delay user inputs; click, tap, and scroll events must register instantaneously.
- **Accessibility (`prefers-reduced-motion`)**: When `prefers-reduced-motion: reduce` is active, all transitions and animations must resolve instantly without animation duration.

---

## 5. Loading, Skeletons & Feedback States

1. **Skeleton Screen Placeholders**:
   - Skeletons must match the exact geometry and dimensions of the incoming cards and data tables.
   - Features a subtle, low-contrast shimmer wave (`#16211D` to `#1D2C26`) to indicate background fetching without jarring flashing.
2. **Deterministic Progress Feedback**:
   - File uploads (e.g., marketplace proof screenshots) must render deterministic percentage progress meters (0% → 100%).
3. **Toast Notifications**:
   - Micro-toasts for action feedback (e.g., "Join request sent", "Listing published", "Booking link copied") appearing at the screen edge with auto-dismiss after 4 seconds.
4. **Empty States**:
   - Empty views (e.g., "No tournaments found", "No active sessions", "No marketplace listings in this tier") must render themed placeholder illustrations with a clear call-to-action button (e.g., "Reset Filters", "Create Listing").

---

## 6. Responsive Breakpoint Matrix

The application layout reflows adaptively across all device tiers:

| Breakpoint Tier | Viewport Width | Navigation Layout | Grid & Content Reflow |
| :--- | :--- | :--- | :--- |
| **Mobile (Small & Large)** | `320px` – `639px` | Bottom navigation bar or top hamburger slide-out drawer | Single-column stack; cards collapse vertically; minimum 44px touch targets |
| **Tablet** | `640px` – `1023px` | Compact header with icon navigation | 2-column marketplace and tournament grids; expandable side filters |
| **Desktop** | `1024px` – `1439px` | Full persistent global navbar with search and action cluster | 3-column marketplace grid; side-by-side tournament details |
| **Ultrawide & High-DPI** | `1440px+` | Full navbar, centered max-width container (`max-w-7xl`) | 4-column marketplace grid; multi-pane admin dashboard |

- **Zero Horizontal Overflow**: No page, table, or modal may cause horizontal scrolling on any viewport down to 320px.
- **Orientation Changes**: Seamless reflow when switching between portrait and landscape modes on mobile devices.
