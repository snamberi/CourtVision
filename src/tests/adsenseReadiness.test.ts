import { describe, it, expect } from 'vitest';
import menuSource from '../components/MainMenu.tsx?raw';
import viteConfig from '../../vite.config.ts?raw';
import wrangler from '../../wrangler.jsonc?raw';
import notFoundPage from '../../public/404.html?raw';
import { adsAllowedOnTab, AD_CONTENT_TABS } from '../ads/adPolicy';
import { TABS } from '../navigation/routes';
import guides from '../content/guideIndex.json';

const pages = import.meta.glob('../../public/**/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('AdSense placement and site quality', () => {
  it('shows ads only on content screens, never on navigation, settings, editors or action screens', () => {
    for (const tab of AD_CONTENT_TABS) expect(TABS as readonly string[], tab).toContain(tab);
    for (const tab of ['standings', 'boxscore', 'playerStats', 'news', 'records']) expect(adsAllowedOnTab(tab), tab).toBe(true);
    for (const tab of ['settings', 'leagueSettings', 'editor', 'bulk', 'fastEdit', 'code', 'imports', 'sandbox', 'trade', 'draft', 'freeAgency', 'autoPlay', 'inbox'])
      expect(adsAllowedOnTab(tab), tab).toBe(false);
  });
  it('has no ad on the main menu, and the menu links every guide', () => {
    const menu = menuSource;
    expect(menu).not.toMatch(/<AdBanner/);
    expect(menu).toMatch(/<MenuLearn \/>/);
    expect(guides.length).toBeGreaterThanOrEqual(14);
    for (const g of guides) expect(pages[`../../public/${g.path}`], g.path).toBeTruthy();
  });
  it('lists every guide in the sitemap', () => {
    const vite = viteConfig;
    for (const g of guides) expect(vite, g.path).toContain(`'${g.path}'`);
  });
  it('serves a real, noindexed 404 page instead of the game for unknown paths', () => {
    expect(wrangler).toMatch(/"not_found_handling":\s*"404-page"/);
    const page = notFoundPage;
    expect(page).toContain('<meta name="robots" content="noindex, follow">');
    expect(page).not.toContain('rel="canonical"');
    expect(page).toContain('href="/guides/"');
  });
});

import privacy from '../legal/privacyPolicy.json';
import termsPage from '../../public/terms.html?raw';
import faqPage from '../../public/faq.html?raw';
import contactPage from '../../public/contact.html?raw';

describe('terms, age and contact', () => {
  it('publishes Terms of Use, links it and lists it in the sitemap', () => {
    expect(termsPage).toContain('<h1>Terms of Use</h1>');
    expect(termsPage).toContain('13 or older');
    expect(viteConfig).toContain("'terms.html'");
    expect(faqPage).toContain('terms.html');
    expect(menuSource).toContain('href="/terms.html"');
  });
  it('gives a support email and sets accounts at 13 and up, with no Support Shop left in the policy', () => {
    expect(privacy.contactEmail).toBe('papashvilisaba4@gmail.com');
    expect(contactPage).toContain('mailto:papashvilisaba4@gmail.com');
    const text = JSON.stringify(privacy);
    expect(text).toMatch(/13 or older to create an account/);
    expect(text).not.toMatch(/Paddle|Support Shop|No-Ads|Supporter Pass/);
  });
});
