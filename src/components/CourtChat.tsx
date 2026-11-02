import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../cloud/account';
import { chatSnapshot, chatSend, type ChatMessage } from '../cloud/courtChat';
import { openSignIn } from '../cloud/signIn';
export function CourtChat({ onClose }: { onClose: () => void }) {
  const account = useAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]), [online, setOnline] = useState<number | null>(null);
  const [body, setBody] = useState(''), [error, setError] = useState(''), [sending, setSending] = useState(false);
  useEffect(() => {
    if (account.status !== 'signedIn') return;
    let live = true, busy = false;
    const refresh = async () => { if (busy || document.hidden) return; busy = true; try { const snapshot = await chatSnapshot(); if (live) { setMessages(snapshot.messages); setOnline(snapshot.online); setError(''); } } catch (e) { if (live) setError(e instanceof Error ? e.message : 'Chat unavailable.'); } finally { busy = false; } };
    void refresh(); const timer = setInterval(() => void refresh(), 15000);
    return () => { live = false; clearInterval(timer); };
  }, [account.status]);
  return <section className="courtchat" aria-label="CourtChat"><header><strong>CourtChat</strong><button onClick={onClose} aria-label="Close CourtChat">×</button></header><small>{online === null ? 'Global chat' : `${online} online in CourtChat`}</small>
    {!cloudEnabled ? <p>Chat is unavailable in this build.</p> : account.status !== 'signedIn' ? <button onClick={openSignIn}>Sign in to chat</button> : <>
      <div className="courtchat-messages" role="log" aria-label="Messages">{messages.map(m => <p key={m.id}><b>@{m.username}</b> <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><br />{m.body}</p>)}{!messages.length && <p>No recent messages.</p>}</div>
      <form onSubmit={async e => { e.preventDefault(); if (sending || !body.trim()) return; setSending(true); try { await chatSend(body.trim()); setBody(''); const snapshot = await chatSnapshot(); setMessages(snapshot.messages); setOnline(snapshot.online); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Message failed.'); } finally { setSending(false); } }}><label htmlFor="courtchat-message">Message</label><textarea id="courtchat-message" maxLength={400} value={body} onChange={e => setBody(e.target.value)} /><button disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send'}</button></form>
    </>}<p role="status">{error}</p><small>Public messages. Keep personal information private.</small></section>;
}
