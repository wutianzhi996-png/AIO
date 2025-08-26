'use client'

import { useState, useEffect, useRef } from 'react'
import { User, Settings, Lock, MapPin, GraduationCap, BookOpen, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserProfile } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'

interface UserProfileDropdownProps {
  user: {
    email?: string
    id: string
  } | null
  onSignOut: () => void
}

export default function UserProfileDropdown({ user, onSignOut }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  // const [loading, setLoading] = useState(false) // Reserved for future use
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data } = await supabaseService.getUserProfile()
      setUserProfile(data)
    }
    
    if (isOpen) {
      loadUserProfile()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowPasswordForm(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordMessage('')

    try {
      // 验证新密码和确认密码是否一致
      if (newPassword !== confirmPassword) {
        setPasswordMessage('新密码和确认密码不一致')
        return
      }

      if (newPassword.length < 6) {
        setPasswordMessage('新密码长度至少6位')
        return
      }

      // 调用密码修改API
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setPasswordMessage(result.error || '密码修改失败')
        return
      }

      setPasswordMessage('密码修改成功！即将退出登录...')
      
      // 清空表单
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // 2秒后退出登录
      setTimeout(() => {
        onSignOut()
      }, 2000)

    } catch {
      setPasswordMessage('网络错误，请重试')
    } finally {
      setPasswordLoading(false)
    }
  }

  const resetPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('')
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <div
        className="flex items-center space-x-2 cursor-pointer hover:bg-white/20 rounded-lg px-3 py-2 transition-colors"
        onMouseEnter={() => setIsOpen(true)}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="hidden sm:block">
          <span className="text-sm text-gray-600">欢迎回来，</span>
          <span className="text-sm font-medium text-gray-900 ml-1">
            {user?.email?.split('@')[0]}
          </span>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50"
          onMouseLeave={() => {
            setIsOpen(false)
            setShowPasswordForm(false)
            resetPasswordForm()
          }}
        >
          {!showPasswordForm ? (
            // User Info View
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user?.email?.split('@')[0]}</h3>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>

              {/* Profile Info */}
              {userProfile ? (
                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userProfile.province}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userProfile.university}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userProfile.major}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  正在加载个人信息...
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-gray-100">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => setShowPasswordForm(true)}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  修改密码
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={onSignOut}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  退出登录
                </Button>
              </div>
            </div>
          ) : (
            // Password Change Form
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">修改密码</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPasswordForm(false)
                    resetPasswordForm()
                  }}
                >
                  返回
                </Button>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    当前密码
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="请输入当前密码"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    新密码
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="请输入新密码（至少6位）"
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    确认新密码
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入新密码"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Message */}
                {passwordMessage && (
                  <div className={`text-sm p-3 rounded-lg ${
                    passwordMessage.includes('成功') 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {passwordMessage}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {passwordLoading ? (
                    <span className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      修改中...
                    </span>
                  ) : (
                    '确认修改'
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
