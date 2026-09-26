import { describe, it, expect } from 'vitest';
import policy from '../legal/privacyPolicy.json';
import { AD_CONFIG } from '../ads/adConfig';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PrivacyPolicyPage } from '../components/PrivacyPolicyPage';

const KNOWN_BLOCKS = new Set(['p', 'ul', 'table', 'contact']);
const text = JSON.stringify(policy);

describe('privacy policy content', () => {
  it('has unique section ids and only known block types', () => {
    const ids = policy.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of policy.sections) for (const b of s.blocks) expect(KNOWN_BLOCKS.has(b.type)).toBe(true);
  });

  it('has a contact section and a last-updated date', () => {
    expect(policy.sections.some((s) => s.blocks.some((b) => b.type === 'contact'))).toBe(true);
    expect(policy.lastUpdated).toMatch(/\d{4}/);
  });

  it('discloses the real storage the app uses', () => {
    for (const name of ['courtvision-saves', 'courtvision', 'ubs-autosave', 'courtvision:lastActiveSaveId']) expect(text).toContain(name);
  });

  it('discloses advertising whenever ads are configured', () => {
    if (AD_CONFIG.enabled && AD_CONFIG.adsenseClient) {
      expect(text).toContain('Google AdSense');
      expect(text).toContain('adssettings.google.com');
    }
  });

  it('describes the actual consent mechanism: the cookie categories, Global Privacy Control, and self-hosted fonts', () => {
    expect(text).toContain('Strictly necessary');
    expect(text).toContain('Global Privacy Control');
    expect(text).toContain('Cookie Settings');
    expect(text).toContain('bundled with the app');
  });

  it('only cross-references sections that exist', () => {
    const refs = [...text.matchAll(/Section (\d+)/g)].map((m) => Number(m[1]));
    for (const n of refs) expect(n).toBeLessThanOrEqual(policy.sections.length);
  });

  it('renders every section (and its links) in the in-app page', () => {
    const html = renderToString(createElement(PrivacyPolicyPage, { onClose: () => {} }));
    for (const s of policy.sections) expect(html).toContain(`id="privacy-${s.id}"`);
    expect(html).toContain('https://adssettings.google.com');
    expect(html).not.toContain('**'); // inline markup fully converted
  });
});
