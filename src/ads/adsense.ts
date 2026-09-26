/** Loading/unloading of the Google AdSense script. Only ever called after the visitor has allowed advertising (see consent/consent.ts). */

export const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

let loading: Promise<boolean> | null = null;
let cancelLoading: (() => void) | null = null;
export function loadAdsenseScript(client: string): Promise<boolean> {
  if (loading) return loading;
  const existing = document.querySelector<HTMLScriptElement>(`script[src^="${ADSENSE_SRC}"]`);
  if (existing && (existing.dataset.loaded === 'true' || window.adsbygoogle?.loaded === true)) {
    return Promise.resolve(true);
  }
  const script = existing ?? document.createElement('script');
  let resolveLoad!: (ok: boolean) => void;
  loading = new Promise<boolean>(resolve => { resolveLoad = resolve; });
  const pending = loading;
  let settled = false;
  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    script.removeEventListener('load', onLoad);
    script.removeEventListener('error', onError);
    cancelLoading = null;
    if (ok) script.dataset.loaded = 'true';
    else { script.remove(); loading = null; }
    resolveLoad(ok);
  };
  const onLoad = () => finish(true);
  const onError = () => finish(false);
  // Bound only the script download. An accepted ad request may take longer to fill.
  const timeout = window.setTimeout(() => finish(window.adsbygoogle?.loaded === true), 30000);
  cancelLoading = () => finish(false);
  script.addEventListener('load', onLoad);
  script.addEventListener('error', onError);
  if (!existing) {
    script.async = true; script.crossOrigin = 'anonymous';
    script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }
  return pending;
}

/** React removes its ad units when consent changes. Settle cancelled downloads as well. */
export function unloadAdsense(): void {
  cancelLoading?.();
  document.querySelectorAll(`script[src^="${ADSENSE_SRC}"]`).forEach((el) => el.remove());
  loading = null;
}

// ---- Google's own certified consent tool (optional; see AD_CONFIG.googleCmp) ----

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { loaded?: boolean };
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

/** Loads Google's "Privacy & messaging" (Funding Choices) consent message for the given AdSense client id. */
export function loadGoogleConsentTool(adsenseClient: string): void {
  const pubId = adsenseClient.replace(/^ca-/, '');
  const src = `https://fundingchoicesmessages.google.com/i/${pubId}?ers=1`;
  if (!document.querySelector(`script[src="${src}"]`)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }
  // Google's documented signal that the tool is present on the page.
  if (!window.frames['googlefcPresent' as unknown as number]) {
    const iframe = document.createElement('iframe');
    iframe.name = 'googlefcPresent';
    iframe.style.cssText = 'width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none';
    document.body.appendChild(iframe);
  }
}

/** Re-opens Google's consent choices (the "Privacy & cookie settings" entry point). */
export function showGoogleConsentChoices(): void {
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push(() => window.googlefc?.showRevocationMessage?.());
}
