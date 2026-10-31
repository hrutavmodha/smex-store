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
  ArrowRight,
  Star,
  Flame,
  Award,
  ExternalLink,
} from 'lucide-react';
import { WhatsAppIcon, InstagramIcon, YouTubeIcon } from '../components/shell/SocialIcons';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 w-full bg-bg-canvas text-text-primary">
      {/* 1. Hero Section */}
      <section className="relative w-full overflow-hidden border-b border-border-subtle bg-bg-canvas px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-4 py-1.5 text-xs font-semibold text-emerald-primary mb-6 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-primary animate-pulse" />
              <span>India&apos;s Premier Mobile Esports & ID Marketplace</span>
            </div>

            {/* Main Headline */}
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-text-primary sm:text-6xl sm:leading-[1.1]">
              COMPETE. TRADE.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1B8F97] via-[#1FAE7A] to-[#22C58F]">
                DOMINATE THE ARENA.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-2xl text-base sm:text-lg text-text-secondary leading-relaxed">
              The premier competitive hub for Mobile Legends: Bang Bang. Compete in community tournaments
              for real cash prizes, trade verified gaming accounts with zero fees, and climb the ranks with pro boosters.
            </p>

            {/* CTA Action Grid */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/tournaments"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-primary px-6 py-3.5 text-sm font-bold text-black shadow-lg shadow-emerald-primary/20 transition-all duration-120 ease-out hover:bg-emerald-hover active:scale-98 cursor-pointer"
              >
                <Trophy className="h-4 w-4" />
                <span>Join Tournaments</span>
              </Link>

              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-6 py-3.5 text-sm font-bold text-text-primary transition-all duration-120 ease-out hover:border-emerald-primary/50 hover:bg-bg-surface-elevated active:scale-98 cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4 text-emerald-primary" />
                <span>Browse Marketplace</span>
              </Link>

              <Link
                href="/boosting"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-6 py-3.5 text-sm font-bold text-text-primary transition-all duration-120 ease-out hover:border-cyan-depth/50 hover:bg-bg-surface-elevated active:scale-98 cursor-pointer"
              >
                <Zap className="h-4 w-4 text-cyan-depth" />
                <span>Calculate Boost</span>
              </Link>
            </div>

            {/* Key Platform Highlights */}
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl pt-8 border-t border-border-subtle">
              <div className="flex flex-col items-center p-4 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-2xl sm:text-3xl font-black text-text-primary">0% Commission</span>
                <span className="text-xs font-semibold text-text-secondary mt-1">Direct P2P Trading</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-2xl sm:text-3xl font-black text-cyan-depth">&lt; 15 mins</span>
                <span className="text-xs font-semibold text-text-secondary mt-1">Order Handoff</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Platform Core Pillars */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-primary">
            <Gamepad2 className="h-4 w-4" />
            <span>Platform Features</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            EVERYTHING YOU NEED TO LEVEL UP
          </h2>
          <p className="text-sm text-text-secondary max-w-xl">
            Whether you are competing in high-stakes brackets, trading verified accounts, or pushing rank with top boosters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Tournaments */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-all duration-120 hover:border-emerald-primary/40 group">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-primary/15 border border-emerald-primary/30 flex items-center justify-center text-emerald-primary transition-transform duration-120 group-hover:scale-105">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">Competitive Tournaments</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Compete against top squads in structured single-elimination, double-elimination, and round-robin tournaments.
                Join live match rooms, submit scores, and earn cash prize payouts.
              </p>
              <ul className="space-y-2.5 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Real-time match room lobbies & live bracket updates</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Automated round progression and transparent standings</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Fair play roster verification with strict anti-smurf checks</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/tournaments"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-primary hover:text-emerald-hover transition-colors duration-120"
              >
                <span>View Tournament Schedule</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </article>

          {/* Card 2: Rank Boosting */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-all duration-120 hover:border-cyan-depth/40 group">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-cyan-depth/15 border border-cyan-depth/30 flex items-center justify-center text-cyan-depth transition-transform duration-120 group-hover:scale-105">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">MLBB Rank Boosting</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Reach Mythic, Mythical Honor, and Immortal with vetted pro boosters. Transparent upfront
                pricing with instant order dispatch via WhatsApp and Instagram.
              </p>
              <ul className="space-y-2.5 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Instant price calculation with tiered bundle discounts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Custom role priority (Jungle, Mid, Gold, Roam, EXP) & hero pool preferences</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Duo play options to climb side-by-side with your booster</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/boosting"
                className="inline-flex items-center gap-2 text-sm font-bold text-cyan-depth hover:text-cyan-hover transition-colors duration-120"
              >
                <span>Open Price Calculator</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </article>

          {/* Card 3: Marketplace */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-all duration-120 hover:border-emerald-primary/40 group">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-primary/15 border border-emerald-primary/30 flex items-center justify-center text-emerald-primary transition-transform duration-120 group-hover:scale-105">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">Verified Account Marketplace</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Buy and sell verified Mobile Legends gaming IDs. Inspect high-resolution screenshot proofs,
                evaluate community seller reputation, and negotiate directly.
              </p>
              <ul className="space-y-2.5 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Verified in-game screenshot proofs with full emblem & skin catalogs</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>Community seller ratings, review history, and verified badges</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
                  <span>100% zero commission: negotiate directly with sellers via WhatsApp/IG</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-primary hover:text-emerald-hover transition-colors duration-120"
              >
                <span>Explore Account Catalog</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </article>

          {/* Card 4: Squad Recruitment */}
          <article className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle transition-all duration-120 hover:border-cyan-depth/40 group">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-cyan-depth/15 border border-cyan-depth/30 flex items-center justify-center text-cyan-depth transition-transform duration-120 group-hover:scale-105">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">Squads & Team Recruitment</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Build your dream squad or find an active team looking for your exact role.
                Filter teams by competitive focus, required roles, and availability status.
              </p>
              <ul className="space-y-2.5 text-xs text-text-primary font-medium pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Filter by role opening: Jungle, Gold Lane, Mid, Roamer, or EXP</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Dedicated team profiles with roster rosters and tournament achievements</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-depth shrink-0" />
                  <span>Instant team join requests with captain review notifications</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Link
                href="/teams"
                className="inline-flex items-center gap-2 text-sm font-bold text-cyan-depth hover:text-cyan-hover transition-colors duration-120"
              >
                <span>Browse Active Squads</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section className="w-full border-t border-border-subtle bg-bg-surface/50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-primary mb-2">
              <Award className="h-4 w-4" />
              <span>Simple & Transparent</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
              HOW SMEX STORE WORKS
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Get into competitive action or start trading in three easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-bg-surface border border-border-subtle">
              <div className="h-12 w-12 rounded-full bg-emerald-primary/10 border border-emerald-primary/30 flex items-center justify-center font-black text-emerald-primary text-lg mb-4">
                1
              </div>
              <h3 className="font-bold text-base text-text-primary mb-2">Create Your Profile</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Sign up in seconds, pick your avatar preset, and enter your in-game name to participate across all tournaments and features.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-bg-surface border border-border-subtle">
              <div className="h-12 w-12 rounded-full bg-cyan-depth/10 border border-cyan-depth/30 flex items-center justify-center font-black text-cyan-depth text-lg mb-4">
                2
              </div>
              <h3 className="font-bold text-base text-text-primary mb-2">Select Your Path</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Register your squad for upcoming cash brackets, browse verified account listings, or customize your rank boosting order.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-bg-surface border border-border-subtle">
              <div className="h-12 w-12 rounded-full bg-emerald-primary/10 border border-emerald-primary/30 flex items-center justify-center font-black text-emerald-primary text-lg mb-4">
                3
              </div>
              <h3 className="font-bold text-base text-text-primary mb-2">Play, Trade & Win</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Connect directly with opponents, sellers, and boosters via our fast WhatsApp & Instagram channels. Win prizes and build your reputation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Trust & Fair Play Highlight */}
      <section className="w-full border-t border-border-subtle bg-bg-canvas px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-primary/15 text-emerald-primary shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-text-primary mb-1">Verified Proof Requirements</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                All marketplace listings undergo automated media validation and require authentic in-game screenshot proofs.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle flex items-start gap-4">
            <div className="p-3 rounded-xl bg-cyan-depth/15 text-cyan-depth shrink-0">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-text-primary mb-1">Community Reputation Ratings</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Public feedback and reputation scores allow buyers and teams to interact only with proven, reliable players.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-primary/15 text-emerald-primary shrink-0">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-text-primary mb-1">Active Match Moderation</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Tournament brackets are actively supervised with strict roster validation to ensure competitive integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Official Community & Creators */}
      <section className="w-full border-t border-border-subtle bg-bg-surface/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-primary mb-2">
              <Users className="h-4 w-4" />
              <span>Leadership & Verification</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
              OFFICIAL COMMUNITY & CREATORS
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Follow our verified community leads for official tournament announcements, bracket streams, and escrow guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* WhatsApp Channel Card */}
            <div className="flex flex-col justify-between p-6 rounded-2xl bg-bg-surface border border-[#25D366]/30 hover:border-[#25D366] transition-all duration-120 group shadow-lg">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center">
                  <WhatsAppIcon className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#25D366]">
                    Official Updates Hub
                  </span>
                  <h3 className="text-lg font-bold text-text-primary mt-1">WhatsApp Channel</h3>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Real-time alerts for tournament room lobbies, registered team matchups, new verified account drops, and booster queues.
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-border-subtle">
                <a
                  href="https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#20ba5a] text-black transition-colors"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Join WhatsApp Channel</span>
                  <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </a>
              </div>
            </div>

            {/* Harshu Card */}
            <div className="flex flex-col justify-between p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-emerald-primary/50 transition-all duration-120 group shadow-lg">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-primary/15 text-emerald-primary flex items-center justify-center font-black text-lg">
                  H
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-primary">
                    Community Lead & Creator
                  </span>
                  <h3 className="text-lg font-bold text-text-primary mt-1">Harshu</h3>
                  <span className="text-xs font-mono text-text-muted">@harshu_moba</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Official community middleman backing verified ID escrow handovers, Smex Cup tournaments, and MLBB rank pushing.
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-border-subtle flex gap-2">
                <a
                  href="https://www.instagram.com/harshu_moba"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-bg-canvas border border-border-subtle hover:border-[#E1306C] hover:text-[#E1306C] text-text-primary transition-colors"
                >
                  <InstagramIcon className="h-3.5 w-3.5" />
                  <span>Instagram</span>
                </a>
                <a
                  href="https://www.youtube.com/@Harshu_moba"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-bg-canvas border border-border-subtle hover:border-[#FF0000] hover:text-[#FF0000] text-text-primary transition-colors"
                >
                  <YouTubeIcon className="h-3.5 w-3.5" />
                  <span>YouTube</span>
                </a>
              </div>
            </div>

            {/* Bishal Card */}
            <div className="flex flex-col justify-between p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-cyan-depth/50 transition-all duration-120 group shadow-lg">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-xl bg-cyan-depth/15 text-cyan-depth flex items-center justify-center font-black text-lg">
                  B
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-depth">
                    Community Lead & Creator
                  </span>
                  <h3 className="text-lg font-bold text-text-primary mt-1">Bishal</h3>
                  <span className="text-xs font-mono text-text-muted">@bishal__moba</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Tournament host and content creator supervising fair play roster verification and 7-day buyer security.
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-border-subtle flex gap-2">
                <a
                  href="https://www.instagram.com/bishal__moba"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-bg-canvas border border-border-subtle hover:border-[#E1306C] hover:text-[#E1306C] text-text-primary transition-colors"
                >
                  <InstagramIcon className="h-3.5 w-3.5" />
                  <span>Instagram</span>
                </a>
                <a
                  href="https://www.youtube.com/@BishalMoba"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-bg-canvas border border-border-subtle hover:border-[#FF0000] hover:text-[#FF0000] text-text-primary transition-colors"
                >
                  <YouTubeIcon className="h-3.5 w-3.5" />
                  <span>YouTube</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Call To Action Footer Banner */}
      <section className="w-full border-t border-border-subtle bg-bg-surface px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-bg-surface-elevated via-bg-surface to-bg-surface-elevated border border-border-prominent shadow-xl">
          <div className="flex flex-col gap-3 max-w-2xl text-center md:text-left">
            <span className="text-xs font-bold text-emerald-primary uppercase tracking-wider">
              Start Your Competitive Journey
            </span>
            <h3 className="text-2xl sm:text-4xl font-black text-text-primary tracking-tight">
              READY TO STEP INTO THE ARENA?
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Join thousands of Mobile Legends players, tournament champions, and verified sellers on Smex Store.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 shrink-0">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-black bg-emerald-primary hover:bg-emerald-hover transition-all duration-120 active:scale-98 shadow-lg shadow-emerald-primary/20"
            >
              <span>Explore Tournaments</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-text-primary bg-bg-canvas border border-border-subtle hover:border-emerald-primary/40 transition-all duration-120 active:scale-98"
            >
              <span>View ID Catalog</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
