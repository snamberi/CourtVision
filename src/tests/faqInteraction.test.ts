// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import html from '../../public/faq.html?raw';
import script from '../../public/faq.js?raw';

beforeEach(() => {
  document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
  HTMLElement.prototype.scrollIntoView = () => {};
  history.replaceState(null, '', '/faq.html');
});

function page(hash = '') {
  history.replaceState(null, '', `/faq.html${hash}`);
  window.eval(script);
  return { window };
}

describe('FAQ progressive enhancement', () => {
  it('keeps every answer and native accordion available without JavaScript', () => {
    const doc = document;
    expect(doc.querySelectorAll('details').length).toBeGreaterThan(30);
    expect(doc.querySelectorAll('details summary').length).toBe(doc.querySelectorAll('details').length);
    expect(doc.querySelector('.faq-tools')?.hasAttribute('hidden')).toBe(true);
    expect(doc.querySelectorAll('.faq-item[hidden]').length).toBe(0);
    const schema = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(schema['@graph'][0].mainEntity.length).toBe(doc.querySelectorAll('details').length);
  });

  it('filters answer text, reports zero results, and restores state on clear', () => {
    const dom = page(); const doc = dom.window.document;
    const input = doc.querySelector<HTMLInputElement>('#faq-search')!;
    const first = doc.querySelector<HTMLDetailsElement>('details')!; first.open = true;
    const search = (value: string) => { input.value = value; input.dispatchEvent(new dom.window.Event('input')); };
    search('restore point');
    expect(doc.querySelectorAll('.faq-item:not([hidden])').length).toBeGreaterThan(0);
    expect(doc.querySelectorAll('.faq-item:not([hidden]):not([open])').length).toBe(0);
    search('no-such-answer-xyz');
    expect(doc.querySelector('#faq-empty')?.hasAttribute('hidden')).toBe(false);
    expect(doc.querySelector('#faq-count')?.textContent).toMatch(/^0 of /);
    doc.querySelector<HTMLButtonElement>('#faq-clear')!.click();
    expect(doc.querySelectorAll('.faq-item[hidden]').length).toBe(0);
    expect(first.open).toBe(true);
    expect(doc.activeElement).toBe(input);
  });

  it('opens existing question anchors and reveals a topic hidden by search', () => {
    const dom = page('#where-are-my-saves-can-i-lose-them'); const doc = dom.window.document;
    expect(doc.querySelector<HTMLDetailsElement>('#where-are-my-saves-can-i-lose-them')!.open).toBe(true);
    const input = doc.querySelector<HTMLInputElement>('#faq-search')!;
    input.value = 'no-such-answer'; input.dispatchEvent(new dom.window.Event('input'));
    doc.querySelector<HTMLAnchorElement>('a[href="#topic-game-modes"]')!.click();
    expect(doc.querySelectorAll('.faq-category[hidden]').length).toBe(0);
  });
});
