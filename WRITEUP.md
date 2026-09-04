# Should-AI Buy? — One-Page Technical Architecture Write-Up

> **Hackathon Submission Requirement:** Official One-Page Architecture Specification covering **AI Logic**, **Risk Gates**, and **Alpaca Infrastructure Implementation**.
> 
> **Live Web Terminal:** [http://15.134.249.209:3000](http://15.134.249.209:3000) *(1-Click Judge Access: `alpaca2026`)*  
> **Repository:** [https://github.com/SquadBlessingMiracle/should-ai-buy](https://github.com/SquadBlessingMiracle/should-ai-buy)  
> **Automated Test Suite:** 891 / 891 Unit Tests Passed (100%)

---

## 1. AI Logic: The Adversarial Trading Council

Traditional AI trading bots rely on a single LLM prompt that suffers from confirmation bias, hallucinations, and zero risk discipline. **Should-AI Buy?** replaces this with an autonomous multi-agent research council built around structured adversarial deliberation.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           MULTI-AGENT ADVERSARIAL PIPELINE                        │
└───────────────────────────────────────────────────────────────────────────────────┘
   Market Scanner ──► [Quantitative Agent]  ──► [Intelligence Agent] ──► [Risk Agent]
                                   │
                                   ▼
                       [Adversarial Red Team Skeptic]
                       • Pokes holes in the bull thesis
                       • Flags liquidity traps & distribution
                       • Verdict: INTACT | WEAKENED | DISPROVED
                                   │
                                   ▼
                     [Synthesis & Decision Council]
                     • Schema-validated JSON verdict
                     • Explicit confidence & opportunity scores
```

### Specialized Council Roles
1. **Quantitative Agent:** Ingests live order book snapshots, RSI-14, multi-timeframe candles, relative volume (RVOL), and historical realized volatility to assess mathematical momentum.
2. **Market Intelligence Agent:** Analyzes live Alpaca news feeds, institutional flow signals, and sector catalysts.
3. **Risk Assessment Agent:** Models bid/ask spreads, market-wide beta, order book depth, and liquidity capitalization.
4. **Adversarial Red Team Skeptic:** The core innovation. Unlike standard bots designed to "find buys," the Red Team's sole directive is to **disprove the thesis**. It hunts for distribution patterns, impending macro releases, and resistance overhead, assigning a falsification rating (`INTACT`, `WEAKENED`, or `DISPROVED`).
5. **Synthesis Consensus Agent:** Combines all analyses into a strictly typed, schema-validated JSON decision (`BUY`, `HOLD`, `PASS`) with target exit prices and explicit invalidation criteria.

---

## 2. Risk Gates: Deterministic Mathematical Safeguards

**Core Invariant:** *LLMs generate investment theses, but they NEVER have direct order execution authority.*

Every trade recommendation must clear our non-bypassable, deterministic Risk Gate written in strict TypeScript before touching the broker:

```
                  ┌─────────────────────────────────────┐
                  │      AI Council BUY Verdict         │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │    DETERMINISTIC RISK GATES (TS)    │
                  ├─────────────────────────────────────┤
                  │ 1. Min Opportunity Score (>= 60)    │
                  │ 2. Min Confidence Score  (>= 65)    │
                  │ 3. Red Team Falsification == 0      │
                  │ 4. Max Bid-Ask Spread    (<= 30 bps)│
                  │ 5. Min Liquidity Floor   ($500k eq) │
                  │ 6. Single-Asset Cap      (<= 25%)   │
                  │ 7. Gross Exposure Cap    (<= 75%)   │
                  │ 8. Dynamic ATR Position Sizing      │
                  └──────────────────┬──────────────────┘
                                     │
                   Passed all gates? │
                   ├── YES ──► Route to Alpaca Paper API
                   └── NO  ──► REJECTED & Logged to Strategy Audit
```

### Risk Gate Invariants
- **Quantitative Cutoffs:** Rejects any opportunity with a score below 60/100 or confidence below 65%.
- **Zero Fatal Flaw Rule:** If the Red Team marks a thesis as `DISPROVED` or flags a fatal flaw, the trade is unconditionally aborted.
- **Capital Boundaries:** Strict maximum position cap of **25% of account equity** per asset and **75% maximum gross portfolio exposure**, reserving cash buffers for drawdowns.
- **ATR-Based Invalidation Sizing:** Position sizes are mathematically calculated based on Average True Range (ATR). Stop-loss levels are computed before entry, not after.
- **Human-in-the-Loop Risk Slider:** An interactive 0%–100% dial allows operators to scale portfolio risk exposure dynamically in real time without restarting daemon services.
- **Continuous Post-Trade Monitoring:** Background workers monitor active positions every 60 seconds. If an entry thesis is invalidated by sudden volume reversal or breakdown, an automated protective exit order is fired.

---

## 3. Alpaca Infrastructure Implementation

Our platform is engineered natively around the **Alpaca Paper Trading API v2**, using real broker endpoints for live market truth, account equity, and order lifecycle management.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           ALPACA INFRASTRUCTURE ARCHITECTURE                      │
└───────────────────────────────────────────────────────────────────────────────────┘
  [ Next.js 14 Web UI ] ◄── REST / SSE ──► [ Autonomous Trading Daemon (PM2) ]
                                                        │
                    ┌───────────────────────────────────┴──────────────────┐
                    ▼                                                      ▼
     Alpaca Paper REST API v2                                Alpaca Market Data v2
     • https://paper-api.alpaca.markets/v2                   • Real-time IEX & Crypto quotes
     • Account equity & buying power                         • 1-minute historical OHLCV bars
     • Idempotent orders (EXEC-..., EXIT-...)                • Live news stream API
     • Position tracking & fills                             • Option chains (DTE 7-45, Delta)
```

### Infrastructure Highlights
1. **Paper-Only Endpoint Isolation:** All outbound broker calls target `https://paper-api.alpaca.markets/v2`. Production endpoints are hardcoded out of scope to eliminate live capital risk.
2. **Sub-40ms Broker Reconciliation:** Local cache state is never treated as authoritative. The system polls and reconciles directly with Alpaca's `/v2/positions` and `/v2/account` endpoints to ensure zero phantom positions.
3. **Idempotency & Duplicate Protection:** Every order generated by the execution router embeds a unique, deterministic client order ID (`EXEC-<cycleId>-<symbol>`). Double-fills and race conditions are mathematically prevented.
4. **Quantitative OCC Option Selector:** Directional equity signals are translated into standard Options Clearing Corporation (OCC) symbology (`AAPL260918C00230000`). Contracts are filtered by expiration (7–45 DTE), target Delta (0.30–0.70), and bid/ask spread tightness.
5. **24/7 Cloud Daemon Deployment:** Hosted on **AWS EC2** (Ubuntu Linux) under **PM2 cluster management** with an Elastic IP (`15.134.249.209`). The web dashboard runs on port 3000 while the autonomous quant worker evaluates cycles in the background 24/7.
6. **Dual-Role Security Gate:** Production deployment is protected by a session-hardened security gate featuring **1-Click Judge Access (`alpaca2026`)** for safe public read-only inspection, alongside an authenticated **Operator tier** for full system execution.

---

## 4. Verification & Live Links

- **Live Application:** [http://15.134.249.209:3000](http://15.134.249.209:3000)
- **Public Judge Passphrase:** `alpaca2026` (Click "1-Click Judge Access" on login)
- **GitHub Repository:** [https://github.com/SquadBlessingMiracle/should-ai-buy](https://github.com/SquadBlessingMiracle/should-ai-buy)
- **Unit Test Coverage:** 891 / 891 tests passing across 52 test suites (`node tests/run-tests.js`)
