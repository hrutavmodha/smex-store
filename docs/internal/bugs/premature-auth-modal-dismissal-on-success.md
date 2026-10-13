# Bug: Premature Dismissal of AuthModal Suppresses Success Screens on Recovery & Registration

- **Bug ID**: BUG-M3-005
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles
- **Severity**: Medium (User Experience & Feedback Bug)
- **Target Files**:
  - `client/components/auth/AuthModal.tsx` (lines 28–33)
  - `client/components/auth/ForgotPasswordForm.tsx` (lines 51–54, 62–85)
  - `client/components/auth/RegisterForm.tsx` (lines 96–99, 107–130)
- **Status**: Identified

---

## 1. Description

Both `ForgotPasswordForm` and `RegisterForm` have dedicated inline confirmation screens (`isSubmitted` / `isSuccess`) designed to inform the user that their request succeeded:
- `ForgotPasswordForm`: Renders "Reset Link Dispatched: If an account is associated with [email], you will receive password reset instructions shortly" with a "Back to Sign In" CTA.
- `RegisterForm`: Renders "Account Created: We have dispatched a verification link to [email]" with a "Continue to Sign In" CTA.

However, in `AuthModal.tsx`:
```typescript
const handleSuccess = () => {
  if (onSuccess) {
    onSuccess();
  }
  onClose();
};
```
Whenever `onSuccess` is passed into child forms (`<ForgotPasswordForm onSuccess={handleSuccess} ... />`), the child form invokes `if (onSuccess) onSuccess()` immediately upon receiving a 200/201 response.

This immediately triggers `onClose()` on the parent `AuthModal`.

The modal closes instantly, unmounting the form before the user can view the confirmation screen or click "Continue to Sign In". The user is left on the home page with no indication of whether their action succeeded or what they need to do next.

---

## 2. Specification & Design Reference

- **SRS Reference**: `docs/internal/requirements.md` Section 8.1 Step 2–3 & Section 8.3 Step 2:
  > Clear user feedback upon registration and password reset initiation.
- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 11.1:
  > Authentication modal views and transitions.

---

## 3. Reproduction Steps / Proof of Concept

1. Open the Auth modal and click "Forgot password?".
2. Enter an email address and click "Send Recovery Link".
3. The API responds with 200 OK.
4. Instead of showing the "Reset Link Dispatched" screen, the modal disappears from the screen instantly.
5. The user is left wondering whether the request succeeded or failed.

---

## 4. Impact

- Degraded user experience and confusion during account recovery and registration.
- Render logic and CTA buttons in `isSubmitted` / `isSuccess` branches are completely unreachable.

---

## 5. Recommended Remediation

1. Do not pass `handleSuccess` (which immediately calls `onClose()`) to `ForgotPasswordForm` and `RegisterForm`.
2. Allow child forms to transition into their `isSubmitted` / `isSuccess` views, and call `onSuccess` or `onClose` only when the user clicks the explicit "Continue to Sign In" or "Back to Sign In" button:
   ```typescript
   // In ForgotPasswordForm.tsx:
   const handleSubmit = async (e: React.FormEvent) => {
     // ...
     setIsSubmitted(true);
     // Do not call onSuccess() here; let the user see the confirmation!
   };
   ```
