/** Deliberate allowlist: no storage values, account IDs, URLs, tokens, or raw error messages. */
export function diagnosticReport(input: {build: string; signedIn: boolean; syncState: string; online: boolean; localStorageAvailable: boolean}) {
 return { format: 1, generatedAt: new Date().toISOString(), build: input.build, signedIn: input.signedIn, syncState: input.syncState, online: input.online, localStorageAvailable: input.localStorageAvailable, indexedDBAvailable: typeof indexedDB !== 'undefined', serviceWorkerAvailable: typeof navigator !== 'undefined' && 'serviceWorker' in navigator };
}
