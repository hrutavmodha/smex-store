# Bug: Hardcoded `isAdmin={false}` & Token Key Mismatch Locks Admins Out of Match Desk

- **Bug ID**: BUG-M5-005
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: High (Client Runtime Failure & Admin Lockout)
- **Target Files**:
  - `client/app/tournaments/[id]/page.tsx` (line 182)
  - `client/components/tournaments/TournamentLobbyRoom.tsx` (lines 74–85)
- **Status**: Identified

---

## 1. Description

Two compounding bugs in the frontend client prevent administrators and tournament officials from operating the live tournament match desk in production:

### A. Hardcoded `isAdmin={false}` in Tournament Details Page
In `client/app/tournaments/[id]/page.tsx` line 182:
```tsx
<TournamentLobbyRoom
  tournamentId={id}
  matches={tournament.matches || []}
  participants={tournament.participants || []}
  isAdmin={false}
/>
```
The page hardcodes `isAdmin={false}` unconditionally. Even if a logged-in user is a verified system administrator (`role === 'admin'`), the match management desk, score input fields, and winner confirmation buttons are never rendered in the live UI.

### B. Authentication Token Storage Key Mismatch
In `client/components/tournaments/TournamentLobbyRoom.tsx` line 75:
```typescript
const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
const res = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/tournaments/${tournamentId}/matches/${activeMatch.id}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      teamAScore,
      teamBScore,
      winnerId,
    }),
  }
);
```
Across the application's authentication layer (`client/lib/api.ts`, auth context, login/register flows), authentication tokens are stored in `localStorage` under the key `'smex_auth_token'`.
However, `TournamentLobbyRoom` looks for `'accessToken'`. Because `'accessToken'` is `null`, the request omits the `Authorization: Bearer <token>` header entirely.
When calling the backend endpoint `PATCH /api/v1/tournaments/:id/matches/:matchId` (which is protected by `fastify.authenticate` and `fastify.adminGuard`), the backend rejects the request with HTTP 401 Unauthorized.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 7.1:
  > The Live Lobby must dynamically check user authentication and role state to grant admin scoring privileges to authorized tournament staff.
- **Data Layer & Auth Contract**: Auth tokens must be uniformly retrieved from the centralized API storage key (`smex_auth_token`).

---

## 3. Reproduction Steps / Proof of Concept

1. Log in to the application with an administrative user account.
2. Navigate to `/tournaments/:id` and click on the "Live Lobby" tab.
3. Observe that the Match Operations Desk is completely hidden because `isAdmin` was hardcoded to `false`.
4. Even if `isAdmin` is forced to `true` in dev tools, entering a score and clicking "Confirm Winner" dispatches a PATCH request with no `Authorization` header because `localStorage.getItem('accessToken')` returns `null`.
5. The API returns `401 Unauthorized`.

---

## 4. Impact

- Admins cannot record match scores or operate tournaments via the client application.
- Broken client-server integration due to mismatched storage keys.

---

## 5. Recommended Remediation

1. In `client/app/tournaments/[id]/page.tsx`, retrieve user session from the auth context/store (e.g. `useAuth()`) and pass `isAdmin={user?.role === 'admin'}`.
2. In `client/components/tournaments/TournamentLobbyRoom.tsx`, replace `localStorage.getItem('accessToken')` with `localStorage.getItem('smex_auth_token')` or use the standard `api` client from `client/lib/api.ts`.
