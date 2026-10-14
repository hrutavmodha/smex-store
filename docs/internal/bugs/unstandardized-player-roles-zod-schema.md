# Bug: In-Game Roles Not Standardized or Enforced in Schema Validation

- **Bug ID**: BUG-M4-008
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Low / Medium (Data Validation & Specification Mismatch)
- **Target Files**:
  - `server/src/routes/teams.ts` (line 24)
  - `client/components/teams/TeamDetailModal.tsx` (lines 354–366)
- **Status**: Resolved

---

## 1. Description

In `docs/internal/design/lld/squad-recruitment.md` Section 2.2 Item 3:
> "**Role Tags**: In-game player roles conform to standardized platform competitive roles (e.g., `'Tank'`, `'Fighter'`, `'Assassin'`, `'Mage'`, `'Marksman'`, `'Support'`, `'Duelist'`, `'IGL'`)."

However:
1. In `server/src/routes/teams.ts`:
   ```typescript
   const joinRequestSchema = z.object({
     playerIgn: z.string().trim().min(1, 'In-game name is required').max(50),
     playerRole: z.string().trim().min(1, 'Competitive role is required').max(50),
     message: z.string().trim().max(500).optional(),
   });
   ```
   `playerRole` is validated only as an unconstrained generic string. Any arbitrary text (e.g. `"<script>"`, `"Potato"`, `"asdf"`, or 50 whitespace characters) is accepted and saved to the database.
2. In `client/components/teams/TeamDetailModal.tsx` line 355:
   ```tsx
   <input
     type="text"
     required
     value={playerRole}
     onChange={(e) => setPlayerRole(e.target.value)}
     placeholder="e.g. Assassin, Mage, Tank"
     data-testid="join-role-input"
   />
   ```
   The UI renders a free-form `<input type="text">` instead of a standardized selection control (e.g. `<select>` or predefined role pill selector).

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 2.2 Item 3 ("Role Tags: In-game player roles conform to standardized platform competitive roles").
- **SRS Reference**: `docs/internal/requirements.md` Section 6.4 Item 3 ("Competitive in-game role and playstyle (e.g. Duelist, Support, Sniper, IGL)").

---

## 3. Reproduction Steps / Proof of Concept

1. Submit join request with payload:
   ```json
   {
     "playerIgn": "Hacker1",
     "playerRole": "<b>InvalidRole</b>"
   }
   ```
2. Endpoint returns `201 Created` and stores the arbitrary string in `team_join_requests.player_role`.
3. Captain views pending requests queue: raw unstandardized role tag renders on the captain's screen.

---

## 4. Impact

- Database pollution with non-standard competitive roles.
- Breaks future tournament filtering or matchmaking systems that rely on standardized role classifications.

---

## 5. Recommended Remediation

1. Define a standardized competitive roles enum/const array in both shared constants and Zod schema:
   ```typescript
   export const STANDARDIZED_ROLES = [
     'Tank',
     'Fighter',
     'Assassin',
     'Mage',
     'Marksman',
     'Support',
     'Duelist',
     'IGL',
   ] as const;

   const joinRequestSchema = z.object({
     playerIgn: z.string().trim().min(1).max(50),
     playerRole: z.enum(STANDARDIZED_ROLES),
     message: z.string().trim().max(500).optional(),
   });
   ```
2. In `TeamDetailModal.tsx`, replace the free-text input with a `<select>` or role pill selector containing `STANDARDIZED_ROLES`.
