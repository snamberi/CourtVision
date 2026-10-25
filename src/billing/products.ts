/*
 * Everything sold in the Support Shop, sold through Paddle. All of it is optional and cosmetic: the game is
 * free, and nothing here makes a team, a player, a spin or a pick any better. Each product unlocks its own icon,
 * name colour and title (the cosmetics are in profile/cosmetics.ts, with the rule { product: id }).
 *
 * Plain data with no imports, so both the game (billing.ts, cosmetics.ts) and the tests can read it.
 */

export type ProductId = 'noAds' | 'supporter' | 'bundleSupporter' | 'bundleVisionary' | 'bundleFounder' | 'bundleCustom';
export type Billing = 'monthly' | 'once';

export interface Product {
  id: ProductId;
  name: string;
  price: string;
  billing: Billing;
  /** The card's accent and glow. */
  accent: string;
  tagline: string;
  perks: string[];
  /** The title it unlocks (the Supporter Pass keeps its long-standing "Supporter" title in cosmetics.ts). */
  title: string;
  /** Pay what you want, from the price up. */
  flexible?: boolean;
}

export const PRODUCTS: Product[] = [
  { id: 'supporter', name: 'Supporter Pass', price: '$4.99', billing: 'monthly', accent: '#ff5fa2', title: 'Supporter',
    tagline: 'Keep the courts lit every month.', perks: ['No ads while it is active', 'Gold ball, blackout sneaker, gold jersey and heart icons', 'Aurora and Supporter pink name colours', 'The Supporter title'] },
  { id: 'noAds', name: 'No-Ads Pass', price: '$3.99', billing: 'monthly', accent: '#6fd3ff', title: 'Ad-Free Baller',
    tagline: 'A clean court, no banners.', perks: ['No ad banners anywhere while it is active', 'On every device you sign in on', 'Clean Court icon and Clear Sky name colour', 'The Ad-Free Baller title'] },
  { id: 'bundleSupporter', name: 'Supporter Bundle', price: '$0.99', billing: 'once', accent: '#ff9a5c', title: 'Backer',
    tagline: 'A small thank-you that goes a long way.', perks: ['Thank-You Heart icon (it bounces)', 'Warm Thanks name colour', 'The Backer title', 'Yours for good'] },
  { id: 'bundleVisionary', name: 'Visionary Supporter Bundle', price: '$2.99', billing: 'once', accent: '#b983ff', title: 'Visionary',
    tagline: 'For the ones who saw it coming.', perks: ['Vision Eye icon (it twinkles)', 'Visionary name colour, a flowing violet', 'The Visionary title', 'Yours for good'] },
  { id: 'bundleFounder', name: 'Eternal Founder Bundle', price: '$9.99', billing: 'once', accent: '#ffd166', title: 'Eternal Founder',
    tagline: 'Your name in gold, from the early days.', perks: ['Eternal Phoenix icon, burning gold', 'Eternal Gold name colour, a shimmering foil', 'The Eternal Founder title', 'Yours for good'] },
  { id: 'bundleCustom', name: 'Custom Support Bundle', price: '$0.99+', billing: 'once', accent: '#55c878', title: 'Patron', flexible: true,
    tagline: 'Pick your own amount. Every bit helps.', perks: ['Gift Box icon (it shines)', 'Kindness name colour', 'The Patron title', 'Yours for good, whatever you give'] },
];

export const productById = (id: string): Product | undefined => PRODUCTS.find(p => p.id === id);
export const BUNDLE_IDS = PRODUCTS.filter(p => p.billing === 'once').map(p => p.id);
