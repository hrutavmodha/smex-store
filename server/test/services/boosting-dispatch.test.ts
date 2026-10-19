import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  generateOrderRef,
  formatOrderMessage,
  resolveWhatsAppHandoff,
  resolveInstagramHandoff,
} from '@smex/shared';

describe('External Communication Link Dispatcher Suite (LLT 2.5)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('Test 19: WhatsApp channel handoff URL resolution and clipboard copy', () => {
    const channelUrl = 'https://whatsapp.com/channel/test-channel-smex';
    process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL = channelUrl;
    delete process.env.NEXT_PUBLIC_BOOSTING_WHATSAPP_PHONE;

    const input = {
      orderRef: 'BST-202610-001',
      customerIgn: 'ViperMLBB',
      startingRank: 'Mythic',
      targetRank: 'Mythical Honor',
      startingStars: 10,
      targetStars: 30,
      pricingMode: 'per_star',
      totalPriceInr: 450,
    };

    const handoff = resolveWhatsAppHandoff(input);

    assert.equal(handoff.destinationUrl, channelUrl);
    assert.equal(handoff.isDirectPhone, false);
    assert.ok(handoff.formattedText.includes('[SMEX STORE BOOSTING ORDER]'));
    assert.ok(handoff.formattedText.includes('Order Ref: #BST-202610-001'));
    assert.ok(handoff.formattedText.includes('Calculated Price: ₹450.00 INR'));
  });

  it('Test 20: Direct WhatsApp phone URI intent construction (optional override)', () => {
    const directPhone = '15550100100';
    process.env.NEXT_PUBLIC_BOOSTING_WHATSAPP_PHONE = directPhone;

    const input = {
      orderRef: 'BST-202610-001',
      customerIgn: 'ViperMLBB',
      startingRank: 'Mythic',
      targetRank: 'Mythical Honor',
      startingStars: 10,
      targetStars: 30,
      pricingMode: 'per_star',
      totalPriceInr: 450,
    };

    const handoff = resolveWhatsAppHandoff(input);

    assert.equal(handoff.isDirectPhone, true);
    assert.ok(handoff.destinationUrl.startsWith(`https://wa.me/${directPhone}?text=`));
    assert.ok(handoff.destinationUrl.includes('%0A'));
    assert.ok(handoff.destinationUrl.includes(encodeURIComponent('BST-202610-001')));
  });

  it('Test 21: Instagram handoff clipboard payload and redirect URL', () => {
    const instagramUrl = 'https://www.instagram.com/smex_official_store_test';
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = instagramUrl;

    const input = {
      orderRef: 'BST-202610-001',
      customerIgn: 'ViperMLBB',
      startingRank: 'Mythic',
      targetRank: 'Mythical Honor',
      startingStars: 10,
      targetStars: 30,
      totalPriceInr: 450,
    };

    const handoff = resolveInstagramHandoff(input);

    assert.equal(handoff.destinationUrl, instagramUrl);
    assert.ok(handoff.formattedText.includes('[SMEX STORE BOOSTING ORDER]'));
    assert.ok(handoff.formattedText.includes('Customer IGN: ViperMLBB'));
    assert.ok(handoff.formattedText.includes('Calculated Price: ₹450.00 INR'));
  });

  it('Test 22: Order reference ID formatting structure', () => {
    const fixedDate = new Date('2026-10-16T12:00:00Z');
    const orderRef = generateOrderRef(fixedDate, 7492);

    assert.match(orderRef, /^BST-[0-9]{6}-[0-9]{4}$/);
    assert.equal(orderRef, 'BST-202610-7492');

    // Random ref test
    const randomRef = generateOrderRef(fixedDate);
    assert.match(randomRef, /^BST-[0-9]{6}-[0-9]{4}$/);
  });
});
