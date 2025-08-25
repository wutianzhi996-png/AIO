'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabaseService } from '@/lib/services/supabase-service'
import { PROVINCES, UNIVERSITIES_BY_PROVINCE } from '@/data/universities'
import { MAJOR_CATEGORIES, MAJORS_BY_CATEGORY, POPULAR_MAJORS } from '@/data/majors'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [province, setProvince] = useState('')
  const [university, setUniversity] = useState('')
  const [majorCategory, setMajorCategory] = useState('')
  const [major, setMajor] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(0)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        const { error } = await supabaseService.signIn(email, password)
        if (error) {
          setMessage(error.message)
        } else {
          router.push('/dashboard')
        }
      } else {
        // 注册时验证字段
        if (password !== confirmPassword) {
          setMessage('密码和确认密码不一致')
          return
        }
        if (!province || !university || !major) {
          setMessage('请填写完整的个人信息')
          return
        }

        const { error } = await supabaseService.signUp(email, password, {
          province,
          university,
          major
        })
        if (error) {
          setMessage(error.message)
        } else {
          setMessage('注册成功！请检查邮箱确认注册。')
          setCountdown(5)
          
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer)
                setIsLogin(true)
                setMessage('')
                setEmail('')
                setPassword('')
                setConfirmPassword('')
                setProvince('')
                setUniversity('')
                setMajorCategory('')
                setMajor('')
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }
      }
    } catch {
      setMessage('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLogin ? '登录' : '注册'} 启明星平台
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱地址"
                required
              />
            </div>
            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                required
              />
            </div>
            {!isLogin && (
              <>
                <div>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="确认密码"
                    required
                  />
                </div>
                <div>
                  <Select value={province} onValueChange={(value) => {
                    setProvince(value)
                    setUniversity('')
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择省份" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((prov) => (
                        <SelectItem key={prov} value={prov}>
                          {prov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select 
                    value={university} 
                    onValueChange={setUniversity}
                    disabled={!province}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择大学" />
                    </SelectTrigger>
                    <SelectContent>
                      {province && UNIVERSITIES_BY_PROVINCE[province]?.map((uni) => (
                        <SelectItem key={uni} value={uni}>
                          {uni}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={majorCategory} onValueChange={(value) => {
                    setMajorCategory(value)
                    setMajor('')
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择专业类别" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAJOR_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select 
                    value={major} 
                    onValueChange={setMajor}
                    disabled={!majorCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择专业" />
                    </SelectTrigger>
                    <SelectContent>
                      {majorCategory && MAJORS_BY_CATEGORY[majorCategory]?.map((maj) => (
                        <SelectItem key={maj} value={maj}>
                          {maj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {majorCategory === '' && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">或选择热门专业：</p>
                    <Select value={major} onValueChange={setMajor}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择热门专业" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_MAJORS.map((maj) => (
                          <SelectItem key={maj} value={maj}>
                            {maj}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          {message && (
            <div className={`text-sm ${message.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
              {countdown > 0 && (
                <div className="mt-2 text-blue-600 font-medium">
                  {countdown}秒后自动跳转到登录页面
                </div>
              )}
            </div>
          )}

          <div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-500 text-sm"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? '没有账号？立即注册' : '已有账号？立即登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}