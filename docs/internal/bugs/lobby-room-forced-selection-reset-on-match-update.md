# Bug: Live Lobby Forces Active Match Selection Reset on Every WebSocket Event

- **Bug ID**: BUG-M5-009
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: Medium (UX Regression & Realtime State Conflict)
- **Target Files**:
  - `client/components/tournaments/TournamentLobbyRoom.tsx` (lines 48–55)
- **Status**: Identified

---

## 1. Description

In `client/components/tournaments/TournamentLobbyRoom.tsx`:
```typescript
useEffect(() => {
  if (matches && matches.length > 0) {
    setSelectedMatchId(matches[0].id);
  }
}, [matches]);
```
This `useEffect` unconditionally overrides `selectedMatchId` to `matches[0].id` whenever the `matches` prop array changes.

In a live tournament with real-time WebSocket synchronization:
1. When any match in the tournament receives a score update or status change, the parent component receives the WebSocket event and updates the `matches` state array.
2. The updated `matches` array triggers this `useEffect`.
3. If an administrator is currently inspecting Match 6 or typing scores for Match 4, their view is **forcibly yanked back to Match 1**.
4. Any in-progress score adjustments for the currently selected match are aborted or lost.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 7.1:
  > The Live Match Operations Desk must maintain operator focus on the active selected match node during background data syncs, updating the match data in place without disrupting active selection.

---

## 3. Reproduction Steps / Proof of Concept

1. Open a tournament with multiple matches in the Live Lobby tab.
2. Click on Match 4 in the list of matches. The detail panel for Match 4 appears.
3. Simulate or trigger an incoming score update on Match 2 via WebSocket.
4. The parent re-renders with the updated matches list.
5. `TournamentLobbyRoom` immediately resets `selectedMatchId` to Match 1, kicking the user out of Match 4.

---

## 4. Impact

- Highly disruptive operator and spectator UX during live tournament play.
- Unusable admin desk when concurrent matches are concluding simultaneously.

---

## 5. Recommended Remediation

Preserve the existing selection if it still exists in the updated `matches` array:
```typescript
useEffect(() => {
  if (matches && matches.length > 0) {
    setSelectedMatchId((prev) => {
      if (prev && matches.some((m) => m.id === prev)) {
        return prev;
      }
      return matches[0].id;
    });
  }
}, [matches]);
```
