# Bug: User IGN and Avatar Contract Drift on Client Profile Components

- **Bug ID**: 3
- **Category**: Correctness
- **Severity**: Medium
- **Target Files**:
  - `server/src/routes/auth.ts` (lines 425–434)
  - `shared/src/user.ts` (lines 6–15)
  - `client/components/shell/NavUserMenu.tsx` (lines 40–48)
  - `client/lib/useAuth.ts` (lines 36–37)
- **Status**: Identified

---

## 1. Description

The shared contract `UserProfile` in `@smex/shared` defines:
```ts
export interface UserProfile {
  uid: string;
  email: string;
  ign: string;
  avatarPreset?: string;
  emailVerified: boolean;
  role?: string;
}
```
However, `GET /api/v1/auth/me` returns:
```ts
return reply.code(200).send({
  id: userRecord.id,
  uid: profileRecord?.inGameId || null,
  email: userRecord.email,
  role: userRecord.role,
  emailVerified: userRecord.emailVerified,
  sessionId: request.user.sessionId,
  profile: profileRecord,
});
```
The profile metadata (`username`, `inGameId`, `avatarPreset`) is nested inside `profile`, and no `ign` or `avatarPreset` properties are present at the root of the response.

In `NavUserMenu.tsx`:
```tsx
<span data-testid="user-avatar-badge" data-preset={user.avatarPreset}>
  {(user.ign || user.email || '?').charAt(0).toUpperCase()}
</span>
<span data-testid="user-ign">
  {user.ign || user.email}
</span>
```
Because `user.ign` and `user.avatarPreset` are `undefined`, `user.ign` always falls back to `user.email`, and `data-preset` is always `undefined`.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/auth-and-sessions.md` Section 4: "User Profile Dropdown in Navigation Bar showing user avatar preset and in-game name (IGN)."
- `docs/internal/requirements.md` Section 8.3: "Navigation header displays user avatar badge and IGN."

---

## 3. Reproduction Steps / Proof of Concept

1. Authenticate with a profile configured with username `"Viper"` and avatar preset `"preset_default_03"`.
2. Observe `NavUserMenu`:
   - Avatar badge lacks the preset attribute `data-preset`.
   - Instead of displaying `"Viper"`, the navigation dropdown displays the user's raw email address.

---

## 4. Impact

User gaming identity (IGN) and avatar selections are not rendered in the application shell.

---

## 5. Recommended Remediation

In `server/src/routes/auth.ts`, align the `/me` endpoint output with `UserProfile`:
```ts
return reply.code(200).send({
  id: userRecord.id,
  uid: userRecord.id,
  ign: profileRecord?.username || userRecord.email,
  avatarPreset: profileRecord?.avatarPreset || 'preset_default_01',
  email: userRecord.email,
  role: userRecord.role,
  emailVerified: userRecord.emailVerified,
  sessionId: request.user.sessionId,
  profile: profileRecord,
});
```
