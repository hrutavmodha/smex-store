# ADR 0002: Rank-Boosting Model and Pricing System

## Status
Accepted

## Date
2026-10-09

## Context & Problem Statement
The platform offers rank-boosting services for Mobile Legends: Bang Bang (MLBB). 

Two operational and pricing questions required architectural decisions:
1. **Provider Model**: Should the platform allow open registration for third-party freelance boosters (marketplace model), or restrict boosting to platform-managed and vetted boosters (curated provider model)?
2. **Pricing Structure**: How should boosting packages be priced, calculated, and presented to users, given that MLBB ranking progression switches from divisions (Epic, Legend) to Stars (⭐) once players reach Mythic?

## Decision

### 1. Curated Provider Model
For the initial release, rank-boosting offerings will be **strictly Admin-Curated**:
- Third-party users cannot post public boosting services.
- All boosting orders are fulfilled by the platform administration and their vetted internal booster roster.
- This prevents boosting scams, account theft, and poor service quality from damaging the platform's early reputation.

### 2. MLBB Dual-Mode Pricing System
The system implements a dual-mode dynamic pricing calculator reflecting MLBB's rank mechanics:

#### A. Fixed Tier-to-Tier Packages (Sub-Mythic)
Flat pricing for standard division leaps:
- **Epic → Legend**: ₹400
- **Legend → Mythic**: ₹300
- **Epic → Mythic (Bundle)**: ₹600 (includes a ₹100 bundle discount compared to ₹400 + ₹300)

#### B. Per-Star Incremental Progression (Mythic & Above)
Progressive difficulty-scaled pricing per star for high-MMR ranks:
- **Mythic** (0–24 Stars): ₹20 / star
- **Mythical Honor** (25–49 Stars): ₹30 / star
- **Mythical Glory** (50–99 Stars): ₹35 / star
- **Mythical Immortal** (100+ Stars): ₹40 / star

### 3. Dynamic Calculation & Communication Handoff
- The calculator must automatically sum multi-tier star deltas across bracket boundaries (e.g., Mythic 10★ to Mythical Honor 30★ = 15 stars @ ₹20 + 5 stars @ ₹30 = ₹450).
- Upon selecting or calculating a quote, the UI generates pre-formatted links to WhatsApp, Discord, or Telegram containing the starting rank, target rank, calculated price in INR (₹), and player In-Game Name (IGN).
- Base rates are stored in PostgreSQL and fully configurable by Admins via the management dashboard without code redeployment.

## Consequences

### Positive
- **Guaranteed Service Quality**: Direct admin curation ensures customer accounts are safe and boosters are reliable.
- **Zero Pricing Ambiguity**: Clear, transparent, instant pricing calculations eliminate tedious back-and-forth negotiation on messaging apps.
- **Incentivized Upgrades**: Clear bundle discounts (e.g., Epic → Mythic saving ₹100) encourage higher-value customer orders.

### Negative / Trade-offs
- **Operational Scalability**: Scaling boosting revenue requires manual booster coordination and schedule management by the platform administrator until an automated booster assignment system is engineered.
