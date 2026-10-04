# UX Research & System Friction Report: Should-AI-Buy?

**Document Version:** 1.0.0  
**Methodology:** Persona-driven behavioral simulation, viewport stress-testing (390px mobile, 1440px desktop), and cognitive friction heuristic audit.

---

## 1. Persona Simulation Matrix

| Persona | Primary Goal | Operating Context | Critical Failure Point | Immediate Perception |
| :--- | :--- | :--- | :--- | :--- |
| **1. The Rushed Commuter** | Check current equity, active exposure, and recent automated buys in < 30 seconds. | iPhone 14 / mobile browser (390×844px), one-handed touch, variable 4G latency. | **Header collision & layout collapse:** Navbar elements overlap completely; left ticker sidebar consumes 75% of viewport width, pushing main data offscreen. Pointer events intercepted by overlapping DOM nodes. | *"The app is broken on my phone. I can't even see my balance or tap the tabs."* |
| **2. Skeptical Enterprise Buyer / Compliance Officer** | Audit security perimeter, credential isolation, model hallucination boundaries, and deterministic execution limits. | High-security corporate terminal, SOC2 / ISO-27001 evaluation mindset. | **Plaintext Passphrase in DOM:** Top banner displays `Passphrase: alpaca2026`. Ambiguity between LLM reasoning and real execution authority. | *"Unacceptable security posture: hardcoded password exposed in client UI. Unclear if LLM has unchecked API key spending power."* |
| **3. The Onboarding Skipper** | Try a prompt ("Should I buy NVDA?"), see what happens, and decide whether to trust the output. | Desktop Chrome, 0 documentation read, zero patience for setup tutorials. | **Action Ambiguity on Search:** Typing `Should-AI buy $BTC?` and clicking `Investigate →` leads to a 7-stage debate feed, but user doesn't know if an order was placed or if it's merely a suggestion. | *"Did it just buy BTC with real money? Where is the confirm button? What does 'Veto Cleared' mean?"* |
| **4. Institutional Quant PM** | Validate mathematical edge, risk factor attribution, fill latency, and slippage model. | Multi-monitor workstation, high data-density tolerance. | **Gimmicky Risk Taxonomy:** Risk slider labeled `all in` alongside `standard`, `risky`, `high risk`. Latency metrics reading `0ms` or `1ms` for LLM forensic steps. | *"Toy retail interface masking as a quant system. 'All in' slider is unacceptable in professional asset management."* |

---

## 2. Friction Log: Breakdown by User Flow

### Flow A: Mobile Viewport Rendering (390px Width)
- **Defect:** Header layout (`Header.tsx`) uses fixed horizontal flex without responsive breakpoints (`flex items-center justify-between h-11 gap-3`). On mobile viewports (< 640px), the brand logo, 5 navigation buttons, equity metric, currency selector, and lock button overlap in the same 40px vertical band.
- **Defect:** The left sidebar (`Sidebar.tsx`) renders statically alongside `<main>` with `w-72` or uncollapsed layout, occupying 288px of the 390px screen width. The actual content view receives less than 102px, rendering charts and feeds completely unreadable.
- **User Impact:** 100% bounce rate on mobile devices.

### Flow B: Execution Authority & Decision Boundary
- **Defect:** When a user executes a query in Command Lab (`Should-AI buy $BTC?`), the system transitions to the Council page displaying `BUY · 76%`.
- **Misunderstanding:** First-time users and risk officers cannot determine whether the multi-agent council *executed* an order on Alpaca or simply *recommended* one.
- **Reality in Code:** The Council generates an `AIDecision`. Autonomous execution only occurs if Autonomous Mode is toggled `ON`, or if the user explicitly triggers paper execution after the Risk Gate validates margin, exposure, and spread limits.
- **Root Cause:** Missing explicit execution state pill: `STATUS: DELIBERATION ONLY (NO ORDER TRANSMITTED)` vs `STATUS: PAPER ORDER SUBMITTED TO ALPACA`.

### Flow C: Plaintext Credentials & Security Perception
- **Defect:** [`SystemHealthBanner.tsx`](file:///c:/Users/as999/Documents/ChatGPT/Should-AI-BUY/src/components/SystemHealthBanner.tsx) line 38 renders:
  `Passphrase: alpaca2026`
- **User Impact:** For enterprise evaluators, judges, or retail traders connecting brokerage accounts, displaying authentication secrets in plaintext in the DOM destroys institutional credibility.
- **Remediation:** Remove client-side password hints entirely. If operator unlock is required, provide a standard secure modal prompt.

---

## 3. Buzzword & Cognitive Noise Audit

| Buzzword / UI Label | Current Location | Problem & Confusion | Recommended Quant/Technical Replacement |
| :--- | :--- | :--- | :--- |
| `Passphrase: alpaca2026` | Top System Banner | Exposes authentication secret directly on the screen. | Remove entirely. Display `Role: Read-Only Evaluator` with an `Unlock Operator` button. |
| `All in` | Autonomous Risk Slider | Gambling cliché; damages credibility with serious capital allocators. | `MAX ALLOCATION (50% Portfolio Cap)` |
| `Featherless LLM Forensic Engine` | Strategy Audit Header | Marketing jargon; hides the fact that the auditor evaluates deterministic constraints. | `Deterministic Rule Engine & LLM Consensus Auditor` |
| `Proof Mode OFF` | Top Controls Ribbon | Cryptic; user has no context on what "Proof Mode" verifies (cryptographic audit trail vs mock bypass). | `Execution Audit Hash: Verified` or `Verifiable Ledger Logging` |
| `Veto Cleared` | Adversarial Debate Card | Unclear who held veto power or what condition was satisfied. | `Risk Gate: Cleared (Spread < 50bps, Exposure < 25%)` |
| `Latency: 0ms` | Strategy Audit Metrics | Physically impossible for networked inference; signals synthetic/fake metrics to quants. | Display actual measured execution time or `Local Cache: < 1ms`. |

---

## 4. Prioritized Action Plan & Structural Changes

### [P0] Mobile Responsive Layout Overhaul
1. **Header Collapse (`Header.tsx`):**
   - On `< md` (< 768px): Hide desktop nav pills and equity counter from the top bar.
   - Replace with a compact mobile bar: `[ Logo ] [ Equity: $100K ] [ Hamburger Menu ☰ ]`.
   - The hamburger menu opens a slide-over drawer with the 5 hubs (`Dashboard`, `Command Lab`, `Council`, `Discovery`, `Portfolio`) and child sub-routes.
2. **Sidebar Sheet (`Sidebar.tsx`):**
   - On `< lg` (< 1024px): Collapse the market pairs sidebar into a slide-out drawer or bottom sheet toggled by a `Markets (18)` floating pill, giving 100% width to charts and execution telemetry.

### [P1] Eliminate Security & Credential Smells
1. **Purge Plaintext Passphrase:**
   - Remove `Passphrase: alpaca2026` from [`SystemHealthBanner.tsx`](file:///c:/Users/as999/Documents/ChatGPT/Should-AI-BUY/src/components/SystemHealthBanner.tsx).
   - Display session authority cleanly: `OPERATOR` vs `VIEWER (READ-ONLY)`.
2. **Execution Authority Boundary Banner:**
   - On Council deliberation pages, display a permanent state banner:
     `ANALYSIS MODE · NO BROKER ORDER SUBMITTED · DETERMINISTIC RISK GATE REQUIRED FOR EXECUTION`

### [P2] Jargon Normalization & Risk Sizing Sanitization
1. **Risk Slider:**
   - Replace `standard | risky | high risk | all in` with quantitative risk tiers:
     `CONSERVATIVE (10% Max) | BALANCED (20% Max) | AGGRESSIVE (35% Max) | PEAK (50% Hard Cap)`.
2. **Explain Acronyms with Micro-Tooltips:**
   - `R-Expectancy`: Add tooltip `Realized Gain / Risk Unit (R = Entry - Stop Loss)`.
   - `RVOL`: Add tooltip `Relative Volume vs 20-period Moving Average`.
   - `ROC-3`: Add tooltip `3-Period Rate of Change Momentum`.

---

## 5. Verification Checklist

- [ ] Mobile viewport (375px - 430px) renders without horizontal scroll, overlapping text, or pointer interception.
- [ ] No plaintext passwords, API keys, or secret tokens present in any UI component.
- [ ] Every autonomous decision states whether an order was placed, blocked, or deferred.
- [ ] Terminology conforms to professional asset management standards.
