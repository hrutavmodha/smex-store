# Bug: Universal Search Modal Retains Stale Results When Query is Cleared

- **Bug ID**: 7
- **Category**: Correctness
- **Severity**: Low
- **Target Files**:
  - `client/components/search/UniversalSearchModal.tsx` (lines 104–106)
- **Status**: Identified

---

## 1. Description

In `client/components/search/UniversalSearchModal.tsx`:
```tsx
// 300ms Debounced search fetch
useEffect(() => {
  if (!isOpen) return;
  const trimmed = query.trim();
  if (trimmed.length < 2) return;

  const handler = setTimeout(async () => {
    setIsLoading(true);
    // ...
  }, 300);

  return () => {
    clearTimeout(handler);
  };
}, [query, category, isOpen]);
```
When a user types a search query of 2 or more characters (e.g. `"Alpha"`), results are fetched and stored in `results`.
If the user then deletes the input back down to 1 character or an empty string, `if (trimmed.length < 2) return;` executes.
Because `results` is never cleared and `isLoading` is not reset, the previous search results remain visible on screen.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/notifications-search.md` Section 4: "Search input with debounced autocomplete. Clearing search input resets state to empty."

---

## 3. Reproduction Steps / Proof of Concept

1. Press `Cmd+K` / `Ctrl+K` to open the search modal.
2. Type `"Team"` and wait 300ms for results to populate.
3. Hit Backspace until the input is completely empty.
4. Observe that the previous results for `"Team"` continue to be displayed.

---

## 4. Impact

Confusing user experience where results remain displayed for a blank search query.

---

## 5. Recommended Remediation

In `UniversalSearchModal.tsx`, clear results when `trimmed.length < 2`:
```tsx
const trimmed = query.trim();
if (trimmed.length < 2) {
  setResults({});
  setIsLoading(false);
  return;
}
```
