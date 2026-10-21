# Bug: CI/CD Test Suites Fail When Executed From Monorepo Root Due to Brittle Working Directory Traversal

- **Bug ID**: BUG-OPS-007
- **Milestone**: Operations & Testing
- **Severity**: Medium (P2 - CI Test Runner Failure)
- **Target Files**:
  - `server/test/ci/workflow-and-drift.test.ts` (lines 10, 48–51)
  - `server/test/deployment/cd-rollback.test.ts` (lines 72–75)
- **Status**: Identified

---

## 1. Description

The integration tests for CI/CD workflow validation assume that Vitest is always invoked with `process.cwd()` set to the `server/` directory:

In [`server/test/deployment/cd-rollback.test.ts`](file:///home/hrutav-modha/Documents/smex-store/server/test/deployment/cd-rollback.test.ts#L72):
```typescript
const deployPath = path.resolve(process.cwd(), '../.github/workflows/deploy.yml');
assert.ok(fs.existsSync(deployPath), '.github/workflows/deploy.yml must exist');
```

In [`server/test/ci/workflow-and-drift.test.ts`](file:///home/hrutav-modha/Documents/smex-store/server/test/ci/workflow-and-drift.test.ts#L10):
```typescript
const ciPath = path.resolve(process.cwd(), '../.github/workflows/ci.yml');
assert.ok(fs.existsSync(ciPath), '.github/workflows/ci.yml must exist');
...
const output = execSync('npx drizzle-kit check', {
  cwd: path.resolve(process.cwd()),
  encoding: 'utf8',
});
```

When a developer or CI pipeline runs `pnpm test` or `vitest run` from the monorepo root:
1. `process.cwd()` is `/home/hrutav-modha/Documents/smex-store`.
2. `path.resolve(process.cwd(), '../.github/workflows/deploy.yml')` resolves to `/home/hrutav-modha/Documents/.github/workflows/deploy.yml`.
3. The file is not found, causing `assert.ok` to throw an `AssertionError`.
4. `execSync('npx drizzle-kit check')` attempts to find `drizzle.config.ts` in the monorepo root rather than `server/`, throwing an error.

---

## 2. Impact

- `pnpm test` executed from the root of the monorepo fails prematurely.
- Automated CI matrix jobs fail unless each workspace is run in isolation.

---

## 3. Reproduction Steps / Proof of Concept

1. From the repository root, run:
   ```bash
   pnpm --filter @smex/server test test/deployment/cd-rollback.test.ts
   ```
2. Observe error:
   ```
   AssertionError [ERR_ASSERTION]: .github/workflows/deploy.yml must exist
   ```

---

## 4. Root Cause

Hardcoding relative directory traversals (`../`) based on `process.cwd()` instead of anchor-based directory discovery (`findPackageRoot` or `import.meta.dirname`).

---

## 5. Recommended Remediation

Replace `path.resolve(process.cwd(), '../...')` with an anchor based on the current file directory (`import.meta.dirname`):

```typescript
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const deployPath = path.resolve(repoRoot, '.github/workflows/deploy.yml');
const serverDir = path.resolve(repoRoot, 'server');
```
