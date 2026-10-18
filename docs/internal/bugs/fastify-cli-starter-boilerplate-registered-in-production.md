# Bug: Fastify-CLI Starter Boilerplate Plugins and Routes Registered in Production App

- **Bug ID**: 25
- **Category**: Maintainability / Production Purity
- **Severity**: Low
- **Target Files**:
  - `server/src/app.ts` (lines 3, 18, 55, 75)
  - `server/src/routes/example/index.ts` (lines 1–10)
  - `server/src/plugins/support.ts` (lines 1–21)
  - `server/test/plugins/support.test.ts`
  - `server/test/routes/example.test.ts`
- **Status**: Identified

---

## 1. Description

The backend application was bootstrapped with the `fastify-cli` starter template. Default template boilerplate files remain registered in the production server assembly:

1. In `server/src/routes/example/index.ts`:
   ```ts
   const example: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
     fastify.get('/', async function (_request, _reply) {
       return 'this is an example'
     })
   }
   export default example
   ```
   Registered in `server/src/app.ts` line 75:
   ```ts
   await fastify.register(exampleRoutes, { prefix: '/example' })
   ```

2. In `server/src/plugins/support.ts`:
   ```ts
   export default fp<SupportPluginOptions>(async (fastify, _opts) => {
     fastify.decorate('someSupport', function () {
       return 'hugs'
     })
   })
   ```
   Registered in `server/src/app.ts` line 55:
   ```ts
   await fastify.register(supportPlugin)
   ```

These endpoints and decorators serve zero production domain purpose, pollute the Fastify instance decorator scope, expose dummy routes on the public network, and violate the engineering mandate for production purity.

---

## 2. Specification & Design Reference

- `docs/internal/roadmap.md` Section 1.1: "Backend Service Bootstrap: Clean Fastify 5 plugin system."
- Engineering Mandate: Section 2.A: "Production Source Code Must Remain 100% Pure & Test-Agnostic: The runtime codebase exists solely to satisfy real business requirements, system invariants, domain logic, and user interfaces. No Dummy Routes."

---

## 3. Reproduction Steps / Proof of Concept

1. Start the server:
   `pnpm --filter @smex/server dev`
2. Send a GET request to `/example`:
   `curl http://localhost:3001/example`
3. Result: HTTP 200 with `'this is an example'`.
4. Inspect Fastify instance: `fastify.someSupport()` is decorated and returns `'hugs'`.

---

## 4. Impact

Unused routes and dummy decorators remain exposed on public production ports, increasing the attack surface, creating router overhead, and cluttering the API contract.

---

## 5. Recommended Remediation

1. Remove `exampleRoutes` and `supportPlugin` registrations from `server/src/app.ts`.
2. Delete `server/src/routes/example/index.ts` and `server/src/plugins/support.ts`.
3. Delete the corresponding template tests: `server/test/plugins/support.test.ts` and `server/test/routes/example.test.ts`.
