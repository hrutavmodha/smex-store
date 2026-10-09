# Software Requirements Specification (SRS)

## Esports Tournament & Community Platform

---

## 1. Project Overview

The platform is a web-based community hub for esports enthusiasts that centralizes tournament schedules, team and group recruitment, a peer-to-peer in-game gaming ID marketplace, and rank-boosting service bookings. The platform provides comprehensive tracking of past, ongoing (live), and upcoming tournament events, showcases official owner social channels, and incorporates community-driven marketplace transactions backed by seller reputation systems.

The platform supports two core roles — **Normal User** and **Admin**. It is designed to be fully responsive across mobile, tablet, and desktop viewports, performance-optimized, and compliant with explicit visual styling and motion constraints (see [internal/design/ui.md](design/ui.md#42-prohibited-visual-effects--animations)).

---

## 2. Objectives

1. Provide a centralized hub for all tournament information across past, ongoing, and upcoming states.
2. Connect community members with the platform owner via a dedicated social media links directory.
3. Enable users to browse and book professional rank-boosting services.
4. Facilitate peer-to-peer trading of gaming account IDs with seller ratings and proof screenshots to prevent scams.
5. Empower players to create, discover, and join competitive teams and groups.
6. Deliver robust account and session security, including email verification, password reset, multi-session device tracking, and user activity logging.
7. Deliver a consistent, fluid, accessible, and performant UI/UX across all device classes.

---

## 3. Scope

### 3.1 In Scope

- **Public & Community Pages**: Home, Tournaments, Teams & Groups, User Profile, ID Buy/Sell Marketplace, Rank Boosting Booking, Leaderboard, Social Links, and About Us.
- **Authentication & Security**: Account registration, email verification flows, login/logout, password reset, and password visibility toggles.
- **Account & Preference Settings**: Theme switching (Dark, Light, AMOLED true-black), interface density controls (Compact, Comfortable, Spacious), and user privacy toggles.
- **Device & Session Management**: Active sessions list, historical login audits, device identification, and remote session revocation.
- **Search & Discovery**: Universal cross-entity search with filtering, sorting, and tag categorization.
- **Community Features**: Member requests, tournament updates, notifications, and seller reputation rating system.
- **Administrative Moderation**: Dedicated admin controls for content oversight and platform management.
- **Motion & Design System**: Hardware-accelerated transitions and distinct motion feedback adhering to strict performance and styling guardrails.

### 3.2 Out of Scope

- **In-App Payment Gateway Processing**: Direct in-app payment processing (no integration with payment gateways like Stripe or Razorpay; all transactions for IDs and rank boosting are handled off-platform via direct external communication links such as WhatsApp, Discord, Telegram, etc.; see [ADR: Payment](adr/payment.md)).
- **Third-Party Game API Scrapers**: Automated live synchronization with proprietary game servers (account stats and ranks rely on user profile entry and verified screenshots).

---

## 4. Users & Roles

| Role                  | Description                                                                                                                                                                                   | Access Level                                  |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| **Normal User** | Standard community member. Can browse tournaments, book rank-boosting packages, create/join teams, list/buy gaming IDs, leave ratings, and manage their personal account and active sessions. | Public & Authenticated User features          |
| **Admin**       | Elevated platform manager responsible for tournament creation and updates, marketplace moderation, rank-boosting package offerings, and system oversight.                                     | Full administrative and moderation privileges |

---

## 5. Information Architecture & Navigation

### 5.1 Global Navigation Bar

1. **Logo & Branding**: Main logo with platform branding, linking directly to the Home page.
2. **Universal Search Bar**: Persistent search bar supporting cross-entity search for tournaments, teams, and players (see Section 6.11).
3. **Notification Center**: Icon with dynamic badge indicator displaying unread incoming requests and system announcements.
4. **User Account Menu**: Displays current user avatar and opens a dropdown for Profile, Settings, Device Management, Activity History, and Logout.
5. **Navbar Stability**: The navigation bar must remain sticky, performant, and completely free from layout jitter or freezing during fast scrolling and viewport resizing (see [internal/design/ui.md](design/ui.md#42-prohibited-visual-effects--animations)).

### 5.2 Primary Site Pages

1. **Home Page**: Featured banners, quick tournament summaries, featured boosting packages, and platform stats.
2. **Tournaments Page**: Dedicated multi-state listings (Past, Ongoing, Upcoming) with filterable categories.
3. **Teams & Groups Page**: Squad recruitment, team rosters, and open slot statuses.
4. **Profile Page**: Preset avatar, in-game player ID, username, designated role/playstyle, and bio.
5. **ID Buy/Sell Marketplace Page**: Account listings, verified screenshot proofs, price badges, and direct seller contact.
6. **Rank Boosting Booking**: Service package directory with tiered options and booking inquiry flow.
7. **Leaderboard Page**: Community rankings for top-rated tournaments and trending teams.
8. **Social Media Links Page**: Official directory of owner and platform community links.
9. **About Us Page**: Mission statement, community guidelines, and owner details.
10. **Authentication Suite**: Registration, Email Verification, Login, and Password Reset.
11. **Settings Suite**: Device Management, Active Sessions, Login History, Activity Log, and Display Settings.

---

## 6. Functional Requirements

### 6.1 Home Page

1. Render the persistent global navigation bar across all screen viewports.
2. Feature a rotating hero carousel displaying 5 to 6 high-visibility announcement banners and promotional posters.
3. Showcase featured rank-boosting packages with transparent pricing, completion timeframes, and package deliverables.
4. Display a "Recent Tournaments" showcase featuring complete competition details, prize pools, and schedules.

### 6.2 Tournaments Page

1. Render the complete directory of esports tournaments.
2. Organize tournament listings into clearly segmented tabs or sections: **Past**, **Ongoing/Current**, and **Upcoming**.
3. Each tournament entry must provide full tournament metadata (dates, format, rules, registration requirements, and prize structure).

### 6.3 Teams & Groups Page

1. Authenticated users can create new team or group listings.
2. Users can submit join requests or directly join open rosters.
3. Display current member count and maximum capacity on every team card.
4. Display dynamic availability status badges (**Open to Join** vs. **Full / Closed**).

### 6.4 Profile Page

1. Profile avatar must be selectable from a curated library of high-quality preset gaming avatars (custom image uploads disabled for safety and moderation).
2. Display the player's primary in-game User ID and public in-game handle.
3. Highlight the player's competitive in-game role and playstyle (e.g., Duelist, Support, Sniper, IGL).
4. Provide an editable rich bio field for player descriptions and hardware specs.

### 6.5 ID Buy/Sell Marketplace Page

1. Sellers can create gaming account listings including title, rank, item inventory, price, and proof screenshots.
2. Clicking a marketplace card opens a comprehensive detail view displaying:
   - Seller profile summary and reputation score.
   - Full-resolution account proof screenshots.
   - Direct external contact options (WhatsApp, Discord, Telegram, or phone link).
3. Sellers retain full control over their own listings, including the ability to mark listings as **Sold** or remove them from the marketplace.
4. **Dynamic Price-Drop Badge**: If a seller lowers the price on an existing listing, the system automatically computes the discount percentage and assigns a **"Good Deal"** badge.
5. **High-Value Badge**: Premium or newly increased listing values are automatically tagged with a **"Hot"** badge.
6. Seller ratings and completed transaction feedback must be prominently displayed on the listing view.

### 6.6 Rank Boosting Booking

1. **Interactive Dual-Mode Calculator**:
   - **Fixed Tier Jump Packages (Sub-Mythic)**: Dropdown selection for standard rank promotions with baseline rates:
     - Epic → Legend: ₹400
     - Legend → Mythic: ₹300
     - Epic → Mythic (Bundle): ₹600 (includes ₹100 bundle discount)
   - **Per-Star Incremental Calculator (Mythic & Above)**: Dynamic star counter/slider for high-tier progression, applying progressive difficulty-scaled rates:
     - Mythic (0–24 Stars): ₹20 / star
     - Mythical Honor (25–49 Stars): ₹30 / star
     - Mythical Glory (50–99 Stars): ₹35 / star
     - Mythical Immortal (100+ Stars): ₹40 / star
   - Real-time quote generation factoring multi-tier bracket jumps (e.g., Mythic 10★ to Mythical Honor 30★ automatically calculates 15 stars @ ₹20 + 5 stars @ ₹30 = ₹450).
2. **Direct Booking Handoff**:
   - Generates pre-formatted direct external communication links (WhatsApp, Telegram, Discord) containing order parameters: starting rank/stars, target rank/stars, calculated price in INR (₹), and player in-game ID (IGN).
3. **Admin Rate Management**:
   - Base rates per tier jump and per-star rates are stored in the database and configurable via the Admin dashboard without requiring redeployment.

### 6.7 Leaderboard Page

1. Display a leaderboard showcasing the highest-rated tournaments based on community feedback.
2. Display a dedicated leaderboard section showcasing top-performing and most popular teams.

### 6.8 Social Media Links Page

1. Dedicated portal featuring verified external links to the platform owner's YouTube, Twitch, Discord, Twitter/X, and Instagram channels.

### 6.9 About Us Page

1. Custom About Us page highlighting platform background, community mission, and verified owner credentials.

### 6.10 Notifications

1. Centralized notification system delivering:
   - **Action Requests**: Team invitations, join requests, and marketplace inquiries.
   - **System Updates**: Tournament start alerts, schedule shifts, and listing status updates.

### 6.11 Universal Search

1. Fast universal search bar in the global navbar capable of querying tournaments, teams, user profiles, and marketplace items.
2. Search results must support faceted **Filters** (e.g., game title, price range, tournament status).
3. Search results must support multi-field **Sorting** (e.g., newest, price low-to-high, rating, member count).
4. Search results must support **Category Tags** for quick navigation.

### 6.12 Rating & Review System

1. Verified buyers can submit star ratings and textual reviews for sellers following a marketplace transaction, building a reliable trust network.

### 6.13 Theme & Interface Settings

1. Standard Dark Mode toggle.
2. Standard Light Mode toggle.
3. High-contrast **AMOLED True-Black Mode** (`#000000` base) for OLED displays.
4. Interface Density selector with three layout scales:
   - **Compact**: Tighter padding, higher data density.
   - **Comfortable**: Default balanced layout.
   - **Spacious**: Relaxed spacing and larger touch targets.
5. Password visibility toggle ("show/hide password") on all password fields.

---

## 7. UI & Design System Guidelines

The user interface adheres to the modern esports dark emerald design system, theme tokens, interface density controls, and hardware-accelerated motion rules specified in detail in [internal/design/ui.md](design/ui.md).

1. **Visual Aesthetic**: Sleek game-inspired visual identity featuring deep charcoal/obsidian surfaces, vibrant emerald (`#1FAE7A`) and teal (`#1B8F97`) accents, and subtle glow highlights (see [design/ui.md#1-visual-theme--design-tokens](design/ui.md#1-visual-theme--design-tokens)).
2. **Multi-Theme Engine**: Native runtime switching between Dark Mode, AMOLED True-Black (`#000000`), and a high-contrast Light Mode (`#F4FAF8`).
3. **Interface Densities**: User-selectable layout spacing (Compact, Comfortable, Spacious) with touch targets scaled appropriately (see [design/ui.md#3-interface-density-system](design/ui.md#3-interface-density-system)).
4. **Motion & Visual Prohibitions**: All interactions must remain snappy and hardware-accelerated. Opacity fades, frosted-glass blur filters, heavy edge glows, and frozen navigation bars are strictly prohibited (see [design/ui.md#42-prohibited-visual-effects--animations](design/ui.md#42-prohibited-visual-effects--animations)).
5. **Responsive Fluidity**: Fluid reflow across the breakpoint matrix (Mobile, Tablet, Desktop, Ultrawide) with zero horizontal overflow (see [design/ui.md#6-responsive-breakpoint-matrix](design/ui.md#6-responsive-breakpoint-matrix)).
6. **Accessibility Compliance**: Minimum 4.5:1 text contrast ratios, visible keyboard focus indicators, and OS `prefers-reduced-motion` compliance across all themes.

---

## 8. User Flows

### 8.1 Registration & Email Verification

1. User fills out registration form (Email, Password, Username).
2. System validates input and dispatches a branded verification email styled in the dark emerald theme.
3. User clicks the verification link; the account status is updated to verified and access is unlocked.

### 8.2 Login

1. User enters credentials on the Login screen.
2. User can toggle password visibility via Section 6.13 Item 5.
3. Upon authentication, a new device session record is created under Device Management.
4. An immutable timestamped event is recorded in the Login History log.

### 8.3 Password Reset

1. User initiates a password reset request via registered email.
2. System dispatches a secure, single-use, time-limited reset link.
3. User enters and confirms new password with inline strength indicators.

### 8.4 Create / Join Team or Group

1. Team captain creates squad profile specifying game title, description, and target member cap (Section 6.3 Item 1).
2. Team card appears on the recruitment board with real-time member tally and availability indicator.
3. Prospective players submit join requests, dispatching real-time notifications to team admins (Section 6.10 Item 1).

### 8.5 List an ID for Sale

1. Seller fills out listing form with game title, rank tier, price, contact method, and proof screenshots (Section 6.5 Item 1).
2. Listing is published to the marketplace with standard metadata tags.
3. If seller subsequently adjusts the price:
   - **Price Decrease**: System calculates savings and displays **"Good Deal"** badge.
   - **Price Increase / Premium**: System tags listing with **"Hot"** badge.
4. Once completed, the seller marks the item as **Sold** or deletes the listing.

### 8.6 Buy an ID / Contact Seller

1. Buyer filters or searches marketplace listings.
2. Buyer opens listing detail page to view verified proof screenshots, seller trust rating, and direct contact options (Section 6.5 Item 2).
3. Buyer reaches out directly to the seller via the provided communication channel.
4. Upon transaction completion, the buyer submits a seller review (Section 6.12 Item 1).

### 8.7 Book a Rank Boosting Package

1. User opens the Rank Boosting calculator (Section 6.6 Item 1).
2. User selects either a Tier-Jump package or inputs starting/target star values for Mythic+ progression.
3. System computes the exact price in INR (₹) and displays estimated turnaround time.
4. User enters their In-Game Name (IGN) and optional notes.
5. User clicks the preferred communication channel (WhatsApp / Telegram / Discord), which opens the app with a pre-filled, formatted booking message.
6. User and booster/admin finalize payment and schedule off-platform (see [ADR: Payment](adr/payment.md)).

### 8.8 Rate a Seller

1. Following a marketplace transaction, buyer accesses the seller review interface.
2. Buyer submits a 1-to-5 star rating and optional written review.
3. The seller's aggregate reputation score updates immediately across all public listings (Section 6.12 Item 1).

---

## 9. Authentication & Account Management

1. Enterprise-grade credential management and session handling.
2. Mandatory email verification lifecycle with themed notification templates.
3. Cryptographically secure, time-limited password recovery tokens.
4. Interactive show/hide password toggle on all authentication input fields.
5. Role-based access control distinguishing Normal Users from Platform Admins.
6. Tight integration between session authentication and the Device Management subsystem.

---

## 10. Device Management

### 10.1 Active Sessions

1. View all active authenticated sessions tied to the account.
2. Detailed session metadata: browser family, operating system, IP-derived approximate location, and last active timestamp.

### 10.2 Login History

1. Audit log tracking historical login events, timestamps, and authentication statuses.

### 10.3 Device List & Details

1. Consolidated list of authorized devices associated with account logins.
2. Drill-down modal displaying extended device specifications.

### 10.4 Remote Logout / Session Revocation

1. Instant remote revocation button enabling users to terminate any active session or all other sessions simultaneously.

---

## 11. Activity History & Privacy Controls

1. **Activity Logging**: Activity History log tracking user-initiated browsing actions (viewed tournaments, visited marketplace listings, recruitment requests).
2. **User Privacy Controls**: Full privacy control: users can pause tracking, clear their history, or set history visibility to completely private.
3. **Decoupled Architecture**: Architectural separation between Activity History (user browsing behavior) and Login History (security audit log).

---

## 12. Backend & API Requirements

*(Backend API architecture supporting client operations through RESTful endpoints with JWT session validation):*

1. **Auth Endpoints**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify-email`, `POST /api/auth/reset-password`.
2. **Session & Device Endpoints**: `GET /api/devices/sessions`, `DELETE /api/devices/sessions/:id`, `GET /api/devices/history`.
3. **Tournament Endpoints**: `GET /api/tournaments`, `GET /api/tournaments/:id`, `POST /api/tournaments` [Admin].
4. **Teams & Groups Endpoints**: `GET /api/teams`, `POST /api/teams`, `POST /api/teams/:id/join`.
5. **Profile Endpoints**: `GET /api/profile/:id`, `PUT /api/profile/me`.
6. **Marketplace Endpoints**: `GET /api/marketplace`, `POST /api/marketplace`, `PATCH /api/marketplace/:id`, `DELETE /api/marketplace/:id`.
7. **Boosting Package Endpoints**: `GET /api/boosting/packages`, `POST /api/boosting/bookings`.
8. **Leaderboard Endpoints**: `GET /api/leaderboard/tournaments`, `GET /api/leaderboard/teams`.
9. **Rating Endpoints**: `POST /api/ratings`, `GET /api/ratings/seller/:id`.
10. **Notification Endpoints**: `GET /api/notifications`, `PATCH /api/notifications/:id/read`.
11. **Universal Search Endpoint**: `GET /api/search?q=&category=&sort=&filter=`.
12. **User Activity Endpoints**: `GET /api/activity`, `PUT /api/activity/preferences`, `DELETE /api/activity`.
13. **Admin Moderation Endpoints**: `GET /api/admin/metrics`, `PATCH /api/admin/content/:id/status`.
14. **Security Middleware**: Strict middleware authorization enforcing role permissions on all state-mutating endpoints.

---

## 13. Database & Data Requirements

1. **User Entity**: `id`, `email`, `password_hash`, `role` (USER | ADMIN), `is_verified`, `avatar_preset_id`, `game_id`, `game_username`, `game_role`, `bio`, `theme_pref`, `density_pref`, `activity_privacy`.
2. **Session Entity**: `id`, `user_id`, `token_hash`, `device_info`, `ip_address`, `last_active_at`, `is_revoked`.
3. **Tournament Entity**: `id`, `title`, `description`, `game_title`, `status` (PAST | CURRENT | UPCOMING), `start_date`, `end_date`, `prize_pool`, `rating`.
4. **Team Entity**: `id`, `name`, `captain_id`, `game_title`, `max_slots`, `status` (OPEN | CLOSED), `member_ids[]`.
5. **Marketplace Listing Entity**: `id`, `seller_id`, `game_title`, `rank_tier`, `price`, `previous_price`, `screenshots[]`, `contact_info`, `status` (ACTIVE | SOLD | DELETED), `badge_tag`.
6. **Rating Entity**: `id`, `reviewer_id`, `seller_id`, `listing_id`, `rating_score`, `comment`, `created_at`.
7. **Boosting Package Entity**: `id`, `title`, `game_title`, `starting_tier`, `target_tier`, `price`, `eta_hours`, `is_active`.
8. **Notification Entity**: `id`, `recipient_id`, `type` (REQUEST | UPDATE | SYSTEM), `payload`, `is_read`, `created_at`.
9. **Activity Log Entity**: `id`, `user_id`, `action_type`, `entity_reference`, `timestamp`.
10. **Relational Integrity**: Foreign key relational integrity enforced across all parent-child associations.

---

## 14. Security & Privacy

1. Passwords hashed using industry-standard algorithms (Argon2id or bcrypt with strong work factor).
2. Mandatory email verification tokens with single-use expiry.
3. Cryptographic time-limited tokens for password resets (15-minute expiration).
4. Granular session management allowing instant termination of stale or compromised tokens.
5. Immutable audit logging for account authentication events.
6. Activity history queries must enforce user privacy preferences at the database query level.
7. Seller contact links are protected against automated scraping (accessible only via deliberate client interaction).
8. Anti-fraud review gating: rating submissions require verified buyer association.
9. Role-based access control enforced at both API gateway and controller layers.

---

## 15. Accessibility

1. Sitewide respect for `prefers-reduced-motion` operating system preferences.
2. Password visibility toggles on all password entry inputs (Section 6.13 Item 5).
3. Full compliance target of **WCAG 2.1 Level AA** standards for color contrast, keyboard focus rings, and screen-reader accessible labeling (ARIA; see [ADR: Accessibility](adr/a11y-std.md)).

---

## 16. Performance

1. Fast First Contentful Paint (FCP < 1.2s) and Largest Contentful Paint (LCP < 2.5s) on standard 4G networks.
2. Animations must not drop frames or degrade CPU/GPU efficiency (maintain 60 FPS minimum; see [internal/design/ui.md](design/ui.md#43-animation-performance-constraints)).
3. Core Web Vitals optimized: Cumulative Layout Shift (CLS < 0.1) and Interaction to Next Paint (INP < 200ms).

---

## 17. Error Handling

1. Zero unhandled exceptions or exposed server stack traces across client and API boundaries.
2. Explicit, human-readable error messages for authentication failures (e.g., invalid credentials, expired session, unverified email).
3. Inline input error states with clear correction guidance for form validation failures.
4. Resilient recovery handling for transient network disconnects.

---

## 18. Edge Cases

1. A marketplace listing is marked sold or deleted by the seller while a buyer is actively viewing it: detail page updates dynamically to reflect sold status and disables contact actions.
2. Successive rapid price changes: discount badge calculation correctly computes against the original baseline price rather than intermediate edits.
3. A team reaches capacity while a join request is in flight: system rejects the transaction gracefully and displays "Team Roster Full".
4. User toggles Activity History to private after previously having it active: prior history is immediately hidden from public queries.
5. User revokes their current active session from the Device Management dashboard: system cleanly terminates the local session and redirects to the login screen.
6. Unverified or non-buyer attempts to submit a seller rating: system blocks the request with a "Verified Purchase Required" prompt.
7. User with unverified email attempts to create a marketplace listing: system prompts with an email verification banner.
8. Reduced-motion enabled at the OS level: all animations degrade instantly to static transitions without disrupting UI function.

---

## 19. Admin Requirements

1. Explicit Admin role with elevated authentication credentials and permissions.
2. Admin Dashboard capabilities:
   - **Tournament Management**: Create, edit, schedule, and finalize tournaments across Past, Current, and Upcoming states.
   - **Marketplace Moderation**: Review reported listings, remove fraudulent items, and ban abusive seller accounts.
   - **Boosting Package Configuration**: Manage package tiers, pricing, and active status.
   - **System Metrics**: Overview of active user counts, listings volume, and system health.

---

## 20. Technical Constraints

The platform architecture and implementation must strictly adhere to the following technical and operational constraints:

1. **Frontend Architecture**: Next.js (App Router, TypeScript strict mode) leveraging Server Components and Server-Side Rendering (SSR) for search engine indexing (SEO), dynamic OpenGraph tags, and structured metadata, paired with client components for interactive features.
2. **Backend & API Architecture**: Decoupled, standalone backend service (Node/TypeScript with Fastify or Express) exposing a RESTful stateless API alongside a persistent WebSocket server for real-time tournament brackets and notifications (see [ADR: Tech Stack](adr/tech-stack.md)).
3. **Authentication & Session Tokens**: Stateless authentication utilizing cryptographically signed JSON Web Tokens (JWT) for access and secure, HTTP-only, `SameSite=Strict` cookies for refresh tokens.
4. **Browser & Platform Support**: Target modern evergreen web browsers (Chromium-based browsers, Firefox, Safari, Edge) across the last 2 major stable releases; mobile support for iOS Safari and Android Chrome.
5. **Database & Storage Architecture**: PostgreSQL for all structured relational business entities with ACID transactional guarantees; Redis cache for active session lookups and rate limiting; S3-compatible cloud object storage for user screenshot proof uploads.
6. **Network & Transport Security**: Mandatory TLS 1.3 encryption across all public and internal network communication; strict HTTPS enforcement with HSTS headers.
7. **Cross-Origin & Header Protection**: Explicit CORS origin whitelisting; enforced Content Security Policy (CSP), X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers.
8. **Rate Limiting & Abuse Prevention**: Server-side rate limiting on all public API endpoints (specifically targeting authentication routes, listing creation, and search) to prevent brute-force attacks and resource exhaustion.
9. **Asset & Performance Budgets**: Client-side production bundles must implement code-splitting and dynamic route-based lazy loading; initial compressed JavaScript bundle target under 250KB.
10. **Data Validation & Sanitization**: Strict input validation and sanitization enforced on both client and server boundaries to prevent Cross-Site Scripting (XSS), SQL injection, and payload manipulation.

---

## 21. Dependencies

1. **Transactional Email Service**: SMTP / transactional email provider (e.g., Resend, SendGrid) for verification and password reset workflows.
2. **Object Storage / CDN**: Cloud storage bucket for marketplace proof screenshots and static preset avatar assets.
3. **Real-Time Event Engine**: WebSocket or Server-Sent Events (SSE) provider for instant notifications and live tournament updates.
4. **Database & Cache**: Relational database (PostgreSQL) paired with Redis for session cache and rate limiting.

---

## 22. Acceptance Criteria

A build is considered production-ready when:

1. All functional requirements in Section 6 are fully implemented and demonstrable.
2. Authentication, email verification, and password reset flows are secure, tested, and fully functional.
3. Device Management allows real-time session tracking and remote logout.
4. Activity History logging respects user privacy settings across all database queries.
5. Marketplace supports screenshot proof uploads, dynamic "Good Deal" / "Hot" badges, seller contact links, and sold statuses.
6. Seller rating system is functional and protected against fraudulent reviews.
7. Team creation and recruitment features maintain accurate capacity limits and status indicators.
8. Rank-boosting packages are browsable and bookable.
9. Leaderboard accurately ranks top tournaments and trending teams.
10. Social Media Links and About Us pages are fully populated and link-verified.
11. Universal search operates across tournaments, teams, and marketplace listings with filters and sorting.
12. Dark, Light, and AMOLED modes persist across user sessions.
13. The application is 100% free of prohibited visual effects (no opacity fades, no frosted glass, no excessive edge-glow, no frozen navbars; see [internal/design/ui.md](design/ui.md#42-prohibited-visual-effects--animations)).
14. System respects `prefers-reduced-motion` sitewide.
15. The site is fully responsive, performs at 60 FPS, and contains zero broken links.
16. Admin role is secured and accessible only to authorized accounts.
17. Dark emerald/teal theme is implemented consistently and passes WCAG AA contrast standards.
18. Native-quality animations perform smoothly on low-end test hardware without layout thrashing.
19. Full responsive layout coverage verified across the entire breakpoint matrix with zero horizontal scroll.
