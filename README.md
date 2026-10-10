<p align="center">
  <img src="./assets/logo.png" alt="Smex Store and Esports" width="420" />
</p>

<p align="center">
  <strong>Production-grade, high-performance community esports tournament hub, squad recruitment engine, MLBB rank boosting calculator, and peer-to-peer verified game account marketplace.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22%20LTS-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22" />
  <img src="https://img.shields.io/badge/Fastify-v5.0-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify v5" />
  <img src="https://img.shields.io/badge/Next.js-v16.4%20App%20Router-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-v19.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%20Alpine-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Redis-7.2%20Alpine-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis 7.2" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-PostgreSQL-C5F74F?style=flat-square&logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Coverage-89.7%25-brightgreen?style=flat-square" alt="Test Coverage" />
  <img src="https://img.shields.io/badge/Tests-14%20Passing-brightgreen?style=flat-square" alt="Tests Passing" />
</p>

---

## Platform Overview

Smex Store is a centralized gaming community and competitive operations platform engineered for esports players, clans, and organizers. It bridges competitive gaming infrastructure with peer-to-peer commerce and rank enhancement services:

* **Tournament Operations**: Bracket generation, registration state machines, and real-time WebSocket match lobbies.
* **Squad and Clan Recruitment**: Atomic join-request pipelines, roster capacity limits, and dynamically calculated open slot badges.
* **MLBB Rank Boosting Calculator**: Dual-mode pricing engine spanning fixed Sub-Mythic tier jumps and progressive per-star Mythic difficulty curves with automated multi-channel order dispatch.
* **Verified Account Marketplace**: Peer-to-peer trading of gaming IDs with direct-to-S3 presigned upload proofs, binary magic-byte inspection, seller reputation metrics, and price-drop badges.
* **Zero-Trust Security**: Argon2id hashing, dual-token access/refresh authentication, distributed Redis rate limiting, and remote multi-device session purge.
* **Pure AMOLED Visual Architecture**: Matrix Emerald `#1FAE7A`, Cyan Depth `#1B8F97`, Obsidian `#0B0F12`, and Pitch Black `#000000` with 120ms maximum hardware transitions and zero frosted-glass blur.

---

## Core Domain Engines

### Esports Tournament Management

* **Lifecycle State Machine**: Strict deterministic transitions across `upcoming`, `registration_open`, `ongoing`, and `completed`.
* **Bracket Seed Generators**: Algorithmic generation for single-elimination, double-elimination, and round-robin tournaments with automated bye placement.
* **Live WebSocket Lobbies**: Duplex event stream broadcasting live registrations, bracket advancements, and match score updates without page reloads.

### Competitive Squads and Recruitment

* **Atomic Recruitment Pipeline**: Database-level transactional isolation guaranteeing teams never exceed defined member capacity during concurrent join requests.
* **Role Hierarchy**: Structured squad permissions distinguishing between Captain, Co-Captain, and Member.
* **Dynamic Slot Computation**: Real-time evaluation of active roster size providing instant recruitment badges (`Open Slots: N`).

### Dual Mode MLBB Rank Boosting

* **Sub-Mythic Jump Matrix**: Fixed package pricing for major tier thresholds (Epic to Legend, Legend to Mythic, and Epic to Mythic bundles).
* **Mythic Progressive Tiers**: Difficulty-scaled per-star pricing across Mythic star brackets (0-24★, 25-49★, 50-99★, and 100+★ Mythical Immortal).
* **External Dispatch Integration**: Automated generation of pre-formatted, URI-encoded order links for WhatsApp, Telegram, and Discord, dispatching starting/target rank specifications and customer IGNs.

### Verified Gaming ID Marketplace

* **Direct-to-Storage Presigned Uploads**: Client-side screenshot proof uploads directly to S3/MinIO via cryptographically signed PUT URLs, bypassing application server memory.
* **Binary Magic-Byte Inspection**: Security middleware validating file header signatures (`image/png`, `image/jpeg`, `image/webp`) to prevent disguised executable uploads.
* **Dynamic Deal Badges**: Automatic evaluation of price history to assign `Good Deal` (price reduction), `Hot` (premium / high interest), and `Verified Seller` indicators.

### Zero Trust Identity and Session Engine

* **Dual-Token Pipeline**: Short-lived 15-minute access JWT paired with long-lived refresh tokens tracked inside Redis.
* **Remote Session Revocation**: Device fingerprinting tracking IP and User-Agent, allowing users to terminate single devices or purge all active sessions immediately.
* **Distributed Rate Limiting**: Redis-backed sliding-window rate limiters safeguarding authentication routes (5 req/min) and global API ingress (100 req/min).

### Pure AMOLED Design System

* **Color Palette Hierarchy**:
  * **Matrix Emerald (`#1FAE7A`)**: Primary brand actions, active state glows, and call-to-actions.
  * **Cyan Depth (`#1B8F97`)**: Secondary accents, captain badges, and verified indicators.
  * **Obsidian (`#0B0F12`)**: Dark mode background canvas.
  * **Pitch Black (`#000000`)**: Pure AMOLED battery-saving canvas.
* **Motion Physics Guardrail**: Transitions strictly capped at 120ms. Zero `backdrop-filter: blur()` usage to preserve peak mobile GPU fill rates and battery longevity.

---

## High Level Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Presentation Tier - Next.js 16 & React 19"]
        CLIENT["Next.js App Router Client"]
        TOKENS["AMOLED Design System - Tailwind v4"]
        CLIENT --> TOKENS
    end

    subgraph GatewayLayer["Service Tier - Fastify v5 HTTP & WebSockets"]
        API["Fastify API Gateway"]
        CORS_GW["CORS Security Gateway"]
        WS_GW["WebSocket Duplex Gateway"]
        AUTH_GW["Zero-Trust Auth & Sessions"]
        API --> CORS_GW
        API --> WS_GW
        API --> AUTH_GW
    end

    subgraph PersistenceLayer["Persistence & Infrastructure Tier"]
        PG[("PostgreSQL 16 - Drizzle ORM")]
        REDIS[("Redis 7.2 - Sessions & Rate Limits")]
        MINIO[("MinIO / S3 - Screenshot Proofs")]
    end

    CLIENT -->|HTTPS Ingress| API
    CLIENT -->|WSS Real-Time Lobby| WS_GW
    CLIENT -->|Presigned Binary Uploads| MINIO

    API -->|Relational Queries| PG
    API -->|Session TTL & Pub/Sub| REDIS
    API -->|Presigned URL Signer| MINIO
```

---

## Technology Stack

### Service Tier Stack

* **Runtime**: Node.js 22 LTS with ECMAScript Modules (`type: "module"`)
* **HTTP Framework**: Fastify v5 with Fastify Plugin v6 and Sensible v6
* **WebSockets**: `@fastify/websocket` with ping/pong heartbeat reaper
* **Network Security**: `@fastify/cors` with preflight 24-hour caching and strict origin controls
* **Configuration**: Typed schema parsing via Zod v4 with fail-fast process termination
* **Persistence Client**: Drizzle ORM with `pg.Pool` connection pooling
* **Build Engine**: `tsdown` powered by Rolldown in Rust

### Presentation Tier Stack

* **Framework**: Next.js 16.4 App Router powered by Turbopack
* **UI Library**: React 19 with Server and Client Components
* **Styling**: Tailwind CSS v4 using semantic CSS custom properties
* **Data Fetching**: TanStack React Query v5
* **Iconography**: Lucide React

### Persistence and Storage Tier

* **Relational Database**: PostgreSQL 16 Alpine
* **Cache and Sessions**: Redis 7.2 Alpine
* **Object Storage**: MinIO S3 emulator for local development, AWS S3 / Cloudflare R2 for production

---

## Monorepo Directory Topology

```
smex-store/
├── assets/                          # Platform visual assets and logos
│   └── logo.png                     # Official Smex Store & Esports emblem
├── client/                          # Next.js 16 App Router frontend package
│   ├── app/
│   │   ├── globals.css              # AMOLED tokens, Emerald palette, and motion rules
│   │   └── layout.tsx               # Root application shell
│   ├── package.json
│   └── tsconfig.json
├── server/                          # Fastify v5 backend service package
│   ├── src/
│   │   ├── config/env.ts            # Typed Zod environment configuration
│   │   ├── plugins/
│   │   │   ├── cors.ts              # Network security and preflight caching
│   │   │   └── websocket.ts         # Duplex WebSocket gateway and heartbeat reaper
│   │   ├── routes/health.ts         # Liveness probe and V8 memory diagnostics
│   │   └── app.ts                   # Fastify service bootstrap and plugin loader
│   ├── test/                        # Node.js test runner test suite
│   ├── package.json
│   └── tsdown.config.ts             # Rust Rolldown build configuration
├── docs/internal/                   # Engineering and architectural specifications
│   ├── adr/                         # Architectural Decision Records
│   ├── design/
│   │   ├── hld.md                   # Platform High-Level Design
│   │   ├── ui.md                    # Visual specification and AMOLED guidelines
│   │   └── lld/                     # Low-Level Design specifications
│   ├── testing/
│   │   ├── plan.md                  # Master Test Plan and Quality Strategy
│   │   └── llt/                     # Low-Level Test catalogs
│   ├── requirements.md              # Software Requirements Specification (SRS)
│   └── roadmap.md                   # 11-Milestone Production Engineering Roadmap
├── docker-compose.yml               # PostgreSQL, Redis, and MinIO container definitions
├── package.json                     # Monorepo root workspace configuration
├── pnpm-workspace.yaml              # pnpm workspace definition
└── README.md                        # Production project documentation
```

---

## Getting Started

### Prerequisites

* **Node.js**: `v22.x` or higher
* **pnpm**: `v10.x` or higher
* **Docker & Docker Compose**: For PostgreSQL, Redis, and MinIO containers

### Step 1 Clone and Dependencies

```bash
# Clone the repository
git clone https://github.com/anitikrish-ai/smexstore.git smex-store
cd smex-store

# Install all workspace dependencies
pnpm install
```

### Step 2 Environment Configuration

```bash
# Copy example environment configuration
cp .env.example .env
```

Verify or adjust environment parameters as needed:

| Parameter | Default Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Runtime environment mode |
| `PORT` | `3001` | Fastify backend API port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/smex_store` | PostgreSQL connection pool |
| `REDIS_URL` | `redis://localhost:6379` | Redis session and rate limit store |
| `JWT_SECRET` | `development_jwt_secret_...` | Access token signature key |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed client origin |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO local S3 storage endpoint |

### Step 3 Launch Infrastructure Stack

Spin up the local containerized backing services:

```bash
pnpm services:up
```

This starts:
* **PostgreSQL 16**: Port `5432` (database `smex_store`)
* **Redis 7.2**: Port `6379`
* **MinIO Storage**: Port `9000` (API) and Port `9001` (Web Console)
* **MinIO Provisioner**: Auto-initializes the `smex-storage` bucket

To verify container health:

```bash
docker compose ps
```

### Step 4 Database Migration and Seeding

Run Drizzle schema migrations and populate deterministic test fixtures:

```bash
# Run schema migrations
pnpm --filter @smex/server db:migrate

# Seed default pricing matrices, avatars, and admin account
pnpm --filter @smex/server db:seed
```

### Step 5 Start Development Servers

Run both the Next.js client and Fastify backend in parallel:

```bash
pnpm dev
```

* **Client Application**: `http://localhost:3000`
* **Backend API**: `http://localhost:3001`
* **Health Endpoint**: `http://localhost:3001/health`
* **MinIO Console**: `http://localhost:9001` (`minioadmin` / `minioadmin`)

---

## Testing and Quality Assurance

### Quality Gate Invariants

The platform enforces four automated quality gates across all milestones:

* **Zero Silent Failures**: Uncaught configuration errors or unhandled socket exceptions terminate immediately with diagnostic logs.
* **1:1 Design-to-Test Parity**: Every module designed in `docs/internal/design/lld/*.md` maps to a twin verification catalog in `docs/internal/testing/llt/*.md`.
* **Coverage Floor**: Minimum $\ge 80.0\%$ line coverage required in Continuous Integration.
* **Isolated Determinism**: Tests wrap operations in transactions or scoped namespaces to guarantee zero cross-suite pollution.

### Test Execution Commands

```bash
# Run entire monorepo test suite
pnpm test

# Run backend test suite with V8 code coverage report
pnpm --filter @smex/server test

# Typecheck monorepo packages without building
pnpm typecheck

# Lint codebase
pnpm lint
```

---

## Architecture and Design Documentation

Detailed engineering documentation is maintained in `docs/internal/`:

* **Requirements**: [`docs/internal/requirements.md`](docs/internal/requirements.md) (Comprehensive 22-section SRS)
* **High-Level Design**: [`docs/internal/design/hld.md`](docs/internal/design/hld.md) (System topology and data flows)
* **Visual & AMOLED Guidelines**: [`docs/internal/design/ui.md`](docs/internal/design/ui.md) (Design tokens and motion constraints)
* **Master Test Plan**: [`docs/internal/testing/plan.md`](docs/internal/testing/plan.md) (Quality strategy and test pyramid)
* **Engineering Roadmap**: [`docs/internal/roadmap.md`](docs/internal/roadmap.md) (11-Milestone phased delivery plan)

---

## License and Community

This repository is maintained as private intellectual property for the Smex Store and Esports platform. All rights reserved.
