# Bug: Silent Client-Side Fallback Bypasses Server-Side Validation on Order Creation

- **Bug ID**: BUG-M6-005
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: High (Data Integrity & Silent Failure Bypass / AI Fluff)
- **Target Files**:
  - `client/components/boosting/Calculator.tsx` (lines 127–167)
  - `server/src/routes/boosting.ts` (lines 105–156)
- **Status**: Identified

---

## 1. Description

When the customer clicks "1-Click WhatsApp" or "Copy & Open Instagram", `handleDispatch` in `client/components/boosting/Calculator.tsx` dispatches a request to persist the inquiry in the database:
```typescript
try {
  const res = await fetchWithAuth('/api/v1/boosting/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });

  if (res.ok) {
    const data = await res.json();
    destinationUrl = data.dispatch?.destinationUrl;
    formattedText = data.dispatch?.formattedText;
  }
} catch {
  // Offline fallback: format client-side
}
```

### The Silent Bypass Flaw
Notice what happens if `res.ok` is `false` (e.g. server returns HTTP 400 Bad Request, HTTP 422 Unprocessable Entity, or HTTP 500):
1. `fetchWithAuth` does **not** throw on HTTP 4xx or 5xx responses (per the standard Fetch API).
2. Because `res.ok` is false, `destinationUrl` and `formattedText` remain empty strings `""`.
3. The component drops immediately into the fallback block (lines 143–167):
   ```typescript
   if (!destinationUrl || !formattedText) {
     const orderRef = generateOrderRef();
     const clientInput = { ... };
     if (channel === 'whatsapp') {
       const wa = resolveWhatsAppHandoff(clientInput);
       destinationUrl = wa.destinationUrl;
       formattedText = wa.formattedText;
     } else {
       const ig = resolveInstagramHandoff(clientInput);
       destinationUrl = ig.destinationUrl;
       formattedText = ig.formattedText;
     }
   }
   ```
4. The client generates a local phantom `orderRef`, copies the message to the clipboard, and opens WhatsApp or Instagram.

### Consequences:
1. **Validation Errors Completely Swallowed**: If the server rejects the order (e.g. due to invalid rank progression, corrupted data, or rate validation), the customer is never notified of the error.
2. **Ghost Orders in Production**: The customer contacts the store manager on WhatsApp presenting an order reference like `#BST-202610-8421`. However, the order **does not exist anywhere in the store database** because the API rejected it.
3. **Price Tampering Window**: If a malicious client modifies payload prices or parameters, the server rejects it, but the client silently ignores the rejection and sends the tampered quote to the booster chat anyway.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 6.2 Item 2:
  > "Server-Side Quote Attestation: When the user clicks any dispatch button, the client initiates POST /api/v1/boosting/orders. Fastify verifies the client's calculations... If rates have changed or tampering is detected, the server returns the authoritative price quote."
- **Engineering Mandate**: Section 1 & Section 3.A (Production Reality Over Test Illusions).

---

## 3. Reproduction Steps / Proof of Concept

1. Temporarily stop the backend server or send an invalid order payload that triggers HTTP 422 (e.g. an unmapped rank).
2. In the client UI, enter an IGN and click "1-Click WhatsApp".
3. **Observed**: No error toast is displayed. The UI displays:
   `Order details copied to clipboard! Opening WhatsApp...`
   and opens WhatsApp with a freshly generated phantom order reference that has never been recorded in the database.

---

## 4. Impact

- Phantom inquiries sent to store staff that cannot be found or managed in the admin portal.
- Masking of critical backend failures and validation errors from end-users.

---

## 5. Recommended Remediation

In `client/components/boosting/Calculator.tsx`:
1. Check `if (!res.ok)`: parse the server error JSON and display a user-friendly error toast (e.g. `showToast(data.message || 'Failed to submit order inquiry')`).
2. Do not proceed to generate client phantom links or open external apps when the server explicitly rejects the order. Reserve offline link formatting strictly for actual offline network failures.
