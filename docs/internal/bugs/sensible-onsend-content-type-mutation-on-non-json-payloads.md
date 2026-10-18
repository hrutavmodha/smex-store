# Bug: Fastify Sensible `onSend` Hook Prematurely Mutates Content-Type on Non-JSON Payloads

- **Bug ID**: 23
- **Category**: Reliability / Observability
- **Severity**: Medium
- **Target Files**:
  - `server/src/plugins/sensible.ts` (lines 53–69)
- **Status**: Identified

---

## 1. Description

In `server/src/plugins/sensible.ts`, an `onSend` hook is registered to attach the RFC 7807 `instance` field and set `Content-Type: application/problem+json`:

```ts
// Hook onSend to enforce Content-Type: application/problem+json on all 4xx and 5xx errors
fastify.addHook('onSend', async (request, reply, payload) => {
  if (reply.statusCode >= 400 && typeof payload === 'string') {
    reply.header('content-type', 'application/problem+json; charset=utf-8');

    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'object' && parsed !== null && !parsed.instance) {
        parsed.instance = request.url;
        return JSON.stringify(parsed);
      }
    } catch {
      // payload is not json
    }
  }
  return payload;
});
```

Notice that `reply.header('content-type', 'application/problem+json; charset=utf-8')` is invoked **before** verifying that `payload` is valid JSON.
If an upstream route or plugin returns a non-JSON error (e.g., plain text `Not Found`, an HTML 502/504 gateway error from an intermediate proxy, or an empty string), `JSON.parse` throws and enters the empty `catch` block.
However, because `reply.header(...)` was already called, the HTTP response header has been overwritten to `application/problem+json`, while the body remains plain text or HTML.

---

## 2. Specification & Design Reference

- `RFC 7807`: Problem Details for HTTP APIs, Section 3: "The `application/problem+json` media type identifies an HTTP response entity that contains a Problem Details JSON object."
- `docs/internal/roadmap.md` Section 10.6: "Enforce RFC 7807 problem details specification (`application/problem+json`)."

---

## 3. Reproduction Steps / Proof of Concept

1. Create or trigger a route that returns a raw string or HTML response with a 4xx/5xx status:
   ```ts
   reply.code(404).type('text/plain').send('Resource does not exist');
   ```
2. Inspect the HTTP response headers and body:
   - Header: `Content-Type: application/problem+json; charset=utf-8`
   - Body: `Resource does not exist`
3. Any API client (or `fetchWithAuth`) attempting to parse the body as JSON via `res.json()` will throw a `SyntaxError: Unexpected token 'R', "Resource does not exist"... is not valid JSON`.

---

## 4. Impact

Clients parsing responses with `Content-Type: application/problem+json` encounter unexpected deserialization crashes when non-JSON error payloads are returned.

---

## 5. Recommended Remediation

Only set the `Content-Type` header *after* verifying that the payload is valid JSON, or handle formatting exclusively within Fastify's `setErrorHandler`:

```ts
fastify.addHook('onSend', async (request, reply, payload) => {
  if (reply.statusCode >= 400 && typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'object' && parsed !== null) {
        reply.header('content-type', 'application/problem+json; charset=utf-8');
        if (!parsed.instance) {
          parsed.instance = request.url;
          return JSON.stringify(parsed);
        }
      }
    } catch {
      // payload is not JSON; preserve original Content-Type
    }
  }
  return payload;
});
```
