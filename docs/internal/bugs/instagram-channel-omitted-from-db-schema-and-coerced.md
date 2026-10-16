# Bug: Instagram Channel Omitted from Database Enum with Silent WhatsApp Coercion

- **Bug ID**: BUG-M6-001
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: High (Data Corruption & Spec Non-Compliance / AI Fluff)
- **Target Files**:
  - `server/src/db/schema/boosting.ts` (line 18)
  - `server/src/routes/boosting.ts` (lines 38, 173–177)
  - `server/src/services/boosting-rate.service.ts` (line 105)
- **Status**: Identified

---

## 1. Description

The platform requirements explicitly mandate WhatsApp and Instagram as the primary commercial communication channels for rank boosting inquiries and off-platform payment handoff:

- `docs/internal/requirements.md` (Section 6.6 & 11)
- `docs/internal/design/lld/mlbb-boosting.md` (Section 1, 3.3, 4.1):
  ```typescript
  export const boostingContactChannelEnum = pgEnum('boosting_contact_channel', [
    'whatsapp',
    'instagram',
  ]);
  ```

However, in the actual database schema definition (`server/src/db/schema/boosting.ts`, line 18):

```typescript
export const boostingContactChannelEnum = pgEnum('boosting_contact_channel', [
  'whatsapp',
  'telegram',
  'discord',
]);
```

`'instagram'` is completely missing from the PostgreSQL `boosting_contact_channel` enum!

### The AI Fluff / Silent Coercion Hack

In `server/src/routes/boosting.ts`, the route validation schema accepts `'instagram'`:

```typescript
contactChannel: z.enum(['whatsapp', 'instagram', 'telegram', 'discord']).default('whatsapp');
```

When persisting the order to PostgreSQL (lines 173–177), rather than fixing the database migration and schema enum to include `'instagram'`, a silent bypass was introduced:

```typescript
// DB channel mapping (fallback to whatsapp for DB enum safety)
const dbContactChannel = (
  ['whatsapp', 'telegram', 'discord'].includes(data.contactChannel)
    ? data.contactChannel
    : 'whatsapp'
) as any;
```

### Consequences:

1. **Silent Data Corruption**: Whenever a customer clicks "Copy & Open Instagram" and dispatches an inquiry with `contactChannel: 'instagram'`, the order record is silently written into PostgreSQL with `contact_channel = 'whatsapp'`.
2. **Broken Admin Filtering**: In `GET /api/v1/admin/boosting/orders?channel=instagram`, the service searches for `contactChannel = 'instagram'`. Not only will it never return any Instagram orders, but PostgreSQL may throw an unhandled query exception:
   `22P02: invalid input value for enum boosting_contact_channel: "instagram"`.
3. **Misrouted Customer Communication**: Store operators viewing the order in the admin portal see the channel listed as WhatsApp, leaving them unable to identify which customer inquiries arrived via Instagram DMs.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 3.3 & Section 4.1.
- **SRS Reference**: `docs/internal/requirements.md` Section 6.6 & Section 11.
- **Engineering Mandate**: Section 1 & Section 3.B (Zero-Hallucination Data Mapping & Production Reality Over Test Illusions).

---

## 3. Reproduction Steps / Proof of Concept

1. From the client UI or API, send `POST /api/v1/boosting/orders` with:
   ```json
   {
     "pricingMode": "per_star",
     "startingRank": "Mythic",
     "targetRank": "Mythical Honor",
     "startingStars": 10,
     "targetStars": 30,
     "customerIgn": "ViperMLBB",
     "contactChannel": "instagram"
   }
   ```
2. The server responds with `201 Created` and `dispatch.channel = 'instagram'`.
3. Query the database table `boosting_orders` for the newly created row.
4. **Observed**: `contact_channel` is stored as `'whatsapp'`, losing the customer's actual channel choice.
5. Call `GET /api/v1/admin/boosting/orders?channel=instagram`.
6. **Observed**: 0 orders found or PostgreSQL throws `invalid input value for enum boosting_contact_channel: "instagram"`.

---

## 4. Impact

- Permanent loss of customer channel provenance.
- Inability for store staff to match incoming Instagram DMs with database orders.
- Broken admin order filtering.

---

## 5. Recommended Remediation

1. Update `server/src/db/schema/boosting.ts` to include `'instagram'` in `boostingContactChannelEnum`:
   ```typescript
   export const boostingContactChannelEnum = pgEnum('boosting_contact_channel', [
     'whatsapp',
     'instagram',
     'telegram',
     'discord',
   ]);
   ```
2. Generate and apply a database migration to alter the `boosting_contact_channel` PostgreSQL type.
3. Remove the silent fallback coercion in `server/src/routes/boosting.ts` line 174 so that `data.contactChannel` is directly stored.
