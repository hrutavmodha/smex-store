# Bug: Disband Squad & Kick Member Lack Confirmation Safeguards in UI

- **Bug ID**: BUG-M4-007
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Medium (UX Safety & Accidental Data Destruction)
- **Target Files**:
  - `client/components/teams/TeamDetailModal.tsx` (lines 212–224, 247–256)
  - `client/app/teams/page.tsx` (lines 170–182, 203–215)
- **Status**: Identified

---

## 1. Description

In `client/components/teams/TeamDetailModal.tsx`:
```tsx
{/* Captain controls: Kick member */}
{isCaptain && !isMemberCaptain && onKickMember && (
  <button
    type="button"
    onClick={() => onKickMember(member.userId)}
    data-testid="kick-member-button"
    ...
  >
    <UserX className="h-4 w-4" />
    <span className="hidden sm:inline">Kick</span>
  </button>
)}

...

{onDisbandTeam && (
  <button
    type="button"
    onClick={onDisbandTeam}
    data-testid="disband-team-button"
    ...
  >
    Disband Squad
  </button>
)}
```

In `docs/internal/design/lld/squad-recruitment.md` Section 7.3:
> "Captain Controls:
>  - Member row action: 'Kick Member' (with confirmation modal).
>  - 'Disband Squad' danger action."

Currently:
- Clicking "Kick" directly fires `onKickMember(member.userId)`, immediately expelling the player from the squad without asking for confirmation.
- Clicking "Disband Squad" immediately invokes `onDisbandTeam()`, which issues `DELETE /api/v1/teams/:id`, permanently destroying the squad profile and all member records instantly.
- On mobile devices, where touch targets are compact, an accidental tap immediately triggers permanent deletion.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 7.3 ("Member row action: 'Kick Member' (with confirmation modal)").
- **Design System Reference**: `docs/internal/design/ui.md` Section 6 ("Touch targets >= 44px, safe destructive interactions").

---

## 3. Reproduction Steps / Proof of Concept

1. As a squad captain, open the squad roster modal in `/teams`.
2. Accidentally tap or click the red "Disband Squad" button.
3. Squad is immediately wiped from the database without any confirmation dialog or confirmation prompt.
4. All roster associations and history are deleted permanently.

---

## 4. Impact

- Severe risk of accidental data loss: accidental taps on mobile or misclicks destroy competitive teams with no recovery path.
- Non-compliance with LLD Section 7.3 explicit requirement for a confirmation modal.

---

## 5. Recommended Remediation

Implement an inline or modal confirmation prompt before triggering `onKickMember` and `onDisbandTeam`:
```tsx
const [confirmAction, setConfirmAction] = useState<{
  type: 'kick' | 'disband';
  targetUserId?: string;
  targetName?: string;
} | null>(null);
```
Show a warning dialog requiring explicit confirmation (e.g. "Are you sure you want to disband this squad? This action cannot be undone.") before executing the deletion.
