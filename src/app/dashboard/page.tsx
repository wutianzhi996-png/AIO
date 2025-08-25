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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载中...</p>
        </div>
      </div>
    )
  }

  const currentOKR = okrs[0] // Show most recent OKR

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">启</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                启明星学习平台
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block">
                <span className="text-sm text-gray-600">
                  欢迎回来，
                </span>
                <span className="text-sm font-medium text-gray-900 ml-1">
                  {user?.email?.split('@')[0]}
                </span>
              </div>
              <Button variant="ghost" onClick={handleSignOut} className="hover:bg-white/50">
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
          <div className="lg:col-span-1 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">🎯 学习目标</h2>
              {currentOKR && !showOKRForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOKRForm(true)}
                  className="hover:bg-blue-50 border-blue-200 text-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新建
                </Button>
              )}
            </div>

            {showOKRForm ? (
              <div className="animate-fade-in">
                <OKRForm onSuccess={handleOKRSuccess} />
              </div>
            ) : currentOKR ? (
              <div className="animate-fade-in">
                <OKRDisplay okr={currentOKR} />
              </div>
            ) : (
              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl card-shadow text-center border border-white/20 animate-fade-in">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-600 mb-4">
                  还没有设定学习目标，让我们开始创建第一个 OKR 吧！
                </p>
                <Button 
                  onClick={() => setShowOKRForm(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建目标
                </Button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl card-shadow border border-white/20 animate-fade-in">
              <h3 className="font-medium mb-3 text-gray-900 flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mr-2"></span>
                快速开始
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-white/50 transition-colors">
                  <span className="text-lg">💡</span>
                  <p className="text-gray-700">问我&quot;今天我该做什么？&quot;获取任务建议</p>
                </div>
                <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-white/50 transition-colors">
                  <span className="text-lg">📚</span>
                  <p className="text-gray-700">遇到学习问题时随时向我提问</p>
                </div>
                <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-white/50 transition-colors">
                  <span className="text-lg">🎯</span>
                  <p className="text-gray-700">完成任务后记得更新你的 OKR</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Main Area - Chat Interface */}
          <div className="lg:col-span-2 animate-fade-in">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  )
}