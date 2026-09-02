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
| **Intelligence Agent** | Implemented | Analyzes live Alpaca news and social intelligence signals with deterministic demo fallback, spam filtering, and explicit failure handling. | Live RSS connectors, SEC EDGAR filing parser, and live streaming social feeds. |
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
| **Social Intelligence** | Implemented | Provider-agnostic `SocialEvent` model, deterministic spam/quality filter (duplicates, scam patterns, repeated characters, link density), sentiment signal extraction, and demo provider with explicit MOCK provenance. | Live X API connector, production ML bot detection, and streaming social event feeds. |
| **Opportunity Scanner & Discovery Dashboard** | Implemented (Phase 5A, 5B, 5C) | Bounded universe scanner (`scanOpportunities`), deterministic ranking, `CandidateQueue` validation/deduplication, sequential `CouncilDispatcher`, and operator `DiscoveryDashboard` with in-memory watchlist. | Persistent database queue/watchlist storage, continuous daemon/cron scheduler, and automated paper trade execution. |
| **Paper Trading Execution Layer** | Implemented (Phase 6A) | Pure paper order intent generation, strict Risk Gate enforcement, Alpaca Paper Trading adapter (`paper-api.alpaca.markets/v2`), fail-closed live endpoint protection, deterministic position sizing reuse, and idempotency protection. | Live real-money trading, persistent portfolio database, automated stop-loss daemon, leverage, and multi-position portfolio optimization. |
| **Paper Portfolio & Position Lifecycle** | Implemented (Phase 6B) | Real-time broker reconciliation, paper-only fail-closed safety, deterministic P&L, gross/net & crypto/equity exposure calculation, single-asset concentration detection, and proposed order risk assessment. | Live portfolio management, automated stop-loss daemon, leverage escalation, and autonomous position closing. |
| **Autonomous Position Monitoring & Invalidation** | Implemented (Phase 6C) | Continuous thesis health tracking, deterministic invalidation rules (drawdown, momentum, liquidity, risk), broker-authoritative exit proposals, and idempotent paper-only protective exits. | Continuous cron daemon infrastructure, automated multi-broker exits, and dynamic trailing stop algorithms. |
| **Scheduled Automation & Orchestration** | Implemented (Phase 6D) | Deployment-agnostic `AutomationScheduler` and `AutomationCoordinator`, concurrency locking against overlapping runs, failure isolation, deterministic job execution, and operator UI with live audit trail. | Persistent cloud worker daemons, external webhook alerts, and multi-broker failover. |
| **Command Center & Workspace UX** | Implemented (Phase 7) | Unified operator Command Center (`CommandCenterView`), high-level HUD vitals (Environment, Automation, Discovery, Thesis Health, Risk Gate, Portfolio Equity), prioritized Attention & Alert Center, 8-stage lifecycle pipeline visualizer, synchronized multi-workspace navigation, and centralized state polling. | Conversational multi-turn workspace, draggable grid panels, and customizable alert sound notifications. |
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

## 11. Paper Trading Execution, Portfolio & Position Monitoring (Completed Phase 6A, 6B & 6C)

```text
Discovery ──> Deliberation ──> Risk Gate (PASS) ──> Paper Entry ──> Broker Position ──> Position Monitor ──> Thesis Health ──> Invalidation Detection ──> Protective Proposal ──> Paper Exit
```

### Implemented (Phase 6A, 6B & 6C)
- **Paper-Only Safety Boundary:** Enforces dedicated connection to Alpaca Paper Trading (`https://paper-api.alpaca.markets/v2`). Live trading endpoints are rejected with immediate fail-closed exceptions.
- **Strict Risk Gate Enforcement:** Execution requires verified server-side `riskGateApproved === true` and executable recommendation (`BUY` or `SELL`). No bypass flags (`force`, `bypassRiskGate`) exist.
- **Position Sizing Verification:** Reuses deterministic mathematical sizing formulas (`calculatePositionSize`) bounded by 25% portfolio cash exposure and stop-loss risk.
- **Idempotency Protection:** Execution keyed by `EXEC-{investigationId}-{symbol}-{side}` and `MONITOR-EXIT-{symbol}-{category}-{bucket}` preventing redundant broker calls.
- **Broker-Authoritative Reconciliation (6B):** Position states reflect ONLY broker-confirmed fills (`FILLED`, `PARTIALLY_FILLED`). Orders in `SUBMITTED`, `CANCELED`, `REJECTED`, or `FAILED` states do not create open holdings.
- **Deterministic P&L & Exposure (6B):** Real-time calculations for `marketValue`, `costBasis`, `unrealizedPnl`, `unrealizedPnlPercent`, `grossExposureUsd`, `netExposureUsd`, `cryptoExposurePct`, `equityExposurePct`, and `allocationPct`.
- **Portfolio Risk & Concentration Engine (6B):** Automatic detection of single-asset concentration ($> 25\%$ equity) and crypto exposure limits ($> 50\%$).
- **Deterministic Thesis Health Engine (6C):** Evaluates ongoing position health (`HEALTHY`, `DEGRADED`, `INVALIDATED`, `THESIS_UNAVAILABLE`) with 0-100 deterministic scoring based on live price action, momentum, liquidity, and risk thresholds.
- **Deterministic Invalidation Rules (6C):** Explicit triggers for Price Drawdown ($\le -5.0\%$), Momentum Reversal ($< 40$), Liquidity Collapse ($< \$200\text{k}$), Risk Surge ($> 75$), Volatility Surge ($> 55\%$), Data Unavailability (fail-closed), and Broker State Mismatches.
- **Protective Exit Action Proposals (6C):** Separates proposal generation (`ProtectiveActionProposal`) from execution. Derives exit side (`sell` for long, `buy` for short) and quantity strictly from broker-confirmed positions.
- **Paper Exit Order Execution (6C):** Authorized paper exits submit orders through `PaperTradingService` with complete idempotency and audit trail tracking.

### Deferred to Future Phases
- Live real-money trading execution.
- Persistent SQL portfolio database.
- Automated background cron daemon.
- Margin/leverage management and multi-asset portfolio optimization.

---

## 12. Autonomous Opportunity Discovery, Queue & Operator Dashboard (Completed Phase 5A, 5B & 5C)

End-to-end autonomous discovery, deliberation, and observability pipeline:
```text
Phase 5A: Opportunity Scanner ──> Ranked Candidates (Top N) ──> Phase 5B: Candidate Queue ──> Sequential Council Dispatcher ──> 7-Stage Council ──> Phase 5C: Discovery Dashboard & Watchlist
```

### Implemented (Phase 5A, 5B & 5C)
- **Bounded Market Universe (5A):** Explicit deterministic universe (`DEFAULT_SCAN_UNIVERSE = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'MSFT']`) with asset class classification.
- **Candidate Discovery & Signals (5A):** Computes quantitative signals (`momentum`, `rsi`, `rvol`, `volumeAcceleration`, `realizedVolatility`, `liquidityUsd`, `opportunityScore`, `riskScore`) reusing existing calculation engine without duplication.
- **Deterministic Candidate Queue (5B):** Validates all candidate fields, rejects invalid objects explicitly, enforces deduplication against active queue items (`QUEUED`, `DISPATCHING`, `INVESTIGATING`), and orders deterministically by `opportunityScore` DESC, `rank` ASC, and `symbol` ASC.
- **Sequential Council Dispatcher (5B):** Consumes next eligible candidate, attaches full scanner provenance (`source: 'autonomous-scanner'`, `candidateRank`, `opportunityScore`, `scanTimestamp`), passes immutable snapshot, and invokes the 7-stage Council.
- **Autonomous Discovery Dashboard (5C):** Real-time visibility into scanner metrics (universe size, scanned count, success/failure counts, candidates found, last scan timestamp), ranked candidate cards, signals grid, deterministic selection rationale ("Why was this asset nominated?"), queue state, and deep investigation inspection.
- **In-Memory Watchlist (5C):** Deterministic watchlist foundation (`add`, `remove`, `contains`, `list`) strictly decoupled from trade recommendations or broker orders.
- **Strict Failure Isolation:** Individual asset or investigation failures update item to `FAILED` and record error details without halting subsequent candidates.
- **Safety Boundary:** Discovery and Watchlist operations do NOT execute broker orders or alter live portfolio state (`skipOrderExecution: true`).

---

## 13. Scheduled Automation & Orchestration (Completed Phase 6D)

The autonomous automation layer coordinates the execution of Discovery (Phases 5A–5C) and Thesis Monitoring (Phases 6B–6C) cycles on deterministic schedules without modifying underlying business rules:

```text
                  AutomationScheduler (State: STOPPED | RUNNING | IDLE)
                                        │
                                        ▼
                  AutomationCoordinator (Concurrency Lock: activeRuns)
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 Discovery Cycle                Monitoring Cycle
                 (Scan -> Queue -> Dispatch)    (Portfolio -> Thesis -> Exit)
                         │                             │
                         └──────────────┬──────────────┘
                                        ▼
                               Audit Trail & Metrics
```

### Implemented (Phase 6D)
- **Separation of Scheduling and Execution:** `AutomationScheduler` dictates *when* jobs execute; `AutomationCoordinator` orchestrates *what* executes by reusing existing domain services without duplicating logic.
- **Concurrency Locking & Overlap Prevention:** Prevents concurrent runs of the same job type. Overlapping triggers return explicit `SKIPPED` status with `skippedReason: 'JOB_ALREADY_RUNNING'`.
- **Component Failure Isolation:** A failure in a discovery cycle does not stop monitoring cycles, and a failure in monitoring does not stop discovery. The scheduler remains operational.
- **Idempotency & Lifecycle Controls:** Safe, idempotent `start()`, `stop()`, and `runNow(jobType)` operations.
- **Audit Trail & Observability:** Real-time event logging capturing timestamps, triggers (`SCHEDULED` vs `MANUAL`), run IDs, cycle durations, and outcomes.
- **Operator UI Dashboard:** Live `AutomationControl` component featuring real-time scheduler state badges, cycle triggers, and recent audit trail events.

---

## 14. Social Intelligence Architecture (Completed Phase 4C)

Structured social sentiment ingestion pipeline:
```text
Social Providers (X, Reddit, Farcaster) ──> SocialEvent Stream ──> Spam/Bot Filter ──> Extracted Sentiment ──> Evidence Object ──> Intelligence Agent
```

### Implemented (Phase 4C Foundation)
- **Domain Model:** Provider-agnostic `SocialEvent`, `SocialAuthor`, `SocialEngagement`, `SocialFilterStats`, and `SocialSignal`.
- **Adapter Interface:** `SocialSourceAdapter` contract defining deterministic fetching and provenance tagging.
- **Deterministic Quality/Spam Filtering:** Rejection of duplicates, promo patterns, repeated characters, excessive hashtag/link density, and engagement manipulation.
- **Deterministic Sentiment Signal Extraction:** Directional classification, narrative clustering, and confidence scoring without LLM hallucinations.
- **Evidence Conversion:** Normalization to `Evidence` domain objects with explicit `verificationStatus: 'MOCK'` and `adapterSource: 'social-demo-v1'`.

---

## 15. Phased Roadmap

- **Phase 1 — Foundation (Completed `v0.1.0`)**: Alpaca API integration, crypto/stock data adapter, multi-timeframe charts, and multi-currency conversion.
- **Phase 2 — Council Runtime & Visible Deliberation (Completed `v0.2.0`)**: 7-stage council orchestrator, single immutable snapshot invariant, Red Team adversarial attack, deterministic Risk Gate, and DeliberationFeed UI.
- **Phase 3 — Evidence Architecture & Verifiable Reasoning (Completed `v0.3.0`)**: Claim domain model, claim extraction per agent, contradiction matrix, and verification badges.
- **Phase 4A — Alpaca News Intelligence Adapter (Completed)**: Real-time Alpaca Market Data News API connector with safe HTML normalization and deterministic failure handling.
- **Phase 4B — Hybrid News Router (Completed)**: Hybrid news router dispatching live Alpaca news with deterministic, clearly labeled hackathon demo fallback.
- **Phase 4C — Social Intelligence Foundation (Completed)**: Provider-agnostic social domain model, deterministic spam filter, sentiment signal extractor, demo provider, and Intelligence Agent integration.
- **Phase 5A — Autonomous Opportunity Scanner (Completed)**: Bounded market universe scanner, deterministic candidate ranking, top-N limiting, and strict failure isolation.
- **Phase 5B — Candidate Queue & Council Dispatcher (Completed)**: Deterministic in-memory queue, candidate validation, deduplication, sequential Council dispatching with scanner provenance, and non-bypassable Risk Gate.
- **Phase 5C — Discovery Dashboard & Watchlist Foundation (Completed)**: Operator Discovery Dashboard, candidate cards with deterministic selection rationale, queue state observability, deep deliberation inspection, and in-memory watchlist.
- **Phase 6A — Paper Trading Execution Layer (Completed)**: Pure paper order intent generation, strict Risk Gate enforcement, Alpaca Paper Trading adapter (`paper-api.alpaca.markets/v2`), fail-closed live endpoint protection, deterministic position sizing reuse, and idempotency protection.
- **Phase 6B — Paper Portfolio & Position Lifecycle (Completed)**: Real-time broker reconciliation, paper-only fail-closed safety, deterministic P&L, gross/net & crypto/equity exposure calculation, single-asset concentration detection, and proposed order risk assessment.
- **Phase 6C — Autonomous Position Monitoring & Protective Invalidation Daemon (Completed)**: Deterministic thesis health engine, invalidation rules (drawdown, momentum, liquidity, risk), broker-authoritative exit proposals, and idempotent paper-only protective exits.
- **Phase 6D — Scheduled Background Daemon & Automation Scheduler (Completed)**: Autonomous automation coordinator, concurrency locking against overlapping runs, failure isolation, deterministic job execution, and operator UI with live audit trail.
- **Phase 7 — Command Center & Workspace UX (Completed)**: Unified operator workstation (`CommandCenterView`), high-level HUD vitals, prioritized Attention & Alert Center, 8-stage lifecycle pipeline visualizer, synchronized multi-workspace navigation, and centralized state polling.
- **Phase 8 — Hackathon Hardening & System Freeze (Completed)**: Error containment, credential scrubbing regex filter, system health & degraded states (`ONLINE`/`DEGRADED`/`OFFLINE`/`STALE`), bounded backoff polling with tab visibility handling, server-side API validation across all routes, Alpaca 429/401 resilience, explicit operator safety phrasing, deterministic 10-step hackathon demo fixtures, and complete test hardening (321/321 passing).
- **Phase 9 — UI/UX 2.0 Command-Driven Workspace (Next)**: Blank-canvas floating window workspace, desktop window manager, movable/resizable tool surfaces, and modern typography.

