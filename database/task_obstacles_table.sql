-- 任务障碍诊断表
-- 用于存储任务障碍信息、AI分析结果和解决方案

CREATE TABLE public.task_obstacles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
    
    -- 障碍基本信息
    obstacle_type VARCHAR(30) DEFAULT 'other' CHECK (obstacle_type IN ('time_management', 'knowledge_gap', 'motivation', 'resource_lack', 'technical_issue', 'other')),
    description TEXT NOT NULL, -- 用户描述的障碍情况
    
    -- AI分析结果
    ai_analysis TEXT, -- AI对障碍的深度分析
    suggested_solutions JSONB, -- AI建议的解决方案列表
    
    -- 障碍状态管理
    status VARCHAR(20) DEFAULT 'identified' CHECK (status IN ('identified', 'in_progress', 'resolved', 'dismissed')),
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ, -- 障碍解决时间
    
    -- 额外信息
    user_feedback TEXT, -- 用户对解决方案的反馈
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5) -- 解决方案有效性评分
);

-- 启用行级安全策略
ALTER TABLE public.task_obstacles ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能操作自己的障碍记录
CREATE POLICY "用户只能操作自己的障碍记录" ON public.task_obstacles 
FOR ALL USING (auth.uid() = user_id);

-- 创建索引以提高查询性能
CREATE INDEX idx_task_obstacles_user ON public.task_obstacles(user_id);
CREATE INDEX idx_task_obstacles_task ON public.task_obstacles(task_id);
CREATE INDEX idx_task_obstacles_status ON public.task_obstacles(status);
CREATE INDEX idx_task_obstacles_type ON public.task_obstacles(obstacle_type);
CREATE INDEX idx_task_obstacles_created ON public.task_obstacles(created_at DESC);

-- 创建更新时间触发器
CREATE TRIGGER update_task_obstacles_updated_at 
    BEFORE UPDATE ON public.task_obstacles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 障碍统计视图
CREATE VIEW public.obstacle_stats AS
SELECT 
    user_id,
    obstacle_type,
    status,
    COUNT(*) as count,
    AVG(effectiveness_rating) as avg_effectiveness,
    DATE_TRUNC('week', created_at) as week
FROM public.task_obstacles
GROUP BY user_id, obstacle_type, status, DATE_TRUNC('week', created_at)
ORDER BY week DESC, count DESC;

-- 用户障碍趋势视图
CREATE VIEW public.user_obstacle_trends AS
SELECT 
    user_id,
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as obstacles_identified,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as obstacles_resolved,
    ROUND(
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as resolution_rate
FROM public.task_obstacles
GROUP BY user_id, DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- 添加注释
COMMENT ON TABLE public.task_obstacles IS '任务障碍诊断表，存储障碍信息和AI分析结果';
COMMENT ON COLUMN public.task_obstacles.obstacle_type IS '障碍类型：时间管理、知识缺口、动机不足、资源缺乏、技术问题、其他';
COMMENT ON COLUMN public.task_obstacles.description IS '用户描述的具体障碍情况';
COMMENT ON COLUMN public.task_obstacles.ai_analysis IS 'AI对障碍原因的深度分析';
COMMENT ON COLUMN public.task_obstacles.suggested_solutions IS 'AI建议的解决方案，JSON格式存储';
COMMENT ON COLUMN public.task_obstacles.status IS '障碍处理状态：已识别、处理中、已解决、已忽略';
COMMENT ON COLUMN public.task_obstacles.effectiveness_rating IS '用户对解决方案有效性的评分(1-5分)';

-- 示例解决方案JSON结构
/*
suggested_solutions 示例：
[
  {
    "title": "制定详细时间计划",
    "description": "将大任务分解为小的时间块，使用番茄工作法",
    "priority": 1,
    "estimated_time": 30,
    "steps": [
      "下载番茄工作法应用",
      "将任务分解为25分钟的小块",
      "设置专注时间和休息时间"
    ]
  },
  {
    "title": "寻找学习资源",
    "description": "查找相关的在线课程或教程",
    "priority": 2,
    "estimated_time": 60,
    "resources": [
      "https://example.com/course",
      "推荐书籍：《XXX》"
    ]
  }
]
*/
