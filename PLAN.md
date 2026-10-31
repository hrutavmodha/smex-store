# SMEX Store - Implementation & Deployment Plan

---

## 1. Feature Implementation Plan (All 6 Requirements)

### Requirement 1: Past Tournaments Details ("Smex Cup") & Admin Tournament Manager

- **Files to update:**
  - `client/app/tournaments/page.tsx` (Public directory & Past tab)
  - `client/app/admin/tournaments/page.tsx` (New Admin Tournament Creator & Past Record Form)
  - `client/app/admin/page.tsx` (Add quick link & metrics for tournament management)
  - `server/src/routes/tournaments.ts` (Support creating completed/past tournaments with winner metadata)
- **Verified Smex Cup S1 Details:**
  - **Tournament:** Smex Cup Season 1 (S1)
  - **Champion / Winner:** `VO DUDU`
  - **Runner-up:** `Goon`
  - **Audience Favourite:** `Marvelous Grievous`
- **Public Display Design (`/tournaments?tab=past`):**
  - Dedicated Smex Cup Hall of Fame showcase card.
  - Gold Trophy badge highlighting Champion: **VO DUDU**
  - Silver Medal badge for Runner-up: **Goon**
  - Community Spotlight / Flame badge for Audience Favourite: **Marvelous Grievous**
  - Dynamic display for all past tournaments recorded by the admin in the database.
- **Admin Tournament Manager (`/admin/tournaments`):**
  - Clean web form for admins to create upcoming tournaments or record past tournaments directly from the browser:
    - Tournament Title
    - Status (`upcoming`, `ongoing`, `completed/past`)
    - Champion / Winner Name
    - Runner-up Name
    - Audience Favourite / MVP
    - Prize Pool & Date
    - Format & Max Teams

---

### Requirement 2: Account Listing Details
- **Files to update:**
  - `client/components/marketplace/CatalogListingGrid.tsx`
  - `client/components/marketplace/ListingDetailView.tsx`
- **Implementation:**
  - Build the flexible, Nexus-style catalog structure so it is ready to receive inventory.
  - Awaiting account data from store dealers (not only Harshu or Bishal). Listings will be populated once received.

---

### Requirement 3: Rank Boosting Details
- **Files to update:**
  - `client/app/boosting/page.tsx`
- **Implementation:**
  - Retain the interactive calculator and direct WhatsApp dispatch action.
  - Order inquiry text dispatches directly to the **SMEX Esports Team** via official WhatsApp (NOT to Harshu or Bishal personal handles).
  - Clear step-by-step customer ordering flow:
    1. Select starting rank and desired target rank.
    2. Enter in-game name (IGN).
    3. Click "Dispatch Order on WhatsApp" to connect directly with the SMEX Esports Team for scheduling and payment.
  - Zero fabricated ETAs or fake policies.

---

### Requirement 4: No Diamonds Selling (Strict Rule)

- **Constraint:** Zero diamond top-up links, buttons, CTAs, or backend routes until you explicitly instruct otherwise.
- **Status:** Verified 0 occurrences across client and server. Strictly enforced.

---

### Requirement 5: WhatsApp Channel & Harshu/Bishal Social Links

- **Files to update:**
  - `client/components/shell/Footer.tsx`
  - `client/app/page.tsx`
- **Data to integrate:**
  - **Official WhatsApp Channel:** `https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w`
  - **Harshu:**
    - Instagram: `https://www.instagram.com/harshu_moba`
    - YouTube: `https://www.youtube.com/@Harshu_moba`
  - **Bishal:**
    - Instagram: `https://www.instagram.com/bishal__moba`
    - YouTube: `https://www.youtube.com/@BishalMoba`
- **Implementation:**
  - Add YouTube SVG icon component.
  - In `Footer.tsx`: Add dedicated "Community Leads & Creators" section displaying Harshu and Bishal with direct Instagram and YouTube links, plus the official WhatsApp Channel badge.
  - In `client/app/page.tsx`: Add a high-visibility "Official Community & Creators" section highlighting Harshu, Bishal, and the WhatsApp Channel.

---

### Requirement 6: Make Account Section Like Nexus (`storenexus.in`) or Better

- **Files to update:**
  - `client/components/marketplace/CatalogListingGrid.tsx`
  - `client/components/marketplace/ListingDetailView.tsx`
  - `client/components/marketplace/SellerContactModal.tsx`
- **Verified Nexus Architecture (Extracted directly from `storenexus.in/accounts`):**
  - **Card Visuals:** AMOLED deep-black cards with glowing rank borders.
  - **Rank Dual-Badge:** Current Rank alongside Peak Rank (e.g., `Current: Epic | Peak: Mythic Glory`).
  - **Account Spec Metrics Grid:**
    - Total Skins (e.g., `258 Skins`, `407 Skins`)
    - Total Heroes (e.g., `140 Heroes`)
    - Account Level (e.g., `Lvl 74`, `Lvl 118`)
    - Winrate & Matches (e.g., `56% WR (7,000 matches)`)
    - Collection Points (e.g., `50,000 pts`, `76,225 pts`)
    - Emblems Status (e.g., `All Emblems 60 Max`)
    - Server & Binding (e.g., `Server: India | Fresh Bind Ready`)
  - **Highlight Attribute Pills:**
    - `Legend skin`
    - `Collector skin`
    - `Limited edition skin`
    - `Starlight skin`
    - `All emblems maxed`
    - `Rare frames & effects`
    - `Season rewards`
  - **Trust & Escrow Guarantee Box ("Before you buy"):**
    - 100% Escrow Protection: Funds held securely during transfer.
    - Handover Guarantee: Verified email/password change assistance.
    - 7-Day Middleman Protection backed by Harshu & Bishal.
  - **Action Controls:**
    - Clear ₹ INR pricing (e.g. `₹2,500`, `₹2,999`, `₹4,300`).
    - "View Details" lightbox modal + "Buy Now / Inquire on WhatsApp" direct action.

---

### Additional Task: Homepage Cleanup (`client/app/page.tsx`)
- Remove the 2 fake metric cards from the default route hero section:
  1. `₹2,50,000+ Prizes Awarded`
  2. `1,200+ Active Squads`
- Retain only real platform attributes (`0% Commission Direct P2P Trading` and `< 15 mins Order Handoff`).

---

## 2. Remote Server Access & Infrastructure Context

### 2.1 Server Specifications

- **Live URL:** `https://smexofficial.in`
- **Health Check Endpoint:** `https://smexofficial.in/health`
- **VPS Public IP:** `45.195.129.92`
- **SSH User:** `root`
- **SSH Port:** `22`
- **Deploy Directory:** `/opt/smex-store`
- **Hardware Specs:** 1 vCPU, 933 MB RAM + 3 GB Swap (Nginx reverse proxy + Docker containers)

### 2.2 SSH Key Details

- **Authorized Key on VPS:** Public ed25519 key installed in `/root/.ssh/authorized_keys`
- **Antigravity CLI Agent Key Path:**
  ```bash
  /home/hrutav-modha/.gemini/antigravity-cli/brain/b774054f-7953-423d-9c02-307068ce123e/scratch/deploy_key
  ```
- **Direct SSH Command:**
  ```bash
  ssh -i /home/hrutav-modha/.gemini/antigravity-cli/brain/b774054f-7953-423d-9c02-307068ce123e/scratch/deploy_key -o StrictHostKeyChecking=no root@45.195.129.92
  ```

### 2.3 Remote Directory Layout (`/opt/smex-store`)

```
/opt/smex-store/
├── docker-compose.prod.yml   # Production Compose file
├── .env                      # Production environment variables & image tags
├── nginx/
│   └── conf.d/default.conf   # Nginx proxy config (SSL, upstream, security headers)
└── data/                     # Persistent volumes (PostgreSQL, Redis, MinIO)
```

### 2.4 Running Docker Containers

- `smex-client-prod`: Next.js frontend (internal port 3000)
- `smex-server-prod`: Fastify Node.js backend (internal port 3001)
- `smex-db-prod`: PostgreSQL 16 (internal port 5432)
- `smex-redis-prod`: Redis 7 (internal port 6379)
- `smex-minio-prod`: MinIO S3 Object Storage (internal ports 9000, 9001)
- `smex-nginx-prod`: Host Nginx reverse proxy routing port 80/443 with Let's Encrypt SSL

---

## 3. Deployment Execution Rule & Procedures

> **MANDATORY DEPLOYMENT RULE:**  
> Deployment to production (`https://smexofficial.in` on VPS `45.195.129.92`) must be executed **ONLY AFTER ALL 6 REQUIREMENTS ARE FULLY COMPLETED AND LOCALLY VERIFIED**. Do not deploy prematurely.

### Option A: Automated CI/CD (GitHub Actions)

1. Commit and push changes to `main`:
   ```bash
   git add .
   git commit -m "feat: add smex cup past tournaments, creator links, and nexus account cards"
   git push origin main
   ```
2. The GitHub Actions workflow (`.github/workflows/deploy.yml`) will:
   - Build client and server Docker images on GitHub-hosted 16 GB runners.
   - Push images to GitHub Container Registry (`ghcr.io/hrutavmodha/smex-store/client:<sha>` and `server:<sha>`).
   - SSH into `45.195.129.92`.
   - Update `.env` with new image tags.
   - Run `docker compose -f docker-compose.prod.yml up -d`.
   - Reload Nginx smoothly (`nginx -s reload`).

### Option B: Direct Remote Deploy via SSH (Emergency / Fast Path)

Run directly from terminal:

```bash
SSH_KEY="/home/hrutav-modha/.gemini/antigravity-cli/brain/b774054f-7953-423d-9c02-307068ce123e/scratch/deploy_key"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no root@45.195.129.92 << 'EOF'
  cd /opt/smex-store
  docker compose -f docker-compose.prod.yml pull client server
  docker compose -f docker-compose.prod.yml up -d --no-deps client server
  docker compose -f docker-compose.prod.yml ps
  curl -fsS http://127.0.0.1:3000/api/health || curl -fsS https://smexofficial.in/health
EOF
```

### 3.1 Verification & Troubleshooting Commands

- **Check container status:**
  ```bash
  ssh -i "$SSH_KEY" root@45.195.129.92 "cd /opt/smex-store && docker compose -f docker-compose.prod.yml ps"
  ```
- **View live client logs:**
  ```bash
  ssh -i "$SSH_KEY" root@45.195.129.92 "docker logs --tail 50 smex-client-prod"
  ```
- **View live server logs:**
  ```bash
  ssh -i "$SSH_KEY" root@45.195.129.92 "docker logs --tail 50 smex-server-prod"
  ```
- **Check live public response:**
  ```bash
  curl -I https://smexofficial.in
  curl -fsS https://smexofficial.in/health
  ```
