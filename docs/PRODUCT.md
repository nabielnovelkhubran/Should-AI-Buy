# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript, Alpaca Paper API v2.

## Users

Fintech founders, quant engineers, hedge fund operators, and algorithmic trading builders evaluating autonomous trading councils. Targeted specifically for a high-impact SaaS fintech video demo (in the style of Zelios video productions: high-contrast, ultra-crisp, intentional, zero-fluff engineering authority).

## Product Purpose

Should-AI Buy? (SAIB) is an evidence-first multi-agent autonomous trading council. It scans markets, subjects asset candidates to multi-factor quantitative checks, convenes an adversarial council (Discovery, Quant, Intel, Risk, and an Adversarial Red Team), enforces non-bypassable deterministic risk gates, executes paper orders through the Alpaca Paper Trading API, and continuously monitors held positions for post-trade thesis invalidation.

## Positioning

Unlike typical AI trading bots that suffer from sycophantic confirmation bias and opaque halluncinated rationales, SAIB enforces:
1. **Adversarial Red-Team Falsification:** Actively attacks and stress-tests every proposed buy thesis.
2. **First-Class Evidence Graph:** Every factual assertion is tracked as an immutable Claim linked to verifiable market and news evidence.
3. **Deterministic Safety Invariants:** Hard 25% single-asset exposure ceiling, spread gates, and broker-verified state that cannot be overridden by LLM tokens.
4. **Closed-Loop Thesis Monitoring:** Continuously evaluates post-fill health and executes automated paper exits upon thesis invalidation.

## Operating Context

- High-stakes financial terminal UI viewed on desktop screens and high-resolution video recordings.
- Operates in real-time or simulated demonstration cycles with fast, fluid live state updates.
- 1-click access via terminal credentials (`operator2026` / `alpaca2026`).

## Capabilities and Constraints

- **Autonomous Council Lifecycle:** 9-stage pipeline from scanning to post-trade thesis invalidation.
- **Execution Mode:** Paper-trading only via Alpaca v2 API (`paper-api.alpaca.markets/v2`).
- **Data Integrity:** Broker fill reconciliation ensures zero fabricated positions or hallucinated trade sizes.
- **Demo Quality:** UI must be razor-sharp, dense, legible in video recordings, and free of generic AI styling tropes.

## Brand Commitments

- **Name:** Should-AI Buy? (SAIB)
- **Voice:** Direct, quantitative, high-signal, institutional financial technology.
- **Aesthetic Anti-Patterns to Eliminate:**
  - No purple-to-indigo gradient glow buttons or borders.
  - No nested card-in-card containers.
  - No washed-out low-contrast gray text on tinted backgrounds.
  - No default generic SaaS tropes (inter generic blur, rubbery bouncy easing).
- **Target Style:** High-end modern Fintech SaaS (clean dark obsidian background, micro-bordered panels, razor tabular figures, precision status indicators, emerald/amber/crimson data highlights).

## Evidence on Hand

- Fully implemented Next.js app with 26 dynamic routes.
- 891/891 passing unit & integration tests.
- Live deployment running on AWS EC2 (`http://15.134.249.209:3000`).

## Product Principles

1. **Truth Over Confidence:** Assertions must cite verified claims and withstand red-team counter-arguments.
2. **Deterministic Capital Protection:** Risk gates are hardcoded mathematical functions, never subject to LLM discretion.
3. **Institutional Density:** Information architecture prioritizes high data density, clear tabular metrics, and visual hierarchy over decorative whitespace.
4. **Execution Provability:** State transitions match confirmed broker executions, never premature assumptions.
