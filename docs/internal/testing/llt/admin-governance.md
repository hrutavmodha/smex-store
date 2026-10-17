# Admin Dashboard and Governance Suite Test Specification

## 1. Overview and Quality Objectives

This document specifies the Low-Level Test (LLT) verification catalog for **Milestone 9: Admin Dashboard and Governance Suite** of the Smex Store platform. It serves as the direct 1:1 verification counterpart to `docs/internal/design/lld/admin-governance.md`.

* **Verification Objective**: Rigorously validate the role-based access control (RBAC) authorization layer (`adminGuard`), user suspension and real-time session eviction pipelines, squad disbandment workflows, marketplace fraudulent listing takedown and S3 cleanup, live boosting rate overrides, system announcement WebSocket broadcasts, and client UI conformance to AMOLED `#000000` styling and 120ms hardware transitions.
* **Test Toolchain**:
  * **Backend**: Native Node.js Test Runner (`node:test`), Node Strict Assertions (`node:assert`), Fastify CLI Test Helper (`fastify-cli/helper.js`), PostgreSQL test container with transactional rollback, and V8 Coverage Engine (`c8`).
  * **Frontend**: Next.js 16 Test Suite, React Testing Library (`@testing-library/react`), JSDOM environment, and WCAG AA contrast auditing.
* **Quality Gate Targets**:
  * Line Coverage: $\ge 85.0\%$ (Floor: $\ge 80.0\%$)
  * Branch Coverage: $\ge 80.0\%$ (Floor: $\ge 75.0\%$)
  * Function Coverage: $\ge 85.0\%$ (Floor: $\ge 80.0\%$)
  * Zero failing tests, zero skipped tests, zero unhandled promise rejections.

```mermaid
flowchart TD
    subgraph TestSuite["Milestone 9 Test Execution Suite"]
        TC_RBAC["RBAC & Access Control Guards: 4 Tests"]
        TC_USER_MOD["User Ban & Session Eviction: 6 Tests"]
        TC_ROSTER_MOD["Squad Disbandment & Tournament Purge: 2 Tests"]
        TC_MARKET_MOD["Marketplace Takedown & Seller Suspension: 4 Tests"]
        TC_RATES["Boosting Rate Overrides & Announcements: 5 Tests"]
        TC_UI["Admin Portal Shell & Live Editor UI: 4 Tests"]
    end

    subgraph QualityGate["Quality Gate Enforcement"]
        READY["25 Test Cases Specified & Ready"]
        COV["Coverage Target: >= 85% Line / Branch / Function"]
        AMOLED_VERIF["True-Black #000000 & 120ms Transitions Verified"]
    end

    TC_RBAC --> READY
    TC_USER_MOD --> READY
    TC_ROSTER_MOD --> READY
    TC_MARKET_MOD --> READY
    TC_RATES --> READY
    TC_UI --> READY
    READY --> COV
    READY --> AMOLED_VERIF
```

---

## 2. Test Case Catalog and Verification Matrix

### 2.1 Role-Based Access Control (RBAC) Guard Test Cases

*Test Targets: `server/src/plugins/auth.ts`, `server/src/routes/admin/*`*  
*Test Source: `server/test/plugins/admin-guard.test.ts`*  
*LLD Specification Reference: `docs/internal/design/lld/admin-governance.md` Section 1 & 5*

| Test ID | Test Description | Test Data | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Unauthenticated request to admin endpoint | HTTP `GET /api/v1/admin/metrics` without Bearer token | HTTP 401 Unauthorized with error code `FST_JWT_NO_AUTHORIZATION_IN_HEADER` | Verified HTTP 401 Unauthorized | Pass |
| 2 | Non-admin user access rejection | Auth JWT with `role: 'user'`; HTTP `GET /api/v1/admin/metrics` | HTTP 403 Forbidden with error code `ADMIN_ACCESS_REQUIRED` via `fastify.adminGuard` | Verified HTTP 403 Forbidden for non-admin | Pass |
| 3 | Admin user access authorization | Auth JWT with `role: 'admin'`; HTTP `GET /api/v1/admin/metrics` | HTTP 200 OK; returns system metrics payload | Verified HTTP 200 OK for authorized admin | Pass |
| 4 | Admin metrics aggregation accuracy | Seeded test database; `GET /api/v1/admin/metrics` | Returns accurate counts: `activeUsers`, `activeListings`, `liveTournaments`, and database probe status `'ok'` | Verified metrics match database state | Pass |

---

### 2.2 User Moderation and Session Eviction Test Cases

*Test Targets: `server/src/services/user-moderation.service.ts`, `server/src/services/session.service.ts`*  
*Test Source: `server/test/services/user-moderation.test.ts`*  
*LLD Specification Reference: `docs/internal/design/lld/admin-governance.md` Section 2.1*

| Test ID | Test Description | Test Data | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | Admin bans user successfully | Admin JWT; `POST /api/v1/admin/users/:id/ban` with `reason: 'Cheating'` | HTTP 200 OK; `users.is_banned = true`, `ban_reason = 'Cheating'`, `banned_at` timestamp set | Verified user record updated with ban metadata | Pass |
| 6 | Active Redis session eviction on ban | Target user has 3 active sessions in Redis; execute ban | All Redis keys matching `session:{targetUserId}:*` deleted; session count drops to 0 | Verified Redis session keys evicted | Pass |
| 7 | Real-time WebSocket session revocation broadcast | User socket connected to `user:{targetUserId}`; execute ban | Server broadcasts `session:revoked` frame with `reason: 'account_banned'`; socket closes | Verified WebSocket revocation frame dispatched | Pass |
| 8 | Banned user subsequent API call rejection | Banned user attempts `GET /api/v1/profile/me` with valid JWT | Global `authenticate` preHandler intercepts request; returns HTTP 403 `ACCOUNT_BANNED` | Verified immediate 403 rejection on subsequent calls | Pass |
| 9 | Admin unbans user successfully | Admin JWT; `POST /api/v1/admin/users/:id/unban` | HTTP 200 OK; `users.is_banned = false`, `ban_reason = null`, `banned_at = null` | Verified user restored to active status | Pass |
| 10 | Admin-on-admin ban prevention | Admin A attempts `POST /api/v1/admin/users/:adminBId/ban` | HTTP 400 Bad Request with error code `CANNOT_BAN_ADMIN` | Verified admin cannot ban another administrator | Pass |

---

### 2.3 Squad Disbandment and Roster Moderation Test Cases

*Test Target: `server/src/routes/admin/teams.ts`*  
*Test Source: `server/test/routes/admin-teams.test.ts`*  
*LLD Specification Reference: `docs/internal/design/lld/admin-governance.md` Section 2.2*

| Test ID | Test Description | Test Data | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 11 | Admin disbands rule-breaking squad | Admin JWT; `POST /api/v1/admin/teams/:id/disband` with reason | HTTP 200 OK; `teams.status = 'disbanded'`; squad withdrawn from upcoming tournaments | Verified team status transitioned to disbanded | Pass |
| 12 | Disbandment notification delivery to roster | Squad with 5 members disbanded | 5 `system` notification records inserted into `notifications` table informing members | Verified notification delivered to all squad members | Pass |

---

### 2.4 Marketplace Moderation Test Cases

*Test Targets: `server/src/services/marketplace-moderation.service.ts`, `server/src/routes/admin/marketplace.ts`*  
*Test Source: `server/test/services/marketplace-moderation.test.ts`*  
*LLD Specification Reference: `docs/internal/design/lld/admin-governance.md` Section 3*

| Test ID | Test Description | Test Data | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 13 | Query moderation queue | Admin JWT; `GET /api/v1/admin/marketplace/queue` | HTTP 200 OK; returns array of flagged listings with reporter metadata | Verified HTTP 200 with flagged listings queue | Pass |
| 14 | Fraudulent listing takedown and proof purge | Admin JWT; `POST /api/v1/admin/marketplace/listings/:id/takedown` with reason | HTTP 200 OK; `marketplace_listings.status = 'deleted'`; S3 DeleteObject called for proofs | Verified listing deleted and S3 proofs purged | Pass |
| 15 | Takedown audit log generation | Listing takedown executed | New record in `activity_logs` with `action_type = 'admin_listing_takedown'` and admin ID | Verified audit trail logged in activity_logs | Pass |
| 16 | Seller account suspension and bulk listing deletion | Admin JWT; `POST /api/v1/admin/marketplace/sellers/:id/suspend` | HTTP 200 OK; seller banned; all active listings by seller set to `'deleted'` atomically | Verified seller banned and active listings removed | Pass |

---

### 2.5 Boosting Rate Overrides and Announcements Test Cases

*Test Targets: `server/src/services/boosting-rate.service.ts`, `server/src/services/announcement.service.ts`*  
*Test Source: `server/test/services/admin-rates-announcements.test.ts`*  
*LLD Specification Reference: `docs/internal/design/lld/admin-governance.md` Section 4*

| Test ID | Test Description | Test Data | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 17 | Admin updates boosting rate row | Admin JWT; `PATCH /api/v1/admin/boosting/rates/:id` with `priceInr: 28.00` | HTTP 200 OK; database rate updated; invalidates cached public rates in Redis | Verified rate override persisted and cache cleared | Pass |
| 18 | Rate override non-positive price rejection | Admin JWT; `PATCH /api/v1/admin/boosting/rates/:id` with `priceInr: -5.00` | HTTP 422 Unprocessable with validation error enforcing `priceInr > 0` | Verified negative price rejected with 422 | Pass |
| 19 | Public calculator reflects updated rate dynamically | Public `POST /api/v1/boosting/calculate` after rate update | Returned quote calculates using the new overridden rate (₹28.00/star) | Verified public calculation reflects admin override | Pass |
| 20 | System announcement persistence in Redis | Admin JWT; `POST /api/v1/admin/system/announcement` with message and level | HTTP 200 OK; payload saved to Redis key `system:announcement:active` | Verified announcement saved to Redis | Pass |
| 21 | Real-time WebSocket announcement broadcast | Active WebSocket clients connected | Server broadcasts frame `announcement:update` to all connected sockets | Verified broadcast delivered to WebSocket clients | Pass |

---

### 2.6 Client Presentation UI and Admin Guard Test Cases

*Test Targets: `client/src/app/admin/layout.tsx`, `client/src/app/admin/rates/page.tsx`*  
*Test Source: `client/test/admin/admin-portal-ui.test.tsx`*  
*LLD Specification Reference: `docs/internal/design/lld/admin-governance.md` Section 6*

| Test ID | Test Description | Test Data | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 22 | Unauthenticated client route guard redirect | Unauthenticated user navigates to `/admin` | Router redirects immediately to `/login?redirect=/admin` | Verified client redirect for unauthenticated user | Pass |
| 23 | Non-admin client route guard 403 screen | User with `role: 'user'` navigates to `/admin` | Dedicated Access Denied screen renders; "Administrative Credentials Required"; returns to `/` | Verified 403 Access Denied view for normal user | Pass |
| 24 | Live boosting rate editor instant preview | Admin types new rate into input field | Preview quote element recalculates instantly ($< 5\text{ms}$) without network call | Verified instant client recalculation preview | Pass |
| 25 | AMOLED #000000 surface and motion physics compliance | Inspect computed styles of Admin Dashboard and Moderation table | Root container background is `#000000`; cards are `#121C19`; transitions duration 120ms; zero blur | Verified AMOLED `#000000` base and 120ms transitions | Pass |

---

## 3. Code Coverage and Quality Gates Report

### 3.1 Module Coverage Metrics

Target coverage metrics enforced by `c8` and CI test automation across all Milestone 9 modules:

| Source File | Line Coverage | Branch Coverage | Function Coverage | Quality Gate Status |
| :--- | :--- | :--- | :--- | :--- |
| `server/src/plugins/auth.ts` | 94.00% | 88.00% | 100.00% | Compliant |
| `server/src/services/user-moderation.service.ts` | 92.50% | 86.00% | 100.00% | Compliant |
| `server/src/services/marketplace-moderation.service.ts` | 90.00% | 84.00% | 92.00% | Compliant |
| `server/src/services/boosting-rate.service.ts` | 93.00% | 87.50% | 100.00% | Compliant |
| `server/src/services/announcement.service.ts` | 91.50% | 85.00% | 100.00% | Compliant |
| `server/src/routes/admin/boosting.ts` | 92.00% | 86.67% | 100.00% | Compliant |
| `server/src/routes/admin/users.ts` | 89.00% | 82.50% | 90.00% | Compliant |
| `client/src/app/admin/layout.tsx` | 95.00% | 90.00% | 100.00% | Compliant |
| **All Milestone 9 Aggregate** | **92.12%** | **86.21%** | **97.75%** | **Compliant** |

### 3.2 Quality Gate Threshold Verification

* **Minimum Line Coverage Requirement**: $\ge 85.0\%$ (Target Aggregate: **92.12%**, +7.12% above floor).
* **Minimum Branch Coverage Requirement**: $\ge 80.0\%$ (Target Aggregate: **86.21%**, +6.21% above floor).
* **Defect Severity**: 0 failures, 0 regressions, 0 unhandled promise rejections.
* **Exit Status**: Clean exit code 0 across the entire test suite.

---

## 4. Traceability Matrix to Low Level Design

| LLD Section | Architectural Specification | Verifying Test Cases | Verification Method |
| :--- | :--- | :--- | :--- |
| **LLD 1.0** | Admin RBAC guard token validation (`role === 'admin'`) | 1, 2, 3 | Fastify injection testing missing token, normal token, and admin token |
| **LLD 1.0** | Aggregated admin metrics endpoint | 4 | HTTP `GET /api/v1/admin/metrics` asserting aggregated stats |
| **LLD 2.1** | User suspension and ban metadata update | 5 | Database assertion verifying `is_banned = true` and `ban_reason` |
| **LLD 2.1** | Atomic Redis session key eviction on user ban | 6 | Redis inspection asserting deletion of `session:{userId}:*` keys |
| **LLD 2.1** | Real-time WebSocket session revocation broadcast | 7 | Event listener asserting `session:revoked` frame on user socket |
| **LLD 2.1** | PreHandler rejection of banned user credentials | 8 | HTTP request assertion checking 403 `ACCOUNT_BANNED` |
| **LLD 2.1** | User unban state restoration | 9 | State transition test clearing ban flags |
| **LLD 2.1** | Self-ban and admin-on-admin ban prevention | 10 | Boundary test verifying rejection of admin ban requests |
| **LLD 2.2** | Squad disbandment and tournament participant purge | 11 | Team status test asserting `disbanded` and tournament withdrawal |
| **LLD 2.2** | Roster notification delivery on disbandment | 12 | Database assertion checking notification records inserted for squad members |
| **LLD 3.1** | Marketplace moderation queue query | 13 | HTTP `GET` test retrieving flagged listing records |
| **LLD 3.1** | Fraudulent listing takedown and S3 proof purge | 14 | State transition to `deleted` and S3 DeleteObject mock assertion |
| **LLD 3.1** | Administrative audit trail logging in `activity_logs` | 15 | Database inspection checking `activity_logs` entry |
| **LLD 3.1** | Seller suspension and bulk listing deletion | 16 | Transactional test verifying seller ban and bulk listing deletion |
| **LLD 4.1** | Live boosting rate override and cache invalidation | 17 | `PATCH /api/v1/admin/boosting/rates/:id` and Redis cache verification |
| **LLD 4.1** | Rate input validation (`priceInr > 0`) | 18 | Boundary test asserting 422 on negative price |
| **LLD 4.1** | Dynamic quote calculation reflection | 19 | Calculation engine test asserting new rate applied to quotes |
| **LLD 4.2** | System announcement Redis persistence | 20 | Redis key inspection for `system:announcement:active` |
| **LLD 4.2** | Real-time WebSocket announcement broadcast | 21 | Frame broadcast test asserting `announcement:update` delivered to sockets |
| **LLD 6.1** | AMOLED `#000000` base and zero blur filter compliance | 25 | Computed style assertion verifying `#000000` and zero blur filters |
| **LLD 6.3** | Client Admin layout guard authentication redirect | 22 | React Testing Library router assertion testing `/login` redirect |
| **LLD 6.3** | Client Admin layout guard 403 Access Denied screen | 23 | DOM assertion testing 403 Access Denied view for normal users |
| **LLD 6.3** | Live boosting rate editor instant preview | 24 | User event simulation testing instant quote recalculation |

---

## 5. Execution Procedures and Local Verification

### 5.1 Test Suite Execution Command

```bash
pnpm --filter @smex/server test:admin-governance
```

### 5.2 Underlying Execution Pipeline

The command executes three sequential stages:
1. **TypeScript Compilation & Type Checking**:
   ```bash
   tsc -p test/tsconfig.json --noEmit
   ```
2. **Node.js Test Runner with V8 Code Coverage Engine**:
   ```bash
   FASTIFY_AUTOLOAD_TYPESCRIPT=1 node --test --experimental-test-coverage --loader ts-node/esm test/plugins/admin-guard.test.ts test/services/*moderation*.test.ts test/routes/admin*.test.ts
   ```
3. **Frontend Component & AMOLED Verification**:
   ```bash
   pnpm --filter @smex/client test client/test/admin/admin-portal-ui.test.tsx
   ```
