'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessage } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'
import { Send } from 'lucide-react'

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatHistory = useCallback(async () => {
    const { data, error } = await supabaseService.getChatHistory(sessionId)
    if (!error && data) {
      setMessages(data)
    }
  }, [sessionId])

  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || loading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setLoading(true)

    // Add user message to UI immediately
    const newUserMessage: ChatMessage = {
      id: Date.now(),
      user_id: '',
      session_id: sessionId,
      message: { role: 'user', content: userMessage },
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          sessionId 
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const { response: assistantResponse } = await response.json()

      // Add assistant response to UI
      const newAssistantMessage: ChatMessage = {
        id: Date.now() + 1,
        user_id: '',
        session_id: sessionId,
        message: { role: 'assistant', content: assistantResponse },
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, newAssistantMessage])

    } catch (error) {
      console.error('Chat error:', error)
      // Add error message to UI
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        user_id: '',
        session_id: sessionId,
        message: { role: 'assistant', content: '抱歉，我现在无法回应。请稍后再试。' },
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">AI 学习助手</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>你好！我是你的学习助手。</p>
            <p>你可以问我学习相关的问题，或者问&quot;今天我该做什么？&quot;获取任务建议。</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
              <p>正在思考中...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="输入你的问题..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !inputMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}