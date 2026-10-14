# Bug: Missing Applicant Join Request Query Mechanism & Unused `hasPendingRequest` Prop

- **Bug ID**: BUG-M4-003
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Medium (Client/Server Feature Gap)
- **Target Files**:
  - `client/app/teams/page.tsx` (lines 75–99, 334–348)
  - `server/src/routes/teams.ts` (lines 265–280)
- **Status**: Identified

---

## 1. Description

In `client/components/teams/TeamDetailModal.tsx`, the component defines `hasPendingRequest?: boolean` in `TeamDetailModalProps` to indicate whether the viewing user already has an active join request for that squad:
```tsx
export interface TeamDetailModalProps {
  ...
  hasPendingRequest?: boolean;
}
```

However:
1. In `client/app/teams/page.tsx`, `hasPendingRequest` is **never passed** to `<TeamDetailModal />`:
   ```tsx
   <TeamDetailModal
     team={selectedTeam}
     members={selectedMembers}
     pendingRequests={pendingRequests}
     currentUserId={currentUser?.id}
     isCaptain={currentUser?.id === selectedTeam.captainId}
     isOpen={isModalOpen}
     onClose={() => setIsModalOpen(false)}
     onSubmitJoinRequest={handleSubmitJoin}
     onResolveRequest={handleResolveRequest}
     onKickMember={handleKickMember}
     onToggleStatus={handleToggleStatus}
     onDisbandTeam={handleDisbandTeam}
   />
   ```
2. In `server/src/routes/teams.ts`, the only route querying join requests is `GET /api/v1/teams/:id/join-requests`, which enforces a strict captain-only guard:
   ```typescript
   if (team.captainId !== callerId) {
     const err: any = new Error('Only the team captain can view squad join requests');
     err.statusCode = 403;
     err.code = 'CAPTAIN_PERMISSION_REQUIRED';
     throw err;
   }
   ```
3. Neither `GET /api/v1/teams/:id` nor any other endpoint provides the authenticated caller's own request status for the squad.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 7.3 ("Conditional Actions: Applicant: 'Request Pending' badge if request already in flight").
- **LLT Reference**: `docs/internal/testing/llt/squad-recruitment.md` Section 2.7 Test 24.

---

## 3. Reproduction Steps / Proof of Concept

1. User B submits a join request to Squad 1.
2. User B closes the browser or refreshes the page.
3. User B returns to `/teams` and clicks "View Roster" on Squad 1.
4. Because `hasPendingRequest` is not passed and defaults to `false`, the modal displays "Request to Join Squad" instead of the expected "Join Request Pending" badge.
5. User B attempts to submit another request.
6. Server returns HTTP 409 Conflict (`DUPLICATE_PENDING_REQUEST`), causing an unexpected error banner in the modal.

---

## 4. Impact

- The client UI cannot fulfill the LLD 7.3 requirement to show "Request Pending" for existing applicants upon opening the modal.
- Users who previously applied receive confusing duplicate request rejection errors instead of clear status feedback.

---

## 5. Recommended Remediation

1. In `GET /api/v1/teams/:id` (or in a dedicated user endpoint `GET /api/v1/teams/:id/my-request`), check if the authenticated user has a pending request for the team and return `hasPendingRequest: boolean` or `myJoinRequest`.
2. In `client/app/teams/page.tsx`, pass `hasPendingRequest` to `TeamDetailModal`.
