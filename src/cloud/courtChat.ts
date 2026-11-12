import { supa } from './account';
export interface ChatMessage { id: number; username: string; body: string; created_at: string }
export async function chatSnapshot(): Promise<{ messages: ChatMessage[]; online: number }> {
  const c = await supa();
  const { error: pulse } = await c.rpc('courtchat_presence'); if (pulse) throw new Error(pulse.message);
  const { data, error } = await c.rpc('courtchat_read'); if (error) throw new Error(error.message);
  return data as { messages: ChatMessage[]; online: number };
}
export async function chatSend(body: string) {
  const c = await supa(); const { error } = await c.rpc('courtchat_send', { message: body });
  if (error) throw new Error(error.message);
}
