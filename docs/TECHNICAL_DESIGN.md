Should-AI Buy?
Technical Design Specification
Discover. Challenge. Decide.
Hackathon: Alpaca AI Trading Agents Hackathon
Team: 4 developers
Development Window: August 28 – September 4, 2026
Document Status: Engineering Source of Truth

1. Purpose
This document translates the Should-AI Buy? Product Requirements Document into an implementation architecture.
It defines:
system architecture
service boundaries
agent architecture
council orchestration
data contracts
evidence provenance
trading workflows
thesis persistence
Alpaca integration
frontend architecture
deployment
testing
team ownership
implementation sequencing
The objective is to produce a working, deployable hackathon application rather than a collection of disconnected AI demonstrations.

2. Engineering Principles
2.1 End-to-End Functionality Over Feature Count
The highest priority is a complete working loop:
USER
 ↓
COMMAND
 ↓
COUNCIL
 ↓
EVIDENCE
 ↓
RED TEAM
 ↓
VERDICT
 ↓
ALPACA PAPER TRADE
 ↓
THESIS
 ↓
MONITORING
 ↓
SELL / HOLD

A smaller number of features working end-to-end is preferable to many partially implemented features.

2.2 Deterministic Code Calculates
LLMs should not be responsible for arithmetic that can be performed deterministically.
Code calculates:
price changes
returns
volume changes
volatility
liquidity metrics
position sizes
exposure
risk thresholds
portfolio constraints
timestamps
aggregation
Agents interpret these results.

2.3 Agents Reason Over Evidence
Every agent receives structured evidence rather than being asked to independently "look at the market" without constraints.
RAW DATA
   ↓
NORMALIZATION
   ↓
FEATURE CALCULATION
   ↓
AGENT INPUT
   ↓
LLM ANALYSIS


2.4 Evidence Is a First-Class Object
Evidence should never exist only inside an LLM prompt.
Every meaningful external observation should have a structured representation.
Evidence
├── id
├── type
├── source
├── timestamp
├── value
├── context
└── provenance

This allows the frontend to render the same evidence used by agents.

2.5 Agents Must Be Auditable
Every agent response should record:
agent name
investigation ID
timestamp
input evidence IDs
conclusion
confidence
supporting evidence IDs
contradictory evidence IDs
This creates an investigation trail.

3. High-Level Architecture
                        ┌───────────────────┐
                         │      WEB APP      │
                         │                   │
                         │ Chat / Dashboard  │
                         │ Council / Charts  │
                         │ Evidence / Trades │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │   API / GATEWAY   │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
             COMMAND ROUTER   INVESTIGATION   PORTFOLIO
                    │           ORCHESTRATOR    SERVICE
                    │              │              │
                    │              ▼              │
                    │        ┌───────────┐        │
                    │        │  COUNCIL  │        │
                    │        └─────┬─────┘        │
                    │              │              │
                    │    ┌─────────┼─────────┐    │
                    │    ▼         ▼         ▼    │
                    │  QUANT     INTEL      RISK  │
                    │    │         │         │    │
                    │    └─────────┼─────────┘    │
                    │              ▼              │
                    │         RED TEAM            │
                    │              │              │
                    │              ▼              │
                    │         DECISION            │
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 ▼                 ▼                 ▼
             MARKET DATA        NEWS DATA          ALPACA
                 │                 │                 │
                 └─────────────────┼─────────────────┘
                                   ▼
                              DATA STORE


4. Recommended Stack
The stack should favor speed and reliability.
Frontend
Next.js
React
TypeScript
Tailwind CSS
charting library
lightweight component system
Backend
TypeScript/Node.js within the same application where practical.
Avoid unnecessary microservices.
AI
LLM provider supporting:
structured outputs
tool calling
sufficiently fast inference
parallel requests
Data
Use a relational database for:
investigations
agents
evidence
theses
trades
portfolio state
PostgreSQL is preferred.
Deployment
Deploy the web application as one primary service.
Use managed infrastructure wherever possible.

5. Repository Structure
should-ai-buy/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── council/
│       │   ├── investigations/
│       │   ├── evidence/
│       │   ├── portfolio/
│       │   └── command/
│       └── lib/
│
├── packages/
│   ├── agents/
│   ├── council/
│   ├── market-data/
│   ├── news/
│   ├── risk/
│   ├── trading/
│   ├── evidence/
│   ├── domain/
│   └── shared/
│
├── docs/
│   ├── PRD.md
│   └── TECHNICAL_DESIGN.md
│
└── package.json

The exact structure can change according to implementation preference, but domain boundaries should remain clear.

6. Domain Model
The core entities are:
User
  │
  ├── Investigation
  │       ├── AgentRun
  │       ├── Evidence
  │       ├── Thesis
  │       └── Decision
  │
  └── Position
          └── Thesis


7. Investigation
An investigation represents one council session.
Investigation
├── id
├── command
├── asset
├── status
├── createdAt
├── completedAt
├── agentRuns[]
├── evidence[]
├── decision
└── thesis?

Possible statuses:
QUEUED
DISCOVERING
ANALYZING
RED_TEAM
DECIDING
EXECUTING
COMPLETED
FAILED


8. Evidence Model
Evidence is one of the most important domain objects.
Evidence
├── id
├── investigationId
├── type
├── title
├── description
├── observedAt
├── source
├── value
├── metadata
└── reliability

Evidence types:
MARKET
NEWS
FLOW
RISK
TECHNICAL
EXTERNAL


9. Evidence Provenance
Every external evidence object should retain provenance.
Source
├── name
├── url
├── publisher
├── publishedAt
└── retrievedAt

For news:
NewsEvidence
├── headline
├── publisher
├── url
├── publishedAt
├── relevance
└── sentiment

The frontend must render the URL as an actionable link.

10. Agent Output Contract
Every agent should return structured output.
Conceptually:
AgentResult
├── agent
├── verdict
├── confidence
├── summary
├── supportingEvidenceIds[]
├── contradictoryEvidenceIds[]
├── risks[]
└── recommendations[]

The LLM should generate the reasoning, but the application validates the structure.
Invalid responses should be rejected or retried.

11. Agent Architecture
Discovery Agent
Input
Market universe.
Output
Ranked candidates.
Candidate
├── symbol
├── opportunityScore
├── signals[]
└── evidenceIds[]


Quant Agent
Input
Structured market data.
Responsibilities
momentum
returns
volume acceleration
volatility
liquidity
market structure
Output
Quantitative interpretation.

Intelligence Agent
Input
News and external information.
Responsibilities
identify catalysts
summarize relevant developments
classify sentiment
detect narrative changes
identify contradictions
Every news-derived conclusion must reference evidence IDs.

Risk Agent
Input
Market and available structural data.
Responsibilities
liquidity risk
concentration
abnormal activity
manipulation indicators
other available risk signals
The agent produces risk indicators, not absolute scam declarations.

Red-Team Agent
Input
All previous agent outputs and evidence.
Responsibilities
Attempt to invalidate the current thesis.
It must actively search for:
contradictory evidence
weak assumptions
overlooked risks
data quality problems
confirmation bias
excessive confidence

Decision Agent
Input
Complete council state.
Responsibilities
Produce:
BUY
HOLD
SELL
REJECT

along with:
confidence
rationale
strongest supporting evidence
strongest opposing evidence
thesis status

12. Council Orchestration
The orchestrator controls the investigation lifecycle.
START
 ↓
PARSE COMMAND
 ↓
LOAD ASSET / POSITION
 ↓
COLLECT DATA
 ↓
RUN AGENTS IN PARALLEL
 ↓
AGGREGATE RESULTS
 ↓
RUN RED TEAM
 ↓
RUN DECISION AGENT
 ↓
VALIDATE DECISION
 ↓
PRESENT RESULT
 ↓
OPTIONALLY EXECUTE


13. Parallel Agent Execution
Independent agents should run concurrently.
                DATA
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      QUANT      INTEL       RISK
        │          │          │
        └──────────┼──────────┘
                   ▼
                RED TEAM
                   │
                   ▼
                DECISION

This reduces latency and demonstrates genuine multi-agent orchestration.

14. Red-Team Ordering
The Red Team must run after the initial thesis is established.
This is intentional.
The Red Team needs something concrete to attack.
Evidence
   ↓
Bull / Bear Thesis
   ↓
Red Team
   ↓
Contradiction Analysis
   ↓
Final Decision


15. Council State Machine
DISCOVERY
    ↓
EVIDENCE_COLLECTION
    ↓
ANALYSIS
    ↓
THESIS_FORMATION
    ↓
RED_TEAM
    ↓
DECISION
    ↓
RISK_GATE
    ↓
EXECUTION
    ↓
MONITORING

Any stage can transition to:
FAILED

if required data or infrastructure is unavailable.

16. Risk Gate
Before execution, deterministic rules should have the final ability to reject a trade.
Example:
if liquidity < minimum:
    reject

if positionSize > maximum:
    reject

if riskScore > maximum:
    reject

if requiredEvidenceMissing:
    reject

The LLM cannot override these rules.
This provides an important safety boundary.

17. Trade Thesis Schema
TradeThesis
├── id
├── investigationId
├── asset
├── direction
├── createdAt
├── entryPrice
├── expectedHorizon
├── bullCase
├── supportingEvidenceIds[]
├── riskFactors[]
├── invalidationConditions[]
├── councilConfidence
└── status

Status:
ACTIVE
WEAKENING
INVALIDATED
COMPLETED


18. Thesis Invalidation
Each thesis should have explicit invalidation conditions.
Example:
Invalidation Conditions

1. Momentum reverses below threshold
2. Liquidity falls below threshold
3. Risk score exceeds threshold
4. Major adverse catalyst
5. Red-Team confidence exceeds threshold

Monitoring checks these conditions.

19. Sell Workflow
POSITION
   ↓
LOAD ORIGINAL THESIS
   ↓
COLLECT CURRENT DATA
   ↓
COMPARE ORIGINAL VS CURRENT
   ↓
RUN COUNCIL
   ↓
RED TEAM
   ↓
SELL / HOLD

The system should explicitly surface what changed.

20. Thesis Diff
The frontend should show:
ORIGINAL THESIS          CURRENT STATE

Momentum     ✓           Momentum     ✗
Liquidity    ✓           Liquidity    ✗
Narrative    ✓           Narrative    ✓
Risk         Low         Risk         High

This is one of the strongest visualizations in the application.

21. Market Data Layer
The market-data layer normalizes provider-specific APIs into a common format.
MarketSnapshot
├── symbol
├── price
├── volume
├── liquidity
├── timestamp
└── intervals

Historical candles:
Candle
├── timestamp
├── open
├── high
├── low
├── close
└── volume


22. Market Intervals
MVP should support:
1H
4H
1D
7D
30D
Additional intervals can be added if data availability and implementation time permit.

23. News Layer
The news subsystem should:
retrieve relevant articles
normalize metadata
deduplicate articles
associate articles with assets
timestamp them
provide source URLs
expose them as evidence
Conceptually:
News Provider
     ↓
Normalizer
     ↓
Deduplication
     ↓
Asset Association
     ↓
News Evidence
     ↓
Intelligence Agent


24. News Reliability
The system should distinguish:
PRIMARY
REPUTABLE
SECONDARY
UNKNOWN

The UI should make source quality visible where practical.
The agent should not treat every article as equally reliable.

25. Data Freshness
Evidence should carry timestamps.
Example:
Observed: 14:31:04
Retrieved: 14:31:08

Agents should be informed when data is stale.
A trading decision should not silently rely on hours-old information while presenting it as current.

26. Frontend Architecture
The UI consists of five primary surfaces.
1. Command Center
2. Investigation View
3. Evidence Explorer
4. Portfolio / Positions
5. Trade History


27. Command Center
Primary interaction:
┌───────────────────────────────────────┐
│ Ask the Council...                    │
│                                       │
│ Should-AI buy $NOVA?                  │
└───────────────────────────────────────┘

Autocomplete suggestions should appear while typing.

28. Investigation View
$NOVA

Opportunity       91
Risk              31
Confidence        84

QUANT              BUY
INTELLIGENCE       BUY
RISK               HOLD
RED TEAM           CAUTION

FINAL VERDICT

🟢 BUY

Tabs:
Overview
Council
Evidence
News
Chart
Thesis


29. Evidence Explorer
Evidence should be expandable.
Example:
Volume increased 38%.

[View Evidence]

opens:
24H VOLUME

Previous: $4.2M
Current:  $5.8M
Change:   +38.1%

Observed: 14:31
Source: Market Data

[View Details]


30. News UI
Each article must be clickable.
📰 Major catalyst drives NOVA activity

Publisher: Example News
2h ago

Relevance: HIGH
Sentiment: POSITIVE

[Read Original Article →]

The article link should open the source in a new browser context where appropriate.

31. Council Timeline
The UI should show agent activity.
14:32  📊 Quant analyzing market structure
14:32  📰 Intelligence reviewing news
14:32  🛡️ Risk checking risk indicators
14:33  🔴 Red Team attacking thesis
14:33  ⚖️ Council reaching decision

Streaming updates are preferred but not mandatory for MVP.
A simulated activity presentation must not falsely imply real-time work that did not occur.

32. Portfolio View
Show:
active positions
entry
current value
unrealized P&L
thesis status
latest council decision
risk state
Example:
$NOVA

Position: ACTIVE
Entry: $1.42
Current: $1.71
P&L: +20.4%

Thesis: WEAKENING

[Ask Council]


33. Alpaca Integration
Alpaca is responsible for execution and supported market/trading functionality.
The application should encapsulate Alpaca behind a trading interface.
TradingService
├── getAccount()
├── getPositions()
├── getOrders()
├── submitOrder()
└── closePosition()

The rest of the application should not directly depend on provider-specific API details.

34. Execution Model
For the hackathon:
Paper trading is the default.
Execution:
COUNCIL BUY
    ↓
RISK GATE
    ↓
USER CONFIRMATION / AUTHORIZED AUTONOMOUS MODE
    ↓
ALPACA PAPER ORDER
    ↓
ORDER RESULT
    ↓
POSITION CREATED
    ↓
THESIS CREATED


35. MCP / Agent Tooling
If Alpaca MCP functionality is used, expose narrowly scoped tools.
Examples:
get_account
get_positions
get_market_data
submit_order
get_order
close_position

Agents should not receive unrestricted capabilities.
Only the execution layer should have permission to submit trades.

36. Permission Boundary
Research Agents
       │
       │ READ ONLY
       ▼
Market / News / Risk Data

Decision Agent
       │
       │ PROPOSE
       ▼
Risk Gate
       │
       │ AUTHORIZE
       ▼
Execution Service
       │
       ▼
Alpaca

This prevents an individual LLM agent from directly placing trades.

37. Autonomous Mode
The system may support:
Assisted Mode
Council recommends.
User approves.
Autonomous Paper Mode
Council recommends.
Deterministic risk gate approves.
System submits paper order.
For the hackathon demo, Assisted Mode should be the default presentation mode, with Autonomous Paper Mode available as a demonstration.

38. API Surface
Conceptual endpoints:
POST /api/investigations
GET  /api/investigations/:id

GET  /api/investigations/:id/evidence
GET  /api/investigations/:id/agents
GET  /api/investigations/:id/decision

POST /api/trades
GET  /api/portfolio
GET  /api/positions

POST /api/positions/:id/re-evaluate

The exact implementation may use server actions or another architecture if preferable.

39. Error Handling
The system must degrade gracefully.
Missing news
Continue with market analysis and clearly state:
News data unavailable.
Missing wallet data
Risk agent marks the relevant dimension:
Insufficient evidence.
LLM failure
Retry once, then mark agent unavailable.
Alpaca failure
Do not claim execution occurred.
Stale data
Display a freshness warning.

40. AI Failure Handling
Agents should never fabricate evidence.
If an agent cannot support a claim:
supported: false

or:
Insufficient evidence.
An agent must never invent:
article URLs
price values
wallet addresses
transaction counts
market statistics
citations

41. Testing Strategy
Unit Tests
Test:
scoring functions
calculations
thresholds
thesis invalidation
command parsing
schema validation
Integration Tests
Test:
data provider → normalized data
news → evidence
council → decision
decision → risk gate
risk gate → Alpaca
E2E Test
The critical test:
User command
   ↓
Investigation
   ↓
Agents
   ↓
Red Team
   ↓
Decision
   ↓
Evidence
   ↓
Paper Trade


42. Observability
Each investigation should have a unique ID.
All agent calls should include it.
Example:
INV-8F42

[14:32:01] COMMAND
[14:32:02] MARKET DATA
[14:32:03] QUANT
[14:32:03] INTELLIGENCE
[14:32:03] RISK
[14:32:05] RED TEAM
[14:32:07] DECISION
[14:32:08] RISK GATE
[14:32:09] ALPACA ORDER

This is useful for debugging and also potentially useful during the demo.

43. Security
Never expose:
Alpaca API secrets
LLM API keys
database credentials
to the client.
All credentials remain server-side.
The browser receives only sanitized results.

44. Data Storage
Minimum persistent tables:
investigations
agent_runs
evidence
sources
theses
positions
trades
decisions

Optional:
market_snapshots
news_articles
watchlists


45. Four-Person Team Ownership
Person 1 — AI / Council Lead
Owns:
agent architecture
prompts
council orchestration
Red Team
Decision Agent
structured outputs
Primary packages:
packages/agents
packages/council


Person 2 — Market / Trading Lead
Owns:
market data
quantitative calculations
discovery
risk scoring
Alpaca trading integration
Primary packages:
packages/market-data
packages/risk
packages/trading


Person 3 — Frontend / Product Lead
Owns:
command interface
investigation screen
council visualization
charts
evidence explorer
news UI
portfolio UI
Primary:
apps/web


Person 4 — Platform / Data Lead
Owns:
database
evidence model
news pipeline
API layer
persistence
deployment
observability
Primary:
packages/evidence
packages/news
packages/domain


46. Shared Responsibility
All four members must understand:
COMMAND
 ↓
COUNCIL
 ↓
EVIDENCE
 ↓
RED TEAM
 ↓
DECISION
 ↓
ALPACA
 ↓
THESIS

Nobody should become so siloed that they cannot explain the product to judges.

47. Seven-Day Implementation Plan
Day 1 — Foundation
Goal:
Everything exists and talks to everything else.
Tasks:
repository
deployment skeleton
database
domain types
Alpaca connection
market data connection
LLM connection
base frontend
command parser
End-of-day milestone:
User enters command
        ↓
Backend receives command
        ↓
Investigation created
        ↓
Frontend displays investigation


Day 2 — Market Intelligence
Implement:
market data
historical candles
quantitative calculations
candidate discovery
initial dashboard charts
Milestone:
System can investigate a real asset using real market data.

Day 3 — Council
Implement:
Quant Agent
Intelligence Agent
Risk Agent
structured outputs
parallel orchestration
council aggregation
Milestone:
User can ask Should-AI Buy? and receive a genuine multi-agent analysis.

Day 4 — Red Team + Evidence
Implement:
thesis formation
Red-Team Agent
evidence IDs
evidence explorer
news links
agent reasoning display
Milestone:
The system can visibly challenge its own thesis and show the evidence.
This is the critical product day.

Day 5 — Trading Lifecycle
Implement:
Decision Agent
deterministic risk gate
Alpaca paper execution
trade thesis persistence
positions
Buy workflow
Sell workflow
Milestone:
BUY
 ↓
POSITION
 ↓
THESIS
 ↓
SELL

works end-to-end.

Day 6 — Polish + Reliability
Focus almost entirely on:
UI polish
loading states
errors
animations
charts
evidence presentation
source links
agent timeline
test failures
deployment stability
Do not introduce major new architecture.

Day 7 — Demo Lock
No major features.
Tasks:
final end-to-end testing
seed reliable demo scenarios
rehearse presentation
record backup demo
prepare screenshots/video
verify deployment
verify Alpaca paper trading
verify every evidence link
clean README
finalize architecture diagram

48. MVP Cutoff Rule
If a feature threatens the stability of the core loop, cut it.
The hierarchy is:
1. Council works
2. Evidence works
3. Red Team works
4. Decision works
5. Alpaca works
6. Thesis works
7. UI polish
8. Everything else

Do not sacrifice the first five for additional features.

49. Demo Reliability Strategy
Live external dependencies create risk.
Therefore maintain:
Live Mode
Uses real APIs.
Fallback Demo Mode
Uses cached/recorded evidence and deterministic demo data.
The fallback should preserve the exact same UI and investigation flow.
The demo must never depend on a third-party API behaving perfectly at presentation time.

50. Demo Scenario
Prepare two assets/scenarios.
Scenario A — False Opportunity
Strong momentum
+
Strong volume
+
Positive narrative
        ↓
Risk Agent finds concentration
        ↓
Red Team attacks thesis
        ↓
Council rejects

This demonstrates why the council exists.

Scenario B — Surviving Opportunity
Strong momentum
+
Healthy liquidity
+
Supporting catalyst
+
Acceptable risk
        ↓
Red Team finds no fatal contradiction
        ↓
Council approves
        ↓
Alpaca paper trade

This demonstrates that the system is not simply a "risk bot."

Scenario C — Thesis Failure
Existing position:
BUY
 ↓
Position opens
 ↓
Conditions deteriorate
 ↓
Should-AI sell?
 ↓
Thesis invalidated
 ↓
SELL

This demonstrates the complete lifecycle.

51. Performance Targets
These are engineering targets rather than financial performance claims.
Investigation
Target:
< 30 seconds for a complete council investigation under normal conditions.
Parallel Agent Execution
Quant, Intelligence, and Risk should execute concurrently where dependencies permit.
UI
Initial application interaction should feel immediate.
Evidence
Evidence should be available as agents complete rather than requiring a full page reload.

52. Quality Gates
Before hackathon submission:
[ ] Production deployment works
[ ] Command parser works
[ ] Real market data works
[ ] Historical charts work
[ ] News links work
[ ] Evidence provenance works
[ ] Quant agent works
[ ] Intelligence agent works
[ ] Risk agent works
[ ] Red Team works
[ ] Decision agent works
[ ] Deterministic risk gate works
[ ] Alpaca paper trading works
[ ] Trade thesis persists
[ ] Sell workflow works
[ ] Error states work
[ ] Secrets are protected
[ ] E2E flow passes
[ ] Demo scenarios are rehearsed


53. What We Are NOT Building
Avoid scope creep into:
custom blockchain infrastructure
proprietary LLM training
advanced HFT
institutional portfolio management
dozens of exchanges
mobile applications
social trading
user-to-user messaging
complex subscription infrastructure
perfect rug-pull detection
guaranteed predictive models
production-grade autonomous real-money trading
The hackathon project is a demonstration of an intelligent trading-agent architecture, not a finished hedge fund.

54. Architectural North Star
The application should always preserve this separation:
                ┌─────────────────────┐
                 │      HUMAN          │
                 │                     │
                 │ Verify / Override   │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │      COUNCIL        │
                 │                     │
                 │ Reason / Debate     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │      EVIDENCE       │
                 │                     │
                 │ Observable facts    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │    DETERMINISTIC    │
                 │       GUARDS        │
                 │                     │
                 │ Risk / Limits       │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │       ALPACA        │
                 │                     │
                 │ Paper Execution     │
                 └─────────────────────┘

The AI should never be the only line of defense between a language-model output and an order.

55. Final Architecture
The completed product should conceptually operate as:
                        SHOULD-AI BUY?
                                │
                                ▼
                         COMMAND ROUTER
                                │
                                ▼
                       INVESTIGATION ENGINE
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
            MARKET            NEWS             RISK
             DATA             DATA             DATA
               │                │                │
               ▼                ▼                ▼
            QUANT          INTELLIGENCE        RISK
             AGENT            AGENT            AGENT
               │                │                │
               └────────────────┼────────────────┘
                                ▼
                         INITIAL THESIS
                                │
                                ▼
                         🔴 RED TEAM
                                │
                                ▼
                        CONTRADICTIONS
                                │
                                ▼
                         DECISION AGENT
                                │
                                ▼
                          DETERMINISTIC
                           RISK GATE
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
                  REJECT                 TRADE
                                           │
                                           ▼
                                         ALPACA
                                           │
                                           ▼
                                        POSITION
                                           │
                                           ▼
                                    TRADE THESIS
                                           │
                                           ▼
                                      MONITORING
                                           │
                                           ▼
                                    THESIS CHECK
                                           │
                                           ▼
                                  SHOULD-AI SELL?
                                           │
                                           ▼
                                      COUNCIL


56. Engineering Definition of Done
Should-AI Buy? is considered technically complete when a user can:
Enter a natural-language trading command.
Select or identify an asset.
Trigger a multi-agent investigation.
Receive quantitative analysis.
Receive external intelligence analysis.
Receive risk analysis.
Watch a Red-Team challenge the thesis.
See the evidence supporting the council's claims.
Open original news sources.
View historical market behavior.
Receive a final Buy / Hold / Sell / Reject decision.
Pass the decision through deterministic risk controls.
Execute a paper trade through Alpaca.
View the resulting position.
View the original trade thesis.
Re-evaluate the position later.
See exactly what changed.
Receive a Sell / Hold decision.
Understand why the council reached that conclusion.
If all 19 work reliably, the team has successfully demonstrated the core vision.

57. Final Engineering Principle
Should-AI Buy? should never ask the user to trust an AI simply because it sounds confident.
The system should make the reasoning inspectable.
The council thinks.
The Red Team challenges.
The evidence shows.
The deterministic layer protects.
Alpaca executes.
The thesis remembers.
The council checks again.

