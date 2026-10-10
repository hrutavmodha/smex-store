# Smex Store: Comprehensive Production Engineering Roadmap

A battle-tested, milestone-driven implementation plan for the Smex Store platform based on the 22 functional sections in docs/requirements.md and docs/design/hld.md.

---

## Technical Dependencies and Library Stack

All packages must be installed using pnpm add with zero manual version editing:

### Backend Server Stack
* **Core Framework**: `fastify@5`, `fastify-plugin@6`, `@fastify/sensible@6`
* **Network and Sockets**: `@fastify/cors`, `@fastify/websocket`
* **Configuration**: `dotenv`
* **Persistence and ORM**: `pg`, `drizzle-orm`, `drizzle-kit` dev dependency
* **Caching and Sessions**: `ioredis`
* **Rate Limiting**: `@fastify/rate-limit`
* **Validation and Security**: `zod`, `argon2`
* **File Uploads**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
* **Build Engine**: `tsdown` powered by Rolldown in Rust

### Frontend Client Stack
* **Core Framework**: `next@16.4` App Router, Turbopack, React 19
* **Styling**: `tailwindcss@4`, `@tailwindcss/turbopack`, `clsx`, `tailwind-merge`
* **Icons**: `lucide-react`
* **Data Fetching and Cache**: `@tanstack/react-query`

---

## Detailed Milestone Execution Plan

```mermaid
flowchart TD
    M1["M1: Core Tooling and Monorepo Foundations"] --> M2["M2: PostgreSQL and Drizzle Data Layer"]
    M2 --> M3["M3: Zero-Trust Auth and Redis Sessions"]
    M3 --> M4["M4: Squads and Team Recruitment Engine"]
    M4 --> M5["M5: Tournament Engine and WebSockets"]
    M5 --> M6["M6: MLBB Dual-Mode Boosting Engine"]
    M6 --> M7["M7: Marketplace and S3 Presigned Uploads"]
    M7 --> M8["M8: Real-Time Notifications and Universal Search"]
    M8 --> M9["M9: Admin Governance and Rate Controls"]
    M9 --> M10["M10: Client UI Implementation and AMOLED System"]
    M10 --> M11["M11: Testing, CI CD, and Production Hardening"]
```

---

### Milestone 1: Core Tooling and Monorepo Foundations
* [x] **1.1 Dependency Installation**: Run pnpm add across server/ and client/ for all baseline packages.
* [x] **1.2 Fastify CORS and Security**: Register `@fastify/cors` configured strictly for `http://localhost:3000` or `CORS_ORIGIN` env.
* [x] **1.3 Fastify WebSocket Registration**: Register `@fastify/websocket` with ping/pong heartbeat handling.
* [x] **1.4 Environment Configuration**: Create typed config parser `src/config/env.ts` using zod for `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `S3_ENDPOINT`.
* [x] **1.5 Client Styling Tokens**: Configure Matrix Emerald `#1FAE7A`, Cyan Depth `#1B8F97`, Obsidian `#0B0F12`, and AMOLED `#000000` tokens inside `client/app/globals.css`.
* [x] **1.6 Health Check Endpoint**: Register `GET /health` returning server uptime, timestamp, memory metrics, and basic server readiness.
* [x] **1.7 Docker Compose Local Stack**: Create `docker-compose.yml` defining local development containers for PostgreSQL, Redis, and MinIO local S3 storage.
* [x] **1.8 Automated Testing Suite**: Execute Node.js test runner suite verifying CORS origin validation, WebSocket ping and pong heartbeats, environment configuration failure parsing, and health probe metrics with >= 80% coverage (14 passing tests, 89.7% coverage documented in docs/internal/testing/llt/core-plumbing.md).

---

### Milestone 2: PostgreSQL and Drizzle Data Layer
* [ ] **2.1 Drizzle Connection Pool**: Set up `drizzle-orm/node-postgres` with pooled `pg.Pool` connection and graceful shutdown handlers.
* [ ] **2.2 Schema Definitions**:
  * `users` table: UUID, email, password_hash, role, game_ign, avatar_preset, created_at.
  * `sessions` table: UUID, user_id, device_fingerprint, ip_address, expires_at.
  * `teams` and `team_members` tables: Captain ID, squad name, game title, max_capacity, open_status.
  * `tournaments` and `tournament_participants` and `matches`: Formats, prize pool, schedule, round states.
  * `boosting_orders`: Customer ID, booster ID, start_rank/stars, target_rank/stars, calculated_price_inr, status, contact_channel.
  * `marketplace_listings`: Seller ID, game_account_title, price, proof_images, status.
  * `reviews_ratings`: Reviewer ID, target_type, rating, feedback.
* [ ] **2.3 Migration Scripts**: Configure `drizzle.config.ts` and verify automated migration generation via drizzle-kit.
* [ ] **2.4 Database Seeding Pipeline**: Create seed script `src/db/seed.ts` populating preset gaming avatars, default MLBB boosting pricing matrix, initial admin account, and sample tournaments.
* [ ] **2.5 Data Layer Health Probe**: Extend `GET /health` to verify live PostgreSQL connection pool query readiness.
* [ ] **2.6 Automated Data Layer Testing**: Execute test suite validating schema column constraints, foreign key cascades, seed idempotency, transaction rollback on failure, and database connection probe readiness.

---

### Milestone 3: Zero-Trust Authentication and Redis Session Engine
* [ ] **3.1 Password Security**: Implement hashing and verification via argon2.
* [ ] **3.2 Dual-Token Session Pipeline**:
  * Short-lived Access Token JWT, 15m.
  * Long-lived Refresh Token stored in Redis with unique session_id.
* [ ] **3.3 Remote Session Revocation**:
  * Implement `POST /api/auth/revoke-session` to terminate a single device.
  * Implement `POST /api/auth/revoke-all` to purge all user keys from Redis, triggering immediate WS and HTTP disconnects.
* [ ] **3.4 Device Fingerprinting**: Capture User-Agent and IP to populate active sessions list in Settings.
* [ ] **3.5 Auth Endpoints**: Implement `/register`, `/login`, `/logout`, `/refresh`, `/me`.
* [ ] **3.6 Distributed Rate Limiting**: Register `@fastify/rate-limit` backed by Redis enforcing strict limits on `/api/auth/*` (5 req/min) and global API ingress (100 req/min) as specified in HLD Section 6.
* [ ] **3.7 Transactional Email and Password Recovery**: Integrate transactional email delivery, implement `POST /api/auth/forgot-password` generating expiring single-use reset tokens stored in Redis, and `POST /api/auth/reset-password`.
* [ ] **3.8 Automated Auth and Security Testing**: Execute test suite verifying Argon2 password hashing, access and refresh token lifecycle, atomic Redis session revocation and purge, rate limiting threshold enforcement, and password reset token single-use expiration.

---

### Milestone 4: Squads and Team Recruitment Engine
* [ ] **4.1 Squad CRUD**: Endpoints for team creation, updating roster limits, and changing open/closed availability.
* [ ] **4.2 Join Request Pipeline**:
  * Player submits join request with in-game IGN and role.
  * Captain receives real-time notification to approve or reject.
  * Concurrency safety: atomic database transactions to prevent joining a full roster.
* [ ] **4.3 Team Rosters and Open Slot Badges**: Calculate open slots dynamically as capacity minus active members.
* [ ] **4.4 Automated Squad and Roster Testing**: Execute test suite verifying team CRUD operations, atomic join request acceptance and rejection, roster capacity race condition prevention under concurrent requests, and dynamic open slot computation.

---

### Milestone 5: Tournament Engine and Real-Time Sockets
* [ ] **5.1 Tournament Management**: Lifecycle state machine handling upcoming, registration_open, ongoing, and completed states.
* [ ] **5.2 Bracket Generation**: Single-elimination and round-robin bracket seed generators.
* [ ] **5.3 Real-Time WebSocket Lobby**:
  * `/ws/tournaments/:id/lobby`: Broadcasts live team registrations and bracket advancements without page reload.
  * Channel heartbeat and connection recovery handling.
* [ ] **5.4 Automated Tournament and Bracket Testing**: Execute test suite verifying lifecycle state machine transitions, single-elimination and round-robin bracket seed generators, bye assignments, match score progression, and real-time WebSocket lobby broadcasts.

---

### Milestone 6: MLBB Dual-Mode Boosting Engine
* [ ] **6.1 Core Calculation Logic**:
  * Sub-Mythic: Tier jump fixed matrix for Epic to Legend, Legend to Mythic, and Epic to Mythic bundles.
  * Mythic and Above: Progressive difficulty-scaled per-star tiers from Mythic 0-24 stars to Mythical Immortal 100+ stars.
  * Role and hero surcharges and multi-bracket traversal.
* [ ] **6.2 External Communication Link Dispatcher**:
  * Generates pre-formatted URI-encoded WhatsApp, Telegram, and Discord direct links.
  * Formats exact order summary text with starting/target ranks, calculated price in INR, and customer in-game IGN.
* [ ] **6.3 Admin Rate Override**: Secure endpoints allowing admins to update per-tier and per-star rates in PostgreSQL.
* [ ] **6.4 Automated Boosting Engine Testing**: Execute test suite validating sub-mythic fixed tier matrices, mythic progressive per-star pricing across star bands, role and hero surcharge additions, order link formatting, and admin rate overrides.

---

### Milestone 7: Marketplace and S3 Presigned Uploads
* [ ] **7.1 Direct-to-Storage Presigned Uploads**:
  * Fastify endpoint generates signed S3/R2 upload URLs with strict MIME type and file size limits of 5MB per image.
  * Client uploads screenshot proofs directly to S3 with zero binary traffic passing through Fastify.
* [ ] **7.2 Listing Management**: CRUD for game account listings with mark-as-sold and price edit capabilities.
* [ ] **7.3 Dynamic Price-Drop Badges**:
  * Price lowered: automatically compute percentage discount and assign Good Deal badge.
  * Price increased or newly listed premium: assign Hot badge.
* [ ] **7.4 Media Verification and Next Image Whitelist**:
  * Implement image magic byte binary inspection to block disguised malicious payloads.
  * Configure `images.remotePatterns` in Next.js `next.config.ts` for safe image optimization.
* [ ] **7.5 Automated Marketplace and Storage Testing**: Execute test suite verifying S3 presigned URL generation, file type and size limits, image magic byte binary validation, listing CRUD, price change badge computation, and mark-as-sold states.

---

### Milestone 8: Real-Time Notifications and Universal Search
* [ ] **8.1 Notification Dispatcher**:
  * In-memory WebSocket pub/sub and database persistence for unread notification center.
  * Notification types: Squad join requests, tournament schedule alerts, order status updates.
* [ ] **8.2 Cross-Entity Universal Search**:
  * Fast SQL search index with trigram matching across Tournaments, Teams, and Players.
  * Debounced client-side search autocomplete.
* [ ] **8.3 Automated Notification and Search Testing**: Execute test suite validating WebSocket notification pub/sub dispatch, unread count tracking and persistence, SQL trigram search precision and recall across tournaments/teams/players, and search debouncing.

---

### Milestone 9: Admin Dashboard and Governance Suite
* [ ] **9.1 User and Roster Moderation**: Admin ability to ban users, revoke tokens, and disband rule-breaking squads.
* [ ] **9.2 Marketplace Moderation**: Takedown reported fraudulent listings and suspend seller accounts.
* [ ] **9.3 Rate and Fee Overrides**: Live dashboard controls for boosting rates and platform announcements.
* [ ] **9.4 Automated Governance and RBAC Testing**: Execute test suite verifying role-based access control guards, user ban enforcement with token invalidation, squad disband cascades, fraudulent listing takedowns, and live boosting rate override controls.

---

### Milestone 10: Client UI Implementation and AMOLED Design System
* [ ] **10.1 Fresh App Router UI Shell**:
  * Build sticky navigation bar with unread notification badge and user profile dropdown.
  * Build hero carousel and live platform statistics counter.
* [ ] **10.2 Fresh Domain Pages**:
  * Build Tournaments page with Past, Ongoing, and Upcoming segmented views.
  * Build Teams and Groups page with capacity badges and join request modals.
  * Build Marketplace page with verified screenshot galleries, seller ratings, and direct contact buttons.
  * Build Rank Boosting page with dynamic dual-mode slider and WhatsApp order dispatch.
* [ ] **10.3 Pure AMOLED and Dark Theme Engine**:
  * Implement Matrix Emerald `#1FAE7A`, Cyan Depth `#1B8F97`, Obsidian `#0B0F12`, and AMOLED `#000000` via Tailwind v4.
  * Enforce strict 120ms physical transforms with zero frosted glass blur.
* [ ] **10.4 Dynamic OpenGraph and Metadata Engine**:
  * Implement Next.js 16 dynamic OpenGraph image generators `opengraph-image.tsx` for tournament detail cards and boosting services.
  * Configure automated `sitemap.ts` and `robots.ts` for search engine crawler indexing.
* [ ] **10.5 Automated Frontend Verification**: Execute component render tests, dynamic OpenGraph image generation tests, responsive layout checks across breakpoints, AMOLED theme token compliance, and accessibility audits.

---

### Milestone 11: Production Hardening, Testing, and CI CD Pipeline
* [ ] **11.1 Full Platform Regression and Quality Gates**:
  * Execute end-to-end integration and regression suites across Fastify API, PostgreSQL, Redis, and Next.js client.
  * Enforce strict CI quality gate requiring >= 80% line and branch coverage across all backend services.
  * Run Drizzle schema drift checks and automated load tests for WebSocket concurrency.
* [ ] **11.2 Continuous Integration Pipeline**:
  * GitHub Actions workflow `.github/workflows/ci.yml` triggered on pull requests and pushes to main.
  * Parallel jobs for monorepo linting, typechecking, unit tests, and build verification with pnpm store caching.
  * Automated Drizzle schema drift check to ensure SQL migrations match the TypeScript data layer.
* [ ] **11.3 Production Containerization**:
  * Multi-stage production Dockerfile for Next.js SSR client and Fastify TSDown bundle.
  * Health check endpoints and graceful shutdown signal handling.
* [ ] **11.4 Continuous Deployment Pipeline**:
  * GitHub Actions workflow `.github/workflows/deploy.yml` for automated container image publishing.
  * Automated deployment webhook or runner trigger to production host upon merge to main.
  * Post-deployment health check probing and automatic rollback trigger on probe failure.
* [ ] **11.5 Accessibility and Motion Compliance**:
  * WCAG 2.1 AA contrast verification across Dark and AMOLED palettes.
  * Reduced-motion media query compliance.
* [ ] **11.6 Structured Observability and RFC 7807 Error Handling**:
  * Configure Pino structured JSON logging with correlation IDs and request ID propagation across HTTP and WebSockets.
  * Enforce RFC 7807 problem details specification for all API errors.
