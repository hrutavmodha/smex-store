'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
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

          {/* Column 4: Verified Social Directory (Dynamic resolution, WhatsApp & Instagram whitelist only) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Official Channels
            </h3>
            <p className="text-xs text-text-muted">
              Connect with verified Smex Store administrators across our official community hubs:
            </p>
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
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-canvas text-text-secondary hover:border-emerald-primary hover:text-emerald-primary transition-colors duration-[120ms]"
                    >
                      <IconComponent className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            )}
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
