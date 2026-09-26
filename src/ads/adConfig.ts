/**
 * Advertising setup - the one file to edit.
 *
 * Every banner on screen is drawn from here. Two ways to fill a slot, used in this order:
 *
 *  1. A Google AdSense unit: set `adsenseClient` (your "ca-pub-..." publisher id) and the slot id for
 *     that placement under `adsenseSlots`. Network ads load only in the web build and only while online.
 *  2. Direct sponsors: the `sponsors` list below. Each entry is either an image creative (`imageSrc`)
 *     or a text creative (`headline` + `body`). Two or more entries rotate automatically.
 *
 * Ads on the web version only load after the visitor allows Advertising in the cookie banner (see src/consent).
 * Placeholder sponsors (marked `placeholder: true`) are never shown in a production build, so a published site
 * shows real ads or nothing - never "your ad here" filler.
 */

export type AdSlot = 'top' | 'inline' | 'menu';

export interface Sponsor {
  id: string;
  /** Filler shown only while developing (`npm run dev`); hidden in production builds. Remove this flag on a real sponsor. */
  placeholder?: boolean;
  /** Where the banner links. Leave empty for a non-clickable placeholder. */
  href?: string;
  /** Image creative (URL or data URI). When set, headline/body/cta are ignored. Recommended 728x90. */
  imageSrc?: string;
  /** Text shown for accessibility on image creatives. */
  alt?: string;
  headline?: string;
  body?: string;
  cta?: string;
}

export interface AdConfig {
  enabled: boolean;
  /** AdSense publisher id, e.g. 'ca-pub-1234567890123456'. Empty = don't use AdSense. */
  adsenseClient: string;
  /** AdSense ad-unit id for each placement, e.g. { top: '1234567890' }. A slot with no id falls back to sponsors. */
  adsenseSlots: Partial<Record<AdSlot, string>>;
  /**
   * Set to true once you have published a consent message in AdSense > Privacy & messaging (Google's certified
   * consent tool, required for ads to serve in the EEA/UK/Switzerland). Google's message then replaces the built-in
   * cookie banner, and Google itself withholds ads until the visitor has answered. Leave false to use the built-in banner.
   */
  googleCmp: boolean;
  /** Milliseconds between creatives when a slot has more than one sponsor. */
  rotateEveryMs: number;
  sponsors: Sponsor[];
}

export const AD_CONFIG: AdConfig = {
  enabled: true,
  adsenseClient: 'ca-pub-4282337217431581',
  adsenseSlots: { top: '2123231841', inline: '3516204563', menu: '7672353250' },
  googleCmp: false,
  rotateEveryMs: 12_000,
  sponsors: [
    {
      id: 'placeholder-a',
      placeholder: true,
      headline: 'Your ad here',
      body: 'Reach basketball sim fans with a banner on CourtVision.',
      cta: 'Advertise with us',
    },
    {
      id: 'placeholder-b',
      placeholder: true,
      headline: 'Sponsor this space',
      body: 'A courtside spot for your brand. Reach fans building their next dynasty.',
      cta: 'Learn more',
    },
  ],
};
