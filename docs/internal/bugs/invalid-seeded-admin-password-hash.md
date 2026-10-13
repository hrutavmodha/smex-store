# Bug: Invalid Precomputed Argon2id Hash in Database Seeding Prevents Admin Login

- **Bug ID**: BUG-M2-001
- **Milestone**: Milestone 2: Data Layer and Client UI Shell (also affects Milestone 3 Admin Access)
- **Severity**: High (Authentication Blocker for Platform Administration)
- **Target Files**:
  - `server/src/db/seed.ts` (lines 40–42)
- **Status**: Identified

---

## 1. Description

The database seeding script `server/src/db/seed.ts` is responsible for provisioning the initial platform administrator account (`admin@smexstore.com`). 

To avoid the CPU cost of Argon2id hashing during testing and seeding, the code specifies a hardcoded precomputed hash:
```typescript
// Standard precomputed Argon2id hash for development/seed password 'Admin@123456'
const passwordHash =
  '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY3OA$9S03Fm+rV7aQ3F7uK9z+9Q8w5e4r3t2y1u0i9o8p7a6';
```

However, this hash string is mathematically invalid and does not correspond to `'Admin@123456'`.

When `argon2.verify(passwordHash, 'Admin@123456')` is executed, it returns `false`.

Consequently, anyone attempting to log in to the platform with the documented seed credentials:
- Email: `admin@smexstore.com`
- Password: `Admin@123456`

receives HTTP 401 Unauthorized (`INVALID_CREDENTIALS`). The default platform administrator is permanently locked out of the seeded development and testing database.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: `docs/internal/roadmap.md` Task 2.4:
  > "Database Seeding Pipeline: Create seed script `src/db/seed.ts` populating preset gaming avatars, default MLBB boosting pricing matrix, initial admin account, and sample tournaments."
- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 5.2 A:
  > **Default Admin Account**:
  > - Email: `admin@smexstore.com`
  > - Password Hash: Precomputed Argon2id hash for development/testing seed password.
- **LLT Reference**: `docs/internal/testing/llt/data-layer.md` Test ID 22:
  > Initial platform admin account provisioning.

---

## 3. Reproduction Steps / Proof of Concept

1. Run the database seed script:
   ```bash
   pnpm --filter @smex/server db:seed
   ```
2. Verify the hash directly via Node.js:
   ```bash
   node -e 'import("argon2").then(a => a.verify("$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY3OA$9S03Fm+rV7aQ3F7uK9z+9Q8w5e4r3t2y1u0i9o8p7a6", "Admin@123456").then(console.log))'
   ```
3. Output: `false`.
4. Attempt login via API:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@smexstore.com","password":"Admin@123456"}'
   ```
5. Response:
   ```json
   {
     "type": "https://api.smexstore.com/errors/unauthorized",
     "title": "Unauthorized",
     "status": 401,
     "detail": "Invalid email or password",
     "code": "INVALID_CREDENTIALS"
   }
   ```

---

## 4. Impact

- Default platform administrator account cannot authenticate.
- Automated tests or developer workflows relying on the seeded administrator for Milestone 9 (Admin Governance) and Milestone 6 (Admin Rate Overrides) will fail.

---

## 5. Recommended Remediation

Replace the invalid hash in `server/src/db/seed.ts` with a valid Argon2id hash generated with the system's exact `ARGON2_CONFIG` (memoryCost 65536, timeCost 3, parallelism 4), or compute it programmatically using `hashPassword('Admin@123456')` during seeding if the admin user is being created.
