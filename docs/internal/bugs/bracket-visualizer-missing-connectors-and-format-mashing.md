# Bug: BracketVisualizer Omits SVG Connectors & Mashes Format Columns

- **Bug ID**: BUG-M5-008
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: Medium (Visual Defect & UI Specification Non-Compliance)
- **Target Files**:
  - `client/components/tournaments/BracketVisualizer.tsx` (lines 140–210)
- **Status**: Identified

---

## 1. Description

The bracket visualization component `BracketVisualizer.tsx` fails to implement the visual specifications outlined in the Low-Level Design (LLD):

### A. Missing Dynamic SVG Bezier Connectors

In `docs/internal/design/lld/tournament-engine.md` Section 7.2:

> "SVG Vector Connections: Dynamic cubic bezier curve paths connecting feeder match outcome nodes directly into parent round nodes across each bracket tier."

In `BracketVisualizer.tsx`, there are **zero SVG paths or connector lines rendered**. The component renders plain flex columns with empty margins between matches. Users cannot visually discern which feeder match feeds into which parent round node.

### B. Mashing Double-Elimination Brackets into Common Round Columns

In `BracketVisualizer.tsx`:

```typescript
const roundGroups = useMemo(() => {
  const groups: Record<number, MatchNode[]> = {};
  matches.forEach((m) => {
    if (!groups[m.roundNumber]) {
      groups[m.roundNumber] = [];
    }
    groups[m.roundNumber].push(m);
  });
  return groups;
}, [matches]);
```

Matches are grouped solely by `roundNumber`.
In a double-elimination bracket, there are Upper Bracket matches, Lower Bracket matches, and Grand Final matches. By grouping solely on `roundNumber`, Upper Round 1 matches and Lower Round 1 matches are dumped into the exact same column vertically.
This creates a confusing, mashed layout where matches of completely different bracket tiers are visually interleaved.

### C. Inappropriate Round Titles in Round Robin

`getRoundTitle(roundNum, totalRounds)` hardcodes:

- Last round: `"Championship Final"`
- Second to last round: `"Semifinals"`
- Third to last round: `"Quarterfinals"`

In a Round Robin tournament with 3 rounds, Round 1 is titled `"Quarterfinals"`, Round 2 `"Semifinals"`, and Round 3 `"Championship Final"`. In Round Robin, there are no quarterfinals, semifinals, or championship finals—all matches are group matchdays/rounds.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 7.2:
  > Visual styling must distinguish Upper Brackets, Lower Brackets, and Grand Finals cleanly, with dynamic connector paths tracing match trees, and contextual round headings corresponding to tournament format.
  >

---

## 3. Reproduction Steps / Proof of Concept

1. View a double-elimination tournament in the UI.
2. In the "Bracket" tab, observe the layout:
   - Upper Round 1 and Lower Round 1 matches are stacked in the same column.
   - No SVG connecting lines exist between any rounds.
3. View a round-robin tournament in the UI:
   - Notice round titles labeled "Semifinals" and "Championship Final".

---

## 4. Impact

- Poor user and spectator experience.
- Complete visual confusion for double-elimination brackets.
- Non-compliance with tournament visual UI specifications.

---

### 5. Recommended Remediation

1. In `client/components/tournaments/BracketVisualizer.tsx`:
   - Split double-elimination display into distinct sections/tabs: Upper Bracket, Lower Bracket, and Grand Final.
   - For round robin, display standard "Round 1", "Round 2", etc.
   - Implement SVG bezier curve connectors between feeder match card right-edge anchors and parent match card left-edge anchors.
