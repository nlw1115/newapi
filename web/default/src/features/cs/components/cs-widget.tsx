import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, X, Send, ChevronLeft } from 'lucide-react'
import { sendMessage, getMessages, getUnreadCount, getConversations } from '../api'
import type { CSMessage, CSConversation } from '../types'

export function CsWidget() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = (user?.role ?? 0) >= 10
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [bounce, setBounce] = useState(false)
  const [messages, setMessages] = useState<CSMessage[]>([])
  const [conversations, setConversations] = useState<CSConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminView, setAdminView] = useState<'list' | 'chat'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef(0)
  const openRef = useRef(false)

  const fetchUnread = useCallback(async () => {
    const count = await getUnreadCount()
    console.log('[CS Widget] poll: count=', count, 'prev=', prevUnreadRef.current, 'open=', openRef.current)
    if (count > prevUnreadRef.current && !openRef.current) {
      console.log('[CS Widget] trigger bounce, count=', count)
      setBounce(true)
    }
    prevUnreadRef.current = count
    setUnread(count)
  }, [])

  useEffect(() => {
    openRef.current = open
  }, [open])

  const fetchMessages = useCallback(async (convId?: number) => {
    setLoading(true)
    const data = await getMessages(convId ?? undefined)
    setMessages(data as CSMessage[])
    setLoading(false)
  }, [])

  const fetchConversations = useCallback(async () => {
    const data = await getConversations()
    setConversations(data as CSConversation[])
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 10000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchUnread])

  useEffect(() => {
    if (open && isAdmin) {
      fetchConversations()
    } else if (open) {
      fetchMessages()
    }
  }, [open, isAdmin, fetchMessages, fetchConversations])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setBounce(false)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    if (isAdmin && selectedUserId) {
      await sendMessage(content, selectedUserId)
    } else {
      await sendMessage(content)
    }
    if (isAdmin && selectedConvId) {
      await fetchMessages(selectedConvId)
      await fetchConversations()
    } else {
      await fetchMessages()
    }
  }

  const handleSelectConv = async (conv: CSConversation) => {
    setSelectedConvId(conv.id)
    setSelectedUserId(conv.user_id)
    setAdminView('chat')
    await fetchMessages(conv.id)
  }

  const handleBack = () => {
    setSelectedConvId(null)
    setSelectedUserId(null)
    setAdminView('list')
    fetchConversations()
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  if (!user) return null

  return (
    <div className='fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2'>
      {open && (
        <div className='bg-background border-border flex h-[500px] w-[380px] flex-col rounded-2xl border shadow-2xl'>
          {/* Header */}
          <div className='border-b flex items-center gap-2 p-4'>
            {isAdmin && adminView === 'chat' && (
              <Button variant='ghost' size='icon' className='size-7' onClick={handleBack}>
                <ChevronLeft className='size-4' />
              </Button>
            )}
            <MessageCircle className='text-primary size-5' />
            <span className='font-semibold text-sm'>
              {isAdmin && adminView === 'list' ? t('Customer Service') : selectedConvId ? t('Conversation') : t('Customer Service')}
            </span>
          </div>

          {/* Body */}
          <ScrollArea className='min-h-0 flex-1 overflow-y-auto p-4'>
            {isAdmin && adminView === 'list' ? (
              <div className='space-y-2'>
                {conversations.length === 0 && (
                  <p className='text-muted-foreground text-center text-sm py-8'>{t('No conversations')}</p>
                )}
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type='button'
                    className='hover:bg-accent w-full rounded-lg p-3 text-left transition-colors'
                    onClick={() => handleSelectConv(conv)}
                  >
                    <div className='flex items-center justify-between'>
                      <span className='font-medium text-sm'>{conv.user_display || conv.username || `#${conv.user_id}`}</span>
                      {conv.admin_unread_count > 0 && (
                        <span className='bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold'>{conv.admin_unread_count}</span>
                      )}
                    </div>
                    <p className='text-muted-foreground mt-1 truncate text-xs'>{conv.last_message}</p>
                    <p className='text-muted-foreground/50 mt-0.5 text-[10px]'>{formatTime(conv.last_message_at)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className='space-y-3'>
                {loading && <p className='text-muted-foreground text-center text-sm py-8'>{t('Loading...')}</p>}
                {!loading && messages.length === 0 && (
                  <p className='text-muted-foreground text-center text-sm py-8'>{t('No messages yet')}</p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex', Boolean(msg.is_admin) === isAdmin ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] rounded-2xl px-4 py-3', Boolean(msg.is_admin) === isAdmin ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm')}>
                      <div className='flex items-center justify-between gap-3 mb-1.5'>
                        <span className='text-xs font-semibold opacity-80 truncate max-w-[120px]'>
                          {msg.is_broadcast === 1 ? t('Broadcast') : (msg.username || t('User'))}
                        </span>
                      </div>
                      <p className='text-sm whitespace-pre-wrap break-words leading-relaxed'>{msg.content}</p>
                      <p className='mt-1.5 text-[10px] opacity-50 text-right'>{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          {(!isAdmin || adminView === 'chat' || selectedConvId) && (
            <div className='border-t flex items-center gap-2 p-4'>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('Type a message...')}
                className='flex-1'
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />
              <Button size='icon' className='size-9 shrink-0' onClick={handleSend} disabled={!input.trim()}>
                <Send className='size-4' />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <Button
        size='icon'
        className={cn(
          'relative size-12 rounded-full shadow-lg',
          bounce && 'animate-bounce'
        )}
        onClick={() => setOpen(!open)}
      >
        {open ? <X className='size-6' /> : <MessageCircle className='size-6' />}
        {!open && unread > 0 && (
          <span className='bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold'>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
    </div>
  )
}
