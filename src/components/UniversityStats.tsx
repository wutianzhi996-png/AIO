'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { supabaseService } from '@/lib/services/supabase-service'
import { UserProfile } from '@/lib/supabase/types'
import ProfileSetup from './ProfileSetup'
import { Users, TrendingUp } from 'lucide-react'

interface MajorStat {
  major: string
  count: number
}

const COLORS = [
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EC4899', // pink-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#84CC16', // lime-500
]

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    payload: MajorStat
  }>
  label?: string
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-white/20">
        <p className="font-medium text-gray-900">{data.major}</p>
        <p className="text-blue-600">
          <span className="font-medium">{data.count}</span> 人
        </p>
      </div>
    )
  }
  return null
}

export default function UniversityStats() {
  const [stats, setStats] = useState<MajorStat[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProfileSetup, setShowProfileSetup] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // 获取用户档案和统计数据
        const [profileResult, statsResult] = await Promise.all([
          supabaseService.getUserProfile(),
          supabaseService.getUniversityMajorStats()
        ])

        if (profileResult.error && !profileResult.error.includes('profile')) {
          setError(profileResult.error)
          return
        }

        if (!profileResult.data) {
          setShowProfileSetup(true)
          setLoading(false)
          return
        }

        if (statsResult.error) {
          setError(statsResult.error)
          return
        }

        setUserProfile(profileResult.data)
        setStats(statsResult.data || [])
      } catch (err) {
        setError('加载数据时发生错误')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleProfileComplete = () => {
    setShowProfileSetup(false)
    setLoading(true)
    // 重新加载数据
    const loadData = async () => {
      try {
        const [profileResult, statsResult] = await Promise.all([
          supabaseService.getUserProfile(),
          supabaseService.getUniversityMajorStats()
        ])

        setUserProfile(profileResult.data)
        setStats(statsResult.data || [])
      } catch (err) {
        setError('加载数据时发生错误')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 animate-pulse">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-5 h-5 bg-gray-300 rounded"></div>
          <div className="w-24 h-4 bg-gray-300 rounded"></div>
        </div>
        <div className="h-64 bg-gray-300 rounded-lg"></div>
      </div>
    )
  }

  if (showProfileSetup) {
    return <ProfileSetup onComplete={handleProfileComplete} />
  }

  if (error || !userProfile) {
    return (
      <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-600 mb-2">
          {error || '暂无数据统计'}
        </p>
        {error && error.includes('profile') && (
          <p className="text-sm text-blue-600">
            请先完善您的个人资料
          </p>
        )}
      </div>
    )
  }

  const totalUsers = stats.reduce((sum, stat) => sum + stat.count, 0)

  return (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            校内专业分布
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {userProfile.university} · 共 {totalUsers} 人
          </p>
        </div>
      </div>

      {stats.length > 0 ? (
        <div className="space-y-4">
          {/* 饼图 */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  dataKey="count"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {stats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 专业列表 */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {stats.map((stat, index) => (
              <div 
                key={stat.major} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700 truncate max-w-32">
                    {stat.major}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    {stat.count}人
                  </span>
                  <span className="text-xs text-gray-500">
                    {((stat.count / totalUsers) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">暂无同校用户数据</p>
          <p className="text-sm text-gray-500">
            成为第一个来自 {userProfile.university} 的用户！
          </p>
        </div>
      )}
    </div>
  )
}