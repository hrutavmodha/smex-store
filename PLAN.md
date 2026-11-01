# SMEX Store - Architecture & Refactoring Plan

---

## 1. Executive Summary & Root Cause Audit

This document serves as the authoritative blueprint for correcting hallucinated/dummy tournament data and formalizing the database schema and UI rendering rules.

### Identified Defects & Root Causes:

1. **Hallucinated Prize Pool (`₹5,000` / `prize_pool_inr`)**:
   * *Defect*: Smex Cup Season 1 had no prize money specified, yet dummy `5000.00` was hardcoded in `server/src/db/seed.ts` and rendered in UI tournament cards.
   * *Resolution*: **Complete removal of `prize_pool_inr` / `prizePoolInr`** from the PostgreSQL database schema, Fastify routes, DTOs, seed data, and client components.
2. **Hallucinated Date (`15/9/26` / `2026-09-15`)**:
   * *Defect*: Database schema had `start_time` set to `NOT NULL`, forcing dummy date insertion for past tournaments where no actual historical date was known.
   * *Resolution*: **Make both `startTime` and `endTime` completely NULLABLE** across the database schema and API contracts.
3. **Frontend Display Rule**:
   * *Strict Rule*: Only render date/time on cards or detail pages **IF BOTH `startTime` AND `endTime` are defined and NOT null**. If either `startTime` OR `endTime` is `null`, `undefined`, or empty, **RENDER ABSOLUTELY NOTHING** in its place (zero fake dates, zero empty calendar badges, zero placeholder text).

---

## 2. Refactoring Blueprint Across All Layers

### Layer 1: PostgreSQL Schema & Migrations (`server/src/db/`)

* **Schema File**: `server/src/db/schema/tournaments.ts`
  * Drop `prizePoolInr: numeric('prize_pool_inr')` completely.
  * Update `startTime: timestamp('start_time', { withTimezone: true })` (Nullable, NO `.notNull()`).
  * Update `endTime: timestamp('end_time', { withTimezone: true })` (Nullable).
* **Database Migrations**:
  * `0011_drop_prize_pool_inr.sql`:
    ```sql
    ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "prize_pool_inr";
    ```
  * `0012_nullable_tournament_dates.sql`:
    ```sql
    ALTER TABLE "tournaments" ALTER COLUMN "start_time" DROP NOT NULL;
    ```

---

### Layer 2: Shared Contracts & DTOs (`shared/src/tournaments.ts`)

* **`TournamentCardData` Interface**:
  * Completely remove `prizePoolInr`.
  * Update date types:
    ```typescript
    export interface TournamentCardData {
      id: string;
      title: string;
      gameSlug: string;
      format: TournamentFormat;
      status: TournamentStatus;
      startTime?: string | null;
      endTime?: string | null;
      maxTeams: number;
      registeredTeams?: number;
      winnerTeamId?: string | null;
      winnerName?: string | null;
      runnerUpName?: string | null;
      mvpName?: string | null;
      rulesMarkdown?: string | null;
    }
    ```

---

### Layer 3: Backend Routes & Lifecycle Services (`server/src/`)

* **Route Schemas (`server/src/routes/tournaments.ts`)**:
  * `createTournamentSchema`:
    * Remove `prizePoolInr`.
    * Update: `startTime: z.string().datetime().optional().nullable()`.
    * Update: `endTime: z.string().datetime().optional().nullable()`.
  * `updateTournamentSchema`:
    * Remove `prizePoolInr`.
    * Update: `startTime: z.string().datetime().optional().nullable()`.
    * Update: `endTime: z.string().datetime().optional().nullable()`.
* **Lifecycle Service (`server/src/services/tournament-lifecycle.service.ts`)**:
  * Remove `prizePoolInr` from query select.
  * Select `startTime: tournaments.startTime` and `endTime: tournaments.endTime`.
  * Order by: `desc(tournaments.createdAt)` or `COALESCE(tournaments.startTime, tournaments.createdAt)` so null dates never break sorting.
* **Database Seed (`server/src/db/seed.ts`)**:
  * `Smex Cup Season 1 (S1)`:
    * `startTime: null`, `endTime: null`.
    * Zero prize pool.
    * Only authentic winner data: `winnerName: 'VO DUDU'`, `runnerUpName: 'Goon'`, `mvpName: 'Marvelous Grievous'`.

---

### Layer 4: Client Presentation & Next.js Components (`client/`)

* **Tournament Directory Cards (`client/app/tournaments/page.tsx`)**:
  * **Zero Prize Pool Display**: Entire prize pool container removed.
  * **Strict Date Conditional**:
    ```tsx
    {t.startTime && t.endTime ? (
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-text-muted" />
        <span>
          {new Date(t.startTime).toLocaleDateString()} - {new Date(t.endTime).toLocaleDateString()}
        </span>
      </div>
    ) : null}
    ```

    *(If either `startTime` OR `endTime` is null/undefined, render `null` - absolutely nothing displayed).*
* **Tournament Detail View (`client/app/tournaments/[id]/page.tsx`)**:
  * Remove prize pool badge.
  * Strict conditional on `tournament.startTime` and `tournament.endTime`: only render calendar if BOTH are present and not null.
* **Admin Tournament Manager (`client/app/admin/tournaments/page.tsx`)**:
  * Remove prize pool input field, table column, and edit modal state.
  * Make `startTime` and `endTime` inputs completely optional.

---

## 3. Remote Server & Production VPS Deployment

### 3.1 Server Details

* **Live URL:** `https://smexofficial.in`
* **VPS IP:** `45.195.129.92`
* **SSH Key Path:** `/home/hrutav-modha/.gemini/antigravity-cli/brain/b774054f-7953-423d-9c02-307068ce123e/scratch/deploy_key`

### 3.2 Production Database Migration Script

When deploying to production, execute in the Postgres container:

```bash
ssh -i "$SSH_KEY" root@45.195.129.92 << 'EOF'
  docker exec -i smex-db-prod psql -U postgres -d smex_store -c "
    ALTER TABLE tournaments DROP COLUMN IF EXISTS prize_pool_inr;
    ALTER TABLE tournaments ALTER COLUMN start_time DROP NOT NULL;
    UPDATE tournaments SET start_time = NULL WHERE title ILIKE '%Smex Cup%';
  "
EOF
```

---

## 4. Implementation Checklist

- [x] 1. Alter PostgreSQL schema `server/src/db/schema/tournaments.ts` (`startTime` and `endTime` nullable, `prizePoolInr` dropped).
- [x] 2. Update `shared/src/tournaments.ts` DTO definitions.
- [x] 3. Update Fastify route schemas and lifecycle services (`server/src/routes/tournaments.ts`).
- [x] 4. Clean `server/src/db/seed.ts` (Smex Cup has null dates and zero prize).
- [x] 5. Update `client/app/tournaments/page.tsx` (Strict conditional: only render date if BOTH `startTime` and `endTime` are not null; otherwise render NOTHING).
- [x] 6. Update `client/app/tournaments/[id]/page.tsx` (Strict conditional: only render date if BOTH `startTime` and `endTime` are not null).
- [x] 7. Update `client/app/admin/tournaments/page.tsx` (Remove prize fields, optional start/end date).
- [x] 8. Verify typecheck across `@smex/shared`, `server`, and `client`.
