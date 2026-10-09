# ADR 0004: Application Stack and Decoupled Architecture

## Status
Accepted

## Date
2026-10-09

## Context & Problem Statement
The platform has two architectural requirements that pull in opposing technical directions:
1. **High Search Engine Visibility (SEO)**: The client explicitly mandates strong organic search discovery for public content (tournaments, team rosters, marketplace listings, leaderboards). This demands instant Server-Side Rendering (SSR), pre-rendered semantic HTML, dynamic OpenGraph/Twitter social cards (`og:image`, `og:title`), and automated XML sitemaps.
2. **Persistent Bi-Directional Real-Time Communications**: The platform requires real-time sync for live tournament bracket updates, team roster join requests, and instant notification pushes. This demands long-lived, persistent WebSockets.

A pure Single-Page Application (React + Vite SPA) performs poorly on web crawlers for dynamic content and cannot generate dynamic server-rendered OpenGraph metadata. Conversely, deploying a full-stack Next.js monolith on serverless infrastructure (e.g., Vercel) does not support persistent stateful WebSockets without complex serverless hacks or expensive third-party real-time SaaS providers (e.g., Pusher, Ably).

## Decision
We adopt a **Decoupled Architecture** pairing an SSR-focused Next.js frontend with a standalone, stateful backend API:

```text
Next.js 15 (App Router, TypeScript)           Standalone Node API (Fastify / Express)
├── Server Components (SSR / SEO) ──── HTTP ──> ├── RESTful Endpoints (CRUD)
├── Dynamic Metadata & OpenGraph Cards          ├── PostgreSQL (Drizzle / Prisma)
├── Client Components (UI / Interactivity)      ├── Redis (Cache, Sessions, Rate Limiting)
└── Client Browser ────────────── WebSockets ─> └── Native Persistent WebSocket Server
```

### 1. Frontend: Next.js (App Router, TypeScript strict mode)
- **Role**: Presentation, Server-Side Rendering, dynamic SEO metadata, and client state orchestration.
- **Server Components & SSR**: Public routes (`/tournaments`, `/marketplace`, `/teams`, `/leaderboard`) pre-render clean semantic HTML for crawlers and search bots.
- **SEO Tooling**: Employs Next.js `generateMetadata()` for dynamic OpenGraph/Twitter cards and native `app/sitemap.ts` / `app/robots.ts` generation.
- **Data Fetching**: Server Components query the backend REST API directly over internal network/HTTP during SSR.

### 2. Backend: Standalone Node/TypeScript Service (Fastify or Express)
- **Role**: Core business logic, data persistence, session management, and persistent real-time event broadcasting.
- **RESTful API**: Standardized JSON endpoints for authentication, marketplace CRUD, boosting management, and admin oversight.
- **Native WebSockets**: Runs a persistent, long-lived WebSocket server directly within the Node process, broadcasting live bracket state changes and notification events to connected clients with sub-millisecond latency.
- **Data & Cache**: Manages PostgreSQL database connections/migrations and Redis for rate-limiting, session lookups, and real-time pub/sub.

## Consequences

### Positive
- **Optimal SEO Crawlability**: Search engines and social scrapers receive full, pre-rendered HTML and dynamic social cards instantly with zero client-side JavaScript execution delay.
- **Robust Real-Time Infrastructure**: Standalone backend hosts native WebSockets without connection drops, edge timeouts, or serverless cold starts.
- **Clean Domain Boundary**: Frontend and backend are decoupled; the backend API is ready to serve future mobile apps (React Native), Discord bots, or administrative CLI tools.
- **Zero Real-Time Vendor Lock-in**: No dependency on third-party real-time SaaS providers for WebSocket notifications.

### Negative / Trade-offs
- **Operational Complexity**: Requires managing, deploying, and monitoring two separate services (e.g., two Docker containers or a static/edge frontend paired with a containerized backend VPS) rather than a single unified monolith.
- **Network Boundaries**: Requires strict CORS configuration, mutual network security, and consistent DTO/type synchronization across frontend and backend boundaries.
