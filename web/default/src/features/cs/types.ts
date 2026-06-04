export interface CSMessage {
  id: number
  conversation_id: number
  user_id: number
  username: string
  content: string
  is_admin: number
  created_at: number
}

export interface CSConversation {
  id: number
  user_id: number
  username: string
  last_message: string
  last_message_at: number
  unread_count: number
  admin_unread_count: number
  created_at: number
  updated_at: number
  user_display?: string
}
