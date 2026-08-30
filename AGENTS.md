AGENTS.md
Should-AI Buy? — Agent Development Constitution
1. Project
Should-AI Buy? is an evidence-first, multi-agent trading council built for the Alpaca AI Trading Agents Hackathon.
The core workflow is:
USER COMMAND
    ↓
INVESTIGATION
    ↓
MARKET / NEWS / RISK DATA
    ↓
SPECIALIZED AGENTS
    ↓
INITIAL THESIS
    ↓
RED TEAM
    ↓
FINAL DECISION
    ↓
DETERMINISTIC RISK GATE
    ↓
ALPACA PAPER TRADING
    ↓
TRADE THESIS
    ↓
MONITORING
    ↓
SELL / HOLD

The primary product question is:
"Should-AI buy?"
The product's core differentiator is:
The council must attempt to disprove its own trade thesis before recommending execution.

2. Read Before Coding
Before making changes, read:
/docs/PRD.md
/docs/TECHNICAL_DESIGN.md
/AGENTS.md

If an additional architecture or domain document exists, read it before modifying the corresponding subsystem.
Do not implement based solely on a task description if repository documentation provides additional constraints.

3. Core Engineering Principles
3.1 Deterministic Code Calculates
Never ask an LLM to perform calculations that can be deterministically computed.
Use code for:
price changes
returns
percentages
volatility
volume changes
liquidity metrics
position sizing
portfolio exposure
thresholds
risk limits
timestamps
aggregation
Use AI for:
interpretation
hypothesis generation
contradiction analysis
evidence synthesis
adversarial reasoning
natural-language explanation

3.2 AI Must Not Invent Evidence
Agents must never fabricate:
market prices
trading volume
news articles
URLs
publishers
timestamps
wallet activity
transaction counts
financial statistics
citations
source attribution
If evidence is unavailable, explicitly represent it as unavailable.
Prefer:
"Insufficient evidence."
over a plausible-sounding fabricated answer.

3.3 Evidence Is a First-Class Domain Object
Important claims must reference structured evidence.
Prefer:
Agent conclusion
    ↓
Evidence IDs
    ↓
Inspectable evidence
    ↓
Original source

over:
LLM paragraph

Evidence must be reusable by both the backend and frontend.

3.4 Source Provenance Matters
External information should retain:
source name
URL
publisher
publication timestamp when available
retrieval timestamp
evidence type
Never invent a source URL.

3.5 Agents Are Specialized
Do not create a single giant "trading AI" unless explicitly required.
Agents have defined responsibilities.
Discovery
Find potentially interesting assets.
Quant
Interpret deterministic market metrics.
Intelligence
Analyze relevant external information and news.
Risk
Identify observable risk indicators.
Red Team
Attempt to invalidate the current thesis.
Decision
Synthesize the council and produce the final decision.
Monitoring
Evaluate whether an existing thesis remains valid.

4. Agent Output Rules
Agent responses must use validated structured schemas.
Every agent result should contain, where applicable:
agent
verdict
confidence
summary
supportingEvidenceIds
contradictoryEvidenceIds
risks
recommendations

Do not rely on arbitrary prose parsing when structured output is possible.
Validate model output at the application boundary.
Invalid output must be:
retried where appropriate,
rejected safely,
surfaced as an unavailable agent result if retry fails.

5. Trading Decisions
Valid decision states are:
BUY
HOLD
SELL
REJECT

Do not introduce additional decision states without updating the domain model and documentation.
A decision must contain:
conclusion
confidence
rationale
supporting evidence
contradictory evidence
relevant risk factors

6. Red Team Requirements
The Red-Team Agent is a core product feature, not an optional decorative agent.
The Red Team must receive the existing thesis and actively attempt to break it.
It should investigate:
contradictory evidence
weak assumptions
confirmation bias
overlooked risks
data quality problems
manipulation possibilities
reasons the apparent opportunity may be misleading
The Red Team must not merely summarize the other agents.
Bad:
"The other agents believe NOVA has strong momentum."
Good:
"The bullish thesis assumes rising volume represents organic demand, but concentration evidence weakens that assumption."

7. Financial Safety Boundary
LLM-generated decisions must never directly submit orders.
The required execution path is:
AI DECISION
    ↓
DETERMINISTIC RISK GATE
    ↓
EXECUTION SERVICE
    ↓
ALPACA

The Risk Gate may reject an otherwise AI-approved trade.
Examples:
insufficient liquidity
position too large
risk threshold exceeded
required evidence unavailable
invalid order parameters

The LLM cannot bypass these controls.

8. Paper Trading
Paper trading is the default development and demonstration environment.
Never introduce real-money execution accidentally.
If execution mode changes, it must be explicit and protected by configuration.

9. Architecture Boundaries
Keep these responsibilities separate:
Frontend
    ↓
API / Application Layer
    ↓
Domain / Council
    ↓
Data / Trading Adapters
    ↓
External Providers

Frontend code must not directly contain:
Alpaca secrets
LLM API keys
database credentials
provider-specific privileged operations

10. External Providers
Provider-specific code belongs behind adapters.
Do not spread provider-specific API calls throughout the application.
Prefer:
MarketDataService
TradingService
NewsService

over direct provider calls from arbitrary components.
This makes providers replaceable and testing easier.

11. Database Rules
Persistent entities include:
investigations
agent_runs
evidence
sources
decisions
theses
positions
trades

Avoid storing important domain state only inside frontend state or LLM conversation history.

12. Investigation Integrity
Every investigation must have a unique ID.
Agent runs, evidence, decisions, and related events should be traceable to that investigation.
Conceptually:
INV-XXXX
    ├── Agent Run
    ├── Agent Run
    ├── Evidence
    ├── Evidence
    ├── Red Team
    └── Decision


13. No Silent Failures
If a provider or agent fails:
Do not fabricate a result.
Instead:
status: unavailable
reason: provider timeout

The UI should communicate meaningful degradation.

14. Data Freshness
Market and news data must carry timestamps.
Never describe stale data as current.
If freshness is important to a decision, expose the timestamp to the agent and user.

15. Frontend Rules
The UI should prioritize:
What is happening?
Why is it happening?
What evidence supports it?
What contradicts it?
What is the final decision?
Do not hide important evidence behind excessive navigation.
The user should be able to move:
Decision
   ↓
Reason
   ↓
Evidence
   ↓
Original Source


16. News Rules
News displayed as evidence must be:
attributed
timestamped where possible
clickable
linked to the original source where possible
Never fabricate links.
If the original source is unavailable, say so.

17. UI Should Not Fake AI Activity
If the system displays an agent timeline, it must correspond to actual agent execution.
Do not create fake streaming messages such as:
"Analyzing liquidity..."
unless the application actually initiated that operation.
Presentation animation is acceptable, but it must not falsely represent work that never occurred.

18. Testing Requirements
Changes should include appropriate tests.
At minimum:
deterministic calculations → unit tests
domain logic → unit tests
schemas → validation tests
provider adapters → integration tests where practical
critical user flow → E2E test
The critical E2E flow is:
COMMAND
 ↓
INVESTIGATION
 ↓
AGENTS
 ↓
RED TEAM
 ↓
DECISION
 ↓
EVIDENCE


19. Keep the MVP Small
Do not introduce features merely because they are technically interesting.
Prioritize:
1. Council
2. Evidence
3. Red Team
4. Decision
5. Alpaca
6. Thesis
7. Monitoring
8. Polish

If a feature threatens the core loop, cut the feature.

20. Dependency Discipline
Before adding a dependency:
Check whether existing dependencies already solve the problem.
Prefer small, maintained libraries.
Avoid unnecessary frameworks.
Avoid introducing infrastructure that does not materially improve the MVP.

21. Code Quality
Prefer:
explicit types
small functions
clear domain names
predictable data flow
testable logic
minimal abstraction
meaningful error handling
Avoid:
giant files
giant functions
deeply nested conditional logic
unnecessary abstractions
duplicated provider logic
magic constants
hidden side effects

22. Changes Must Be Scoped
When implementing a task:
modify only relevant files
avoid unrelated refactors
avoid changing architecture without justification
do not overwrite another developer's work
inspect existing code before creating replacements
If a broader architectural change is required, document the reason.

23. Git Discipline
Use focused commits.
Preferred format:
feat(council): add parallel agent orchestration
feat(evidence): add provenance model
feat(ui): add investigation evidence panel
fix(trading): reject orders exceeding risk limits
test(council): add decision validation

Do not create giant commits containing unrelated changes.

24. Before Declaring a Task Complete
Run the relevant:
formatter
linter
type checker
unit tests
integration tests
E2E tests where applicable
Then report:
Implemented:
...

Files changed:
...

Tests:
...

Known limitations:
...

Follow-up:
...

Never claim a test passed unless it was actually run.

25. When Requirements Are Ambiguous
Do not invent important product behavior.
First inspect:
PRD.md
TECHNICAL_DESIGN.md
existing domain types
existing tests

If ambiguity remains:
choose the smallest reasonable implementation,
document the assumption,
avoid blocking unrelated work.

26. Definition of Success
The system succeeds when a user can enter:
"Should-AI buy $BTC?"
and the application can genuinely perform:
Market Data
     ↓
Quant
     ↓
Intelligence
     ↓
Risk
     ↓
Thesis
     ↓
Red Team
     ↓
Decision
     ↓
Evidence UI

The product should feel like a coherent trading council rather than a collection of unrelated AI demos.

27. Final Rule
When deciding between:
more features
and
a more reliable core loop
choose the reliable core loop.
The goal is not to build the largest trading application.
The goal is to build the most convincing demonstration of an evidence-first adversarial trading council.

