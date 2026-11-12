import { useAccount } from '../../cloud/account';
export function SaveStatus({compact = false}: {compact?: boolean}) {
 const { status, sync } = useAccount();
 return <aside className="qol-save-status" aria-label="Account cloud sync status">{status !== 'signedIn' ? 'Account cloud sync: signed out' : sync.state === 'syncing' ? 'Syncing account progress…' : sync.state === 'error' ? 'Account sync failed — check Settings' : 'Account cloud sync'}{status === 'signedIn' && sync.at && <small>Last successful sync: {new Date(sync.at).toLocaleString()}</small>}{!compact && <small>Active Career worlds use manual Save to cloud in Settings. GM leagues save locally.</small>}</aside>;
}
