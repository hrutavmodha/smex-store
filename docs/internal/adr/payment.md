# ADR 0001: External Payment and Communication Links

## Status
Accepted

## Date
2026-10-09

## Context & Problem Statement
The platform facilitates peer-to-peer trading of gaming account IDs and bookings for competitive rank-boosting packages (specifically for Mobile Legends: Bang Bang).

Integrating automated in-app payment processors (e.g., Stripe, Razorpay, PayPal) introduces major operational and regulatory friction:
1. **High-Risk Merchant Classification**: Digital gaming account transfers and boosting services are routinely classified as high-risk by tier-1 payment gateways, leading to abrupt account holds, frozen funds, or outright merchant termination.
2. **Regulatory & Compliance Burden**: In-app payment processing requires PCI-DSS compliance, merchant KYC/AML verification, tax reporting infrastructure, and payment gateway transaction fees (2%–4% + fixed costs).
3. **Chargeback & Friendly Fraud Exposure**: Digital game accounts and boosting services are prone to malicious chargebacks where buyers dispute charges with credit card issuers after credentials or rank boosts have been delivered.
4. **Escrow Complexity**: Providing native in-app escrow requires holding customer funds, ledger accounting, and administrative arbitration for contested transactions.

## Decision
We will **not** integrate in-app payment gateways, payment processor APIs, or automated escrow systems.

Instead:
1. All commercial transactions, payments, and account handoffs will be coordinated **off-platform** via direct external communication channels (WhatsApp, Discord, Telegram).
2. The platform will act purely as an information, listing, and reputation layer:
   - **Marketplace**: Sellers list account details and verified screenshot proofs; interested buyers click direct contact buttons that open the seller's external communication channel.
   - **Rank Boosting**: The platform provides a dynamic price calculator and generates pre-formatted inquiry messages that link directly to official admin/booster channels on WhatsApp, Discord, or Telegram.
3. Trust and dispute mitigation will be handled through platform-level seller reputation scores, verified purchase review gating, and community trust badges.

## Consequences

### Positive
- **Zero Payment Gateway Liability**: Complete immunity from payment gateway freezes, account bans, and chargeback penalties.
- **Zero Payment Compliance Overhead**: No PCI-DSS certification, KYC collection, or payment processor fees.
- **Faster Time to Market**: Eliminates weeks of payment webhook handling, dispute resolution UI, and ledger state machines.
- **Natural Regional Fit**: Gamers in target markets (e.g., South Asia, Southeast Asia) overwhelmingly prefer direct UPI, bank transfer, or peer-to-peer payments coordinated over WhatsApp or Discord.

### Negative / Trade-offs
- **No Automated Platform Commission Capture**: The platform cannot automatically take a transaction cut at checkout. Monetization must rely on direct listing fees, featured placement badges, or manual booster billing.
- **Counterparty Fraud Risk**: Buyers and sellers bear counterparty risk during off-platform exchange, making verified seller reviews and screenshot proof requirements critical for platform credibility.
