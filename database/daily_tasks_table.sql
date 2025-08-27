-- 每日任务表
-- 用于存储基于OKR生成的个性化学习任务

CREATE TABLE public.daily_tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    okr_id UUID REFERENCES public.okrs(id) ON DELETE CASCADE,
    key_result_index INTEGER, -- 关联的关键结果索引，NULL表示通用任务
    
    -- 任务基本信息
    title TEXT NOT NULL, -- 任务标题
    description TEXT, -- 任务详细描述
    task_type VARCHAR(20) DEFAULT 'daily' CHECK (task_type IN ('daily', 'weekly')), -- 任务类型
    
    -- 任务状态和优先级
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 2 CHECK (priority >= 1 AND priority <= 5), -- 1=最高优先级, 5=最低优先级
    
    -- 时间相关
    task_date DATE NOT NULL, -- 任务日期
    estimated_duration INTEGER, -- 预估完成时间(分钟)
    completed_at TIMESTAMPTZ, -- 完成时间
    
    -- 任务生成相关
    generated_by VARCHAR(20) DEFAULT 'ai' CHECK (generated_by IN ('ai', 'user', 'system')), -- 任务来源
    generation_context JSONB,
    progress_contribution INTEGER DEFAULT 0 CHECK (progress_contribution >= 0 AND progress_contribution <= 100), -- 完成此任务对关键结果进度的贡献值 -- 生成任务时的上下文信息
    
    -- 任务关联和依赖
    parent_task_id BIGINT REFERENCES public.daily_tasks(id) ON DELETE SET NULL, -- 父任务ID
    depends_on_task_ids BIGINT[], -- 依赖的任务ID数组
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能操作自己的任务
CREATE POLICY "用户只能操作自己的任务" ON public.daily_tasks 
FOR ALL USING (auth.uid() = user_id);

-- 创建索引以提高查询性能
CREATE INDEX idx_daily_tasks_user_date ON public.daily_tasks(user_id, task_date DESC);
CREATE INDEX idx_daily_tasks_okr ON public.daily_tasks(okr_id);
CREATE INDEX idx_daily_tasks_status ON public.daily_tasks(status);
CREATE INDEX idx_daily_tasks_priority ON public.daily_tasks(priority);
CREATE INDEX idx_daily_tasks_type_date ON public.daily_tasks(task_type, task_date);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_tasks_updated_at 
    BEFORE UPDATE ON public.daily_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 任务生成记录表 (用于跟踪任务生成历史和避免重复生成)
CREATE TABLE public.task_generation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    generation_date DATE NOT NULL,
    generation_type VARCHAR(20) DEFAULT 'daily' CHECK (generation_type IN ('daily', 'weekly')),
    okr_snapshot JSONB, -- 生成时的OKR快照
    previous_tasks_snapshot JSONB, -- 前一天任务状态快照
    generated_tasks_count INTEGER DEFAULT 0,
    generation_prompt TEXT, -- 使用的AI提示词
    ai_response TEXT, -- AI的原始响应
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.task_generation_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "用户只能查看自己的生成记录" ON public.task_generation_logs 
FOR ALL USING (auth.uid() = user_id);

-- 创建索引
CREATE INDEX idx_task_generation_logs_user_date ON public.task_generation_logs(user_id, generation_date DESC);

-- 添加注释
COMMENT ON TABLE public.daily_tasks IS '每日任务表，存储基于OKR生成的个性化学习任务';
COMMENT ON COLUMN public.daily_tasks.key_result_index IS '关联的关键结果索引，NULL表示通用任务';
COMMENT ON COLUMN public.daily_tasks.priority IS '任务优先级：1=最高优先级, 5=最低优先级';
COMMENT ON COLUMN public.daily_tasks.estimated_duration IS '预估完成时间(分钟)';
COMMENT ON COLUMN public.daily_tasks.generation_context IS '生成任务时的上下文信息，如前一天的任务完成情况';

COMMENT ON TABLE public.task_generation_logs IS '任务生成记录表，用于跟踪任务生成历史';
COMMENT ON COLUMN public.task_generation_logs.okr_snapshot IS '生成时的OKR快照，用于分析任务生成效果';
COMMENT ON COLUMN public.task_generation_logs.previous_tasks_snapshot IS '前一天任务状态快照，用于生成连续性任务';

-- 创建一些有用的视图

-- 今日任务视图
CREATE VIEW public.today_tasks AS
SELECT 
    dt.*,
    okr.objective,
    CASE 
        WHEN dt.key_result_index IS NOT NULL 
        THEN (okr.key_results->dt.key_result_index)->>'text'
        ELSE NULL 
    END as related_key_result
FROM public.daily_tasks dt
LEFT JOIN public.okrs okr ON dt.okr_id = okr.id
WHERE dt.task_date = CURRENT_DATE
ORDER BY dt.priority ASC, dt.created_at ASC;

-- 任务完成统计视图
CREATE VIEW public.task_completion_stats AS
SELECT 
    user_id,
    task_date,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    ROUND(
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completion_rate
FROM public.daily_tasks
GROUP BY user_id, task_date
ORDER BY task_date DESC;
