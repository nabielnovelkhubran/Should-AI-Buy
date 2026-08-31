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

## 10. Future Extension Points

- **Phase 3 (Evidence Architecture & Verifiable Reasoning):** Integration of external SEC/regulatory feeds, on-chain event listeners, and bidirectional claim-to-evidence citation graphs.
- **Phase 4 (Social Intelligence):** Real-time social ingestion queue with spam/bot filtering and sentiment signal extraction.
- **Phase 5 (Opportunity Scanner & Watchlist):** Autonomous market scanner background worker with persistent SQLite/Postgres watchlist storage.
- **Phase 6 (Autonomous Monitoring):** Continuous thesis health polling daemon with automated webhook notifications.
- **Streaming (SSE):** Upgrading `/api/investigations` to stream `CouncilEvent` objects via Server-Sent Events for real-time frontend animation.
