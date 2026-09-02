# Should-AI Buy? ⚡

> **Autonomous Multi-Agent Market Intelligence, Verifiable Thesis Deliberation & Paper-Trading Execution System Built Around Alpaca.**

[![Test Suite](https://img.shields.io/badge/Tests-891%2F891%20Passed-emerald.svg)](tests/run-tests.js)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Typecheck%200%20Errors-blue.svg)](tsconfig.json)
[![Environment](https://img.shields.io/badge/Trading%20Mode-PAPER%20ONLY-amber.svg)](src/lib/trading/alpaca-paper-adapter.ts)
[![Broker](https://img.shields.io/badge/Broker-Alpaca%20Paper%20v2-green.svg)](https://paper-api.alpaca.markets/v2)
[![Options](https://img.shields.io/badge/OCC%20Options-Greeks%20%26%20Delta%20Selector-purple.svg)](src/lib/options/)

---

## 1. Executive Summary & Problem Statement

Most AI trading bots suffer from three fatal design flaws:
1. **Sycophantic Confirmation Bias:** Single-prompt LLMs rubber-stamp user queries and invent hallucinated rationales.
2. **Opaque, Unverifiable Assertions:** Decisions are rendered as free-form prose without traceable evidence or claim provenance.
3. **Open-Loop Execution Without Post-Trade Invalidation:** Once an order is filled, systems ignore whether the entry thesis remains intact, failing to protect capital when market conditions deteriorate.

**Should-AI Buy?** solves this through an end-to-end, multi-stage autonomous trading research pipeline. It continuously scans markets, deliberates through specialized agents, subjects investment theses to adversarial Red Team challenge, enforces a deterministic Risk Gate, executes paper orders via Alpaca, selects high-expectancy OCC option contracts, and continuously monitors held positions for thesis invalidation.

---

## 2. The 9-Stage Reasoning & Execution Lifecycle

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               9-STAGE AUTONOMOUS REASONING & EXECUTION PIPELINE                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

   [1] DISCOVERY SCANNED       ──> 25-asset continuous market scanner evaluates RVOL, momentum, RSI
        │
        ▼
   [2] LIQUIDITY FILTER        ──> Asset-aware liquidity floors ($0k crypto sandbox, $500k equity)
        │
        ▼
   [3] SPREAD GATE             ──> Bid/ask spread verification (<= 100 bps max spot spread)
        │
        ▼
   [4] MULTI-FACTOR SCORE      ──> Momentum breakout, volume acceleration, regime compatibility
        │
        ▼
   [5] AI COUNCIL              ──> Quant, Intel, Risk & Adversarial Red Team deliberates thesis
        │
        ▼
   [6] AI BUY DECISION         ──> Schema-validated JSON verdict with mathematical target/stop prices
        │
        ▼
   [7] RISK GATE               ──> Non-bypassable 25% single-asset cap, margin boundaries, and limits
        │
        ▼
   [8] BROKER EXECUTION        ──> Idempotent paper order submitted to Alpaca Paper Trading API
        │
        ▼
   [9] THESIS MONITORING       ──> Continuous position health daemon & protective exit execution
```

---

## 3. Core Architectural Highlights

### Multi-Agent Council with Adversarial Red Team
- **Discovery Agent:** Identifies structural catalysts, breakout patterns, and volume expansion.
- **Quantitative Agent:** Analyzes RSI-14, volume acceleration, multi-timeframe candle structure, and realized volatility.
- **Intelligence Agent:** Ingests live Alpaca News feeds, social sentiment, and institutional flow data.
- **Risk Assessment Agent:** Evaluates bid/ask spreads, order book depth, liquidity capitalization, and market-wide beta.
- **Adversarial Red Team:** Probes for counter-evidence, whale distribution, and thesis falsification (`INTACT`, `WEAKENED`, or `DISPROVED`).
- **Synthesis & Decision Agent:** Synthesizes consensus verdicts (`BUY`, `HOLD`, `SELL`, `REJECT`) with explicit confidence scoring.

### Quantitative OCC Option Contract Selector
- Formulates OCC standard symbology (`AAPL260918C00230000`).
- Mathematical selection criteria evaluating **DTE (7–45 days)**, **Delta (0.30–0.70)**, **Implied Volatility**, and **Bid/Ask Spread**.
- Integrates directional bias from multi-agent council consensus directly into option strike selection.

### First-Class Claims & Evidence Contradiction Graph
- Every factual assertion is extracted into an immutable `Claim` entity.
- Evidence items are linked bidirectionally with verification statuses (`VERIFIED`, `UNVERIFIED`, `STALE`, `MOCK`, `FAILED`).
- Contradiction engine automatically cross-references opposing claims and highlights unresolved debates.

### Deterministic Risk Gate & Position Sizing
- **Non-Bypassable Safety Boundary:** Written in deterministic TypeScript without LLM overrides.
- **Invariants Enforced:** Minimum opportunity score, maximum risk score, liquidity threshold, zero Red Team fatal flaws, and single-asset allocation caps ($\le 25\%$).

### Alpaca Paper Trading & Broker Reconciliation
- Dedicated connection to `https://paper-api.alpaca.markets/v2`.
- Any attempt to reach live production endpoints triggers immediate, fail-closed rejection.
- Authoritative position holdings are derived exclusively from confirmed broker fills.
- Idempotency keys (`EXEC-...` and `MONITOR-EXIT-...`) protect against duplicate executions.

### Continuous Position Monitoring & Protective Invalidation
- Held positions are tracked against their original entry thesis.
- Continuous scoring evaluates price drawdown, momentum reversal, liquidity drop, and composite risk surge.
- Invalidation triggers automated protective paper exits derived strictly from broker-confirmed quantities.

---

## 4. Automated Test Suite (891/891 Passing)

The test suite enforces complete domain invariants across 52 verification suites:

| Suite | Focus Area | Status |
|---|---|:---:|
| **1–8** | Quantitative Math, Technical Indicators, Council Agents, Risk Gate | ✅ Passed |
| **9–12** | Red Team Challenge, Single Snapshot Invariant, End-to-End Council | ✅ Passed |
| **13–15** | Claim Domain Model, Evidence Provenance, Contradiction Engine | ✅ Passed |
| **16–17** | Alpaca News Intelligence & Hybrid Fallback Router | ✅ Passed |
| **18–19** | Autonomous Scanner, Candidate Queue, Sequential Dispatcher | ✅ Passed |
| **20–21** | Alpaca Paper Trading Execution & Paper Portfolio Reconciliation | ✅ Passed |
| **22** | Thesis Health Scoring & Protective Invalidation Engine | ✅ Passed |
| **23** | Scheduled Automation Daemon, Concurrency Locks & Audit Trail | ✅ Passed |
| **24** | Command Center UX, Attention Center Alerts & 8-Stage Pipeline | ✅ Passed |
| **25** | Error Containment, System Health, API Hardening & Demo Fixtures | ✅ Passed |
| **26–31** | Autonomous Engine Pipeline, Idempotency, Failure Injection & Circuit Breakers | ✅ Passed |
| **32–40** | Live Alpha Observability, Durable Telemetry Journal, Lineage Validation | ✅ Passed |
| **41–45** | Crypto Liquidity Normalization, Broker Diagnostics, Featherless AI Auditor | ✅ Passed |
| **46–52** | OCC Option Contract Selector, Dynamic Risk Ratios & Real-Time Settlement | ✅ Passed |

---

## 5. Technology Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language:** TypeScript 5.0 (Strict Mode, 0 Type Errors)
- **Styling:** Tailwind CSS + Lucide Icons
- **Broker Integration:** Alpaca Markets Paper Trading API (`@alpacahq/alpaca-trade-api` & REST v2)
- **AI Models:** Google Gemini API / Featherless AI (`Qwen/Qwen3.8-27B-Instruct`)
- **Testing:** Custom zero-dependency automated test runner (`tests/run-tests.js`)

---

## 6. Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Alpaca Paper Trading account API keys ([Sign up for free](https://app.alpaca.markets/signup))

### 1. Clone & Install
```bash
git clone https://github.com/your-username/should-ai-buy.git
cd should-ai-buy
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory:

```bash
# Alpaca Paper Trading API Credentials
ALPACA_API_KEY=your_alpaca_paper_api_key
ALPACA_SECRET_KEY=your_alpaca_paper_secret_key
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets/v2

# Market Data Configuration
ALPACA_DATA_BASE_URL=https://data.alpaca.markets/v2
```

### 3. Run Automated Tests
Execute the 891-test verification suite:

```bash
node tests/run-tests.js
```

### 4. Run TypeScript Verification
```bash
npx tsc --noEmit
```

### 5. Start Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Safety, Determinism & Compliance

- **PAPER TRADING ONLY:** The application enforces dedicated paper trading boundaries. Live broker endpoints are blocked by architectural fail-closed safeguards.
- **ZERO STOCHASTIC LOGIC:** All domain calculations, candidate rankings, thesis health scores, and risk gates are 100% deterministic with zero `Math.random()`.
- **NO FABRICATED DATA:** When upstream services fail, errors are recorded cleanly. The system never fabricates broker fills, artificial account balances, or phantom positions.
- **SERVER-SIDE VALIDATION:** Client user interfaces cannot override order quantities, bypass risk rules, or force invalidation overrides.

---

## 8. License

This project is licensed under the Apache 2.0 License. Built for the Alpaca AI Trading Agents Hackathon.
