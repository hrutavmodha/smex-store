'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { WhatsAppIcon, InstagramIcon, YouTubeIcon } from './SocialIcons';

export interface OwnerSocialChannel {
  id: 'whatsapp' | 'instagram';
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export function getOwnerSocialChannels(): OwnerSocialChannel[] {
  const channels: OwnerSocialChannel[] = [];

  const whatsappUrl = process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL?.trim();
  if (whatsappUrl) {
    channels.push({
      id: 'whatsapp',
      name: 'WhatsApp Channel',
      href: whatsappUrl,
      icon: WhatsAppIcon,
      label: 'Join our official WhatsApp Channel',
    });
  }

  const instagramUrl = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM?.trim();
  if (instagramUrl) {
    channels.push({
      id: 'instagram',
      name: 'Instagram',
      href: instagramUrl,
      icon: InstagramIcon,
      label: 'Follow our official Instagram page',
    });
  }

  return channels;
}

export function Footer() {
  const socialChannels = getOwnerSocialChannels();

  return (
    <footer className="w-full border-t border-border-subtle bg-bg-surface text-text-secondary transition-colors duration-[120ms]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* 4-column balanced grid on desktop, single column on mobile */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 text-text-primary no-underline">
              <Image
                src="/logo.png"
                alt="Smex Store Logo"
                width={60}
                height={32}
                className="h-8 w-auto object-contain"
              />
              <span className="font-extrabold tracking-wider text-base uppercase leading-none text-text-primary">
                Smex Store
              </span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              The premier zero-trust esports platform for MLBB rank boosting, verified gaming ID
              trading, competitive tournament brackets, and squad recruitment.
            </p>
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

          {/* Column 4: Creators & Official Channels */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Official Channels
              </h3>
              <a
                href="https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 text-xs font-bold transition-colors duration-[120ms] w-full"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0" />
                <span>Join Official WhatsApp Channel</span>
              </a>
              {socialChannels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1" data-testid="owner-social-directory">
                  {socialChannels.map((social) => {
                    const IconComponent = social.icon;
                    return (
                      <a
                        key={social.id}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-canvas text-text-secondary hover:border-emerald-primary hover:text-emerald-primary transition-colors duration-[120ms]"
                      >
                        <IconComponent className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Creators & Promoters */}
            <div className="space-y-2.5 pt-2 border-t border-border-subtle/70">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Creators & Promoters
              </h3>
              <div className="space-y-2">
                {/* Harshu */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-bg-canvas border border-border-subtle">
                  <span className="text-xs font-bold text-text-primary">Harshu</span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href="https://www.instagram.com/harshu_moba"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Harshu on Instagram"
                      className="p-1.5 rounded text-text-muted hover:text-[#E1306C] hover:bg-bg-surface-elevated transition-colors duration-[120ms]"
                    >
                      <InstagramIcon className="h-4 w-4" />
                    </a>
                    <a
                      href="https://www.youtube.com/@Harshu_moba"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Harshu on YouTube"
                      className="p-1.5 rounded text-text-muted hover:text-[#FF0000] hover:bg-bg-surface-elevated transition-colors duration-[120ms]"
                    >
                      <YouTubeIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Bishal */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-bg-canvas border border-border-subtle">
                  <span className="text-xs font-bold text-text-primary">Bishal</span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href="https://www.instagram.com/bishal__moba"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Bishal on Instagram"
                      className="p-1.5 rounded text-text-muted hover:text-[#E1306C] hover:bg-bg-surface-elevated transition-colors duration-[120ms]"
                    >
                      <InstagramIcon className="h-4 w-4" />
                    </a>
                    <a
                      href="https://www.youtube.com/@BishalMoba"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Bishal on YouTube"
                      className="p-1.5 rounded text-text-muted hover:text-[#FF0000] hover:bg-bg-surface-elevated transition-colors duration-[120ms]"
                    >
                      <YouTubeIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
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
