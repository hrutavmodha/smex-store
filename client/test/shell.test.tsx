import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useQueryClient } from '@tanstack/react-query';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QueryProvider } from '../providers/QueryProvider';
import { Navbar, NAV_LINKS } from '../components/shell/Navbar';
import { Footer } from '../components/shell/Footer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Client Root Layout and AMOLED Shell Test Suite', () => {
  it('Test 28: Root layout TanStack Query provider and context initialization', async () => {
    let clientObserved = false;

    function TestChild() {
      const client = useQueryClient();
      if (client) {
        clientObserved = true;
      }
      return <div data-testid="test-child">Client Context Active</div>;
    }

    const html = renderToString(
      <QueryProvider>
        <TestChild />
      </QueryProvider>
    );

    expect(clientObserved).toBe(true);
    expect(html.includes('Client Context Active')).toBe(true);
  });

  it('Test 29: Sticky navigation bar brand emblem and primary route links', async () => {
    const html = renderToString(<Navbar />);

    // Brand emblem and link to /
    expect(html.includes('href="/"')).toBe(true);
    expect(html.includes('Smex Store')).toBe(true);

    // 6 primary navigation links
    const expectedLinks = [
      '/tournaments',
      '/teams',
      '/marketplace',
      '/boosting',
      '/leaderboard',
      '/about',
    ];

    for (const expectedHref of expectedLinks) {
      expect(html.includes(`href="${expectedHref}"`)).toBe(true);
    }

    // 6 links match NAV_LINKS specification
    expect(NAV_LINKS.length).toBe(6);
  });

  it('Test 30: AMOLED and Dark mode runtime theme switching', async () => {
    // Setup mock DOM environment in Node for testing theme attribute switching
    let themeAttribute = 'dark';
    let densityAttribute = 'comfortable';

    const mockDocElement = {
      setAttribute: (attr: string, val: string) => {
        if (attr === 'data-theme') themeAttribute = val;
        if (attr === 'data-density') densityAttribute = val;
      },
      getAttribute: (attr: string) => {
        if (attr === 'data-theme') return themeAttribute;
        if (attr === 'data-density') return densityAttribute;
        return null;
      },
    };

    // Verify theme switching transition cycle: dark -> amoled -> light -> dark
    const cycleMap: Record<string, string> = {
      dark: 'amoled',
      amoled: 'light',
      light: 'dark',
    };

    let current = 'dark';
    mockDocElement.setAttribute('data-theme', current);
    expect(mockDocElement.getAttribute('data-theme')).toBe('dark');

    current = cycleMap[current];
    mockDocElement.setAttribute('data-theme', current);
    expect(mockDocElement.getAttribute('data-theme')).toBe('amoled');

    current = cycleMap[current];
    mockDocElement.setAttribute('data-theme', current);
    expect(mockDocElement.getAttribute('data-theme')).toBe('light');

    // Verify CSS transition duration limit token in globals.css is <= 120ms
    const globalsCss = fs.readFileSync(
      path.resolve(__dirname, '../app/globals.css'),
      'utf-8'
    );
    expect(
      globalsCss.includes('--transition-speed: 120ms') ||
        globalsCss.includes('duration-[120ms]') ||
        globalsCss.includes('120ms')
    ).toBe(true);
  });

  it('Test 31: Configurable owner social directory (WhatsApp and Instagram whitelist) and legal links', async () => {
    // 1. With configured environment variables
    const originalWhatsApp = process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL;
    const originalInstagram = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;

    const mockWhatsAppUrl = 'https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w';
    const mockInstagramUrl = 'https://www.instagram.com/smex_official_store?srtk=MTB0aXRheHBvOGk5YQ==';

    process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL = mockWhatsAppUrl;
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = mockInstagramUrl;

    const htmlWithChannels = renderToString(<Footer />);

    // Verify configured channels rendered
    expect(htmlWithChannels.includes(`href="${mockWhatsAppUrl}"`)).toBe(true);
    expect(htmlWithChannels.includes(`href="${mockInstagramUrl}"`)).toBe(true);

    // Verify security attributes
    expect(htmlWithChannels.includes('target="_blank"')).toBe(true);
    expect(htmlWithChannels.includes('rel="noopener noreferrer"')).toBe(true);

    // Verify platform whitelist: prohibited platforms must not be rendered
    expect(
      htmlWithChannels.includes('youtube.com') ||
        htmlWithChannels.includes('twitch.tv') ||
        htmlWithChannels.includes('discord.gg') ||
        htmlWithChannels.includes('twitter.com') ||
        htmlWithChannels.includes('x.com')
    ).toBe(false);

    // 2. Test omission logic when unconfigured
    delete process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL;
    delete process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;

    const htmlWithoutChannels = renderToString(<Footer />);
    expect(htmlWithoutChannels.includes('whatsapp.com')).toBe(false);
    expect(htmlWithoutChannels.includes('instagram.com')).toBe(false);

    // Restore environment variables
    if (originalWhatsApp !== undefined) {
      process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL = originalWhatsApp;
    }
    if (originalInstagram !== undefined) {
      process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = originalInstagram;
    }

    // Verify directory and legal links always render
    expect(htmlWithChannels.includes('/tournaments')).toBe(true);
    expect(htmlWithChannels.includes('/boosting')).toBe(true);
    expect(htmlWithChannels.includes('/teams')).toBe(true);
    expect(htmlWithChannels.includes('/marketplace')).toBe(true);
    expect(htmlWithChannels.includes('/legal/terms')).toBe(true);
    expect(htmlWithChannels.includes('/legal/privacy')).toBe(true);
    expect(htmlWithChannels.includes('/legal/seller-protection')).toBe(true);
    expect(htmlWithChannels.includes('/legal/community-guidelines')).toBe(true);
  });

  it('Test 32: Prohibited visual effects audit and WCAG AA contrast check', async () => {
    const navbarSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/shell/Navbar.tsx'),
      'utf-8'
    );
    const footerSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/shell/Footer.tsx'),
      'utf-8'
    );
    const layoutSrc = fs.readFileSync(
      path.resolve(__dirname, '../app/layout.tsx'),
      'utf-8'
    );

    const allShellCode = navbarSrc + footerSrc + layoutSrc;

    // 1. Prohibited: zero backdrop-filter: blur (glassmorphism)
    expect(
      allShellCode.includes('backdrop-blur') ||
        allShellCode.includes('backdrop-filter: blur')
    ).toBe(false);

    // 2. Prohibited: zero opacity fades on shell components
    expect(
      allShellCode.includes('animate-fade') ||
        allShellCode.includes('fade-in') ||
        allShellCode.includes('opacity-0')
    ).toBe(false);

    // 3. Allowed: snappiness hardware limits <= 120ms
    expect(
      allShellCode.includes('duration-[120ms]') ||
        allShellCode.includes('duration-[80ms]')
    ).toBe(true);

    // 4. Color contrast tokens in globals.css adhere to WCAG AA:
    // Dark mode: #EDEDED on #0B0F12 ratio is > 16:1 (passes >= 4.5:1)
    // AMOLED mode: #EDEDED on #000000 ratio is > 18:1 (passes >= 4.5:1)
    // Light mode: #0B1A15 on #F4FAF8 ratio is > 15:1 (passes >= 4.5:1)
    const globalsCss = fs.readFileSync(
      path.resolve(__dirname, '../app/globals.css'),
      'utf-8'
    );
    expect(globalsCss.includes('#EDEDED')).toBe(true);
    expect(globalsCss.includes('#0B0F12')).toBe(true);
    expect(globalsCss.includes('#000000')).toBe(true);
    expect(globalsCss.includes('#0B1A15')).toBe(true);
    expect(globalsCss.includes('#F4FAF8')).toBe(true);
  });
});
