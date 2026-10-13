# Bug: Missing Frontend Pages and Forms for Email Verification & Password Reset

- **Bug ID**: BUG-M3-004
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles
- **Severity**: High (Missing Critical Milestone Deliverable / Broken Workflow)
- **Target Files**:
  - `client/app/` (missing `/verify-email` and `/reset-password` pages)
  - `client/components/auth/` (missing `ResetPasswordForm.tsx`)
  - `server/src/services/email.service.ts` (lines 41, 64)
- **Status**: Identified

---

## 1. Description

The backend service dispatches emails containing actionable verification and password reset links:
- Verification Email: `<a href="https://smexstore.com/verify-email?token=${token}">Verify Account</a>`
- Password Reset Email: `<a href="https://smexstore.com/reset-password?token=${token}">Reset Password</a>`

However, the frontend client application does not contain the corresponding pages or components:
1. There is no `client/app/verify-email/page.tsx`. A user clicking the email verification link receives a 404 Not Found error from Next.js.
2. There is no `client/app/reset-password/page.tsx` nor any `ResetPasswordForm` component. A user clicking the password reset link receives a 404 Not Found error.
3. The endpoint `POST /api/v1/auth/reset-password` is never invoked by any client-side component.
4. The endpoint `POST /api/v1/auth/verify-email` is never invoked by any client-side component.

Although Milestone 3 task 3.8 was marked completed in `docs/internal/roadmap.md` (`* [X] 3.8 Client Authentication and Account UI: Build modal and standalone views for Login, Registration, and Password Reset`), only the modal was created, and standalone pages for reset and verification were omitted.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: `docs/internal/roadmap.md` Task 3.8:
  > "Build modal and standalone views for Login, Registration, and Password Reset."
- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 8.2 & Section 9.1:
  > Flow charts and specifications for user verification and password reset token consumption.
- **SRS Reference**: `docs/internal/requirements.md` Section 5.2 Item 10 & Section 8.1 / 8.3:
  > "Authentication Suite: Registration, Email Verification, Login, and Password Reset."

---

## 3. Reproduction Steps / Proof of Concept

1. Register an account or request a password reset via the API.
2. Receive the simulated or transactional email link:
   `https://smexstore.com/verify-email?token=...` or `https://smexstore.com/reset-password?token=...`
3. Navigate to either URL on the frontend:
   - `http://localhost:3000/verify-email?token=abc...`
   - `http://localhost:3000/reset-password?token=abc...`
4. Both routes return Next.js 404 (This page could not be found).

---

## 4. Impact

- Users cannot verify their email addresses, preventing them from accessing high-trust features (e.g. creating marketplace listings, joining tournaments).
- Users who forget their password cannot reset it via the web interface.

---

## 5. Recommended Remediation

1. Implement `client/app/verify-email/page.tsx`:
   - Reads `token` query param.
   - Dispatches `POST /api/v1/auth/verify-email` with `{ token }`.
   - Renders success state and "Continue to Sign In" CTA.
2. Implement `client/app/reset-password/page.tsx` and `client/components/auth/ResetPasswordForm.tsx`:
   - Reads `token` query param.
   - Renders New Password and Confirm Password inputs with show/hide password toggles.
   - Dispatches `POST /api/v1/auth/reset-password` with `{ token, newPassword }`.
   - Renders confirmation and redirects to Sign In.
