# Bug: Squad Created with `memberCap: 1` Initialized with `status: 'open'` and Accepts Requests Despite Being Full

- **Bug ID**: BUG-M4-011
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Low / Medium (Edge Case Invariant Violation)
- **Target Files**:
  - `server/src/services/team.service.ts` (lines 99–119)
  - `server/src/services/team-join.service.ts` (lines 51–56)
- **Status**: Identified

---

## 1. Description

1. In `server/src/services/team.service.ts` line 99:
   ```typescript
   const [newTeam] = await tx
     .insert(teams)
     .values({
       name: input.name,
       tag: input.tag,
       captainId: userId,
       gameSlug,
       memberCap: input.memberCap ?? 5,
       status: 'open',
       description: input.description,
     })
     .returning();

   const [captainMember] = await tx
     .insert(teamMembers)
     .values({
       teamId: newTeam.id,
       userId,
       memberRole: 'captain',
     })
     .returning();
   ```
   If a user creates a squad with `memberCap: 1` (a valid capacity per check constraint `member_cap >= 1 AND member_cap <= 10`), the team is immediately populated with 1 member (the captain). It has 0 open slots and is 100% full upon creation. However, its initial status is unconditionally hardcoded to `'open'`.

2. In `server/src/services/team-join.service.ts`:
   ```typescript
   if (team.status === 'closed') {
     const err: any = new Error('Cannot submit join request to a closed squad');
     err.statusCode = 400;
     err.code = 'TEAM_CLOSED';
     throw err;
   }
   ```
   `submitJoinRequest` only checks if `team.status === 'closed'`. It **never checks if `openSlots === 0`**.
   Because this squad was created with `status: 'open'`, an applicant can submit a join request to it, even though it has 0 slots available.
   When the captain attempts to approve the request, it is rejected with `TEAM_ROSTER_FULL`.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 3.2 ("Availability Badges: Full / Closed: Computed when `teams.status === 'closed'` OR $\text{Open Slots} === 0$").
- **SRS Reference**: `docs/internal/requirements.md` Section 18 Item 3.

---

## 3. Reproduction Steps / Proof of Concept

1. User creates a squad with `{ name: "SoloSquad", tag: "SOLO", memberCap: 1 }`.
2. Team is created with `memberCap = 1`, `status = 'open'`.
3. Captain is in `team_members`. `activeMembersCount = 1`, `openSlots = 0`.
4. Another player submits a join request via `POST /api/v1/teams/:id/join-requests`.
5. Join request is accepted and created in DB (`status: 'pending'`), even though the team has 0 available slots.

---

## 4. Impact

- Wastage of user effort and database entries: users can submit applications to rosters that are already at full capacity.

---

## 5. Recommended Remediation

1. In `createTeam`, if `(input.memberCap ?? 5) === 1`, initialize `status: 'closed'`.
2. In `submitJoinRequest`, count active members in `team_members` and block submission if `activeCount >= team.memberCap`:
   ```typescript
   const [countResult] = await db
     .select({ count: sql<number>`COUNT(*)::int` })
     .from(teamMembers)
     .where(eq(teamMembers.teamId, teamId));

   const activeMembersCount = countResult?.count ?? 0;
   if (team.status === 'closed' || activeMembersCount >= team.memberCap) {
     const err: any = new Error('Cannot submit join request to a full or closed squad');
     err.statusCode = 400;
     err.code = 'TEAM_CLOSED';
     throw err;
   }
   ```
