'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export const SOCIAL_LINKS = [
  {
    name: 'YouTube',
    href: 'https://youtube.com/@smexstore',
    icon: YouTubeIcon,
    label: 'Visit our official YouTube channel',
  },
  {
    name: 'Twitch',
    href: 'https://twitch.tv/smexstore',
    icon: TwitchIcon,
    label: 'Watch live broadcasts on Twitch',
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/smexstore',
    icon: DiscordIcon,
    label: 'Join our official Discord community',
  },
  {
    name: 'Twitter/X',
    href: 'https://x.com/smexstore',
    icon: TwitterIcon,
    label: 'Follow our official Twitter/X announcements',
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/smexstore',
    icon: InstagramIcon,
    label: 'Follow us on Instagram',
  },
] as const;

export function Footer() {
  return (
    <footer className="w-full border-t border-border-subtle bg-bg-surface text-text-secondary transition-colors duration-[120ms]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* 4-column balanced grid on desktop, single column on mobile */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 text-text-primary no-underline">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-primary text-black font-black text-base shadow-sm">
                S
              </div>
              <span className="font-extrabold tracking-wider text-base uppercase leading-none text-text-primary">
                Smex Store
              </span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              The premier zero-trust esports platform for MLBB rank boosting, verified gaming ID
              trading, competitive tournament brackets, and squad recruitment.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-primary font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Verified Direct-to-Storage Escrow</span>
            </div>
          </div>

          {/* Column 2: Platform Directory */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Platform Directory
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/tournaments"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  Esports Tournaments
                </Link>
              </li>
              <li>
                <Link
                  href="/boosting"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  MLBB Boosting Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/teams"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  Squad & Team Recruitment
                </Link>
              </li>
              <li>
                <Link
                  href="/marketplace"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  ID Trading Marketplace
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Governance */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Legal & Trust
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/legal/terms"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/privacy"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/seller-protection"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  Seller Protection Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/community-guidelines"
                  className="hover:text-emerald-primary transition-colors duration-[120ms]"
                >
                  Community Guidelines
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Verified Social Directory */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Official Channels
            </h3>
            <p className="text-xs text-text-muted">
              Connect with verified Smex Store administrators across our official community hubs:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {SOCIAL_LINKS.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-canvas text-text-secondary hover:border-emerald-primary hover:text-emerald-primary transition-colors duration-[120ms]"
                  >
                    <IconComponent className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="mt-12 border-t border-border-subtle pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>© 2026 Smex Store. All rights reserved.</p>
          <p>
            Engineered with zero-trust security and 120ms hardware acceleration.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
