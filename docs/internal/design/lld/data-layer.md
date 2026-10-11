# Data Layer and Client UI Shell Design Specification

## 1. Overview and Scope

This document specifies the Low-Level Design (LLD) for **Milestone 2: Data Layer and Client UI Shell** of the Smex Store platform. It defines the architecture, relational models, connection pooling, migration workflows, database seeding pipeline, extended observability health probes, and client UI presentation shell conforming to the requirements in `docs/internal/requirements.md`, the system topology in `docs/internal/design/hld.md`, the visual styling and motion constraints in `docs/internal/design/ui.md`, and the quality strategy in `docs/internal/testing/plan.md`.

```mermaid
flowchart TD
    subgraph DataLayer["Persistence & Data Layer (Fastify + Drizzle ORM)"]
        ENV["EnvConfig: DATABASE_URL"] --> POOL["pg.Pool Connection Pool"]
        POOL --> DRIZZLE["Drizzle ORM Engine (Node-Postgres)"]
        DRIZZLE --> SCHEMAS["Relational Schema Definitions (7 Domain Clusters)"]
        DRIZZLE --> MIGRATIONS["Drizzle Kit Migration Engine"]
        DRIZZLE --> SEED["Deterministic Seeding Pipeline"]
        POOL --> HEALTH["Data Layer Extended Health Probe (/health)"]
    end

    subgraph ClientShell["Presentation Tier Client Shell (Next.js 16 App Router)"]
        LAYOUT["Root Layout (layout.tsx)"] --> QUERY_PROV["TanStack Query Provider"]
        LAYOUT --> THEME_INIT["AMOLED / Dark Theme Hydration"]
        LAYOUT --> NAVBAR["Sticky AMOLED Navigation Bar"]
        LAYOUT --> CONTENT["Page Viewport Canvas"]
        LAYOUT --> FOOTER["Verified Social & Legal Footer"]
    end

    DRIZZLE -.->|Type-Safe Models| POOL
    HEALTH -.->|DB Latency & Pool Stats| CLIENT_STATUS["Observability Telemetry"]
```

---

## 2. Drizzle Connection Pool Architecture

*Target Source: `server/src/db/index.ts` and `server/src/plugins/db.ts`*

### 2.1 Connection Pool Lifecycle and Parameters

The persistence tier utilizes `drizzle-orm/node-postgres` wrapping `pg.Pool`. The connection pool is instantiated once during service initialization and decorated onto the Fastify instance.

```typescript
export interface DbPoolConfig {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}
```

#### Pool Parameter Specifications

| Parameter | Development | Production | Rationale |
| :--- | :--- | :--- | :--- |
| `max` | `5` | `20` | Caps concurrent DB connections per Fastify node instance to prevent Postgres process exhaustion |
| `idleTimeoutMillis` | `10,000` (10s) | `30,000` (30s) | Frees unused connections during traffic troughs while maintaining hot connections |
| `connectionTimeoutMillis` | `3,000` (3s) | `5,000` (5s) | Fails fast when Postgres pool is saturated rather than hanging client requests indefinitely |
| `allowExitOnIdle` | `false` | `false` | Keeps worker event loop active while pool is initialized |

### 2.2 Fastify Plugin Decoration and Graceful Teardown

The database layer registers as a Fastify plugin (`server/src/plugins/db.ts`) using `fastify-plugin`:

```typescript
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import * as schema from '../db/schema/index.js';

export type SmexDatabase = NodePgDatabase<typeof schema>;

declare module 'fastify' {
  interface FastifyInstance {
    db: SmexDatabase;
    dbPool: pg.Pool;
  }
}
```

#### Teardown State Machine

```mermaid
sequenceDiagram
    autonumber
    participant App as Fastify Server
    participant Plugin as DB Plugin (onClose Hook)
    participant Pool as pg.Pool
    participant Postgres as PostgreSQL Engine

    App->>App: SIGTERM / SIGINT or app.close() received
    App->>Plugin: Execute registered onClose hooks
    Plugin->>Pool: pool.end() initiated
    Pool->>Postgres: Finish active queries & close idle client connections
    Postgres-->>Pool: All client sockets terminated cleanly
    Pool-->>Plugin: Promise resolved
    Plugin-->>App: Teardown complete, exit 0
```

---

## 3. Relational Schema Definitions

*Target Source Directory: `server/src/db/schema/`*

The schema is partitioned into 7 modular domain definitions, unified under `server/src/db/schema/index.ts`. All primary keys use RFC 4122 Version 4 UUIDs generated via Postgres `gen_random_uuid()`. Timestamps default to `now()` with timezone precision (`timestamp({ withTimezone: true })`).

### 3.1 Domain 1: Users, Credentials, and Profiles

*Target Source: `server/src/db/schema/users.ts`*

```mermaid
erDiagram
    users ||--|| profiles : "user_id (1:1 cascade)"
    users {
        uuid id PK "gen_random_uuid()"
        varchar email UK "max 255"
        text password_hash "argon2id hash"
        user_role role "DEFAULT 'user'"
        boolean email_verified "DEFAULT false"
        timestamp created_at "DEFAULT now()"
        timestamp updated_at "DEFAULT now()"
    }
    profiles {
        uuid user_id PK,FK "references users(id) ON DELETE CASCADE"
        varchar username UK "max 50"
        varchar in_game_id "max 50, nullable"
        varchar avatar_preset "DEFAULT 'preset_default_01'"
        varchar playstyle "max 50, nullable"
        text bio "nullable"
        theme_preference theme_pref "DEFAULT 'dark'"
        density_preference density_pref "DEFAULT 'comfortable'"
        privacy_preference activity_privacy "DEFAULT 'public'"
        timestamp updated_at "DEFAULT now()"
    }
```

#### Schema Specifications: `users` & `profiles`

* **Enums**:
  * `userRoleEnum`: `pgEnum('user_role', ['user', 'admin'])`
  * `themePrefEnum`: `pgEnum('theme_preference', ['dark', 'amoled', 'light'])`
  * `densityPrefEnum`: `pgEnum('density_preference', ['compact', 'comfortable', 'spacious'])`
  * `privacyPrefEnum`: `pgEnum('privacy_preference', ['public', 'friends', 'private'])`
* **Invariants & Constraints**:
  * `users.email` is normalized lowercase with unique index `users_email_unique_idx`.
  * `profiles.user_id` is both primary key and foreign key referencing `users.id` with `onDelete: 'cascade'`.
  * `profiles.username` enforces alphanumeric + underscore pattern via application-layer validation and database unique index `profiles_username_unique_idx`.
  * Preset avatars are constrained to vetted IDs (e.g., `'preset_default_01'` to `'preset_default_12'`), prohibiting arbitrary custom external URLs.

---

### 3.2 Domain 2: Multi-Device Sessions

*Target Source: `server/src/db/schema/sessions.ts`*

Supports persistent multi-device tracking, login history audits, and remote session termination per Requirements Section 10.

#### Schema Specifications: `sessions`

```typescript
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  deviceFingerprint: varchar('device_fingerprint', { length: 128 }),
  deviceName: varchar('device_name', { length: 150 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sessions_user_active_idx').on(t.userId, t.isActive),
  index('sessions_expires_at_idx').on(t.expiresAt),
]);
```

* **Invariants & Constraints**:
  * `refreshTokenHash` stores SHA-256 digest of the raw cryptographic refresh token.
  * When `isActive` is set to `false`, the session is terminated and subsequent refresh requests fail immediately.

---

### 3.3 Domain 3: Squads, Rosters, and Recruitment

*Target Source: `server/src/db/schema/teams.ts`*

Implements competitive squads, roster limits, open slot calculations, and member associations per Requirements Section 6.3.

```mermaid
erDiagram
    users ||--o{ teams : "captain_id (1:N restrict)"
    teams ||--o{ team_members : "team_id (1:N cascade)"
    users ||--o{ team_members : "user_id (1:N cascade)"
    teams {
        uuid id PK "gen_random_uuid()"
        varchar name UK "max 50"
        varchar tag "max 10"
        uuid captain_id FK "references users(id) ON DELETE RESTRICT"
        varchar game_slug "DEFAULT 'mlbb'"
        integer member_cap "DEFAULT 5, CHECK (1..10)"
        team_status status "DEFAULT 'open'"
        text description "nullable"
        timestamp created_at "DEFAULT now()"
        timestamp updated_at "DEFAULT now()"
    }
    team_members {
        uuid id PK "gen_random_uuid()"
        uuid team_id FK "references teams(id) ON DELETE CASCADE"
        uuid user_id FK "references users(id) ON DELETE CASCADE"
        varchar member_role "DEFAULT 'member'"
        timestamp joined_at "DEFAULT now()"
    }
```

#### Schema Specifications: `teams` & `team_members`

* **Enums**:
  * `teamStatusEnum`: `pgEnum('team_status', ['open', 'closed'])`
* **Invariants & Constraints**:
  * `teams.captain_id` references `users.id` with `onDelete: 'restrict'` (a user cannot delete their account without transferring or disbanding captaincy).
  * `teams.member_cap` check constraint: `member_cap >= 1 AND member_cap <= 10`.
  * `team_members` unique constraint on `(team_id, user_id)` preventing duplicate membership in the same squad.
  * Open slots formula: `open_slots = teams.member_cap - COUNT(team_members.id)`.

---

### 3.4 Domain 4: Tournaments, Participants, and Brackets

*Target Source: `server/src/db/schema/tournaments.ts`*

Implements esports competition lifecycles (Past, Ongoing, Upcoming), seed distribution, and match states per Requirements Section 6.2 and HLD Section 4.

```mermaid
erDiagram
    tournaments ||--o{ tournament_participants : "tournament_id (1:N cascade)"
    teams ||--o{ tournament_participants : "team_id (1:N cascade)"
    tournaments ||--o{ tournament_matches : "tournament_id (1:N cascade)"
    tournaments {
        uuid id PK "gen_random_uuid()"
        varchar title "max 100"
        varchar game_slug "DEFAULT 'mlbb'"
        tournament_format format "DEFAULT 'single_elimination'"
        tournament_status status "DEFAULT 'upcoming'"
        timestamp start_time "with timezone"
        timestamp end_time "with timezone, nullable"
        numeric prize_pool_inr "precision 10, scale 2, DEFAULT 0.00"
        integer max_teams "DEFAULT 16, CHECK (2..128)"
        text rules_markdown "nullable"
        uuid winner_team_id FK "references teams(id) ON DELETE SET NULL, nullable"
        timestamp created_at "DEFAULT now()"
        timestamp updated_at "DEFAULT now()"
    }
    tournament_participants {
        uuid id PK "gen_random_uuid()"
        uuid tournament_id FK "references tournaments(id) ON DELETE CASCADE"
        uuid team_id FK "references teams(id) ON DELETE CASCADE"
        integer seed "nullable"
        timestamp registered_at "DEFAULT now()"
    }
    tournament_matches {
        uuid id PK "gen_random_uuid()"
        uuid tournament_id FK "references tournaments(id) ON DELETE CASCADE"
        integer round_number "not null"
        integer match_order "not null"
        uuid team_a_id FK "references teams(id) ON DELETE SET NULL, nullable"
        uuid team_b_id FK "references teams(id) ON DELETE SET NULL, nullable"
        integer team_a_score "DEFAULT 0"
        integer team_b_score "DEFAULT 0"
        uuid winner_id FK "references teams(id) ON DELETE SET NULL, nullable"
        match_status status "DEFAULT 'scheduled'"
        timestamp updated_at "DEFAULT now()"
    }
```

#### Schema Specifications: `tournaments`, `tournament_participants`, `tournament_matches`

* **Enums**:
  * `tournamentFormatEnum`: `pgEnum('tournament_format', ['single_elimination', 'double_elimination', 'round_robin'])`
  * `tournamentStatusEnum`: `pgEnum('tournament_status', ['upcoming', 'registration_open', 'ongoing', 'completed'])`
  * `matchStatusEnum`: `pgEnum('match_status', ['scheduled', 'live', 'completed', 'bye'])`
* **Invariants & Constraints**:
  * `tournament_participants` enforces unique constraint `(tournament_id, team_id)`.
  * `tournament_matches` indexes `(tournament_id, round_number)` for bracket traversal queries.

---

### 3.5 Domain 5: MLBB Dual-Mode Boosting Matrix and Orders

*Target Source: `server/src/db/schema/boosting.ts`*

Implements the dynamic pricing engine defined in ADR 0002 (`docs/internal/adr/rank-boosting-model-pricing-system.md`) and Requirements Section 6.6.

#### Schema Specifications: `boosting_rates` & `boosting_orders`

```typescript
export const boostingPricingModeEnum = pgEnum('boosting_pricing_mode', ['fixed_tier', 'per_star']);
export const boostingContactChannelEnum = pgEnum('boosting_contact_channel', ['whatsapp', 'telegram', 'discord']);
export const boostingOrderStatusEnum = pgEnum('boosting_order_status', [
  'inquiry',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);

export const boostingRates = pgTable('boosting_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
  pricingMode: boostingPricingModeEnum('pricing_mode').notNull(),
  fromTier: varchar('from_tier', { length: 50 }),
  toTier: varchar('to_tier', { length: 50 }),
  starTier: varchar('star_tier', { length: 50 }),
  minStars: integer('min_stars'),
  maxStars: integer('max_stars'),
  priceInr: numeric('price_inr', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('boosting_rates_mode_idx').on(t.pricingMode, t.isActive),
]);

export const boostingOrders = pgTable('boosting_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => users.id, { onDelete: 'set null' }),
  gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
  pricingMode: boostingPricingModeEnum('pricing_mode').notNull(),
  startingRank: varchar('starting_rank', { length: 50 }).notNull(),
  targetRank: varchar('target_rank', { length: 50 }).notNull(),
  startingStars: integer('starting_stars').notNull().default(0),
  targetStars: integer('target_stars').notNull().default(0),
  calculatedPriceInr: numeric('calculated_price_inr', { precision: 10, scale: 2 }).notNull(),
  customerIgn: varchar('customer_ign', { length: 50 }).notNull(),
  contactChannel: boostingContactChannelEnum('contact_channel').notNull(),
  status: boostingOrderStatusEnum('status').notNull().default('inquiry'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

* **Invariants & Constraints**:
  * Sub-Mythic calculations require valid `fromTier` and `toTier`.
  * Mythic per-star calculations require `starTier`, `minStars`, and `maxStars` bounding.
  * `priceInr` must be strictly positive (`CHECK (price_inr > 0)`).

---

### 3.6 Domain 6: Marketplace Listings and Proof Screenshots

*Target Source: `server/src/db/schema/marketplace.ts`*

Implements peer-to-peer gaming ID trading, dynamic "Good Deal" and "Hot" badges, and direct-to-S3 media references per Requirements Section 6.5 and HLD Section 5.

```mermaid
erDiagram
    users ||--o{ marketplace_listings : "seller_id (1:N cascade)"
    marketplace_listings ||--o{ listing_proofs : "listing_id (1:N cascade)"
    marketplace_listings {
        uuid id PK "gen_random_uuid()"
        uuid seller_id FK "references users(id) ON DELETE CASCADE"
        varchar title "max 150"
        varchar game_slug "DEFAULT 'mlbb'"
        varchar rank_tier "max 50"
        numeric price_inr "precision 10, scale 2, CHECK >= 100"
        numeric baseline_price_inr "precision 10, scale 2"
        listing_badge badge_type "DEFAULT 'none'"
        listing_status status "DEFAULT 'active'"
        contact_channel contact_channel "not null"
        varchar contact_handle "max 100"
        timestamp created_at "DEFAULT now()"
        timestamp updated_at "DEFAULT now()"
    }
    listing_proofs {
        uuid id PK "gen_random_uuid()"
        uuid listing_id FK "references marketplace_listings(id) ON DELETE CASCADE"
        text s3_key "not null"
        text cdn_url "not null"
        integer display_order "DEFAULT 0"
        timestamp created_at "DEFAULT now()"
    }
```

#### Schema Specifications: `marketplace_listings` & `listing_proofs`

* **Enums**:
  * `listingStatusEnum`: `pgEnum('listing_status', ['active', 'sold', 'deleted'])`
  * `listingBadgeEnum`: `pgEnum('listing_badge', ['none', 'good_deal', 'hot'])`
  * `contactChannelEnum`: `pgEnum('contact_channel', ['whatsapp', 'telegram', 'discord', 'phone'])`
* **Invariants & Constraints**:
  * Price floor: `price_inr >= 100` enforced via database CHECK constraint `marketplace_price_floor_chk`.
  * If price is discounted (`price_inr < baseline_price_inr`), the engine sets `badge_type = 'good_deal'`.
  * `listing_proofs.display_order` enforces ascending carousel order.

---

### 3.7 Domain 7: Seller Reviews and Activity Audit Logs

*Target Source: `server/src/db/schema/reviews.ts` and `server/src/db/schema/activity.ts`*

Implements the seller trust scoring network and user privacy-gated activity history per Requirements Section 6.12 and Section 11.

#### Schema Specifications: `seller_ratings` & `activity_logs`

```typescript
export const sellerRatings = pgTable('seller_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  listingId: uuid('listing_id').notNull().references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  reviewText: text('review_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('seller_ratings_buyer_listing_unq').on(t.buyerId, t.listingId),
  check('seller_ratings_range_chk', sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  check('seller_ratings_no_self_review_chk', sql`${t.sellerId} <> ${t.buyerId}`),
  index('seller_ratings_seller_idx').on(t.sellerId),
]);

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  isPrivate: boolean('is_private').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('activity_logs_user_created_idx').on(t.userId, t.createdAt),
]);
```

* **Invariants & Constraints**:
  * Check constraint `sellerId <> buyerId` prohibits self-reviews.
  * Rating boundary `1 <= rating <= 5`.
  * Unique constraint `(buyer_id, listing_id)` ensures only 1 review per transaction.
  * `metadataJson` uses Postgres `jsonb` indexing for unstructured event payload inspection.

---

## 4. Migration Scripts and Drizzle Configuration

*Target Source: `server/drizzle.config.ts` and `server/package.json`*

### 4.1 Drizzle Kit Configuration Specification

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smex_store',
  },
  strict: true,
  verbose: true,
});
```

### 4.2 Migration Generation and Drift Verification Workflow

```mermaid
flowchart LR
    DEV["Edit TypeScript Schemas in src/db/schema/"] --> GEN["drizzle-kit generate"]
    GEN --> SQL["Generate Sequential SQL Migration: 0000_init.sql"]
    SQL --> RUN["drizzle-kit migrate (or programmatic migrator)"]
    RUN --> DB[("PostgreSQL Database")]
    DB --> DRIFT["drizzle-kit check / schema drift assertion in CI"]
```

#### NPM Package Scripts Contract (`server/package.json`)
* `"db:generate"`: `drizzle-kit generate`
* `"db:migrate"`: `drizzle-kit migrate`
* `"db:seed"`: `node --loader ts-node/esm src/db/seed.ts`
* `"db:studio"`: `drizzle-kit studio`

---

## 5. Database Seeding Pipeline

*Target Source: `server/src/db/seed.ts`*

### 5.1 Seed Execution Architecture and Idempotency

The seeding pipeline is strictly **idempotent**. Running `db:seed` repeatedly on an existing database will not duplicate records, cause unique constraint violations, or erase production-altered values.

```mermaid
sequenceDiagram
    autonumber
    participant CLI as Seed Runner (db:seed)
    participant DB as PostgreSQL (Drizzle)

    CLI->>DB: Check / Upsert Admin Account (email: admin@smexstore.com)
    DB-->>CLI: Admin verified / created
    CLI->>DB: Upsert Preset Avatars catalog (12 preset references)
    DB-->>CLI: Avatars initialized
    CLI->>DB: Upsert Default MLBB Boosting Pricing Matrix
    DB-->>CLI: 3 fixed tier jump rates + 4 per-star tier rates configured
    CLI->>DB: Upsert Sample Esports Tournaments (Past, Ongoing, Upcoming)
    DB-->>CLI: Sample tournaments created
    CLI->>CLI: Log execution metrics and exit cleanly (code 0)
```

### 5.2 Seed Data Definitions

#### A. Default Admin Account
* **Email**: `admin@smexstore.com`
* **Role**: `admin`
* **Email Verified**: `true`
* **Password Hash**: Precomputed Argon2id hash for development/testing seed password.
* **Profile**: Username `smex_admin`, avatar `preset_admin_01`, bio `Official Smex Store Platform Administrator`.

#### B. MLBB Boosting Pricing Matrix (ADR 0002 Baseline)
1. **Fixed Tier Jump Rates**:
   * Epic $\rightarrow$ Legend: ₹400.00 (`fixed_tier`)
   * Legend $\rightarrow$ Mythic: ₹300.00 (`fixed_tier`)
   * Epic $\rightarrow$ Mythic (Bundle): ₹600.00 (`fixed_tier`)
2. **Progressive Per-Star Rates**:
   * Mythic (0–24★): ₹20.00 / star (`per_star`, min: 0, max: 24)
   * Mythical Honor (25–49★): ₹30.00 / star (`per_star`, min: 25, max: 49)
   * Mythical Glory (50–99★): ₹35.00 / star (`per_star`, min: 50, max: 99)
   * Mythical Immortal (100+★): ₹40.00 / star (`per_star`, min: 100, max: 999)

#### C. Sample Tournaments
1. **Past**: "Smex Community Clash Vol. 1", format `single_elimination`, status `completed`, prize pool ₹10,000.
2. **Ongoing**: "MLBB Regional Invitational 2026", format `double_elimination`, status `ongoing`, prize pool ₹25,000.
3. **Upcoming**: "Mythic Legends Championship", format `single_elimination`, status `registration_open`, prize pool ₹50,000.

---

## 6. Data Layer Health Probe Extension

*Target Source: `server/src/routes/health.ts`*

### 6.1 Liveness vs. Readiness Specification

The existing `GET /health` route is extended to perform an active database query probe (`SELECT 1`) to measure connection health and query latency without blocking the Fastify event loop.

### 6.2 Health Response Schema Contract

```typescript
export interface DataLayerHealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  environment: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  database: {
    status: 'connected' | 'disconnected';
    latencyMs: number;
    pool: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
  };
}
```

#### Health Status Decision Logic

* **Healthy (HTTP 200)**: Database responds within 1,000ms. `status: 'ok'`, `database.status: 'connected'`.
* **Degraded / Outage (HTTP 503)**: Database query throws connection error or times out. `status: 'degraded'`, `database.status: 'disconnected'`. RFC 7807 problem details returned without leaking raw DB connection strings.

---

## 7. Client Root Layout and AMOLED Shell Architecture

*Target Source Directory: `client/app/` and `client/components/shell/`*

### 7.1 Client Presentation Hierarchy

```mermaid
flowchart TD
    HTML["Root HTML (<html lang='en' data-theme='dark'>)"] --> BODY["Body (min-h-screen bg-bg-canvas text-text-primary)"]
    BODY --> QUERY["QueryProvider (TanStack React Query Provider)"]
    QUERY --> SHELL["AppShell (<div className='flex min-h-screen flex-col'>)"]
    SHELL --> NAVBAR["Sticky AMOLED Navbar (<Navbar />)"]
    SHELL --> MAIN["Main Viewport Content (<main className='flex-1'>)"]
    SHELL --> FOOTER["Verified Social & Legal Footer (<Footer />)"]
```

### 7.2 TanStack Query Client Configuration

*Target Source: `client/providers/QueryProvider.tsx`*

* `staleTime`: `60,000ms` (1 minute) for queries to minimize redundant background refetches.
* `gcTime` (formerly cacheTime): `300,000ms` (5 minutes) for inactive query garbage collection.
* `retry`: `1` (fail-fast on network drops with structured error display).
* `refetchOnWindowFocus`: `false` (prevents unnecessary layout thrashing).

### 7.3 Sticky AMOLED Navigation Bar

*Target Source: `client/components/shell/Navbar.tsx`*

#### Visual & Behavioral Constraints (per `docs/internal/design/ui.md`)
1. **Positioning**: `sticky top-0 z-50` with solid surface background (`bg-bg-surface` / `#0B0F12` or AMOLED `#000000`).
2. **Prohibited Visuals**: **Zero `backdrop-filter: blur`**. Uses solid opaque surface to eliminate mobile GPU redraw stutter.
3. **Motion Physics**: 120ms hardware transitions for theme toggles, links, and hamburger menu reveals.
4. **Desktop Navigation Links**:
   * `/tournaments` (Tournaments)
   * `/teams` (Teams & Groups)
   * `/marketplace` (ID Marketplace)
   * `/boosting` (Rank Boosting)
   * `/leaderboard` (Leaderboards)
   * `/about` (About Us)
5. **Interactive Controls Cluster**:
   * Universal Search shortcut (`Cmd+K` trigger icon).
   * Theme Toggle (cycles Dark $\leftrightarrow$ AMOLED $\leftrightarrow$ Light, persisted via `localStorage` and `data-theme` attribute).
   * Density Toggle (cycles Compact $\leftrightarrow$ Comfortable $\leftrightarrow$ Spacious).
   * Login / Register primary CTA (`#1FAE7A` emerald button with 80ms `scale(0.98)` active feedback).
6. **Mobile Navigation Drawer**:
   * Hamburger toggle button with $\ge 44\text{px}$ touch target.
   * Slide-out drawer using hardware transform (`translateX`) over 120ms.

### 7.4 Application Footer

*Target Source: `client/components/shell/Footer.tsx`*

#### Structure & Official Links
1. **Brand Showcase**: Smex Store logo, tagline, and platform mission.
2. **Verified Owner Social Directory** (Requirements Section 6.8):
   * YouTube (`https://youtube.com/@smexstore`)
   * Twitch (`https://twitch.tv/smexstore`)
   * Discord (`https://discord.gg/smexstore`)
   * Twitter/X (`https://x.com/smexstore`)
   * Instagram (`https://instagram.com/smexstore`)
3. **Platform Directory Links**: Tournaments, Boosting Calculator, Team Recruitment, Seller Protection Policy.
4. **Legal & Compliance**: Terms of Service, Privacy Policy, Community Guidelines, Copyright 2026.
5. **Responsive Behavior**: Stacked single-column on mobile ($< 640\text{px}$); 4-column balanced grid on desktop ($\ge 1024\text{px}$).

---

## 8. Error Handling and Operational Invariants

1. **Relational Integrity Guarantees**: Cascade rules are strictly enforced: deleting a user deletes their sessions and profiles, but team captaincy requires explicit reassignment (`RESTRICT`).
2. **Schema Drift Detection**: CI executes `drizzle-kit check` against migration files to prevent discrepancies between TypeScript definitions and SQL files.
3. **Database Error Sanitization**: All database query exceptions caught at Fastify route handlers are converted to standardized RFC 7807 error envelopes, masking raw SQL strings, table names, and connection parameters.
4. **Zero Layout Jitter**: The client shell enforces exact height reservations for Navbar ($64\text{px}$) and footer components, preventing Cumulative Layout Shift (CLS target $< 0.1$).
5. **No Opacity Fades**: All client shell micro-interactions use directional sliding (`transform`) or instant state swaps, adhering to the 120ms rule.
