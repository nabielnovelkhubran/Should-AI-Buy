<p align="center">
  <img src="public/logo.png" width="68" alt="Should-AI Buy Logo" />
</p>

<h1 align="center">Should-AI Buy?</h1>

<p align="center">
  <strong>Autonomous Multi-Agent Deliberation & Paper Execution Engine for Alpaca Markets</strong><br />
  Continuous Market Scanning | Adversarial Thesis Audit | Non-Bypassable Risk Gates | Thesis Invalidation Daemon
</p>

<p align="center">
  <a href="tests/run-tests.js"><img src="https://img.shields.io/badge/Tests-897%2F897%20Passed-00ff84?style=flat-square&labelColor=17161d" alt="Tests Passed" /></a>
  <a href="tsconfig.json"><img src="https://img.shields.io/badge/TypeScript-Strict%200%20Errors-38bdf8?style=flat-square&labelColor=17161d" alt="TypeScript Strict" /></a>
  <a href="src/lib/trading/alpaca-paper-adapter.ts"><img src="https://img.shields.io/badge/Execution-Paper%20Trading%20Only-f59e0b?style=flat-square&labelColor=17161d" alt="Paper Trading Only" /></a>
  <a href="https://paper-api.alpaca.markets/v2"><img src="https://img.shields.io/badge/Broker-Alpaca%20v2-10b981?style=flat-square&labelColor=17161d" alt="Alpaca Broker API" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-848388?style=flat-square&labelColor=17161d" alt="License" /></a>
</p>

<p align="center">
  <strong>Live Deployment:</strong> <a href="http://15.134.249.209:3000">http://15.134.249.209:3000</a> &nbsp;|&nbsp; <strong>Judge / Demo Passphrase:</strong> <code>alpaca2026</code>
</p>

---

## Overview

Most automated trading scripts execute open-loop: single-prompt LLMs generate unverified rationale, submit orders without hard risk boundaries, and abandon positions once filled.

**Should-AI Buy?** implements a closed-loop, verifiable deliberation and execution architecture:

1. **Continuous Discovery:** Scans 25+ liquid equity and crypto assets against volatility, momentum, and volume acceleration thresholds.
2. **Adversarial Deliberation:** Coordinates quantitative, fundamental, and dedicated Red Team agents to challenge trade theses before execution.
3. **Deterministic Risk Gates:** Non-bypassable TypeScript guards enforcing max 25% single-asset exposure, liquidity minimums, and spread ceilings.
4. **Idempotent Paper Execution:** Submits paper orders via Alpaca REST v2 using deterministic deduplication keys.
5. **Post-Trade Thesis Monitoring:** A background daemon tracks position health, recalculates thesis validity on every market tick, and triggers automated protective exits upon thesis breakdown.

---

## System Architecture

```text
  [ Market Data ] ──> Alpaca REST / WebSocket Stream
         │
         ▼
┌─────────────────┐     Calculates RVOL, RSI-14, ATR, and momentum
│ Discovery Engine│ ──> Applies liquidity ($500k equity) & spread (<=100 bps) filters
└────────┬────────┘     Ranks top opportunities into the dispatch queue
         │
         ▼
┌─────────────────┐     • Quant Agent: Technical momentum & volatility profile
│  Multi-Agent    │     • Intel Agent: Alpaca News ingestion & sentiment scoring
│  Council Hub    │     • Risk Agent: Order book depth & beta exposure
└────────┬────────┘     • Red Team: Adversarial challenge & fatal flaw detection
         │
         ▼
┌─────────────────┐     Hard rules outside LLM control:
│ Deterministic   │ ──> • Max 25% single-position allocation
│   Risk Gate     │     • Spread <= 1.00% | Min volume $500,000
└────────┬────────┘     • Rejects any thesis with unresolved Red Team fatal flaws
         │
         ▼
┌─────────────────┐     • Idempotency key derivation: EXEC-{asset}-{timestamp}
│ Alpaca Broker   │ ──> • Dedicated Paper Trading route (Live endpoints fail-closed)
│ Execution Layer │     • Position state authoritative from broker reconciliation
└────────┬────────┘
         │
         ▼
┌─────────────────┐     • Evaluates price drawdown, spread widening & momentum loss
│ Thesis Health   │ ──> • Health status: HEALTHY (>=70) | DEGRADED (40-69) | INVALIDATED (<40)
│   Daemon Loop   │     • Automatic protective paper exit submission on invalidation
└─────────────────┘
```

---

## Core Components

### 1. Multi-Agent Council & Adversarial Audit
The council operates across four specialized roles coordinated by a synthesis arbiter:
- **Quantitative Agent:** Evaluates candle structure, RSI-14, volume expansion, and realized volatility.
- **Market Intelligence Agent:** Ingests live Alpaca news items, cross-referencing news sentiment against technical volume spikes.
- **Risk Assessment Agent:** Validates spot bid/ask spreads, market depth, and portfolio concentration limits.
- **Adversarial Red Team:** Actively attempts to falsify the trade thesis. Targets liquidation levels, macro resistance clusters, and structural vulnerabilities.

### 2. Deterministic Risk Gate
Trading decisions cannot bypass the risk layer. The risk gate executes strictly in deterministic code with zero LLM overrides:
- **Exposure Boundary:** Restricts any single holding to $\le 25\%$ of total portfolio equity.
- **Liquidity Floor:** Requires minimum 24h trading volume ($500k for equities, $0 minimum for crypto sandbox testing).
- **Execution Spread Limit:** Enforces maximum allowable spot spread of 100 bps (1.00%).
- **Hard Rejections:** Automatically blocks orders if the Red Team detects an unmitigated structural flaw.

### 3. Continuous Thesis Health Daemon
Unlike static bot architectures that disconnect post-fill, positions are monitored continuously:
- **Composite Health Score:** Computes weighted score across price momentum (40%), drawdown profile (30%), liquidity stability (15%), and volatility expansion (15%).
- **State Machine:**
  - `HEALTHY` ($\ge 70$): Position remains within thesis boundaries.
  - `DEGRADED` ($40 \le \text{Score} < 70$): Alert logged to Command Lab Attention Center.
  - `INVALIDATED` ($< 40$): Invalidation triggered; automated paper exit proposal generated and submitted via Alpaca API.

### 4. Quantitative OCC Options Engine
Formulates standard Options Clearing Corporation (OCC) option contract symbology (`AAPL260918C00230000`):
- Filters candidate contracts by Days to Expiration (7–45 DTE) and Delta (0.30–0.70).
- Calculates Implied Volatility and directional bias derived from council deliberation.

---

## Verification & Test Suite

The codebase maintains 53 test suites containing 897 automated tests. All tests execute deterministically without external network dependency.

```bash
node tests/run-tests.js
```

```text
========================================
TEST SUMMARY: 897/897 PASSED (0 FAILED)
========================================
- Invariant & Mathematical Soundness: 100%
- State Isolation & Safety Bounds:    100%
- Broker Adapter & Order Idempotency: 100%
- Concurrency & Queue Determinism:    100%
- Outbound Webhook Alert Dispatch:    100%
```

### Verification Matrix

| Suite Range | Scope | Enforcement |
|:---|:---|:---:|
| **Suites 01–08** | Technical Indicators & Math Models | Verified |
| **Suites 09–12** | Council Deliberation & Red Team Invariants | Verified |
| **Suites 13–15** | Claim Lineage & Contradiction Graph | Verified |
| **Suites 16–17** | Market Intelligence & Hybrid Fallback Engine | Verified |
| **Suites 18–19** | Discovery Scanner, Queue & Dispatcher | Verified |
| **Suites 20–21** | Alpaca Paper Broker & Ledger Reconciliation | Verified |
| **Suites 22–23** | Position Health Daemon & Invalidation Exits | Verified |
| **Suites 24–31** | Circuit Breakers, Error Isolation & Idempotency | Verified |
| **Suites 32–40** | Observability, Telemetry Journal & State Recovery | Verified |
| **Suites 41–52** | Options Contract Selector & Settlement Verification | Verified |
| **Suite 53** | Outbound Alert Webhook Dispatcher (Discord & Telegram) | Verified |

---

## Production Invariants & Security Controls

- **Paper Trading Isolation:** Network adapters target `https://paper-api.alpaca.markets/v2`. Any outbound request to live broker endpoints triggers immediate fail-closed termination.
- **Deterministic State:** Asset sorting, score calculation, and candidate ranking are purely deterministic without stochastic RNG calls.
- **Zero Hallucinated Fills:** Position quantities and cash balances derive strictly from authenticated broker responses. If the broker is unreachable, error states isolate gracefully without synthetic state insertion.
- **Credential Hygiene:** API keys and passphrases are restricted to server-side environments and never leak into client telemetry or DOM attributes.

---

## Quick Start

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Alpaca Paper Trading Account ([Alpaca Signup](https://app.alpaca.markets/signup))

### 1. Installation
```bash
git clone https://github.com/nabielnovelkhubran/Should-AI-Buy.git
cd Should-AI-Buy
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the project root:

```ini
# Alpaca Paper Trading Credentials
ALPACA_API_KEY=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets/v2
ALPACA_DATA_BASE_URL=https://data.alpaca.markets/v2

# Optional LLM Inference Keys (Falls back to deterministic mocked council if omitted)
GEMINI_API_KEY=your_gemini_api_key
FEATHERLESS_API_KEY=your_featherless_api_key

# Optional Outbound Alert Webhooks (Discord & Telegram)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl...
TELEGRAM_CHAT_ID=-1001234567890
```

### 3. Verify System Invariants
```bash
# Verify TypeScript strict typecheck
npx tsc --noEmit

# Execute complete test suite
node tests/run-tests.js
```

### 4. Launch Application
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Use passphrase `alpaca2026` for instant operator access.

---

## Technology Stack

- **Application Framework:** Next.js 14 (App Router)
- **Language & Type System:** TypeScript 5 (Strict Mode, 0 compile errors)
- **UI Architecture:** Tailwind CSS, Custom High-Density Design System
- **Broker Interface:** Alpaca Markets REST API v2 & WebSocket Stream
- **Testing Runtime:** Native Node.js Test Harness with Zero External Mocking Dependencies

---

## Documentation Index

Comprehensive technical specifications and system designs are maintained in the [`docs/`](docs/) directory:

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document & Operational Invariants
- [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md) — Multi-Agent Consensus & Deliberation Architecture
- [`docs/WRITEUP.md`](docs/WRITEUP.md) — Submission Architecture Specification
- [`docs/DESIGN.md`](docs/DESIGN.md) — Terminal UI & High-Density Design System Tokens
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — Positioning, User Personas, & Strategic Roadmap
- [`docs/UX_RESEARCH.md`](docs/UX_RESEARCH.md) — Cognitive Friction Audit & Usability Benchmarks

---

## License

This software is released under the Apache 2.0 License. Built for the Alpaca AI Trading Hackathon.
