# Bug: Team Detail Modal Stale State & Cross-Squad "Pending Request" State Leak

- **Bug ID**: BUG-M4-002
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: High (Client UI Functional Defect)
- **Target Files**:
  - `client/components/teams/TeamDetailModal.tsx` (lines 62–70)
  - `client/app/teams/page.tsx` (lines 334–348)
- **Status**: Identified

---

## 1. Description

In `client/components/teams/TeamDetailModal.tsx`:
```tsx
export function TeamDetailModal({
  team,
  members,
  pendingRequests = [],
  currentUserId,
  isCaptain = false,
  hasPendingRequest = false,
  isOpen,
  onClose,
  ...
}: TeamDetailModalProps) {
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [playerIgn, setPlayerIgn] = useState('');
  const [playerRole, setPlayerRole] = useState('Assassin');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(hasPendingRequest);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;
```

In `client/app/teams/page.tsx`:
- The `<TeamDetailModal ... />` component remains mounted across modal open/close cycles because returning `null` when `isOpen === false` does not unmount the React component instance in the parent fiber tree.
- When an applicant submits a join request for Squad A, `setRequestSubmitted(true)` sets `requestSubmitted = true`.
- When the applicant closes the modal (`isModalOpen = false`) and opens a different squad (Squad B), `TeamDetailModal` simply receives new props `team={squadB}`.
- Because `useState(hasPendingRequest)` only runs on initial component mount, and there is **no `useEffect` resetting `requestSubmitted`, `showJoinForm`, `errorMsg`, or form inputs when `team.id` changes or `isOpen` toggles**, `requestSubmitted` remains `true`.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 7.3 ("Roster Detail & Join Modal").
- **SRS Reference**: `docs/internal/requirements.md` Section 6.3 Item 2 ("Users can submit join requests or directly join open rosters").

---

## 3. Reproduction Steps / Proof of Concept

1. Log into the client app as a verified non-captain player.
2. Navigate to `/teams`.
3. Click "View Roster" on Squad A.
4. Click "Request to Join Squad", enter IGN and role, and submit.
5. Modal updates to show: `"Join Request Pending (Awaiting Captain Approval)"`.
6. Click `X` to close the modal.
7. Click "View Roster" on Squad B (which has open slots and to which the user has never applied).
8. Observe the action section of the modal:
   - Instead of displaying the green "Request to Join Squad" button, it displays `"Join Request Pending (Awaiting Captain Approval)"`.
   - The user cannot apply to Squad B or any other squad without a hard browser page reload.

---

## 4. Impact

- Severe client-side state leak: once a user submits a join request to one squad, all squads viewed subsequently inherit the "Request Pending" state, preventing the user from interacting with recruitment across the platform.

---

## 5. Recommended Remediation

1. In `TeamDetailModal.tsx`, synchronize local state when `team.id` or `hasPendingRequest` changes using a `useEffect`:
   ```tsx
   useEffect(() => {
     setRequestSubmitted(hasPendingRequest);
     setShowJoinForm(false);
     setErrorMsg(null);
     setPlayerIgn('');
     setMessage('');
   }, [team.id, hasPendingRequest, isOpen]);
   ```
2. Or alternatively, key the modal by team ID in `TeamsPage` so React automatically creates a fresh component instance on squad change:
   ```tsx
   {selectedTeam && (
     <TeamDetailModal
       key={selectedTeam.id}
       team={selectedTeam}
       ...
     />
   )}
   ```
