# Technical Design Document

**Product:** Should-AI Buy?  
**Tag / Baseline:** `v0.3.0` (Phase 3: Evidence Architecture & Verifiable Reasoning)  
**System Architecture:** Next.js 14 App Router, TypeScript, Multi-Agent Council Orchestration, Alpaca Paper Trading Integration.


---

## 1. Architecture Overview

Should-AI Buy? is built as a unified Next.js 14 full-stack application. It cleanly decouples presentation, domain types, quantitative calculations, multi-agent reasoning, safety validation, and execution adapters.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION LAYER                              │
│   Header (FX/Equity) • CommandCenter • DeliberationFeed • RedTeamSpotlight  │
│   EvidenceExplorer • MarketChart (1H-30D) • PortfolioView (Thesis Checks)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            API ROUTE CONTROLLERS                            │
│   POST /api/investigations       GET /api/investigations/[id]               │
│   GET  /api/market-data          GET /api/portfolio                         │
│   POST /api/re-evaluate                                                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    COUNCIL ORCHESTRATOR (src/lib/council)                   │
│                                                                             │
│  1. Single Market Snapshot Fetch ────> Alpaca Market Data Adapter           │
│  2. Parallel Deliberation ───────────> [Quant, Intelligence, Risk Agents]   │
│  3. Adversarial Refutation ──────────> Red-Team Agent                       │
│  4. Consensus Synthesis ─────────────> Decision Agent                       │
│  5. Safety Enforcement ──────────────> Deterministic Risk Gate Evaluator    │
│  6. Order Execution & Thesis ────────> Alpaca Paper API & Storage Service   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```text
should-ai-buy/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── investigations/      # Investigation creation & retrieval
│   │   │   ├── market-data/          # Snapshot & historical candles API
│   │   │   ├── portfolio/            # Alpaca account, positions, & orders
│   │   │   └── re-evaluate/          # Active position thesis check & sell
│   │   ├── globals.css               # Dark theme & custom animation styles
│   │   ├── layout.tsx                # App root layout
│   │   └── page.tsx                  # Dashboard container & tab coordinator
│   ├── components/
│   │   ├── CommandCenter.tsx         # Command input with autocomplete pills
│   │   ├── CurrencyProvider.tsx      # Multi-currency exchange rate context
│   │   ├── DeliberationFeed.tsx      # 7-stage visible deliberation stepper & cards
│   │   ├── EvidenceExplorer.tsx      # Category evidence browser & source links
│   │   ├── Header.tsx                # Portfolio equity, buying power & FX switcher
│   │   ├── MarketChart.tsx           # Multi-timeframe candlestick chart canvas
│   │   ├── PortfolioView.tsx         # Position tracker & thesis re-evaluation
│   │   └── RedTeamSpotlight.tsx      # Adversarial challenge banner & refutations
│   └── lib/
│       ├── agents/                   # Pure agent reasoning functions
│       ├── alpaca/                   # Alpaca Paper Trading REST service
│       ├── command/                  # Command parser (BUY, SELL, WATCH, WHY)
│       ├── council/                  # 7-stage council orchestrator
│       ├── market-data/              # Alpaca market data adapter & snapshot builder
│       ├── news/                     # News evidence generator & source provenance
│       ├── quant/                    # Pure deterministic technical math calculations
│       ├── risk/                     # Composite risk metrics calculation
│       ├── risk-gate/                # Deterministic safety gate evaluation
│       ├── storage/                  # In-memory runtime persistence store
│       └── types/                    # Domain models, contracts, and interfaces
├── tests/
│   └── run-tests.js                  # 20 automated test suites
├── docs/
│   ├── PRD.md                        # Product Requirements Document
│   └── TECHNICAL_DESIGN.md           # Technical Architecture Specification
├── package.json
└── tsconfig.json
```

---

## 3. Domain Model Inventory

The domain models defined in `src/lib/types/index.ts` form the core contracts:

### `MarketSnapshot`
- **Purpose:** An immutable representation of market state at investigation time.
- **Key Fields:** `symbol`, `price`, `bid`, `ask`, `change24h`, `change7d`, `volume24h`, `volumeAcceleration`, `relativeVolume`, `realizedVolatility`, `momentumScore`, `rsi14`, `liquidityUsd`, `spreadBps`, `candles` (`1H`, `4H`, `1D`, `7D`, `30D`), `provider`, `timestamp`.
- **Producer:** `fetchMarketSnapshot` in `src/lib/market-data/index.ts`.
- **Consumers:** All 6 Council Agents, MarketChart, Risk Gate, Evidence Builders.

### `Evidence`
- **Purpose:** Structured factual evidence records with verifiable provenance.
- **Key Fields:** `id`, `type` (`MARKET` | `NEWS` | `FLOW` | `RISK` | `TECHNICAL`), `title`, `description`, `observedAt`, `source` (`name`, `url`, `publisher`, `retrievedAt`), `reliability` (`PRIMARY` | `REPUTABLE` | `SECONDARY` | `UNKNOWN`), `value`, `isContradictory`.
- **Producer:** `getMarketEvidence` & `getNewsEvidence`.
- **Consumers:** Agents, EvidenceExplorer, RedTeamSpotlight.

### `AgentResult`
- **Purpose:** The structured output of a council member.
- **Key Fields:** `agent`, `verdict` (`BUY` | `HOLD` | `SELL` | `REJECT` | `CAUTION` | `VALID` | `OPPORTUNITY`), `confidence`, `summary`, `supportingEvidenceIds`, `contradictoryEvidenceIds`, `strongestSupportingEvidenceId`, `strongestCounterargument`, `metrics`, `failed`, `error`.

### `FinalDecision`
- **Purpose:** Synthesized council consensus combined with safety gate verification.
- **Key Fields:** `conclusion`, `confidence`, `rationale`, `opportunityScore`, `riskScore`, `supportingEvidenceIds`, `contradictoryEvidenceIds`, `riskGateApproved`, `riskGateNotes`, `tradeExecuted`, `orderId`, `thesis`.

### `Investigation`
- **Purpose:** Root aggregate root containing the entire investigation lifecycle.
- **Key Fields:** `id`, `command`, `asset`, `status`, `createdAt`, `snapshot`, `evidence`, `agentRuns`, `decision`, `thesis`, `timeline`, `events`, `stages`.

### `CouncilStageState` & `CouncilEvent`
- **Purpose:** Granular stage lifecycle tracking.
- **Key Fields:** `stage` (`DISCOVERY` | `QUANT` | `INTELLIGENCE` | `RISK` | `RED_TEAM` | `DECISION` | `RISK_GATE`), `status` (`PENDING` | `RUNNING` | `COMPLETED` | `FAILED`), `summary`, `timestamp`, `error`.

### `TradeThesis`
- **Purpose:** Persistent hypothesis recorded upon order execution.
- **Key Fields:** `id`, `investigationId`, `asset`, `direction`, `entryPrice`, `expectedHorizon`, `bullCase`, `supportingEvidenceIds`, `riskFactors`, `invalidationConditions` (`metricKey`, `threshold`, `comparison`, `triggered`, `explanation`), `status`.

---

## 4. Market Data Architecture

### Alpaca Adapter (`src/lib/market-data/alpaca-adapter.ts`)
1. **Cryptocurrencies:** Uses `GET /v1beta3/crypto/us/bars` and `GET /v1beta3/crypto/us/snapshots` for continuous 24/7 market state.
2. **US Equities:** Uses `GET /v2/stocks/snapshots` and `GET /v2/stocks/bars`. On weekends when the stock market is closed, the adapter extracts the latest trade price and Friday daily close from the snapshot.
3. **Multi-Timeframe Partitioning:** Hourly bars are partitioned into `1H` (last 24 hours), `4H` (aggregated 4-hour blocks), `1D` (daily series), `7D` (7-day daily window), and `30D` (30-day daily window).
4. **Single Snapshot Invariant:** Exactly **one** snapshot fetch occurs per investigation. Agents never make secondary market data calls.

---

## 5. Council Orchestration Architecture

The orchestration engine (`src/lib/council/index.ts`) executes the following sequence:

```text
1. INITIALIZATION: Initializes stages { DISCOVERY: PENDING, ... RISK_GATE: PENDING }
2. DISCOVERY: Fetches single MarketSnapshot from Alpaca -> Runs Discovery Agent -> Emits COMPLETED/FAILED
3. PARALLEL BRANCH (Promise.all):
   ├─ Quant Agent (Deterministic indicators interpretation)
   ├─ Intelligence Agent (News catalyst audit; explicit failure if unavailable)
   └─ Risk Agent (Holder concentration & liquidity pool depth analysis)
   * Each branch is isolated with a dedicated try/catch boundary.
4. RED TEAM ATTACK: Formulates preliminary thesis -> Refutes assumptions -> Identifies vulnerabilities -> Sets thesisStatus
5. DECISION SYNTHESIS: Weighs evidence, opportunity, risk, and Red-Team refutation -> Produces consensus
6. DETERMINISTIC RISK GATE: Evaluates code-enforced safety rules
   ├─ If PASSED & BUY: Dispatches Alpaca paper order -> Creates TradeThesis -> Saves position
   └─ If BLOCKED: Emits RISK_GATE: FAILED with specific violation notes
7. COMPLETION: Sets investigation.status = 'COMPLETED', saves to storage, returns to client.
```

---

## 6. Deterministic Quantitative & Safety Calculations

To prevent hallucinated numbers, all mathematical calculations reside in pure TypeScript modules:
- `calculateReturn(p1, p2)`: Percentage change between price intervals.
- `calculateRVOL(currentVol, historicalVols)`: Volume relative to 15-period rolling average.
- `calculateVolumeAcceleration(latestVol, prevVol)`: Velocity of volume change.
- `calculateRealizedVolatility(candles)`: Annualized standard deviation of log returns.
- `calculateRSI(candles, period)`: 14-period Wilder-smoothed Relative Strength Index.
- `calculateMomentumScore(candles)`: Weighted composite momentum metric.
- `calculatePositionSize(cash, maxRiskPct, price, stopLossPct)`: Risk-based capital allocation.
- `calculateRiskMetrics(top10Pct, liquidity, vol24h, anomalies, unlocks)`: Composite risk score.

---

## 7. Safety Architecture (Deterministic Risk Gate)

Located in `src/lib/risk-gate/index.ts`, `evaluateRiskGate` is a non-bypassable safety boundary:
- **Rule 1 (Red-Team Refutation):** If `hasRedTeamFatalFlaw === true` (`thesisStatus === 'DISPROVED'`), trade is blocked.
- **Rule 2 (Liquidity Floor):** If `liquidityUsd < $250,000`, trade is blocked.
- **Rule 3 (Risk Ceiling):** If `riskScore > 70`, trade is blocked.
- **Rule 4 (Opportunity Floor):** If `opportunityScore < 55`, trade is blocked.
- **Rule 5 (Position Sizing Cap):** If `positionValue > 25% Available Cash`, trade is blocked.
- **Rule 6 (Evidence Sufficiency):** If `evidence.length < 3`, trade is blocked.

---

## 8. Execution & Monitoring Architecture

### Paper Trading Workflow
When the Decision Agent concludes `BUY` and the Risk Gate passes:
1. `alpacaService.submitPaperOrder(asset, qty, 'buy', price)` transmits a market order to Alpaca Paper Trading.
2. A `TradeThesis` entity is recorded with timestamped entry and explicit invalidation thresholds.
3. An active `Position` is stored in runtime memory linking to the thesis ID.

### Thesis Re-Evaluation Workflow (`POST /api/re-evaluate`)
1. Fetches current live market snapshot for the asset.
2. Compares live momentum, liquidity, and drawdown against `invalidationConditions`.
3. If an invalidation condition is breached, `runMonitoringAgent` recommends `SELL` with detailed condition breakdown.
4. If `executeSell === true`, a closing order is submitted to Alpaca and the position is marked `CLOSED`.

---

## 9. Testing Strategy & Verified Invariants

The test suite in `tests/run-tests.js` executes 20 automated tests:
1. **Asset Classification:** Crypto vs stock regex and symbol normalization.
2. **Weekend Extraction:** Friday close recovery for US equities during weekend closures.
3. **Historical Partitioning:** Correct time-bucket slicing across 1H, 4H, 1D, 7D, 30D intervals.
4. **Deterministic Technical Math:** Exact math assertions for returns, RVOL, volume acceleration, and realized volatility.
5. **Council Execution:** 7-stage sequential and parallel progression.
6. **Snapshot Consistency & Isolation:** Confirms all agents receive the exact same unmutated snapshot reference.
7. **Risk Gate Policies:** Rejection of disproved theses, thin liquidity, and over-allocation.
8. **Failed Stage Resilience:** Graceful handling of empty news intelligence without hallucinating fake news.
9. **Command Parser Compatibility:** Valid parsing of BUY, SELL, WATCH, WHY across crypto and stock tickers.

---

## 10. Future Extension Points & Phase Roadmap Status

- **Phase 4A (Alpaca News Intelligence Adapter - Completed):** Live connector for Alpaca Market Data News REST API (`v1beta1`) with safe HTML normalization and deterministic failure handling.
- **Phase 4B (Hybrid News Router - Completed):** Hybrid routing engine routing live Alpaca news as primary, with deterministic, visibly labeled hackathon demo fallback scenarios on empty, stale, or unavailable feeds.
- **Phase 4C (Social Intelligence Foundation - Completed):**
  - **Architecture:** Provider-agnostic `SocialEvent` representation (`platform`, `author`, `text`, `engagement`, `verificationStatus: 'MOCK'`, `adapterSource: 'social-demo-v1'`).
  - **Quality & Spam Filter:** Deterministic filter rejecting duplicate text, promotional scam patterns, excessive character/emoji repetitions, and link/hashtag density.
  - **Sentiment Signal Extractor:** Directional classification, narrative clustering, and confidence scoring without LLM fabrication.
  - **Evidence Normalization:** Seamless conversion into `Evidence[]` records consumed by `IntelligenceAgent`, `ClaimInspector`, and `ContradictionMatrix`.
- **Phase 5A (Autonomous Opportunity Scanner - Completed):**
  - **Bounded Market Universe:** Explicit universe configuration (`DEFAULT_SCAN_UNIVERSE = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'MSFT']`).
  - **Candidate Discovery & Signals:** Evaluates `MarketSnapshot` without math duplication; computes `momentum`, `rsi`, `rvol`, `volumeAcceleration`, `realizedVolatility`, `liquidityUsd`, `opportunityScore`, and `riskScore`.
  - **Deterministic Ranking:** Primary sort by `opportunityScore` DESC, secondary tie-breaker by `symbol` ASC.
  - **Top-N Selection:** Returns top N candidates according to configurable `limit` and optional `minScore`.
  - **Failure Isolation:** Errors on single symbols are captured in `failedTargets` without aborting scan; no fake data fabrication.
- **Phase 5B (Candidate Queue & Council Dispatcher - Completed):**
  - **Deterministic Candidate Queue:** In-memory queue with validation, deduplication against active states (`QUEUED`, `DISPATCHING`, `INVESTIGATING`), and priority sorting (`score` DESC, `rank` ASC, `symbol` ASC).
  - **Sequential Council Dispatcher:** Consumes highest priority candidate, attaches scanner provenance metadata (`source: 'autonomous-scanner'`, `candidateRank`, `opportunityScore`, `scanTimestamp`), passes immutable snapshot, and invokes 7-stage Council sequentially.
  - **Safety Boundaries:** Pure candidate evaluation without trade execution (`skipOrderExecution: true`); non-bypassable Risk Gate validation.
  - **Fault Isolation:** Individual investigation failures transition item to `FAILED` without crashing the queue.
- **Phase 5C (Discovery Dashboard & Watchlist Foundation - Completed):**
  - **Operator Observability UI:** Real-time visibility into scanner metrics, ranked candidate cards, signals grid, selection rationale ("Why nominated"), queue lifecycle, and failed scan feed targets.
  - **Deliberation Deep Dive:** Seamless operator inspection jumping from candidate card directly into `DeliberationFeed`, `EvidenceExplorer`, `ClaimInspector`, and `RedTeamSpotlight`.
  - **In-Memory Watchlist:** Deterministic watchlist service (`add`, `remove`, `contains`, `list`) strictly decoupled from buy decisions and automated broker execution.
- **Phase 6A (Paper Trading Execution Layer - Completed):**
  - **Paper-Only Safety Boundary:** Enforces dedicated connection to Alpaca Paper Trading API (`https://paper-api.alpaca.markets/v2`); fails closed on live endpoints.
  - **Risk Gate Enforcement:** Non-bypassable server-side validation requiring `riskGateApproved === true` and actionable verdict (`BUY`/`SELL`).
  - **Position Sizing Verification:** Deterministic sizing derived from account cash, asset price, and stop-loss limits without client overrides.
  - **Idempotency Engine:** Keyed by `EXEC-{investigationId}-{symbol}-{side}` to prevent accidental duplicate order submissions.
  - **Order Lifecycle & Traceability:** Tracks states (`INTENT_CREATED`, `SUBMITTED`, `FILLED`, `CANCELED`, `REJECTED`, `FAILED`, `BLOCKED`) and attaches execution metadata to `investigation.execution`.
- **Phase 6B (Paper Portfolio & Position Lifecycle - Completed):**
  - **Broker-Authoritative Reconciliation:** Position holdings reflect confirmed broker fills (`FILLED`, `PARTIALLY_FILLED`). `SUBMITTED`, `CANCELED`, `REJECTED`, or `FAILED` orders do NOT create open positions.
  - **Deterministic P&L & Exposure Math:** Computes `marketValue`, `costBasis`, `unrealizedPnl`, `unrealizedPnlPercent`, `grossExposureUsd`, `netExposureUsd`, `cryptoExposurePct`, `equityExposurePct`, and `allocationPct`.
  - **Portfolio Risk Engine:** Concentration monitoring ($> 25\%$ single-asset limit, $> 50\%$ crypto limit, $> 100\%$ gross leverage limit, $< 10\%$ cash liquidity reserve).
  - **Pre-Trade Risk Assessment:** `assessProposedOrder()` pre-checks hypothetical trade allocations against portfolio limits prior to broker submission.
  - **Fault Isolation:** Component-level failure containment (`errors: PortfolioError[]`) prevents partial broker outages from corrupting aggregate state.
- **Phase 6C (Autonomous Position Monitoring & Protective Invalidation Daemon - Completed):**
  - **Authoritative Position Monitoring:** Uses `PaperPortfolioService` as ground truth; evaluates broker-confirmed positions continuously.
  - **Deterministic Thesis Health Engine:** Scores position health (0–100) across price drawdown, momentum reversal, liquidity pool depth, and composite risk surge.
  - **Explicit Invalidation Rules:** Fail-closed invalidation triggers on price drawdown ($\le -5.0\%$), momentum collapse ($< 40$), liquidity drop ($< \$200\text{k}$), risk surge ($> 75$), missing market data (`DATA_UNAVAILABLE`), and broker quantity mismatch (`BROKER_STATE_MISMATCH`).
  - **Protective Exit Action Proposals:** Generates decoupled `ProtectiveActionProposal` records with broker-derived exit quantities (`sell` for long, `buy` for short) and risk safety validation.
  - **Idempotent Paper Exits:** Submits paper exit orders through `PaperTradingService` keyed by `MONITOR-EXIT-{symbol}-{category}-{bucket}`, preventing duplicate order execution.
  - **Monitoring API & UI Dashboard:** `GET/POST /api/monitoring` and integrated `PortfolioView` displaying real-time thesis health badges, triggers, and protective action states.
- **Phase 6D (Scheduled Background Daemon & Automation Scheduler - Completed):**
  - **Deployment-Agnostic Coordinator:** `AutomationCoordinator` orchestrates Discovery (`scanOpportunities` $\rightarrow$ `candidateQueue` $\rightarrow$ `councilDispatcher`) and Monitoring (`positionMonitoringService` $\rightarrow$ `paperTradingService`) without duplicating domain logic.
  - **Concurrency & Overlap Protection:** In-memory lock per job type (`activeRuns`) guarantees that overlapping scheduled ticks return deterministic `SKIPPED` status without spawning concurrent jobs.
  - **Failure Isolation:** Discovery and Monitoring run in isolated try/catch boundaries; an error in one subsystem does not prevent or corrupt execution in the other.
  - **Automation API & Operator Control:** `GET/POST /api/automation` supporting `start`, `stop`, `runNow`, and `updateConfig` operations.
  - **Operator UI & Audit Trail:** Interactive `AutomationControl` component displaying scheduler state, live metrics, job cards, manual triggers, and real-time audit logs.
- **Phase 7 (Command Center / Workspace UX - Next):** Conversational multi-turn workspace, contextual analysis panels, and draggable layouts.
- **Future Social Expansion:** Live X (Twitter) API v2 connector, real-time WebSocket ingestion, and production ML bot detection models.
- **Streaming (SSE):** Upgrading `/api/investigations` to stream `CouncilEvent` objects via Server-Sent Events for real-time frontend animation.

