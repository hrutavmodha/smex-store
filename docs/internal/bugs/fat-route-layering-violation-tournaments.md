# Bug: "Fat Route" Layering Breakdown in Tournament Controller Doing Direct Database Transactions and Business Logic

- **Bug ID**: BUG-M5-006
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies (Architectural Debt)
- **Severity**: Medium / Architectural Debt (Separation of Concerns & Controller Bloat)
- **Target Files**:
  - `server/src/routes/tournaments.ts` (667 lines; specifically lines 220–408, 411–480)
- **Status**: Identified

---

## 1. Description

The Smex Store backend architecture follows a strict layered design:
$$\text{Routes (HTTP Controller / RFC 7807 Serialization)} \longrightarrow \text{Services (Domain Logic, Transactions, Validation)} \longrightarrow \text{Drizzle ORM (Database)}$$

In `server/src/routes/tournaments.ts` (a single file spanning **667 lines**), this architecture breaks down significantly. The route handlers directly implement:
1. **Raw Database Transactions & Row Locks**:
   Lines 309–402 initiate direct `fastify.db.transaction(async (tx) => { ... })` and execute row-level locking (`.for('update')`) directly inside the HTTP route callback.
2. **Tournament Domain Rules**:
   Squad capacity validation (`currentCount >= tourney.maxTeams`), seed assignments (`currentCount + 1`), participant status checks, and squad withdrawal logic are executed directly in route handlers rather than delegated to domain services like `TournamentRegistrationService` or `TournamentLifecycleService`.
3. **Redundant PreHandler Query Duplication**:
   Prehandlers query the database to verify tournament existence, then the route handler queries the database again to lock and update the tournament.

---

## 2. Specification & Design Reference

- **ADR / Clean Architecture Invariant**: HTTP route handlers must remain thin controllers responsible exclusively for request schema validation (`safeParse`), invoking domain services, and serializing responses. Database transactions and row locking belong strictly within domain services.
- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` specifies that tournament lifecycle and registration state machines are encapsulated within services.

---

## 3. Impact

- **Testability Impairment**: Testing tournament registration logic requires spinning up an entire HTTP server with Fastify route injection rather than invoking a clean, unit-testable service method.
- **Code Duplication**: If squad registration is ever triggered from another context (e.g., admin CLI, batch invite, or tournament seed scheduler), the logic must be duplicated because it is trapped inside a Fastify route handler.
- **Maintenance Cognitive Load**: A 667-line controller file with deeply nested try/catch blocks and database transactions makes auditing and debugging unnecessarily difficult.

---

## 4. Recommended Remediation

1. Extract registration, withdrawal, and seeding logic from `server/src/routes/tournaments.ts` into a dedicated service (e.g. `TournamentParticipantService` or extend `TournamentLifecycleService`):
   ```typescript
   export class TournamentParticipantService {
     static async registerSquad(
       tournamentId: string,
       teamId: string,
       captainUserId: string,
       db: SmexDatabase
     ): Promise<TournamentParticipant> {
       return await db.transaction(async (tx) => {
         // Lock tournament row, validate capacity, assign seed, insert participant
       });
     }
   }
   ```
2. Refactor `server/src/routes/tournaments.ts` route handlers to be thin controllers:
   ```typescript
   fastify.post('/api/v1/tournaments/:id/register', async (request, reply) => {
     const participant = await TournamentParticipantService.registerSquad(
       id,
       teamId,
       request.user.sub,
       fastify.db
     );
     return reply.code(201).send(participant);
   });
   ```
