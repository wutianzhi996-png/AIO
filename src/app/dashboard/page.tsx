'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ChatInterface from '@/components/ChatInterface'
import OKRForm from '@/components/OKRForm'
import OKRDisplay from '@/components/OKRDisplay'
import { supabaseService } from '@/lib/services/supabase-service'
import { OKR } from '@/lib/supabase/types'
import { User } from '@supabase/supabase-js'
import { LogOut, Plus } from 'lucide-react'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [okrs, setOKRs] = useState<OKR[]>([])
  const [showOKRForm, setShowOKRForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadUserData = useCallback(async () => {
    const { user: currentUser } = await supabaseService.getCurrentUser()
    
    if (!currentUser) {
      router.push('/auth')
      return
    }

    setUser(currentUser)
    
    const { data: userOKRs } = await supabaseService.getUserOKRs()
    if (userOKRs) {
      setOKRs(userOKRs)
    }
    
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadUserData()
  }, [loadUserData])

  const handleSignOut = async () => {
    await supabaseService.signOut()
    router.push('/auth')
  }

  const handleOKRSuccess = () => {
    setShowOKRForm(false)
    loadUserData() // Reload to get latest OKRs
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const currentOKR = okrs[0] // Show most recent OKR

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">启明星学习平台</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                欢迎，{user?.email}
              </span>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-12rem)]">
          {/* Left Sidebar - OKR Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">学习目标</h2>
              {currentOKR && !showOKRForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOKRForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新建
                </Button>
              )}
            </div>

            {showOKRForm ? (
              <OKRForm onSuccess={handleOKRSuccess} />
            ) : currentOKR ? (
              <OKRDisplay okr={currentOKR} />
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <p className="text-gray-600 mb-4">
                  还没有设定学习目标，让我们开始创建第一个 OKR 吧！
                </p>
                <Button onClick={() => setShowOKRForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建目标
                </Button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="font-medium mb-3">快速开始</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>💡 问我&quot;今天我该做什么？&quot;获取任务建议</p>
                <p>📚 遇到学习问题时随时向我提问</p>
                <p>🎯 完成任务后记得更新你的 OKR</p>
              </div>
            </div>
          </div>

          {/* Right Main Area - Chat Interface */}
          <div className="lg:col-span-2">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  )
}