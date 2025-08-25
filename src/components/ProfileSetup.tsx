'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabaseService } from '@/lib/services/supabase-service'
import { PROVINCES, UNIVERSITIES_BY_PROVINCE } from '@/data/universities'
import { MAJOR_CATEGORIES, MAJORS_BY_CATEGORY, POPULAR_MAJORS } from '@/data/majors'
import { User, CheckCircle } from 'lucide-react'

interface ProfileSetupProps {
  onComplete: () => void
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [province, setProvince] = useState('')
  const [university, setUniversity] = useState('')
  const [majorCategory, setMajorCategory] = useState('')
  const [major, setMajor] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!province || !university || !major) {
      setMessage('请填写完整的个人信息')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // 创建用户档案
      const { error } = await supabaseService.createUserProfile({
        province,
        university,
        major
      })

      if (error) {
        setMessage(error)
      } else {
        setMessage('个人资料已保存！')
        setTimeout(() => {
          onComplete()
        }, 1500)
      }
    } catch (err) {
      setMessage('保存失败，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">完善个人资料</h3>
        <p className="text-sm text-gray-600">
          请补充您的学校和专业信息，以便获得更好的个性化体验
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {message && (
          <div className={`text-sm text-center ${message.includes('已保存') ? 'text-green-600' : 'text-red-600'}`}>
            {message.includes('已保存') && (
              <CheckCircle className="w-4 h-4 inline mr-1" />
            )}
            {message}
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          disabled={loading || !province || !university || !major}
        >
          {loading ? '保存中...' : '保存资料'}
        </Button>
      </form>
    </div>
  )
}