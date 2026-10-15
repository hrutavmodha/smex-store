# Bug: BracketVisualizer Polluted with Synthetic DOM Event Listener for Test Bypassing (AI Fluff)

- **Bug ID**: BUG-M5-004
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: Medium (Production Purity & Mandate Violation / AI Fluff)
- **Target Files**:
  - `client/components/tournaments/BracketVisualizer.tsx` (lines 80–89)
  - `client/test/tournaments-ui.test.tsx` (Test 25)
- **Status**: Identified

---

## 1. Description

A synthetic DOM event listener was injected directly into the production React component `BracketVisualizer.tsx` solely to facilitate a passing automated UI test (`client/test/tournaments-ui.test.tsx`, Test 25).

In `client/components/tournaments/BracketVisualizer.tsx` lines 80–89:
```typescript
// 1. Listen for DOM dispatched bracket:update events (used by testing & local dispatch)
const handleCustomUpdate = (e: any) => {
  if (e.detail?.tournamentId === tournamentId && e.detail?.matches) {
    setLocalMatches(e.detail.matches);
  }
};
window.addEventListener('bracket:update', handleCustomUpdate);
```

In `client/test/tournaments-ui.test.tsx` lines 360–375:
```typescript
// Test 25: verifies real-time bracket updates
window.dispatchEvent(
  new CustomEvent('bracket:update', {
    detail: {
      tournamentId: 'tourney-1',
      matches: updatedMatches,
    },
  })
);
```

### Mandate Violation
This directly violates Section 2 of the **Antigravity Global Engineering Mandate: Production Reality Over Test Illusions**:
> "Production source code must never contain artifacts, dummy endpoints, in-memory test stores, or synthetic branches whose sole reason for existence is to satisfy an automated test... Testing hacks belong exclusively in test setup code."

In production runtime, live updates are delivered via WebSockets over the Socket.IO / WebSocket channel. No real user or server ever dispatches synthetic `window.dispatchEvent(new CustomEvent('bracket:update'))` events.

---

## 2. Specification & Design Reference

- **Rule Reference**: Global Engineering Mandate Section 2.A (Forbidden Anti-Patterns in Production Code).
- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 6:
  > Real-time bracket synchronization must be powered exclusively by the centralized WebSocket/Socket.IO client channel subscribing to `tournament:{id}`.

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect `client/components/tournaments/BracketVisualizer.tsx` at line 81.
2. Observe code comment explicitly acknowledging test-only intent:
   `// 1. Listen for DOM dispatched bracket:update events (used by testing & local dispatch)`
3. Notice that without this test-only hook, Test 25 in `client/test/tournaments-ui.test.tsx` fails because the test does not mock the WebSocket subscriber.

---

## 4. Impact

- Production code pollution with synthetic test scaffolding.
- False confidence: The test passes via synthetic DOM events without actually verifying real WebSocket message parsing and state updates.

---

## 5. Recommended Remediation

1. Remove `window.addEventListener('bracket:update', ...)` from `client/components/tournaments/BracketVisualizer.tsx`.
2. Update `client/test/tournaments-ui.test.tsx` to properly mock the WebSocket hook/client adapter rather than injecting window event bridges into production components.
