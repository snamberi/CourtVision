/**
 * True only inside the packaged Windows build (`vite build --mode desktop`, see scripts/package-windows.mjs).
 * That build is what the download button hands out, so it hides the button itself.
 */
export const IS_DESKTOP_BUILD = import.meta.env.VITE_DESKTOP_BUILD === '1';

/** Where the packaged Windows zip is served from in the web build (copied there by `npm run package:windows`). */
export const WINDOWS_DOWNLOAD_FILE = 'CourtVision-Windows.zip';
export const WINDOWS_DOWNLOAD_URL = `${import.meta.env.BASE_URL}downloads/${WINDOWS_DOWNLOAD_FILE}`;
