# Sprint 1: Manager Role, Tournament Incident Monitoring & Boosting Operations

## 1. Executive Summary & Sprint Objectives

This specification defines the functional and non-functional requirements for **Sprint 1** (Post-v1.0 Milestone delivery). 

Sprint 1 introduces a dedicated operational role—**Manager** (formerly referred to as Referee/Umpire)—to empower squad leadership and tournament governance while closing operational alerting gaps in the MLBB boosting service pipeline.

### Core Objectives:
1. **Manager Role & RBAC**: Introduce the `manager` role in authentication and authorization layers, allowing Platform Admins to appoint trusted players as standing Managers with platform-wide operational oversight until explicitly dismissed by an Admin.
2. **Tournament Match Incident Flagging**: Provide Managers with tools to monitor live tournament lobbies, flag suspicious conduct (e.g., suspected cheats, unauthorized substitutions, unsportsmanlike behavior), and dispatch immediate audit notifications to Clan Leaders and Admins.
3. **Real-Time Boosting Order Alerts**: Fix the operational alerting gap by routing new incoming boosting order notifications exclusively to **Managers**, enabling them to promptly review, verify booster availability, and handle fulfillment without cluttering Admin notifications.

---

## 2. Role Definition & Access Control

### 2.1 The `Manager` Role
A standing operational role positioned between a standard squad member (`user`) and full platform governance (`admin`).

| Role Attribute | Specification |
| :--- | :--- |
| **Role Identifier** | `manager` |
| **Appointment Authority** | **Strictly Platform Admin (`admin`)**. Clan leaders cannot appoint or revoke Managers. |
| **Tenure & Lifecycle** | **Standing Permanent Appointment**: Once appointed/promoted by an Admin, the user remains a Manager across the platform indefinitely. The role is **NOT** hired per-match or per-tournament; it persists until the Admin explicitly fires/demotes the user back to `user`. |
| **Candidate Pool** | Any registered player/user in the squad or community. |
| **Primary Scope** | 1. Standing live tournament/match supervision and incident flagging across all matches.<br>2. Operational handling and real-time alert reception for incoming boosting inquiries and order updates. |
| **Privilege Boundaries** | Cannot delete tournaments, cannot modify platform-wide billing/rates, cannot alter global user credentials or delete squads. |

---

## 3. Feature Specifications

### Feature A: Tournament Live Monitoring & Incident Flagging (Referee Role)

#### 3.1 Background & Problem Statement
Currently, tournaments support match scheduling, brackets, and score submissions, but lack in-game dispute mediation during live matches. When disputes or unfair play occur, communication is fragmented on third-party channels (WhatsApp/Discord) without an auditable platform record.

#### 3.2 User Stories
* **US-M1**: *As a Manager*, I want to access live ongoing tournament match lobbies so that I can monitor participant rosters and match progress.
* **US-M2**: *As a Manager*, I want to flag a specific match or team for suspicious activity with a categorized reason and evidence notes so that clan leadership is alerted immediately.
* **US-M3**: *As a Clan Leader / Platform Admin*, I want to receive real-time notifications when an incident is flagged and view an incident report audit trail to take corrective action (e.g., disqualification, match restart).

#### 3.3 Functional Acceptance Criteria
1. **Manager Lifecycle & Standing Authority**:
   * Platform Admins can promote any user to `manager` (or demote/fire back to `user`) via the Admin Governance suite.
   * Managers hold **standing, platform-wide authority**—they are **NOT** appointed per-match or per-tournament. Once hired, they have continuous privileges across all tournaments to monitor ongoing matches and file incident reports.
   * A Manager's standing status remains active until the Admin explicitly fires them.
2. **Incident Flagging Capabilities**:
   * A Manager viewing a live match can open an "Incident Report" modal.
   * Required report fields:
     * `incidentType`: Enum (`suspected_cheat`, `unauthorized_substitute`, `toxic_behavior`, `connection_manipulation`, `other`).
     * `targetTeamId` / `targetPlayerIgn`: Team or player being reported.
     * `severity`: Enum (`low`, `medium`, `high`, `critical`).
     * `description`: Free-text explanation (10 to 1,000 characters).
     * `evidenceUrl`: Optional link to screenshot or stream clip.
3. **Real-Time Alert Dispatch**:
   * Trigger in-app notification and WebSocket broadcast to the relevant Clan Leader(s) and all active Platform Admins:
     * Frame: `TOURNAMENT_INCIDENT_FLAGGED`
     * Title: `🚨 Match Incident Flagged: [Tournament Name]`
     * Body: `Manager [Manager_IGN] flagged [Team_Name] for [Incident_Type] in Match #[Match_ID].`
4. **Audit Trail & Status Tracking**:
   * Each incident has a lifecycle status: `flagged` ➔ `under_review` ➔ `resolved` / `dismissed`.
   * Only Admins or Clan Leaders can transition incident status with mandatory resolution notes.

---

### Feature B: Real-Time Boosting Order Alerts (Manager-Exclusive Dispatch)

#### 3.1 Current Gap Analysis
* **Current Behavior**: When a user or guest places a boosting order via `POST /api/v1/boosting/orders`:
  * Database entry is recorded in `boosting_orders` with status `'inquiry'`.
  * If the customer is authenticated, `NotificationService.notifyOrderStatusUpdate()` sends a notification **only to the customer**.
  * If the customer is a guest, no notification is dispatched.
  * Operational staff (Managers) receive zero notifications.
* **Root Cause**: The original architecture prioritized external WhatsApp handoff, leaving the backend dispatch hook unpopulated for operational roles.

#### 3.2 User Stories
* **US-B1**: *As a Manager*, I want to receive an instant real-time notification (in-app + WebSocket) whenever any customer (guest or authenticated) submits a boosting order, so that I can immediately verify booster availability and coordinate assignment.
* **US-B2**: *As a Platform Admin*, I want boosting order notifications routed strictly to Managers so that the Admin notifications feed remains focused on platform governance, security, and severe incident escalations.

#### 3.3 Functional Acceptance Criteria
1. **Manager-Exclusive Notification Hook**:
   * On successful creation of a boosting order in `POST /api/v1/boosting/orders`, backend queries all users with role `manager` (excluding `admin` to avoid alert spamming).
   * Dispatches real-time in-app notification and WebSocket event to all active Manager user IDs.
2. **Notification Content & Payload**:
   * Type: `NEW_BOOSTING_ORDER`
   * Title: `🚀 New Boosting Order #[Order_Ref]`
   * Message: `Customer [IGN] requested [Start_Rank] ➔ [Target_Rank] (₹[Total_Price_INR]) via [Contact_Channel].`
   * Metadata: `{ orderId, orderRef, customerIgn, startingRank, targetRank, totalPriceInr, contactChannel }`
3. **Guest & Authenticated Support**:
   * Alerts must trigger reliably regardless of whether the customer is a logged-in user or a guest inquiry.

---

## 4. Non-Functional & Security Requirements

1. **Authorization Guardrails**:
   * Incident submission endpoints must enforce `RoleGuard(['admin', 'manager'])`.
   * Regular users cannot trigger incident reports or receive staff-level boosting order notifications.
2. **Audit Logging & Tamper Resistance**:
   * All incident reports must record `createdBy` (manager ID), immutable timestamp, and IP address.
   * Managers cannot delete or modify previously filed incident reports once submitted.
3. **Performance & Latency**:
   * WebSocket alert broadcast latency must be under 200ms from database insert.
   * Non-blocking dispatch: Notification dispatch failures must not fail the primary order or incident creation response.

---

## 5. Out of Scope (Non-Goals for Sprint 1)

* In-app automated payment gateway integration (Razorpay/Stripe); WhatsApp/manual chat handoff remains authoritative per [ADR 0001](../adr/payment.md).
* Direct automated game API integrations (no Tencent/Moonton live replay scraping).
* Automated penalties (e.g. auto-banning accounts on flag); resolutions require human review by Admin or Clan Leader.

---

## 6. Traceability Matrix

| Sprint 1 Item | Existing Canonical Reference | Impacted Modules |
| :--- | :--- | :--- |
| **Manager Role** | `docs/internal/requirements.md` §4 (Users & Roles) | `server/src/db/schema.ts`, `server/src/middleware/auth.ts`, `shared/src/types.ts` |
| **Incident Flagging** | `docs/internal/design/lld/tournament-engine.md` §3 & §6 | `server/src/routes/tournaments.ts`, `client/components/tournaments/` |
| **Boosting Alerts** | `docs/internal/design/lld/mlbb-boosting.md` §4 | `server/src/routes/boosting.ts`, `server/src/services/notification.service.ts` |
