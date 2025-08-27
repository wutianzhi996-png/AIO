# 数据库设置指南

## 重要提醒 ⚠️

如果你在使用以下功能时遇到错误，说明需要在Supabase数据库中创建相应的数据表：
- **进度提交功能**: "进度历史表尚未创建" → 需要创建 `progress_history` 表
- **任务管理功能**: "任务表不存在" → 需要创建 `daily_tasks` 和 `task_generation_logs` 表

## 快速解决方案

### 步骤1: 登录Supabase控制台
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"

### 步骤2: 执行SQL脚本
复制以下SQL脚本并在SQL Editor中执行：

#### 🔥 必需脚本 - 进度历史记录表
```sql
-- 创建进度历史记录表
CREATE TABLE IF NOT EXISTS public.progress_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    okr_id UUID REFERENCES public.okrs(id) ON DELETE CASCADE,
    key_result_index INTEGER NOT NULL,
    key_result_text TEXT NOT NULL,
    progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
    progress_description TEXT,
    previous_progress INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能操作自己的进度历史记录
CREATE POLICY "用户只能操作自己的进度历史记录" ON public.progress_history 
FOR ALL USING (auth.uid() = user_id);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_progress_history_user_okr ON public.progress_history(user_id, okr_id);
CREATE INDEX IF NOT EXISTS idx_progress_history_okr_kr ON public.progress_history(okr_id, key_result_index);
CREATE INDEX IF NOT EXISTS idx_progress_history_created_at ON public.progress_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_history_lookup ON public.progress_history(okr_id, key_result_index, created_at DESC);

-- 添加注释
COMMENT ON TABLE public.progress_history IS '关键结果进度历史记录表';
COMMENT ON COLUMN public.progress_history.key_result_index IS '关键结果在OKR中的索引位置';
COMMENT ON COLUMN public.progress_history.key_result_text IS '关键结果文本快照';
COMMENT ON COLUMN public.progress_history.progress IS '进度百分比 (0-100)';
COMMENT ON COLUMN public.progress_history.previous_progress IS '上一次的进度值';
COMMENT ON COLUMN public.progress_history.progress_description IS '本次进度更新的描述';
```

#### 🚀 新功能脚本 - 任务管理系统 (可选)
如果你想使用个性化学习计划生成功能，请执行以下脚本：

```sql
-- 每日任务表
CREATE TABLE public.daily_tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    okr_id UUID REFERENCES public.okrs(id) ON DELETE CASCADE,
    key_result_index INTEGER,

    -- 任务基本信息
    title TEXT NOT NULL,
    description TEXT,
    task_type VARCHAR(20) DEFAULT 'daily' CHECK (task_type IN ('daily', 'weekly')),

    -- 任务状态和优先级
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 2 CHECK (priority >= 1 AND priority <= 5),

    -- 时间相关
    task_date DATE NOT NULL,
    estimated_duration INTEGER,
    completed_at TIMESTAMPTZ,

    -- 任务生成相关
    generated_by VARCHAR(20) DEFAULT 'ai' CHECK (generated_by IN ('ai', 'user', 'system')),
    generation_context JSONB,

    -- 任务关联和依赖
    parent_task_id BIGINT REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
    depends_on_task_ids BIGINT[],

    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能操作自己的任务" ON public.daily_tasks FOR ALL USING (auth.uid() = user_id);

-- 创建索引
CREATE INDEX idx_daily_tasks_user_date ON public.daily_tasks(user_id, task_date DESC);
CREATE INDEX idx_daily_tasks_okr ON public.daily_tasks(okr_id);
CREATE INDEX idx_daily_tasks_status ON public.daily_tasks(status);

-- 任务生成记录表
CREATE TABLE public.task_generation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    generation_date DATE NOT NULL,
    generation_type VARCHAR(20) DEFAULT 'daily' CHECK (generation_type IN ('daily', 'weekly')),
    okr_snapshot JSONB,
    previous_tasks_snapshot JSONB,
    generated_tasks_count INTEGER DEFAULT 0,
    generation_prompt TEXT,
    ai_response TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.task_generation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能查看自己的生成记录" ON public.task_generation_logs FOR ALL USING (auth.uid() = user_id);

-- 创建今日任务视图
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
```

### 步骤3: 验证创建成功
执行以下查询验证表是否创建成功：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'progress_history';

-- 检查表结构
\d public.progress_history;
```

## 功能说明

### 📊 进度历史记录功能
创建 `progress_history` 表后，你将获得：

#### ✅ 进度历史记录
- 📊 每次进度更新都会自动保存到历史记录
- 🔄 显示进度变化趋势（增加/减少/不变）
- ⏰ 记录精确的提交时间
- 📝 保存用户的进度描述

### ✅ 智能显示
- 📈 按时间倒序显示（最新在前）
- 🏷️ 显示提交次序（第1次、第2次...）
- 🎨 可视化进度变化（颜色和箭头）
- 📱 响应式设计，适配各种设备

### ✅ 数据安全
- 🔒 行级安全策略，用户只能看到自己的记录
- 🛡️ 数据完整性约束和验证
- 🗑️ 级联删除，清理孤立数据

### 🎯 任务管理功能
创建 `daily_tasks` 相关表后，你将获得：

#### ✅ 个性化学习计划
- 🤖 AI基于OKR自动生成每日/每周任务
- 📅 智能时间安排和优先级排序
- 🎯 任务与关键结果直接关联
- 📈 基于前日完成情况的连续性规划

#### ✅ 任务状态管理
- ✅ 任务完成/未完成状态切换
- ❌ 前日未完成任务的失败标记
- 🔄 任务重新生成和状态追踪
- ⏰ 任务完成时间记录

#### ✅ 智能分析
- 📊 任务完成率统计
- 🎨 优先级颜色编码显示
- 📝 任务生成历史记录
- 🔍 学习行为数据分析

## 故障排除

### 问题1: 权限错误
如果遇到权限相关错误，确保：
- 你有数据库的管理员权限
- RLS策略正确设置
- 用户已正确登录

### 问题2: 外键约束错误
如果遇到外键约束错误，检查：
- `okrs` 表是否存在
- 用户表结构是否正确

### 问题3: 索引创建失败
如果索引创建失败：
- 检查表名是否正确
- 确保列名拼写无误
- 可以跳过索引创建，功能仍然可用

## 数据迁移（可选）

如果你已经有一些OKR数据，可以选择为现有的关键结果创建初始历史记录：

```sql
-- 为现有OKR创建初始历史记录（可选）
INSERT INTO public.progress_history (
    user_id, 
    okr_id, 
    key_result_index, 
    key_result_text, 
    progress, 
    progress_description,
    previous_progress,
    created_at
)
SELECT 
    user_id,
    id as okr_id,
    generate_series(0, jsonb_array_length(key_results) - 1) as key_result_index,
    (key_results->generate_series(0, jsonb_array_length(key_results) - 1))->>'text' as key_result_text,
    COALESCE((key_results->generate_series(0, jsonb_array_length(key_results) - 1))->>'progress', '0')::integer as progress,
    (key_results->generate_series(0, jsonb_array_length(key_results) - 1))->>'progress_description' as progress_description,
    NULL as previous_progress,
    COALESCE(
        (key_results->generate_series(0, jsonb_array_length(key_results) - 1))->>'last_updated',
        created_at::text
    )::timestamptz as created_at
FROM public.okrs
WHERE jsonb_array_length(key_results) > 0
AND (key_results->generate_series(0, jsonb_array_length(key_results) - 1))->>'progress' IS NOT NULL;
```

## 完成后

执行完SQL脚本后：

### 🔥 进度历史功能测试
1. 刷新你的应用页面
2. 尝试更新任意关键结果的进度
3. 查看是否能正常显示历史记录

### 🚀 任务管理功能测试 (如果已创建任务表)
1. 登录到Dashboard页面
2. 在左侧应该看到"今日学习任务"组件
3. 点击"AI生成今日任务"按钮
4. 查看是否能正常生成和显示任务

如果仍有问题，请检查浏览器控制台的错误信息，或联系技术支持。

---

**注意**:
- 📊 进度历史表是**必需的**，用于进度跟踪功能
- 🎯 任务管理表是**可选的**，用于个性化学习计划功能
- 🔧 这些表创建是一次性操作，创建后就可以永久使用相应功能！
