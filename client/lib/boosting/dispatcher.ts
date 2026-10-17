import {
  type BoostingDispatchConfig,
  type BoostingOrderDispatchInput,
} from '@smex/shared';

export function getDispatchConfig(): BoostingDispatchConfig {
  return {
    whatsappChannelUrl: process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL || '',
    instagramUrl: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || '',
    whatsappDirectPhone: process.env.NEXT_PUBLIC_BOOSTING_WHATSAPP_PHONE,
  };
}

export function generateOrderRef(date: Date = new Date(), sequenceOrRandom?: number): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const seq =
    sequenceOrRandom !== undefined
      ? String(sequenceOrRandom).padStart(4, '0')
      : String(Math.floor(1000 + Math.random() * 9000));
  return `BST-${yyyy}${mm}-${seq}`;
}

export function formatOrderMessage(input: BoostingOrderDispatchInput): string {
  const serverIdText = input.serverId ? input.serverId : 'N/A';
  const startStars = input.startingStars ?? 0;
  const targetStars = input.targetStars ?? 0;

  const addonParts: string[] = [];
  if (input.addons?.rolePriority) {
    addonParts.push(`Role: ${input.addons.rolePriority}`);
  }
  if (input.addons?.restrictedHeroPool && input.addons.restrictedHeroPool.length > 0) {
    addonParts.push(`Hero Pool: ${input.addons.restrictedHeroPool.join(', ')}`);
  }
  if (input.addons?.duoPlayWithBooster) {
    addonParts.push('Duo Play');
  }
  const addonsSummary = addonParts.length > 0 ? addonParts.join(' | ') : 'None';

  let modeLabel = input.pricingMode || 'Fixed Tier';
  if (modeLabel === 'fixed_tier') modeLabel = 'Fixed Tier';
  else if (modeLabel === 'per_star') modeLabel = 'Per-Star Ladder';
  else if (modeLabel === 'composite') modeLabel = 'Composite Progression';

  const priceFormatted = Number(input.totalPriceInr).toFixed(2);

  return [
    `[SMEX STORE BOOSTING ORDER]`,
    `• Order Ref: #${input.orderRef}`,
    `• Customer IGN: ${input.customerIgn} (Server: ${serverIdText})`,
    `• Game: Mobile Legends: Bang Bang`,
    `• Progression: ${input.startingRank} (${startStars}★) ➔ ${input.targetRank} (${targetStars}★)`,
    `• Pricing Mode: ${modeLabel}`,
    `• Add-ons: ${addonsSummary}`,
    `• Calculated Price: ₹${priceFormatted} INR`,
    `----------------------------------------`,
    `Please confirm booster availability and payment details.`,
  ].join('\n');
}

export function resolveWhatsAppHandoff(
  input: BoostingOrderDispatchInput,
  config?: Partial<BoostingDispatchConfig>
): { destinationUrl: string; formattedText: string; isDirectPhone: boolean } {
  const activeConfig = { ...getDispatchConfig(), ...config };
  const formattedText = formatOrderMessage(input);

  if (activeConfig.whatsappDirectPhone) {
    const directUrl = `https://wa.me/${activeConfig.whatsappDirectPhone}?text=${encodeURIComponent(formattedText)}`;
    return {
      destinationUrl: directUrl,
      formattedText,
      isDirectPhone: true,
    };
  }

  return {
    destinationUrl: activeConfig.whatsappChannelUrl,
    formattedText,
    isDirectPhone: false,
  };
}

export function resolveInstagramHandoff(
  input: BoostingOrderDispatchInput,
  config?: Partial<BoostingDispatchConfig>
): { destinationUrl: string; formattedText: string } {
  const activeConfig = { ...getDispatchConfig(), ...config };
  const formattedText = formatOrderMessage(input);

  return {
    destinationUrl: activeConfig.instagramUrl,
    formattedText,
  };
}
