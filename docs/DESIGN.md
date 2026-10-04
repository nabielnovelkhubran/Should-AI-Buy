---
name: Should-AI Buy? Design System
description: Institutional quantitative trading terminal with warm dark surfaces, crisp hairline borders, high-density telemetry, and zero AI gradient tropes.
colors:
  bg-base: "#121117"
  bg-surface: "#1f1e23"
  bg-panel: "#17161b"
  bg-hover: "#28272f"
  border-subtle: "#28272e"
  border-bright: "#34333b"
  text-primary: "#ffffff"
  text-secondary: "#8b8a91"
  text-muted: "#848388"
  brand-green: "#00ff84"
  danger-crimson: "#ff3b5c"
  warning-amber: "#f59e0b"
  accent-sky: "#38bdf8"
typography:
  display:
    fontFamily: "Phantom, -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Phantom, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Phantom, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  cash:
    fontFamily: "PhantomCash, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.bg-base}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
---

# Design System

## Overview
Should-AI Buy? is an institutional autonomous trading terminal built for algorithmic finance and quantitative multi-agent council execution. The design language takes direct inspiration from elite fintech video showcases (e.g. Zelios productions and Phantom Terminal): ultra-crisp, high-contrast, mathematically dense, and uncompromisingly direct.

## Colors
- **Base Canvas:** `#121117` (warm deep charcoal, preserving the original terminal character).
- **Cards & Surfaces:** `#1f1e23` (warmer matte panel tone).
- **Inner Boxes & Fields:** `#17161b` (subtle dark recessed layers).
- **Borders:** `#28272e` (crisp 1px hairline dividers) and `#34333b` (active/hover focus).
- **Semantics:**
  - Brand Green (`#00ff84`): Buy signals, verified claims, active navigation states, system health.
  - Crimson (`#ff3b5c`): Sell signals, adversarial red-team objections, thesis invalidations.
  - Amber (`#f59e0b`): Cautionary signals, position limits, test/competition banners.
  - Sky (`#38bdf8`): View-only status, informational feeds.

## Typography & Numerals
- **Primary Typeface:** `Phantom` for headings and interface navigation.
- **Tabular & Code Typeface:** `JetBrains Mono` / `PhantomCash` for market tickers, prices, execution timestamps, and telemetry.
- **Rules:**
  - Tabular numerals (`tabular-nums` / `font-variant-numeric: tabular-nums`) on all prices, timestamps, and percentages.
  - Active nav tabs render in high-contrast brand green (`#00ff84`), inactive in `#8b8a91`.
  - No gradient text.

## Iconography & Anti-AI Slop Rules
- **Zero Decorative Icon Clutter:** Strictly eliminate generic, overused icons (`Sparkles`, generic `Award`, `ShieldCheck`, `UserCheck`, `Flame`).
- **Geometric Status Pips:** Use subtle `w-1.5 h-1.5` rounded geometric dots for status indication (e.g. green for OPERATOR/live, sky for VIEW-ONLY, amber for warning).
- **Typography as Interface:** Prefer clear monospace labels (`[BUY]`, `[SELL]`, `[LOCK]`, `[OPERATOR]`) over ambiguous icons.

## Layout & Motion
- Single-level container borders (`#28272e`) with flat visual hierarchy.
- Smooth Phantom sliding pill highlight transitions (`cubic-bezier(0.16, 1, 0.3, 1)`) for tab navigation and selection.
- No bouncy or rubbery entrance easing.
