# Bug: Modal Header Availability & Dynamic Vacancy Counts Desync After Roster Mutations

- **Bug ID**: BUG-M4-009
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Medium (Client State Consistency Defect)
- **Target Files**:
  - `client/app/teams/page.tsx` (lines 75–99, 154–200)
- **Status**: Identified

---

## 1. Description

In `client/app/teams/page.tsx`:
1. **In `handleToggleStatus`**:
   ```tsx
   const handleToggleStatus = async () => {
     if (!selectedTeam) return;
     const nextStatus = selectedTeam.status === 'open' ? 'closed' : 'open';
     const res = await fetchWithAuth(`/api/v1/teams/${selectedTeam.id}`, { ... });
     if (res.ok) {
       const updated = { ...selectedTeam, status: nextStatus };
       setSelectedTeam(updated as TeamCardData);
       await loadTeams();
     }
   };
   ```
   `selectedTeam.availability` (`'open' | 'closed' | 'full'`) is **not recalculated** when `status` changes. In `TeamDetailModal.tsx` line 121, the status badge checks `team.availability === 'open' ? 'Open to Join' : ...`. Because `availability` is untouched, the modal header badge does not update to "Closed".

2. **In `handleResolveRequest` and `handleKickMember`**:
   ```tsx
   if (res.ok) {
     await handleOpenTeam(selectedTeam);
     await loadTeams();
   }
   ```
   Calling `handleOpenTeam(selectedTeam)`:
   ```tsx
   const handleOpenTeam = async (team: TeamCardData) => {
     setSelectedTeam(team);
     ...
     const res = await fetchWithAuth(`/api/v1/teams/${team.id}`);
     if (res.ok) {
       const data = await res.json();
       setSelectedMembers(data.team.members || []);
     }
   ```
   `handleOpenTeam` sets `selectedMembers(data.team.members)`, but **never updates `selectedTeam`** with `data.team`!
   As a result:
   - `selectedTeam.activeMembersCount` remains at the stale count.
   - `selectedTeam.openSlots` remains at the stale count.
   - `selectedTeam.availability` remains at the stale value.
   - If a captain approves the final member, `data.team.status` became `'closed'`, but the modal's `selectedTeam` continues to report the squad as open with old slots available.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 3.2 ("Dynamic Availability Badges") and Section 7.3 ("Roster Detail & Join Modal").

---

## 3. Reproduction Steps / Proof of Concept

1. As captain of a squad with 4/5 members, open the roster modal in `/teams`.
2. Notice header displays "4 / 5 Members", "1 Slots Available", "Open to Join".
3. Approve a pending join request.
4. Member row appears in the active roster list (5 members rendered).
5. Look at the modal header:
   - Header badge still says "Open to Join" instead of "Full / Closed".
   - `team.openSlots` still reflects 1 slot open.

---

## 4. Impact

- Visual inconsistency and misleading capacity feedback inside the modal: the active member rows and the modal header status contradict each other.

---

## 5. Recommended Remediation

In `client/app/teams/page.tsx`:
1. In `handleOpenTeam`, update `selectedTeam` with `data.team`:
   ```tsx
   if (res.ok) {
     const data = await res.json();
     setSelectedMembers(data.team.members || []);
     setSelectedTeam(data.team);
   }
   ```
2. In `handleToggleStatus`, recalculate `availability` or reload the team details from backend.
