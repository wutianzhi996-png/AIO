'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ChatInterface, { ChatInterfaceRef } from '@/components/ChatInterface'
import OKRForm from '@/components/OKRForm'
import OKRDisplay from '@/components/OKRDisplay'
import UniversityStats from '@/components/UniversityStats'
import { supabaseService } from '@/lib/services/supabase-service'
import { OKR } from '@/lib/supabase/types'
import { User } from '@supabase/supabase-js'
import { Plus } from 'lucide-react'
import UserProfileDropdown from '@/components/UserProfileDropdown'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [okrs, setOKRs] = useState<OKR[]>([])
  const [showOKRForm, setShowOKRForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const chatRef = useRef<ChatInterfaceRef>(null)
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

  const handleQuickAction = (message: string) => {
    chatRef.current?.sendMessage(message)
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
              <UserProfileDropdown user={user} onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[calc(100vh-12rem)]">
          {/* Left Sidebar - OKR Section */}
          <div className="lg:col-span-1 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">🎯 学习目标</h2>
              {!showOKRForm && (
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
            ) : okrs.length > 0 ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {okrs.map((okr, index) => (
                  <div key={okr.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <OKRDisplay okr={okr} onDelete={loadUserData} />
                  </div>
                ))}
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
                <div 
                  className="flex items-start space-x-3 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer group"
                  onClick={() => handleQuickAction("今天我该做什么？")}
                >
                  <span className="text-lg">💡</span>
                  <div className="flex-1">
                    <p className="text-gray-700 group-hover:text-blue-600 transition-colors">
                      问我&quot;今天我该做什么？&quot;获取任务建议
                    </p>
                    <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-500 transition-colors">
                      点击直接向右侧学习助手提问
                    </p>
                  </div>
                </div>
                <div 
                  className="flex items-start space-x-3 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer group"
                  onClick={() => handleQuickAction("帮我制定一个学习计划")}
                >
                  <span className="text-lg">📚</span>
                  <div className="flex-1">
                    <p className="text-gray-700 group-hover:text-blue-600 transition-colors">
                      遇到学习问题时随时向我提问
                    </p>
                    <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-500 transition-colors">
                      点击获取学习计划建议
                    </p>
                  </div>
                </div>
                <div 
                  className="flex items-start space-x-3 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer group"
                  onClick={() => handleQuickAction("我的学习进度如何？如何更新OKR？")}
                >
                  <span className="text-lg">🎯</span>
                  <div className="flex-1">
                    <p className="text-gray-700 group-hover:text-blue-600 transition-colors">
                      完成任务后记得更新你的 OKR
                    </p>
                    <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-500 transition-colors">
                      点击了解进度和OKR更新方法
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 数据统计模块 */}
            <UniversityStats />
          </div>

          {/* Right Main Area - Chat Interface */}
          <div className="lg:col-span-2 animate-fade-in">
            <ChatInterface ref={chatRef} />
          </div>
        </div>
      </div>
    </div>
  )
}