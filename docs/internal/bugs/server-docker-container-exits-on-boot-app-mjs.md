# Bug: Production Server Docker Container Exits Immediately on Startup (`node dist/app.mjs`)

- **Bug ID**: 14
- **Category**: Maintainability
- **Severity**: High
- **Target Files**:
  - `server/Dockerfile` (line 52)
  - `server/tsdown.config.ts` (line 4)
  - `server/src/app.ts` (lines 38–79)
  - `server/package.json` (line 16)
- **Status**: Identified

---

## 1. Description

In `server/Dockerfile`:
```dockerfile
CMD ["node", "dist/app.mjs"]
```
However, in `server/tsdown.config.ts`:
```ts
export default defineConfig({
  entry: ['src/app.ts'],
  format: ['esm'],
  // ...
})
```
`src/app.ts` is only a Fastify plugin:
```ts
const app: FastifyPluginAsync<AppOptions> = async (fastify, _opts): Promise<void> => {
  // register plugins and routes
}
export default app
```
It does not create a Fastify instance, nor does it call `server.listen()`.
In development, `fastify start` (from `fastify-cli`) is used to load and run the plugin.
In the production Docker container, executing `node dist/app.mjs` executes the plugin definition file directly, which immediately exits with code 0 without binding to any port or serving traffic.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/cicd-hardening.md` Section 2: "Production Dockerfile: Container must expose port 3001 and actively respond to /health."
- `docs/internal/roadmap.md` Section 10.3: "Production Containerization: Multi-stage production Dockerfile."

---

## 3. Reproduction Steps / Proof of Concept

1. Build the server Docker container:
   `docker build -f server/Dockerfile -t smex-server-test .`
2. Run the container:
   `docker run --rm smex-server-test`
3. The container exits immediately with exit code 0 and shuts down.

---

## 4. Impact

The backend production container is completely non-functional and cannot run in a live deployment.

---

## 5. Recommended Remediation

Update `server/tsdown.config.ts` to bundle the server bootstrap (`src/server.ts`), and update `server/Dockerfile` to run `dist/server.mjs`:
1. In `server/tsdown.config.ts`:
   ```ts
   entry: ['src/server.ts'],
   ```
2. In `server/Dockerfile`:
   ```dockerfile
   CMD ["node", "dist/server.mjs"]
   ```
