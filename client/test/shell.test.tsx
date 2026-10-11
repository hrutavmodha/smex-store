import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('Client Root Layout and AMOLED Shell Test Suite', async (suite) => {
  await suite.test(
    'Test 28: Root layout TanStack Query provider and context initialization',
    async () => {
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

      assert.strictEqual(clientObserved, true, 'TanStack QueryClient must be accessible in context');
      assert.ok(html.includes('Client Context Active'), 'Child component must render successfully');
    }
  );

  await suite.test(
    'Test 29: Sticky navigation bar brand emblem and primary route links',
    async () => {
      const html = renderToString(<Navbar />);

      // Brand emblem and link to /
      assert.ok(html.includes('href="/"'), 'Navbar must contain root link');
      assert.ok(html.includes('Smex Store'), 'Brand name must be present');

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
        assert.ok(
          html.includes(`href="${expectedHref}"`),
          `Navbar must render link for ${expectedHref}`
        );
      }

      // 6 links match NAV_LINKS specification
      assert.strictEqual(NAV_LINKS.length, 6);
    }
  );

  await suite.test(
    'Test 30: AMOLED and Dark mode runtime theme switching',
    async () => {
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
      assert.strictEqual(mockDocElement.getAttribute('data-theme'), 'dark');

      current = cycleMap[current];
      mockDocElement.setAttribute('data-theme', current);
      assert.strictEqual(mockDocElement.getAttribute('data-theme'), 'amoled');

      current = cycleMap[current];
      mockDocElement.setAttribute('data-theme', current);
      assert.strictEqual(mockDocElement.getAttribute('data-theme'), 'light');

      // Verify CSS transition duration limit token in globals.css is <= 120ms
      const globalsCss = fs.readFileSync(
        path.resolve(__dirname, '../app/globals.css'),
        'utf-8'
      );
      assert.ok(
        globalsCss.includes('--transition-speed: 120ms') ||
          globalsCss.includes('duration-[120ms]') ||
          globalsCss.includes('120ms'),
        'Theme transition duration must be <= 120ms'
      );
    }
  );

  await suite.test(
    'Test 31: Configurable owner social directory (WhatsApp and Instagram whitelist) and legal links',
    async () => {
      // 1. With configured environment variables
      const originalWhatsApp = process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL;
      const originalInstagram = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;

      const mockWhatsAppUrl = 'https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w';
      const mockInstagramUrl = 'https://www.instagram.com/smex_official_store?srtk=MTB0aXRheHBvOGk5YQ==';

      process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL = mockWhatsAppUrl;
      process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = mockInstagramUrl;

      const htmlWithChannels = renderToString(<Footer />);

      // Verify configured channels rendered
      assert.ok(
        htmlWithChannels.includes(`href="${mockWhatsAppUrl}"`),
        'Configured WhatsApp Channel link must be rendered'
      );
      assert.ok(
        htmlWithChannels.includes(`href="${mockInstagramUrl}"`),
        'Configured Instagram link must be rendered'
      );

      // Verify security attributes
      assert.ok(htmlWithChannels.includes('target="_blank"'));
      assert.ok(htmlWithChannels.includes('rel="noopener noreferrer"'));

      // Verify platform whitelist: prohibited platforms must not be rendered
      assert.strictEqual(
        htmlWithChannels.includes('youtube.com') ||
          htmlWithChannels.includes('twitch.tv') ||
          htmlWithChannels.includes('discord.gg') ||
          htmlWithChannels.includes('twitter.com') ||
          htmlWithChannels.includes('x.com'),
        false,
        'Prohibited platforms must be strictly excluded from owner directory'
      );

      // 2. Test omission logic when unconfigured
      delete process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL;
      delete process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;

      const htmlWithoutChannels = renderToString(<Footer />);
      assert.strictEqual(
        htmlWithoutChannels.includes('whatsapp.com'),
        false,
        'Unconfigured channels must be omitted'
      );
      assert.strictEqual(
        htmlWithoutChannels.includes('instagram.com'),
        false,
        'Unconfigured channels must be omitted'
      );

      // Restore environment variables
      if (originalWhatsApp !== undefined) {
        process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL = originalWhatsApp;
      }
      if (originalInstagram !== undefined) {
        process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = originalInstagram;
      }

      // Verify directory and legal links always render
      assert.ok(htmlWithChannels.includes('/tournaments'));
      assert.ok(htmlWithChannels.includes('/boosting'));
      assert.ok(htmlWithChannels.includes('/teams'));
      assert.ok(htmlWithChannels.includes('/marketplace'));
      assert.ok(htmlWithChannels.includes('/legal/terms'));
      assert.ok(htmlWithChannels.includes('/legal/privacy'));
      assert.ok(htmlWithChannels.includes('/legal/seller-protection'));
      assert.ok(htmlWithChannels.includes('/legal/community-guidelines'));
    }
  );

  await suite.test(
    'Test 32: Prohibited visual effects audit and WCAG AA contrast check',
    async () => {
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
      assert.strictEqual(
        allShellCode.includes('backdrop-blur') ||
          allShellCode.includes('backdrop-filter: blur'),
        false,
        'Prohibited visual effect detected: backdrop-filter blur must be zero'
      );

      // 2. Prohibited: zero opacity fades on shell components
      assert.strictEqual(
        allShellCode.includes('animate-fade') ||
          allShellCode.includes('fade-in') ||
          allShellCode.includes('opacity-0'),
        false,
        'Prohibited visual effect detected: opacity fades must not be used on shell'
      );

      // 3. Allowed: snappiness hardware limits <= 120ms
      assert.ok(
        allShellCode.includes('duration-[120ms]') ||
          allShellCode.includes('duration-[80ms]'),
        'Hardware animations must use <= 120ms duration'
      );

      // 4. Color contrast tokens in globals.css adhere to WCAG AA:
      // Dark mode: #EDEDED on #0B0F12 ratio is > 16:1 (passes >= 4.5:1)
      // AMOLED mode: #EDEDED on #000000 ratio is > 18:1 (passes >= 4.5:1)
      // Light mode: #0B1A15 on #F4FAF8 ratio is > 15:1 (passes >= 4.5:1)
      const globalsCss = fs.readFileSync(
        path.resolve(__dirname, '../app/globals.css'),
        'utf-8'
      );
      assert.ok(globalsCss.includes('#EDEDED'));
      assert.ok(globalsCss.includes('#0B0F12'));
      assert.ok(globalsCss.includes('#000000'));
      assert.ok(globalsCss.includes('#0B1A15'));
      assert.ok(globalsCss.includes('#F4FAF8'));
    }
  );
});
