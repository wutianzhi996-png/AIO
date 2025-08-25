export interface OKR {
  id: string
  user_id: string
  objective: string
  key_results: { text: string; completed?: boolean }[]
  created_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  province: string
  university: string
  major: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  user_id: string
  session_id: string
  message: {
    role: 'user' | 'assistant'
    content: string
  }
  created_at: string
}

export interface KnowledgeChunk {
  id: number
  content: string
  embedding: number[]
}