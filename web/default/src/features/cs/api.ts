function getUserId(): string | null {
  try {
    if (typeof window !== 'undefined') return window.localStorage.getItem('uid')
  } catch {}
  return null
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const uid = getUserId()
  if (uid) h['New-Api-User'] = uid
  return h
}

const BASE = '/api/cs'

export async function sendMessage(content: string, targetUserId?: number, isBroadcast?: boolean): Promise<boolean> {
  const body: Record<string, unknown> = { content }
  if (targetUserId) body.target_user_id = targetUserId
  if (isBroadcast) body.is_broadcast = true
  const res = await fetch(`${BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders() },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return json.success === true
}

export async function getMessages(conversationId?: number): Promise<unknown[]> {
  const url = conversationId ? `${BASE}/messages?conversation_id=${conversationId}` : `${BASE}/messages`
  const res = await fetch(url, { headers: getHeaders(), credentials: 'include' })
  const json = await res.json()
  return json.success ? json.data : []
}

export async function getUnreadCount(): Promise<number> {
  try {
    const res = await fetch(`${BASE}/unread?_t=${Date.now()}`, { headers: getHeaders(), credentials: 'include' })
    const json = await res.json()
    return json.success ? json.data.count : 0
  } catch { return 0 }
}

export async function getConversations(): Promise<unknown[]> {
  const res = await fetch(`${BASE}/conversations`, { headers: getHeaders(), credentials: 'include' })
  const json = await res.json()
  return json.success ? json.data : []
}
