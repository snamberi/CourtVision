/** Path of the static, crawlable copy of this same policy (generated from the same JSON at build time). */
export const PRIVACY_STATIC_PATH = 'privacy.html';
/** Hash route that opens the in-app policy page from anywhere: `<a href="#/privacy">`. */
export const PRIVACY_HASH = '#/privacy';

/** The footer link to the in-app policy (the policy text itself loads only when it is opened). */
export function PrivacyLink({ className }: { className?: string }) {
  return <a className={className ?? 'legal-link'} href={PRIVACY_HASH}>Privacy Policy</a>;
}
