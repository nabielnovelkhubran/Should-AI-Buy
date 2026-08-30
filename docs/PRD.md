Should-AI Buy?
An autonomous trading council that challenges every trade before capital is deployed.
Hackathon: Alpaca AI Trading Agents Hackathon
Organizer: lablab.ai × Alpaca
Dates: August 28 – September 4, 2026
Team: 3 people
Product: Web application / autonomous AI trading agent
Primary Market: Cryptocurrency

1. Executive Summary
Should-AI Buy? is an autonomous AI trading council designed to help users discover, investigate, and manage high-risk cryptocurrency opportunities.
Instead of relying on a single AI model to make a trading recommendation, the system delegates analysis to multiple specialized agents.
The council can:
discover emerging crypto opportunities
analyze market behavior
investigate relevant news and narratives
evaluate risk and potential rug-pull indicators
construct an investment thesis
actively attempt to disprove that thesis
reach a final Buy / Hold / Sell / Reject decision
execute approved paper trades through Alpaca
continuously monitor existing positions
reassess whether the original trade thesis remains valid
The defining principle is:
The AI doesn't just tell you what it thinks. It shows you the evidence behind its reasoning so you can verify it yourself.
This makes the product useful to both inexperienced traders learning how markets work and experienced traders who want to compress hours of research into a faster decision-making workflow.

2. Core Product Concept
The product can be understood as:
Claude Council for trading.
Instead of multiple AI agents debating a programming decision, specialized trading agents debate whether an investment decision is justified.
                        USER
                          │
                          ▼
              "Should-AI buy $NOVA?"
                          │
                          ▼
                 ┌────────────────┐
                 │ TRADING COUNCIL│
                 └───────┬────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       📊 QUANT       📰 INTEL       🛡️ RISK
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                    🔴 RED TEAM
                 "Prove us wrong."
                         │
                         ▼
                  ⚖️ DECISION AGENT
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
            BUY        HOLD       REJECT
              │
              ▼
            ALPACA
              │
              ▼
          MONITORING
              │
              ▼
        THESIS RE-EVALUATION
              │
              ▼
       "Should-AI sell $NOVA?"


3. Product Philosophy
3.1 Don't Just Give Answers
The system should not simply output:
BUY — 87% confidence
Instead, it should provide:
BUY — 87% confidence
followed by:
why the council reached that conclusion
which agents agreed/disagreed
the evidence supporting each claim
contradictory evidence
relevant news
market history
risk indicators
Red-Team objections
source links where applicable

4. Core Insight
Most trading systems attempt to answer:
"Why should I buy this?"
Should-AI Buy? asks an additional question:
"What would prove that we're wrong?"
Every trade therefore becomes a hypothesis.
INVESTMENT THESIS
       ↓
SUPPORTING EVIDENCE
       ↓
ADVERSARIAL ATTACK
       ↓
CONTRADICTORY EVIDENCE
       ↓
COUNCIL DECISION
       ↓
TRADE / REJECT

This adversarial architecture is the primary product differentiator.

5. Target Users
5.1 New / Rookie Traders
Should-AI Buy? can function as a learning-by-doing environment.
A new trader can ask:
Should-AI buy $SOL?
and then inspect:
price history
volume
liquidity
news
market behavior
risk indicators
agent reasoning
The system teaches users why a trade is being considered rather than simply telling them what to do.
The goal is not to turn the application into a formal trading education platform.
Instead:
The learning happens through transparent decision-making.

5.2 Experienced Traders
Experienced traders can use the system as a research accelerator.
Instead of manually:
scanning assets
reading news
checking market behavior
looking for anomalies
comparing signals
monitoring existing positions
they can ask the council to perform the investigation and then inspect the evidence.
The human remains the final decision-maker.

6. Primary User Interaction
The primary interface is a conversational command box.
Example:
Should-AI buy $BTC?
Should-AI sell $ETH?
Should-AI watch $SOL?
Why did you reject $NOVA?
The chat interface acts as the user's gateway to the council.
It should not behave like a generic chatbot.
Commands should map to structured trading workflows.

7. Command System
7.1 Buy
Example
Should-AI buy $NOVA?
Triggers:
opportunity investigation
quantitative analysis
intelligence analysis
risk analysis
Red-Team analysis
final trading decision
Possible outputs:
BUY
HOLD
REJECT

7.2 Sell
Example
Should-AI sell $NOVA?
The system evaluates the current position and compares it against the original trade thesis.
It should ask:
Is the original thesis still valid?
Which thesis conditions changed?
Has momentum deteriorated?
Has risk increased?
Has the expected upside changed?
Has new information invalidated the original reasoning?
Possible outputs:
SELL
HOLD

7.3 Watch
Example
Should-AI watch $NOVA?
The system determines whether an asset is worth monitoring despite insufficient evidence for an immediate trade.
The system can establish conditions under which it should reconsider the asset.
Example:
WATCHING $NOVA

Current Opportunity: 74
Current Risk: 43

Reconsider if:

✓ Liquidity improves
✓ Volume remains elevated
✓ Risk score falls
✓ Momentum confirms


7.4 Why
Example
Why did the council reject $NOVA?
The system explains:
final decision
strongest supporting evidence
strongest contradictory evidence
Red-Team findings
relevant sources
which agents disagreed

8. Command Autocomplete
The command box should provide syntax assistance.
Example:
┌──────────────────────────────────────────────┐
│ Should-AI buy $                              │
└──────────────────────────────────────────────┘

Suggestions

→ Should-AI buy $BTC?
→ Should-AI buy $ETH?
→ Should-AI buy $SOL?

Commands

BUY      Analyze potential entry
SELL     Analyze existing position
WATCH    Monitor an asset
WHY      Explain a previous decision

Autocomplete should reduce friction without forcing users to memorize syntax.
Natural-language variations should be supported where practical.

9. Trading Council
The council consists of specialized agents with clearly defined responsibilities.
Core Agents
Discovery Agent
Quant Agent
Intelligence Agent
Risk Agent
Red-Team Agent
Decision Agent
Monitoring Agent

10. Discovery Agent
Objective
Find potentially interesting emerging assets.
The Discovery Agent should not decide whether an asset is safe.
Its job is:
Find things worth investigating.
Potential signals
momentum
volume acceleration
market activity
liquidity
volatility
price movement
unusual activity
Output
Candidate: $NOVA

Momentum: 92
Volume Acceleration: 88
Liquidity: 74
Activity: 91

Opportunity Score: 87


11. Quant Agent
Objective
Analyze market structure using deterministic calculations and market data.
Potential analysis
price returns
momentum
volatility
volume acceleration
relative volume
liquidity
spread
order-book imbalance
recent price structure
abnormal activity
Output
QUANT ANALYSIS

Bullish:
+ Strong volume acceleration
+ Positive momentum
+ Increasing market activity

Bearish:
- Elevated volatility

Confidence: 76%

Where possible, numerical calculations must be performed by deterministic software rather than generated by the LLM.

12. Intelligence Agent
Objective
Analyze external information surrounding the asset.
Potential sources
latest news
market announcements
public information
relevant narratives
sentiment
catalyst information
Questions
The agent should investigate:
Why is this asset receiving attention?
Is there a genuine catalyst?
Is attention accelerating?
Is the narrative supported by independent evidence?
Is sentiment unusually one-sided?
Are there signs of coordinated promotion?

13. Risk Agent
Objective
Identify structural and behavioral risks.
Potential signals
holder concentration
wallet concentration
liquidity conditions
suspicious transfers
unusual wallet behavior
developer-related activity
token unlocks
contract permissions where available
abnormal transaction patterns
manipulation indicators
The Risk Agent should not claim certainty that an asset is a scam or rug pull.
Instead:
Identify observable risk indicators and explain their significance.

14. Red-Team Agent
The Defining Feature
The Red-Team Agent exists to challenge the council.
Its objective:
Try to prove the trade is wrong.
It receives the current bullish or bearish thesis and searches specifically for contradictory evidence.
Questions
What assumptions are we making?
What evidence contradicts those assumptions?
What risks have other agents overlooked?
Could the apparent opportunity be manipulation?
What would cause this trade to fail?
Which signals are unreliable?
What evidence would invalidate the thesis?
Example
BULL THESIS

"NOVA is experiencing genuine demand."

RED TEAM ATTACK

Concern #1:
Volume is concentrated among a small number
of wallets.

Concern #2:
Liquidity has not increased proportionally
with market activity.

Concern #3:
Recent social activity is unusually concentrated.

THESIS STATUS

WEAKENED


15. Decision Agent
The Decision Agent synthesizes the council's findings.
It must consider:
opportunity
risk
evidence quality
contradictions
Red-Team findings
portfolio context
user/account constraints
The Decision Agent should not simply count votes.
Five bullish agents versus one severe risk signal does not automatically mean BUY.

16. Decision States
BUY
The opportunity survives adversarial review and satisfies the required conditions.
HOLD
The evidence is inconclusive or an existing position remains justified.
REJECT
The opportunity fails risk or adversarial validation.
SELL
The existing position's thesis has deteriorated sufficiently to justify exiting.

17. Opportunity Score
Opportunity should be represented separately from risk.
Potential components:
OPPORTUNITY
├── Momentum
├── Volume Acceleration
├── Liquidity
├── Market Activity
├── Narrative Growth
└── Flow Signals


18. Risk Score
Potential components:
RISK
├── Holder Concentration
├── Liquidity Risk
├── Wallet Behavior
├── Structural / Contract Risk
├── Unlock Risk
└── Manipulation Indicators

A single score must not hide this distinction.
For example:
Opportunity: 91 / 100
Risk:        83 / 100

is more informative than:
AI Score: 74 / 100


19. Evidence-First Explainability
Core Requirement
Every material AI claim should be traceable to inspectable evidence whenever technically available.
The system must distinguish between:
Raw Evidence
What happened?
24h price: +8.7%
24h volume: +38%
Liquidity: $X

Analysis
What does that evidence suggest?
Momentum is strengthening.
Volume acceleration supports the bullish thesis.

Decision
What should we do?
BUY

Users should be able to navigate:
Decision → Analysis → Evidence

20. Evidence Categories
Market Evidence
price history
OHLCV
volume
volatility
liquidity
spreads
order-book information
News / Information Evidence
latest headlines
article timestamps
publisher
relevant catalyst
sentiment classification
Flow Evidence
wallet activity
concentration
unusual transfers
whale behavior
Risk Evidence
detected anomalies
thresholds
historical comparisons
Agent Evidence
agent responsible for claim
confidence
supporting evidence
contradictory evidence
Red-Team objections

21. Interactive Market History
Users should be able to inspect price behavior across multiple periods.
Potential ranges:
1 hour
4 hours
1 day
7 days
1 month
longer periods where data availability permits
The chart should allow users to visually verify claims such as:
"Momentum accelerated during the last 24 hours."
Rather than merely trusting the AI.

22. News Evidence
News should be directly inspectable.
Each news item used materially by the council should display:
📰 NEWS EVIDENCE

Major catalyst drives NOVA activity

Publisher: Example News
Published: 2 hours ago

Relevance: HIGH
Sentiment: POSITIVE

[ Read Original Article → ]

Hard Requirement
News items must be:
clickable
attributed to the publisher
timestamped where available
linked to the original source whenever technically possible
The system must not present external news claims as unsupported AI-generated facts.

23. Source Traceability Requirement
EVID-01
Every externally sourced factual claim that materially contributes to a council decision should expose:
Source attribution
Timestamp where available
Original source link where available
Relevant context
This requirement is P0.

24. Source Hierarchy
The system should prefer:
Original source
Primary data provider
Reputable secondary source
Aggregator
When multiple sources are available, the UI should make the provenance clear.

25. Evidence Timeline
Each investigation should maintain a chronological activity feed.
Example:
14:32:11  🔎 DISCOVERY
          Candidate $NOVA identified.

14:32:14  📊 QUANT
          Volume acceleration confirmed.

14:32:17  📰 INTELLIGENCE
          Positive catalyst identified.

14:32:20  🛡️ RISK
          Wallet concentration anomaly detected.

14:32:24  🔴 RED TEAM
          Attempting to invalidate bullish thesis.

14:32:29  🔴 RED TEAM
          Two additional risk indicators found.

14:32:31  ⚖️ DECISION
          Trade rejected.

The timeline allows users and judges to understand how the conclusion developed.

26. Trade Thesis
Every approved trade should create a persistent Trade Thesis.
TRADE THESIS

Asset
Entry Price
Timestamp

Bull Case
Supporting Evidence

Risk Factors

Invalidation Conditions

Expected Horizon

Position Size

Council Confidence

The thesis becomes the foundation for future sell decisions.

27. Buy → Monitor → Sell Lifecycle
The product should treat trading as a continuous process.
DISCOVER
   ↓
BUY DECISION
   ↓
TRADE THESIS CREATED
   ↓
POSITION OPEN
   ↓
CONTINUOUS MONITORING
   ↓
THESIS RE-EVALUATION
   ↓
SELL / HOLD


28. Sell Intelligence
When evaluating:
Should-AI sell $NOVA?
the system should compare:
Original Thesis
✓ Strong momentum
✓ Increasing liquidity
✓ Positive narrative
✓ Healthy distribution

against:
Current State
✗ Momentum deteriorating
✗ Liquidity declining
✓ Narrative stable
✗ Wallet flows becoming bearish

The council can then conclude:
SELL
because:
The original thesis is no longer intact.
This is fundamentally different from simply predicting that price will fall.

29. Monitoring Agent
The Monitoring Agent continuously evaluates active positions.
Potential triggers:
thesis invalidation
significant risk increase
momentum reversal
liquidity deterioration
new adverse news
abnormal wallet activity
predefined portfolio risk limits
When a significant change occurs, the council should be able to trigger a new investigation.

30. Human Verification
The system should never position itself as an infallible financial oracle.
Its philosophy is:
"We investigate faster. You can verify the work."
Users retain the ability to:
inspect evidence
open source articles
examine charts
view agent reasoning
compare conflicting evidence
disagree with the council
This is particularly important for financial decision-making.

31. Main Dashboard
The dashboard should emphasize active investigations rather than generic financial widgets.
Example:
┌──────────────────────────────────────────────┐
│ SHOULD-AI BUY?                               │
│                                              │
│ Ask the Council...                           │
│                                              │
│ "Should-AI buy $NOVA?"                       │
└──────────────────────────────────────────────┘

AGENT STATUS

● ACTIVE

Candidates investigated: 37
Opportunities detected: 4
Trades approved: 1
Trades rejected: 3
Positions monitored: 2


32. Investigation View
$NOVA

COUNCIL INVESTIGATION

Opportunity     91 / 100
Risk            31 / 100
Confidence      84 / 100

QUANT            🟢 BUY
INTELLIGENCE     🟢 BUY
RISK             🟡 HOLD
FLOW             🟢 BUY
RED TEAM         🟡 CAUTION

────────────────────────────────

FINAL VERDICT

🟢 BUY

[ Why? ] [ Evidence ] [ News ] [ Chart ]


33. Agent Deliberation View
Users should be able to inspect individual agent findings.
Example:
📊 QUANT AGENT

Verdict: BUY
Confidence: 84%

Supporting Evidence:

+ Volume acceleration: +38%
+ Momentum: positive
+ Liquidity: sufficient

[View Market Data]


34. Red-Team View
The Red-Team should receive special visual treatment because it is the project's signature feature.
🔴 RED TEAM

Current Thesis:
"NOVA presents a favorable opportunity."

ATTACKING THESIS...

✓ Tested liquidity
✓ Checked concentration
✓ Examined momentum
✓ Searched contradictory evidence
✓ Investigated abnormal activity

RESULT:

2 significant concerns found.

[View Evidence]


35. Final Verdict
The final verdict should be impossible to miss.
╔══════════════════════════════════════╗
║             $NOVA                    ║
║                                      ║
║         🚫 TRADE REJECTED            ║
║                                      ║
║ Opportunity       91 / 100           ║
║ Risk              83 / 100           ║
║ Confidence        89 / 100           ║
╚══════════════════════════════════════╝

Then:
Why?
The opportunity showed strong momentum, but the bullish thesis failed adversarial validation due to significant concentration and liquidity concerns.
[View Evidence]

36. Alpaca Integration
Alpaca should be a core part of the autonomous workflow rather than merely an order button.
Potential integration:
Market Data
     ↓
Council
     ↓
Decision
     ↓
Risk Validation
     ↓
Alpaca
     ↓
Paper Trade
     ↓
Portfolio
     ↓
Monitoring

The implementation should use the Alpaca interfaces appropriate to the hackathon requirements, including available API/MCP/CLI functionality.

37. Trading Safety
The MVP should operate using paper trading for demonstration.
Potential safeguards:
maximum position size
maximum portfolio exposure
confidence threshold
minimum liquidity requirement
trade cooldown
maximum concurrent positions
predefined loss limits
rejection on insufficient evidence
The system should never imply guaranteed profitability.

38. Technical Principle
Deterministic Software Calculates.
AI Interprets.
Numerical calculations should be handled by code.
Examples:
percentage changes
volatility
volume acceleration
liquidity calculations
position sizing
portfolio exposure
thresholds
risk limits
LLMs should handle:
evidence interpretation
hypothesis generation
contradiction analysis
adversarial reasoning
synthesis
natural-language explanation
This separation improves reliability and makes the system easier to audit.

39. MVP
The MVP must demonstrate the complete loop:
1. User starts council
2. Agent discovers candidate
3. Market data is retrieved
4. Opportunity analysis runs
5. Risk analysis runs
6. News/intelligence analysis runs
7. Bull thesis is generated
8. Red Team attacks thesis
9. Decision is produced
10. Evidence is displayed
11. News sources are clickable
12. Approved trade reaches Alpaca paper trading
13. Position is monitored
14. Thesis can be re-evaluated
15. Sell/Hold decision can be produced

If this works reliably, the MVP is considered complete.

40. Feature Priority
P0 — Must Have
Alpaca integration
Autonomous council orchestration
Buy command
Sell command
Candidate discovery
Quantitative analysis
Risk analysis
Red-Team Agent
Decision Agent
Evidence display
Interactive price history
Clickable news sources
Trade thesis persistence
Paper trading
Position monitoring
Explainable final verdict
Deployed web application
P1 — Strongly Desired
Watch command
Why command
Agent activity timeline
richer news intelligence
wallet/flow analysis
configurable risk thresholds
trade history
thesis invalidation visualization
historical performance
P2 — Stretch
continuous autonomous market scanning
sophisticated on-chain analytics
advanced social intelligence
adaptive strategies
portfolio optimization
advanced backtesting
automated strategy evolution

41. Explicit Non-Goals
The team will not prioritize:
mobile applications
elaborate authentication
complex account management
generalized chatbot functionality
every cryptocurrency/blockchain
institutional-grade infrastructure
perfect rug-pull prediction
guaranteed profitability
dozens of unrelated integrations
unnecessary microservices
The product should remain focused on its core loop.

42. Hackathon Demo
The demo should be designed around a 2–3 minute narrative.
Scene 1 — Ask the Council
User enters:
Should-AI buy $NOVA?

Scene 2 — Discovery
The system identifies why $NOVA is interesting.
Opportunity Score: 91


Scene 3 — Council Investigation
Agents investigate.
📊 Quant          BUY
📰 Intelligence   BUY
🛡️ Risk          CAUTION


Scene 4 — Red Team
The screen changes:
🔴 RED TEAM: ATTACKING THESIS
The agent discovers evidence that was not obvious from the initial bullish signals.

Scene 5 — Evidence
Show:
wallet concentration
liquidity chart
price history
relevant news
timestamps
source links
The judge can see that the AI's conclusion is grounded in observable information.

Scene 6 — Verdict
🚫 REJECT
The bullish thesis failed adversarial validation.

Scene 7 — Second Opportunity
The council finds another asset.
This time the thesis survives.
🟢 BUY
The system executes a paper trade through Alpaca.

Scene 8 — Sell
Later:
Should-AI sell $NOVA?
The system compares the original thesis against current evidence.
Original Thesis
✓ Momentum
✓ Liquidity
✓ Narrative

Current State
✗ Momentum deteriorating
✗ Liquidity declining
✗ Risk increasing

The council concludes:
🔴 SELL
This demonstrates the entire product lifecycle.

43. Judging Strategy
The product should answer three questions immediately:
What is it?
An autonomous AI trading council.
What's different?
It actively tries to disprove every trade before executing it.
Why should I trust it?
You don't have to blindly trust it — you can inspect the evidence and original sources behind its reasoning.

44. Core Differentiators
1. Council Architecture
Multiple specialized agents rather than one monolithic AI.
2. Adversarial Validation
A dedicated Red-Team Agent tries to invalidate the trade thesis.
3. Evidence-First Design
The AI exposes the evidence behind its reasoning.
4. Source Traceability
External claims can be traced back to original sources.
5. Persistent Trade Thesis
Buy decisions create a thesis that can later be tested during Sell decisions.
6. Full Trading Lifecycle
Discover → Buy → Monitor → Sell.
7. Human-in-the-Loop Verification
AI performs the investigation while the user retains visibility and judgment.

45. Product Identity
Should-AI Buy? should not be positioned primarily as:
a crypto price predictor
a chatbot
a rug-pull detector
a trading dashboard
an AI stock screener
Those are components.
The product is:
An autonomous adversarial trading council.

46. Brand Language
Product Name
Should-AI Buy?
Core Phrase
Discover. Challenge. Decide.
Alternative
Don't just find the trade. Try to break it.
Product Philosophy
Don't take our word for it.
Core Pitch
Should-AI Buy? is an autonomous trading council that investigates potential trades, challenges its own thesis, and shows users the evidence before making a decision.

47. One-Sentence Pitch
Should-AI Buy? is a multi-agent trading council that finds emerging crypto opportunities, tries to prove each trade wrong, and only recommends trades that survive adversarial analysis.

48. Extended Pitch
Crypto markets are full of opportunities — and traps.
Should-AI Buy? uses a council of specialized AI agents to investigate potential trades. Quant agents analyze market behavior, intelligence agents investigate news and narratives, risk agents search for structural threats, and a dedicated Red-Team Agent tries to prove the entire thesis wrong.
The council then reaches a Buy, Hold, Sell, or Reject decision.
But we don't ask users to blindly trust the AI.
Every important conclusion is connected to inspectable evidence — from price history and market data to clickable original news sources.
If a trade survives the council, the system can execute a paper trade through Alpaca and continue monitoring whether the original thesis remains valid.
Discover. Challenge. Decide.

49. Final Product Loop
                        DISCOVER
                            │
                            ▼
                    SHOULD-AI BUY?
                            │
                            ▼
                       INVESTIGATE
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
            QUANT        INTEL          RISK
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                       🔴 RED TEAM
                            │
                            ▼
                         EVIDENCE
                            │
                            ▼
                         COUNCIL
                            │
                   ┌────────┼────────┐
                   ▼        ▼        ▼
                  BUY      HOLD    REJECT
                   │
                   ▼
                 ALPACA
                   │
                   ▼
                MONITOR
                   │
                   ▼
              THESIS CHECK
                   │
                   ▼
             SHOULD-AI SELL?
                   │
                   ▼
                COUNCIL
                   │
                SELL / HOLD


50. Final Vision
Should-AI Buy? aims to make autonomous trading more transparent, adversarial, and accessible.
The system does not attempt to replace human judgment.
Instead, it attempts to give users a tireless research team that:
searches for opportunities
investigates evidence
challenges assumptions
explains its reasoning
links back to original sources
executes when authorized
and keeps checking whether it was wrong
The fundamental question is simple:
Should-AI Buy?
But before answering:
The council has to earn the right to say yes.

