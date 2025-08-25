import { createClient } from '@/lib/supabase/client'
import { OKR, ChatMessage } from '@/lib/supabase/types'

class SupabaseService {
  private supabase = createClient()

  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    return { error }
  }

  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    return { user, error }
  }

  async createOKR(objective: string, keyResults: string[]): Promise<{ data: OKR | null, error: any }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('okrs')
      .insert({
        user_id: user.id,
        objective,
        key_results: keyResults.map(text => ({ text }))
      })
      .select()
      .single()

    return { data, error }
  }

  async getUserOKRs(): Promise<{ data: OKR[] | null, error: any }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('okrs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return { data, error }
  }

  async saveChatMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        message: { role, content }
      })

    return { data, error }
  }

  async getChatHistory(sessionId?: string): Promise<{ data: ChatMessage[] | null, error: any }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    let query = this.supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    return { data, error }
  }

  async searchKnowledge(query: string, limit = 5) {
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: await this.getEmbedding(query),
      match_threshold: 0.7,
      match_count: limit
    })

    return { data, error }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error('Failed to get embedding')
    }

    const { embedding } = await response.json()
    return embedding
  }
}

export const supabaseService = new SupabaseService()