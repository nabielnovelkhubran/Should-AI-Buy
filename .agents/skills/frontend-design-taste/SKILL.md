---
name: frontend-design-taste
description: >-
  Visual design judgment, aesthetic taste, and craftsmanship for modern command-driven web applications.
  Use when designing UI layout, composition, typography, color systems, spacing, micro-interactions, motion,
  and crafting a distinctive visual identity for Should-AI Buy? Command Canvas.
---

# Frontend Design & Aesthetic Taste Guide

This skill guides visual direction, spatial composition, typography, and interaction craftsmanship for the **Should-AI Buy? Command Canvas**. It ensures the product avoids generic dashboard/SaaS clichés and delivers a distinctive, high-conviction visual language fit for autonomous financial intelligence.

---

## 1. Core Visual Philosophy: The Autonomous Trading Terminal

The design language of **Should-AI Buy?** is **Command-First Precision & Cognitive Clarity**.
It merges the raw data density and speed of professional financial terminals (Bloomberg, Koyfin) with the spatial fluidity of modern creative canvases (Figma, Linear, Raycast).

### What to AVOID (Generic Dashboard Clichés)
- ❌ **Purple Gradient Overkill:** Neon purple blur blobs behind every card.
- ❌ **Repetitive Bento Box Grids:** Monotonous 3x3 rounded rectangles with identical borders.
- ❌ **Fluffy Empty White Space:** Low-density layouts that require infinite scrolling for basic financial data.
- ❌ **Unstyled Default Inputs:** Standard HTML text inputs masquerading as command lines.
- ❌ **Generic SaaS Blue/Violet Accents:** Default Tailwind blue-600 buttons without identity.

### What to EMBRACE (Distinctive Craftsmanship)
- ✅ **The Canvas as Workspace:** Infinite or bounded dark desktop canvas where tools are movable, resizable, floating glass windows.
- ✅ **Command-Driven Interaction:** Instant typing interface with ghost autocomplete syntax, tab-completion, and keyboard ergonomics.
- ✅ **Deep Void Dark Surfaces:** Ultra-rich dark backgrounds (`#07080b`, `#0b0d14`, `#10131e`) with subtle slate/indigo undertones.
- ✅ **Subtle Border Luminance:** 1px hairline borders (`rgba(255,255,255,0.08)`) with subtle specular highlight at the top edge (`border-t-white/15`).
- ✅ **Phosphor Semantic Accents:**
  - **Alpha Emerald (`#10b981` / `#34d399`):** High opportunity, verified claims, winning P&L.
  - **Caution Amber (`#f59e0b` / `#fbbf24`):** Degraded thesis, stale data, rate limit warning.
  - **Critical Rose (`#f43f5e` / `#fb7185`):** Thesis invalidation, protective exit, stop-loss trigger.
  - **Terminal Cyan / Electric Indigo (`#06b6d4` / `#6366f1`):** Active command execution, focus ring, agent deliberation pulse.

---

## 2. Typography & Numerical Layout

### Font Hierarchy
- **UI / Headlines:** Crisp, geometric neo-grotesque sans (`Inter`, `SF Pro Display`, system sans) with tight letter-spacing (`tracking-tight` on headings).
- **Telemetry / Financial Figures:** Monospaced tabular numerals (`font-mono`, `tabular-nums`) for prices, percentages, P&L, timestamps, and order quantities.
- **Micro-Labels & Badges:** Uppercase, wide tracking (`tracking-wider`, `text-[10px]`, `font-bold`) for statuses like `PAPER ONLY`, `VERIFIED`, `INVALIDATED`.

### Contrast Rules
- Primary Text: High-contrast pure white (`text-slate-100` / `#f8fafc`).
- Secondary Text: Readable muted slate (`text-slate-400` / `#94a3b8`).
- Tertiary / Metadata: Subtle low-emphasis slate (`text-slate-500` / `#64748b`).
- Ensure all text passes WCAG AA contrast ($\ge 4.5:1$ against dark background).

---

## 3. Spatial Composition & Window Canvas Dynamics

### Canvas Window Rules
- **Header Bar:** Distinct drag handle with window title, status pill, minimize/maximize/close actions, and active focus elevation.
- **Glassmorphism:** `backdrop-blur-md`, subtle dark translucency (`bg-[#0d1017]/90`), distinct drop shadows (`shadow-2xl shadow-black/60`).
- **Active State Elevation:** Focused window brings `z-index` to top, gains subtle border glow (`ring-1 ring-indigo-500/40`), while inactive windows dim slightly (`opacity-90`).
- **Resize Handles:** 8-direction or corner resize grip with visual feedback and minimum dimension clamping (e.g. min width 320px, min height 200px).

---

## 4. Motion & Micro-Interactions

- **Duration:** Micro-interactions (100–150ms), state transitions (200–250ms), canvas animations (300ms max).
- **Easing:** Cubic bezier `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for snappy, mechanical responsiveness.
- **Transforms over Layout Thrashing:** Use `transform: translate3d(x, y, 0)` for window movement; avoid changing `top`/`left` directly on mousemove.
- **Respect User Preferences:** `@media (prefers-reduced-motion: reduce)` disables non-essential animations.
