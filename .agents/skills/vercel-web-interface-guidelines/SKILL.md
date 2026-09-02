---
name: vercel-web-interface-guidelines
description: >-
  Official UX, accessibility, and interaction-quality reference based on Vercel Web Interface Guidelines.
  Use for keyboard navigation, focus management, command palettes, autocomplete, dragging/resizing,
  accessibility, loading/error states, and motion standards.
---

# Vercel Web Interface Guidelines

This guide specifies interaction patterns, keyboard accessibility, focus management, micro-interactions, and interface design standards based on the **Vercel Web Interface Guidelines**.

---

## 1. Focus Management & Keyboard Navigation

### Global Keyboard Shortcuts
- **Command / Search Trigger:** `Cmd+K` / `Ctrl+K` or `/` focuses the command interface immediately.
- **Escape Key (`Escape`):**
  - If autocomplete / dropdown is open: close suggestions and keep focus in input.
  - If input is populated: first press clears or blurs, second press dismisses open floating panels.
- **Arrow Keys (`ArrowUp` / `ArrowDown`):**
  - Navigate suggestion list smoothly without shifting page scroll.
  - Wrap around from bottom to top and vice-versa if appropriate, or clamp at boundaries.
- **Tab Completion (`Tab`):**
  - In command inputs with ghost syntax text: completes the highlighted suggestion or syntax token without submitting.
- **Enter Key (`Enter`):**
  - Executes the highlighted suggestion or submits the current parsed command text.

### Focus Rings & States
- Never remove focus rings completely (`outline: none` without replacement is prohibited).
- Use distinct, accessible focus rings: `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090c]`.
- Maintain a predictable, logical Tab order across all interactive controls.
- Use `roving tabindex` (`tabIndex={isActive ? 0 : -1}`) for toolbars, canvas windows, and command suggestion lists.

---

## 2. Command Palette & Autocomplete Guidelines

### Ghost Text Syntax Hints
- As the user types (e.g. `Should-AI buy $B...`), render inline ghost completion text (e.g. `TC`) in a muted font color (`text-slate-500`) directly ahead of the cursor.
- The ghost text must be non-intrusive and cleanly disappear if the user types a character that deviates from the suggestion.
- Pressing `Tab` or `ArrowRight` (when cursor is at end of input) completes the ghost text.

### Real-Time Validation & Feedback
- Provide instantaneous visual feedback on whether a typed command is structurally valid (e.g. valid ticker parsed, recognized action).
- Show subtle badge indicators: `[ACTION: BUY]`, `[ASSET: BTC]`, `[MODE: PAPER]`.
- If a command is incomplete, display helpful syntax guidance rather than harsh error messages.

---

## 3. Window Dragging & Resizing Dynamics

### Pointer Capture & Drag Ergonomics
- Use the modern Pointer Events API (`pointerdown`, `pointermove`, `pointerup`) with `e.currentTarget.setPointerCapture(e.pointerId)` for robust drag tracking that doesn't drop when the cursor moves outside the window.
- Apply `touch-action: none` to drag handles to prevent page scrolling on touch devices.
- **Performance Rule:** Batch drag and resize position updates with `requestAnimationFrame` or apply CSS transforms (`transform: translate3d(x, y, 0)`) to ensure 60fps rendering without layout thrashing.
- **Boundary Clamping:** Windows must not be dragged completely off-screen; clamp coordinates so at least the title bar (min 40px) remains visible and reachable.
- **Elevation:** Bringing any window into focus on `pointerdown` should automatically update its `z-index` to the highest layer.

### Resizing Best Practices
- Provide visual corner grips or 4-edge resize handles.
- Enforce strict minimum width (e.g. 320px) and minimum height (e.g. 220px) constraints to prevent UI elements from collapsing.

---

## 4. Accessibility (a11y) & ARIA Standards

- **ARIA Live Regions:** Use `aria-live="polite"` for non-critical status updates (e.g., sync notices, toast notifications) and `aria-live="assertive"` for critical safety alerts (e.g., stop-loss triggered, order failed).
- **Autocomplete ARIA:** Input uses `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded={isOpen}`, and `aria-activedescendant={selectedOptionId}`.
- **Color Contrast:** All readable text must meet WCAG 2.1 AA ratio ($\ge 4.5:1$ for body text, $\ge 3.0:1$ for large text and interactive icons).
- **Reduced Motion:** Respect `prefers-reduced-motion: reduce` by replacing spatial animations with instant transitions or gentle opacity fades.

---

## 5. Loading, Error, and Degraded States

- **Zero Layout Shift (CLS = 0):** Skeletons and loading indicators must match the exact dimensions of the loaded content.
- **Optimistic UI:** Provide immediate visual confirmation when user initiates an action; roll back gracefully if server validation fails.
- **Stale Data Labeling:** When network is disconnected or upstream data is delayed, clearly label data as `STALE` without erasing the existing view.
- **Clear Actionable Errors:** Errors must explain *what happened* and provide an immediate remediation action (e.g. `Retry Connection`).
