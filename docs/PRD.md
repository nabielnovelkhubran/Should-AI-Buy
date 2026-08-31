# Product Requirements Document (PRD)

**Product:** Should-AI Buy?  
**Tag / Baseline:** `v0.3.0` (Phase 3: Evidence Architecture & Verifiable Reasoning)  
**Core North Star:** An evidence-first autonomous trading council that discovers opportunities, investigates them from multiple specialized perspectives, challenges its own thesis through adversarial reasoning, enforces deterministic safety constraints, executes paper trades through Alpaca, and continuously monitors the resulting thesis.


---

## 1. Product Overview

### What Should-AI Buy? Is
**Should-AI Buy?** is a multi-agent trading investigation platform designed to replace opaque prediction models with a visible, evidence-backed deliberative process. Instead of a single model making an unverified financial prediction, Should-AI Buy? deploys a council of specialized agents (Discovery, Quant, Intelligence, Risk, Red Team, Decision) that systematically investigate an asset, attempt to disprove the bull thesis, verify claims against structured evidence, and enforce code-level safety boundaries before dispatching paper orders.

### The Problem It Solves
Retail traders frequently suffer from confirmation bias, fragmented information, and inability to rigorously stress-test investment ideas. Existing AI trading tools exacerbate this problem by acting as black-box predictors that output confidence scores without inspectable evidence or safety boundaries. Should-AI Buy? turns trading analysis into a transparent hypothesis-testing workflow where every claim is grounded in verifiable market and news evidence.

### Why a Council Architecture Matters
Financial markets involve orthogonal dimensions (technical structure, news catalysts, on-chain liquidity, holder concentration, downside tail risk). A monolithic prompt conflates these signals and easily falls prey to hype. A council architecture assigns strict, isolated responsibilities to dedicated agents, ensuring that quantitative metrics are calculated deterministically while adversarial agents actively look for reasons *not* to trade.

### Supported Assets & Execution Model
- **Supported Assets:** 24/7 Cryptocurrencies (e.g. `BTC/USD`, `ETH/USD`, `SOL/USD`) and US Equities (e.g. `AAPL`, `NVDA`, `TSLA`, `SPY`) with Friday market close handling during weekend sessions.
- **Execution Model:** Paper trading via Alpaca API with deterministic portfolio allocation and position sizing.

---

## 2. Product Thesis & Loop

The core operating loop of Should-AI Buy? is:

```text
OPPORTUNITY DISCOVERY
        ↓
CANDIDATE ASSET
        ↓
EVIDENCE COLLECTION (Single Snapshot)
        ↓
MULTI-PERSPECTIVE COUNCIL (Quant / Intelligence / Risk)
        ↓
RED TEAM CHALLENGE (Adversarial Refutation)
        ↓
COUNCIL DECISION (Consensus Synthesis)
        ↓
DETERMINISTIC RISK GATE (Hard Code Boundaries)
        ↓
PAPER EXECUTION (Alpaca Paper Trading)
        ↓
TRADE THESIS (Persistent Hypothesis)
        ↓
CONTINUOUS MONITORING & RE-EVALUATION
```

While the current version supports on-demand user commands (`Should-AI buy $BTC?`), the system architecture is designed to evolve toward autonomous background opportunity discovery and continuous thesis monitoring.

---

## 3. Problem Statement

Conventional retail trading and existing AI financial tools suffer from systemic limitations:
1. **Fragmented Information:** Traders must manually assemble price charts, technical indicators, news disclosures, and order book depth across disconnected platforms.
2. **Confirmation Bias:** When a trader identifies an opportunity, they subconsciously search for validating news while ignoring red flags such as holder concentration or thin liquidity.
3. **Opaque Black-Box AI:** Generic AI predictors generate trading recommendations without citing verifiable evidence, timestamps, or raw calculation sources.
4. **Unsafe Direct AI Execution:** Allowing an AI model to directly submit financial orders without code-enforced safety checks creates catastrophic prompt injection and drift risks.
5. **Thesis Drift:** Traders enter positions based on a specific catalyst (e.g. volume acceleration) but fail to exit when that specific catalyst deteriorates.

---

## 4. Product Principles

1. **Evidence-First Explainability:** Every material claim made by an agent must link directly to an inspectable, structured evidence record with source attribution, timestamp, and verifiable URL.
2. **Deterministic Where Determinism Matters:** Math, percentage returns, volatility, RSI, RVOL, position sizing, and safety boundaries must be calculated deterministically in code—never estimated by an AI model.
3. **Adversarial Reasoning (Red-Team Core):** The system must not merely ask "Why should we buy this?"; it must actively ask "Why might this trade fail?" through a mandatory Red-Team refutation stage.
4. **Single Immutable Market Snapshot:** All council reasoning for a given investigation operates over exactly one frozen market snapshot to eliminate race conditions and price hallucinations.
5. **Explicit Failure Over Fake Data:** When external intelligence or news feeds are unavailable, agents must explicitly report failure rather than generating plausible synthetic news.
6. **Separation of Reasoning & Safety:** AI council members can recommend an action, but the Deterministic Risk Gate possesses non-bypassable code authority over whether capital can be deployed.

---

## 5. Target Users

- **Active Retail Traders:** Traders looking to compress hours of multi-source research into an instantaneous, structured investigation.
- **High-Volatility & Crypto Market Participants:** Traders navigating meme tokens, emerging assets, and high-beta equities where rug-pull indicators, concentration risks, and liquidity depth are critical.
- **Systematic & Evidence-Driven Investors:** Users who reject black-box financial advice and demand inspectable math, source links, and clear thesis invalidation rules.

---

## 6. Current User Experience (v0.2.0)

1. **Command Input:** User inputs a command via the Command Center (e.g. `Should-AI buy $BTC?`, `Should-AI sell $ETH?`, `Should-AI watch $SOL?`, `Why did you reject $NOVA?`) or clicks a suggested prompt.
2. **Command Parsing & Snapshot Fetch:** Intent and ticker are parsed; a single authoritative `MarketSnapshot` is fetched from Alpaca.
3. **Visible Deliberation:** The 7-stage pipeline stepper renders live progression (`DISCOVERY` → `QUANT` / `INTELLIGENCE` / `RISK` → `RED_TEAM` → `DECISION` → `RISK_GATE`).
4. **Perspective Inspection:** Users can click any stage to open an expandable details drawer or review individual perspective cards for each agent.
5. **Red Team Spotlight:** Displays challenged assumptions, detected vulnerabilities, and the resulting thesis status (`INTACT`, `WEAKENED`, `DISPROVED`).
6. **Verdict & Risk Gate Banner:** Highlights council consensus alongside the deterministic Risk Gate result (clearly marking when Risk Gate blocks a council BUY).
7. **Evidence Explorer:** Users can filter evidence records by category (`ALL`, `MARKET`, `NEWS`, `FLOW`, `RISK`, `TECHNICAL`), review reliability tiers, and open external source links.
8. **Interactive Chart & Portfolio:** Multi-timeframe candlestick chart (`1H`, `4H`, `1D`, `7D`, `30D`), multi-currency conversion, active paper positions, and on-demand thesis re-evaluation.

---

## 7. Current Feature Matrix

| Capability | Status | Current Implementation (v0.2.0) | Future Expansion |
| :--- | :---: | :--- | :--- |
| **Command Center** | Implemented | Conversational input with regex parsing for `BUY`, `SELL`, `WATCH`, `WHY` and quick-suggestion pills. | Fuzzy intent matching, conversational follow-ups, and natural language filters. |
| **Crypto Market Data** | Implemented | 24/7 Alpaca Crypto API integration (`v1beta3`) for spot prices and hourly/daily bars. | Multi-exchange order book depth and DEX liquidity pools. |
| **US Equity Market Data** | Implemented | Alpaca Stock API (`v2`) snapshots with Friday market close handling during weekends. | Real-time quote streaming and extended hours / pre-market feeds. |
| **Multi-Timeframe Charts** | Implemented | Canvas-based candle and volume chart supporting `1H`, `4H`, `1D`, `7D`, `30D` intervals. | Technical indicator overlays (MACD, Bollinger Bands, EMA ribbons). |
| **Multi-Currency Display** | Implemented | Currency switcher supporting USD, EUR, GBP, JPY, IDR, AUD, CAD, CHF, CNY, SGD. | Live foreign exchange rate feed integration. |
| **Discovery Agent** | Implemented | Evaluates baseline opportunity score from momentum, volume acceleration, RVOL, and liquidity. | Autonomous background market scanner integration. |
| **Quant Agent** | Implemented | Deterministic calculation of RSI-14, RVOL, realized volatility, spread, and returns. | Multi-factor quantitative scoring and statistical arbitrage models. |
| **Intelligence Agent** | Implemented | Analyzes public news catalysts and sentiment with explicit failure handling. | Live RSS connectors, SEC EDGAR filing parser, and social sentiment ingestion. |
| **Risk Agent** | Implemented | Computes composite risk score, holder concentration %, and liquidity pool depth. | Deep on-chain contract audits and token unlock schedules. |
| **Red Team Agent** | Implemented | Formulates refutation attacks, challenges assumptions, and flags vulnerabilities. | Multi-round adversarial debate and historical counterfactual simulation. |
| **Decision Agent** | Implemented | Synthesizes council findings, links strongest support / counterargument, and sets consensus. | Dynamic confidence weighting based on historical agent accuracy. |
| **Deterministic Risk Gate** | Implemented | Enforces hardcoded code safety limits ($250k liquidity, 70 max risk, 25% allocation). | User-configurable risk profiles (Conservative, Moderate, Aggressive). |
| **Evidence Explorer** | Implemented | Category filtering, reliability badges (`PRIMARY`, `REPUTABLE`), timestamps, and external URLs. | Deep bidirectional citation graphs and contradiction matrices (Phase 3). |
| **Paper Trading** | Implemented | Dispatches market orders to Alpaca Paper Trading API upon passed BUY decisions. | Limit orders, bracket orders (take-profit/stop-loss), and multi-broker support. |
| **Trade Thesis** | Implemented | Creates persistent thesis with bull case, confidence, and invalidation conditions. | Dynamic thesis mutation and auto-adjusting trailing stop limits. |
| **Monitoring / Re-evaluation** | Partially Implemented | `runMonitoringAgent` evaluates active positions against thesis conditions on demand. | Continuous background daemon with automated webhook alerts (Phase 6). |
| **WATCH Command** | Partially Implemented | Command is parsed; returns asset analysis with watch criteria. | Persistent watchlist table and automatic alerts on threshold triggers (Phase 5). |
| **WHY Command** | Partially Implemented | Command is parsed; explains rejection rationale and counterarguments. | Dedicated interactive deep-dive modal detailing agent disagreements. |
| **Social Intelligence** | Planned | Architectural extension point identified; not implemented. | Twitter/X, Reddit, and Farcaster sentiment stream ingestion (Phase 4). |
| **Opportunity Scanner** | Planned | Architectural extension point identified; not implemented. | Autonomous market screener detecting volume/momentum anomalies (Phase 5). |
| **Streaming Deliberation (SSE)** | Planned | Events model implemented; investigation returned synchronously. | Real-time Server-Sent Events for animated stage transitions. |

---

## 8. Council Architecture

The Council operates through a 7-stage visible lifecycle:

```text
1. DISCOVERY STAGE
   └─ Question: "What is happening?"
   └─ Action: Fetches authoritative single MarketSnapshot; establishes Opportunity Score.

2. PARALLEL SPECIALIZED DELIBERATION
   ├─ QUANT AGENT: "What do numbers say?" (RSI-14, RVOL, Realized Volatility, Spread)
   ├─ INTELLIGENCE AGENT: "What news/catalysts exist?" (Disclosures, News, Sentiment)
   └─ RISK AGENT: "What could go wrong?" (Holder concentration, Liquidity pool depth)

3. RED TEAM ADVERSARIAL CHALLENGE (Core Differentiator)
   └─ Question: "Why might the council be wrong?"
   └─ Action: Attacks the preliminary bull thesis, identifies fatal vulnerabilities.
   └─ Output: thesisStatus (INTACT | WEAKENED | DISPROVED).

4. DECISION SYNTHESIS STAGE
   └─ Question: "What is the council's verdict?"
   └─ Action: Synthesizes multi-perspective findings into BUY, HOLD, SELL, or REJECT.

5. DETERMINISTIC RISK GATE STAGE (Code Safety Boundary)
   └─ Question: "Is capital deployment safe under hard code rules?"
   └─ Action: Non-bypassable code validation over liquidity, risk, and allocation limits.
```

---

## 9. Evidence-First Model

### Current Implementation (v0.2.0)
- **Data Model:** Structured `Evidence` objects containing `id`, `type`, `title`, `description`, `observedAt`, `source` (`name`, `url`, `publisher`, `retrievedAt`), `reliability` (`PRIMARY`, `REPUTABLE`, `SECONDARY`), and `isContradictory`.
- **Deterministic Namespacing:** `EVID-MKT-<invId>-1`, `EVID-FLOW-<invId>-2`, `EVID-NEWS-<invId>-3`.
- **Explorer UI:** Category-based filtering and clickable external URLs.

### Planned Phase 3 Expansion (Evidence Architecture & Verifiable Reasoning)
- **Bidirectional Claim-Evidence Resolution Graph:** Linking specific reasoning phrases directly to supporting/refuting evidence IDs.
- **Multi-Source Aggregation:** Live connectors for regulatory disclosures (SEC EDGAR), on-chain verifiable events, and verified financial news feeds.
- **Contradiction Matrix:** Visual interface contrasting bullish market signals against bearish risk flags.

---

## 10. Safety Model (Deterministic Risk Gate)

The Risk Gate (`src/lib/risk-gate/index.ts`) is a pure code boundary evaluated before any order can reach the execution broker:
1. **Minimum Liquidity:** `liquidityUsd >= $250,000`
2. **Maximum Risk Score:** `riskScore <= 70 / 100`
3. **Minimum Opportunity Score:** `opportunityScore >= 55 / 100`
4. **Maximum Portfolio Exposure:** `positionValue <= 25% Available Cash`
5. **Minimum Evidence Count:** `evidence.length >= 3`
6. **Red-Team Fatal Flaw:** `thesisStatus !== 'DISPROVED'`

**Architectural Rule:** AI reasoning may recommend; deterministic safety code decides whether execution is permitted.

---

## 11. Paper Trading & Thesis Model

- **Order Submission:** When Council verdict is `BUY` and Risk Gate evaluates to `PASSED`, a paper order is dispatched to Alpaca via `alpacaService.submitPaperOrder`.
- **Persistent Trade Thesis:** An approved trade creates a `TradeThesis` record containing:
  - Entry price and timestamp
  - Bull case rationale and supporting evidence IDs
  - Key risk factors
  - Explicit **invalidation conditions** (e.g. Momentum drops below 45, Liquidity drops below $1M, Stop-loss drawdown reaches -5.0%)
- **Re-Evaluation:** `runMonitoringAgent` evaluates active positions against invalidation conditions, recommending `SELL` when original conditions break.

---

## 12. Future Opportunity Discovery (Planned Phase 5)

Transitioning from on-demand user commands toward an autonomous discovery scanner:
```text
Market Data Stream ──> Opportunity Scanner ──> Volume/Momentum Anomaly ──> Candidate Queue ──> Council Investigation ──> Risk Gate ──> Trade / Watchlist
```

---

## 13. Future Social Intelligence (Planned Phase 4)

Structured social sentiment ingestion pipeline:
```text
Social Providers (X, Reddit, Farcaster) ──> SocialEvent Stream ──> Spam/Bot Filter ──> Extracted Sentiment ──> Evidence Object ──> Intelligence Agent
```

---

## 14. Phased Roadmap

- **Phase 1 — Foundation (Completed `v0.1.0`)**: Alpaca API integration, crypto/stock data adapter, multi-timeframe charts, and multi-currency conversion.
- **Phase 2 — Council Runtime & Visible Deliberation (Completed `v0.2.0`)**: 7-stage council orchestrator, single immutable snapshot invariant, Red Team adversarial attack, deterministic Risk Gate, and DeliberationFeed UI.
- **Phase 3 — Evidence Architecture & Verifiable Reasoning (Next)**: Claim-to-evidence citation graph, multi-source ingestion, contradiction matrix, and evidence verification badges.
- **Phase 4 — Social Intelligence**: SocialEvent ingestion, bot detection, sentiment signal extraction, and Intelligence Agent expansion.
- **Phase 5 — Opportunity Discovery & Watchlist**: Autonomous market scanner, opportunity ranking engine, and persistent watchlist table.
- **Phase 6 — Autonomous Monitoring**: Continuous background monitoring daemon, automated thesis invalidation triggers, and exit safeguards.
- **Phase 7 — Command Center / Workspace UX**: Conversational multi-turn workspace, contextual analysis panels, and draggable layouts.
- **Phase 8 — Hackathon Hardening**: Reliability, error boundaries, rate-limiting resilience, and observability logging.
- **Phase 9 — UI/UX 2.0 Polish**: Motion transitions, typography hierarchy, responsive design refinement, and theme polish.
