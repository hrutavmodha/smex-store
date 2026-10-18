# Bug: Inconsistent RFC 7807 Error Formatting and HTTP Status Codes

- **Bug ID**: 16
- **Category**: Maintainability
- **Severity**: Medium
- **Target Files**:
  - `server/src/plugins/sensible.ts` (lines 14–33)
  - `shared/src/errors.ts` (lines 1–28)
  - `server/src/routes/boosting.ts` (lines 71–76, 108–113)
  - `server/src/routes/admin/users.ts` (lines 62–68, 84–90)
  - `server/src/routes/marketplace/index.ts` (lines 72, 131, 173)
- **Status**: Identified

---

## 1. Description

Milestone 10 requirement 10.6 mandates:
> "Enforce RFC 7807 problem details specification (`application/problem+json`) with 422 Unprocessable Entity status on validation failures across all API errors."

Currently:
1. RFC 7807 formatting helpers are duplicated with inconsistent signatures in `server/src/plugins/sensible.ts` (`formatRfc7807Problem`) and `shared/src/errors.ts` (`formatRfc7807`).
2. Validation errors return HTTP 422 in `teams.ts` and `tournaments.ts`, but return HTTP 400 in `marketplace/index.ts` and `auth.ts`.
3. In `boosting.ts` (lines 71–76, 108–113) and `admin/users.ts` (lines 62–68, 84–90), validation errors do not use RFC 7807 format at all, instead returning ad-hoc objects:
   ```json
   {
     "statusCode": 400,
     "error": "Bad Request",
     "message": "Invalid calculation parameters",
     "issues": [...]
   }
   ```
4. In `marketplace/uploads.ts` (lines 161, 176), errors return `{ error: "Media not found" }`.

---

## 2. Specification & Design Reference

- `docs/internal/roadmap.md` Section 10.6: "Structured Observability and RFC 7807 Error Handling: Enforce RFC 7807 problem details specification (application/problem+json) with 422 Unprocessable Entity status on validation failures across all API errors."
- `docs/internal/design/lld/core-plumbing.md` Section 3: "Standard RFC 7807 Problem Details."

---

## 3. Reproduction Steps / Proof of Concept

1. Send an invalid payload to `POST /api/v1/boosting/calculate`:
   Returns HTTP 400 with `{ statusCode: 400, error: 'Bad Request', ... }`.
2. Send an invalid payload to `POST /api/v1/teams`:
   Returns HTTP 422 with RFC 7807 `{ type, title, status: 422, detail, code }`.
3. Send an invalid payload to `POST /api/v1/marketplace/listings`:
   Returns HTTP 400 with `{ type, title, status: 400, detail, code }`.

---

## 4. Impact

Clients cannot reliably parse API error responses, breaking generic error-handling abstractions.

---

## 5. Recommended Remediation

1. Remove duplicate formatter in `sensible.ts` and standardize on `shared/src/errors.ts`.
2. Update all route validation failures across `boosting.ts`, `marketplace/index.ts`, `auth.ts`, and `admin/users.ts` to return HTTP 422 with `formatRfc7807`.
