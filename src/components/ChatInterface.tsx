'use client'

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessage } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'
import { Send } from 'lucide-react'

export interface ChatInterfaceRef {
  sendMessage: (message: string) => void
}

const ChatInterface = forwardRef<ChatInterfaceRef>((props, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatHistory = useCallback(async () => {
    try {
      console.log('Loading chat history for session:', sessionId)
      const { data, error } = await supabaseService.getChatHistory(sessionId)
      if (!error && data && data.length > 0) {
        console.log('Chat history loaded:', data.length, 'messages')
        setMessages(data)
      } else if (error) {
        console.error('Error loading chat history:', error)
      } else {
        console.log('No chat history found, starting with empty messages')
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
      // Continue without chat history - start with empty messages
    }
  }, [sessionId])

  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading) return

    const userMessage = message.trim()
    setInputMessage('')
    setLoading(true)

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
        const errorData = await response.json()
        console.error('API Error Response:', errorData)
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Failed to get response'}`)
      }

      const { error: apiError } = await response.json()
      
      if (apiError) {
        throw new Error(`API Error: ${apiError}`)
      }

      // Reload chat history to get the latest messages from database
      await loadChatHistory()

    } catch (error) {
      console.error('Chat error:', error)
      // Add error message to UI with more details
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        user_id: '',
        session_id: sessionId,
        message: { 
          role: 'assistant', 
          content: `抱歉，我现在无法回应。错误信息：${error instanceof Error ? error.message : String(error)}\n\n请检查网络连接或稍后再试。` 
        },
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId, loadChatHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return
    await sendMessage(inputMessage)
  }

  useImperativeHandle(ref, () => ({
    sendMessage
  }), [sendMessage])

  return (
    <div className="flex flex-col h-full bg-white/70 backdrop-blur-sm rounded-xl card-shadow border border-white/20">
      <div className="p-4 border-b border-gray-100/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">学习助手</h2>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">在线</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-2xl">👋</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">你好！我是你的学习助手</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              我可以帮助你制定学习计划、回答学习问题、提供任务建议等。让我们开始学习之旅吧！
            </p>
            <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-100">
                <p className="text-sm text-gray-700">💡 &quot;今天我该做什么？&quot;</p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-100">
                <p className="text-sm text-gray-700">📚 &quot;帮我制定学习计划&quot;</p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-100">
                <p className="text-sm text-gray-700">🎯 &quot;我的学习进度如何？&quot;</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex ${msg.message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-in`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-end space-x-2 max-w-[80%] lg:max-w-[70%]">
                {msg.message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">AI</span>
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    msg.message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm'
                      : 'bg-white/80 backdrop-blur-sm text-gray-800 border border-gray-100 rounded-bl-sm'
                  } card-shadow`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message.content}</p>
                  <p className={`text-xs mt-2 ${msg.message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {msg.message.role === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">你</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-end space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">AI</span>
              </div>
              <div className="bg-white/80 backdrop-blur-sm text-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm border border-gray-100 card-shadow">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm text-gray-600 ml-2">正在思考中...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100/50 bg-white/30 backdrop-blur-sm rounded-b-xl">
        <div className="flex space-x-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="输入你的问题..."
            disabled={loading}
            className="flex-1 bg-white/80 backdrop-blur-sm border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl"
          />
          <Button 
            type="submit" 
            disabled={loading || !inputMessage.trim()}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl px-4 py-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>按 Enter 发送，Shift + Enter 换行</span>
          <span className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            <span>AI 助手已就绪</span>
          </span>
        </div>
      </form>
    </div>
  )
})

ChatInterface.displayName = 'ChatInterface'

export default ChatInterface