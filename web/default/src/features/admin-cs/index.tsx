import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageCircle,
  Send,
  RefreshCw,
  Megaphone,
  Users,
  ChevronLeft,
} from 'lucide-react'
import { sendMessage, getMessages, getConversations } from '@/features/cs/api'
import type { CSMessage, CSConversation } from '@/features/cs/types'

export function AdminCsPage() {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<CSConversation[]>([])
  const [messages, setMessages] = useState<CSMessage[]>([])
  const [selectedConv, setSelectedConv] = useState<CSConversation | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    const data = await getConversations()
    setConversations(data as CSConversation[])
  }, [])

  const fetchMessages = useCallback(async (convId?: number) => {
    setLoading(true)
    const data = await getMessages(convId ?? undefined)
    setMessages(data as CSMessage[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectConv = async (conv: CSConversation) => {
    setSelectedConv(conv)
    await fetchMessages(conv.id)
  }

  const handleSend = async () => {
    if (!input.trim() || !selectedConv) return
    const content = input.trim()
    setInput('')
    await sendMessage(content, selectedConv.user_id)
    await fetchMessages(selectedConv.id)
    await fetchConversations()
  }

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return
    setSendingBroadcast(true)
    await sendMessage(broadcastText.trim(), undefined, true)
    setBroadcastText('')
    setBroadcastOpen(false)
    setSendingBroadcast(false)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b flex items-center justify-between px-6 py-4'>
        <div className='flex items-center gap-3'>
          <MessageCircle className='text-primary size-6' />
          <h1 className='text-xl font-bold'>{t('Customer Service')}</h1>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={fetchConversations}>
            <RefreshCw className='mr-1.5 size-3.5' />
            {t('Refresh')}
          </Button>
          <Button size='sm' onClick={() => setBroadcastOpen(true)}>
            <Megaphone className='mr-1.5 size-3.5' />
            {t('Broadcast')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className='flex min-h-0 flex-1'>
        {/* Conversation list */}
        <div className='border-r flex w-80 shrink-0 flex-col'>
          <div className='border-b text-muted-foreground flex items-center gap-2 px-4 py-3 text-xs font-medium'>
            <Users className='size-3.5' />
            <span>{t('Conversations')} ({conversations.length})</span>
          </div>
          <ScrollArea className='min-h-0 flex-1 overflow-y-auto'>
            {conversations.length === 0 && (
              <p className='text-muted-foreground p-8 text-center text-sm'>{t('No conversations')}</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type='button'
                className={cn(
                  'hover:bg-accent w-full border-b p-4 text-left transition-colors',
                  selectedConv?.id === conv.id && 'bg-accent'
                )}
                onClick={() => handleSelectConv(conv)}
              >
                <div className='flex items-center justify-between'>
                  <span className='truncate text-sm font-medium'>
                    {conv.user_display || conv.username || `#${conv.user_id}`}
                  </span>
                  {conv.admin_unread_count > 0 && (
                    <span className='bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold'>{conv.admin_unread_count}</span>
                  )}
                </div>
                <p className='text-muted-foreground mt-1 truncate text-xs'>{conv.last_message}</p>
                <p className='text-muted-foreground/50 mt-0.5 text-[10px]'>{formatDate(conv.last_message_at || conv.updated_at)}</p>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className='flex min-w-0 flex-1 flex-col'>
          {selectedConv ? (
            <>
              {/* Chat header */}
              <div className='border-b flex items-center gap-2 px-6 py-3'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0 md:hidden'
                  onClick={() => setSelectedConv(null)}
                >
                  <ChevronLeft className='size-4' />
                </Button>
                <span className='text-sm font-semibold'>
                  {selectedConv.user_display || selectedConv.username || `#${selectedConv.user_id}`}
                </span>
              </div>

              {/* Messages */}
              <ScrollArea className='min-h-0 flex-1 overflow-y-auto p-6'>
                {loading && <p className='text-muted-foreground text-center text-sm'>{t('Loading...')}</p>}
                {!loading && messages.length === 0 && (
                  <p className='text-muted-foreground pt-16 text-center text-sm'>{t('No messages yet')}</p>
                )}
                <div className='space-y-4'>
                {messages.map((msg) => (
                    <div key={msg.id} className={cn('flex', msg.is_admin ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[70%] rounded-2xl px-4 py-3',
                        msg.is_admin
                          ? 'bg-muted rounded-bl-sm'
                          : msg.is_broadcast === 1
                            ? 'bg-amber-50 dark:bg-amber-950 rounded-br-sm border border-amber-200 dark:border-amber-800'
                            : 'bg-primary text-primary-foreground rounded-br-sm'
                      )}>
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
              </ScrollArea>

              {/* Input */}
              <div className='border-t flex items-center gap-3 px-6 py-4'>
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
            </>
          ) : (
            <div className='text-muted-foreground flex flex-1 items-center justify-center'>
              <div className='text-center'>
                <MessageCircle className='mx-auto mb-3 size-12 opacity-30' />
                <p className='text-sm'>{t('Select a conversation to start chatting')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Megaphone className='size-5' />
              {t('Send Broadcast')}
            </DialogTitle>
          </DialogHeader>
          <div className='py-4'>
            <p className='text-muted-foreground mb-3 text-sm'>
              {t('This message will be sent to all users.')}
            </p>
            <Textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder={t('Type your broadcast message...')}
              className='min-h-[120px]'
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setBroadcastOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleBroadcast} disabled={!broadcastText.trim() || sendingBroadcast}>
              {sendingBroadcast ? t('Sending...') : t('Send to All')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
