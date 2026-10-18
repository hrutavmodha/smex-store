# Bug: Copy-Pasted RFC 7807 Error Formatting Helper Across Route Handlers (AI Boilerplate Fluff)

- **Bug ID**: BUG-M8-007
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search (Architectural Debt across M5–M8)
- **Severity**: Low / Code Quality Smell (DRY Violation & Architectural Drift)
- **Target Files**:
  - `server/src/routes/marketplace/index.ts` (lines 7–14)
  - `server/src/routes/notifications.ts` (lines 7–16)
  - `server/src/routes/search.ts` (lines 7–22)
  - `server/src/routes/teams.ts` (lines 14–21)
  - `server/src/routes/tournaments.ts` (lines 12–19)
- **Status**: Identified

---

## 1. Description

RFC 7807 problem details error responses (`type`, `title`, `status`, `detail`, `code`, `instance`) are the official API error response standard across Smex Store.

However, rather than establishing a centralized utility or Fastify decorator/plugin (e.g. `fastify.sendError` or `createProblemDetails()`), multiple AI generation rounds repeatedly copy-pasted private helper implementations of `formatRfc7807` inside individual route files:

```typescript
// server/src/routes/marketplace/index.ts:7-14
function formatRfc7807(statusCode: number, code: string, title: string, detail: string) {
  return {
    type: `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status: statusCode,
    detail,
    code,
  };
}

// server/src/routes/search.ts:7-22 (includes optional instance parameter)
function formatRfc7807(statusCode: number, code: string, title: string, detail: string, instance?: string) { ... }

// server/src/routes/notifications.ts:7-16
function formatRfc7807(...) { ... }
```

Meanwhile, other route files (e.g. `server/src/routes/marketplace/uploads.ts` lines 88–94) completely forget the helper exists and write out ad-hoc inline JSON error payloads.

---

## 2. Specification & Design Reference

- **ADR / Clean Architecture Invariant**: Platform-wide error representation must be consistent and single-sourced to prevent payload schema drift across micro-endpoints.

---

## 3. Impact

- **Maintenance Overhead**: Modifying the error schema (such as adding trace IDs, timestamps, or validation array details) requires editing multiple disjoint files.
- **Contract Inconsistency**: Some routes include `instance`, others omit it, and some return non-standard payloads.

---

## 4. Recommended Remediation

1. Create a centralized error utility in `server/src/utils/errors.ts` (or `@smex/shared`):
   ```typescript
   export function formatRfc7807(
     statusCode: number,
     code: string,
     title: string,
     detail: string,
     instance?: string
   ) {
     return {
       type: `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
       title,
       status: statusCode,
       detail,
       code,
       ...(instance ? { instance } : {}),
     };
   }
   ```
2. Remove private function declarations in each route file and import the centralized helper.
