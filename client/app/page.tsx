import Link from 'next/link';
import {
  Trophy,
  Zap,
  ShoppingBag,
  Users,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Gamepad2,
  ChevronRight,
  Lock,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 w-full bg-bg-canvas text-text-primary">
      {/* 1. Hero Section */}
      <section className="relative w-full overflow-hidden border-b border-border-subtle bg-bg-canvas px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3.5 py-1 text-xs font-semibold text-emerald-primary mb-6">
              <Sparkles className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Next-Gen Esports & Gaming Operations</span>
            </div>

            {/* Main Headline */}
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-text-primary sm:text-6xl sm:leading-[1.1]">
              COMPETITIVE ESPORTS HUB &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1B8F97] via-[#1FAE7A] to-[#22C58F]">
                VERIFIED MARKETPLACE
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-2xl text-base sm:text-lg text-text-secondary leading-relaxed">
              Zero-trust community tournaments with automated brackets, authoritative MLBB rank
              boosting calculations, verified ID trading with proof verification, and squad recruitment.
            </p>

            {/* CTA Action Grid */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/tournaments"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-primary px-6 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-primary/20 transition-all duration-120 ease-out hover:bg-emerald-hover active:scale-98 cursor-pointer"
              >
                <Trophy className="h-4 w-4" />
                <span>Browse Tournaments</span>
              </Link>

              <Link
                href="/boosting"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-6 py-3 text-sm font-bold text-text-primary transition-all duration-120 ease-out hover:border-emerald-primary/50 hover:bg-bg-surface-elevated active:scale-98 cursor-pointer"
              >
                <Zap className="h-4 w-4 text-emerald-primary" />
                <span>Calculate Boosting</span>
              </Link>

              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-6 py-3 text-sm font-bold text-text-primary transition-all duration-120 ease-out hover:border-emerald-primary/50 hover:bg-bg-surface-elevated active:scale-98 cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4 text-cyan-depth" />
                <span>ID Marketplace</span>
              </Link>
            </div>

            {/* Key Value Stat Counters */}
            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-8 w-full max-w-4xl pt-8 border-t border-border-subtle">
              <div className="flex flex-col items-center p-3 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-2xl sm:text-3xl font-black text-emerald-primary">₹0</span>
                <span className="text-xs font-medium text-text-secondary mt-1">Trading Commission</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-2xl sm:text-3xl font-black text-text-primary">100%</span>
                <span className="text-xs font-medium text-text-secondary mt-1">Proof Verified</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-2xl sm:text-3xl font-black text-cyan-depth">&lt; 15m</span>
                <span className="text-xs font-medium text-text-secondary mt-1">Order Handoff</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-2xl sm:text-3xl font-black text-text-primary">Atomic</span>
                <span className="text-xs font-medium text-text-secondary mt-1">Roster Locks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Core Pillars Grid */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-primary">
            <Gamepad2 className="h-4 w-4" />
            <span>Platform Ecosystem</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            ENGINEERED FOR SERIOUS GAMERS
          </h2>
          <p className="text-sm text-text-secondary max-w-xl">
            Built from the ground up for high-trust gaming operations, anti-cheat security, and competitive fairness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Tournaments */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-colors duration-120 hover:border-emerald-primary/40">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-primary/15 border border-emerald-primary/30 flex items-center justify-center text-emerald-primary">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">Esports Tournaments</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Single-elimination, double-elimination, and round-robin brackets. Power-of-two seed
                normalization, automated bye placement, and live duplex WebSocket score feeds.
              </p>
              <ul className="space-y-2 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Real-time match room lobbies & score submission</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Automated seed re-indexing on team withdrawals</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Fair-play zero-trust participant roster validation</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/tournaments"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-primary hover:text-emerald-hover transition-colors duration-120"
              >
                <span>View Tournament Schedule</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Card 2: Rank Boosting */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-colors duration-120 hover:border-emerald-primary/40">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-cyan-depth/15 border border-cyan-depth/30 flex items-center justify-center text-cyan-depth">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">MLBB Rank Boosting Calculator</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Dual-mode pricing model: fixed-tier packages for Sub-Mythic ranks (Epic to Legend, Legend to Mythic)
                and piecewise star-bracket rates for Mythical Glory & Immortal.
              </p>
              <ul className="space-y-2 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Live price breakdowns with configurable add-on surcharges</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Interactive star slider with bidirectional rank synchronization</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Automated WhatsApp & Instagram URI-encoded order dispatch</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/boosting"
                className="inline-flex items-center gap-2 text-sm font-bold text-cyan-depth hover:text-cyan-hover transition-colors duration-120"
              >
                <span>Open Boosting Calculator</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Card 3: Marketplace */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-colors duration-120 hover:border-emerald-primary/40">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-primary/15 border border-emerald-primary/30 flex items-center justify-center text-emerald-primary">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">Verified ID Marketplace</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Peer-to-peer game account trading with presigned direct-to-S3 uploads, binary magic-byte
                screenshot inspection, community seller ratings, and price-drop badges.
              </p>
              <ul className="space-y-2 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Binary JPEG, PNG, WebP validation against disguised executables</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Proof screenshot lightbox carousel with full verification details</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Zero in-app middleman cuts; direct buyer-to-seller negotiation</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-primary hover:text-emerald-hover transition-colors duration-120"
              >
                <span>Explore Account Catalog</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Card 4: Squad Recruitment */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-colors duration-120 hover:border-emerald-primary/40">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-cyan-depth/15 border border-cyan-depth/30 flex items-center justify-center text-cyan-depth">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">Squads & Clan Recruitment</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Atomic squad recruitment pipeline. Form rosters, assign roles (Jungle, Gold, Mid, Roam, EXP),
                and recruit competitive talent without race conditions.
              </p>
              <ul className="space-y-2 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>PostgreSQL row locks prevent exceeding squad roster limits</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>MLBB Single-Squad enforcement prevents duplicate memberships</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Dynamic slot computation with instant recruitment status badges</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/teams"
                className="inline-flex items-center gap-2 text-sm font-bold text-cyan-depth hover:text-cyan-hover transition-colors duration-120"
              >
                <span>Browse Active Squads</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* 3. Security & Architecture Banner */}
      <section className="w-full border-t border-border-subtle bg-bg-canvas px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 p-8 rounded-2xl bg-bg-surface border border-border-subtle">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-primary uppercase">
              <ShieldCheck className="h-4 w-4 text-emerald-primary" />
              <span>Zero-Trust Architecture</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-text-primary">
              Built with Modern Defense-in-Depth
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Argon2id password hashing, dual-token JWT and HTTP-only cookie sessions, Redis fast-path revocation tombstones,
              and remote multi-device session purging.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/settings/devices"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-text-primary bg-bg-surface-elevated border border-border-subtle hover:border-emerald-primary/40 transition-colors duration-120"
            >
              <Lock className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Device Security</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
