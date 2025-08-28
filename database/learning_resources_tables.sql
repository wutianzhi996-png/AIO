-- 学习资源推荐系统数据表
-- 包含资源信息、用户交互、推荐记录等

-- 1. 学习资源主表
CREATE TABLE public.learning_resources (
    id BIGSERIAL PRIMARY KEY,
    
    -- 基本信息
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL UNIQUE,
    platform VARCHAR(20) DEFAULT 'other' CHECK (platform IN ('youtube', 'bilibili', 'blog', 'course', 'documentation', 'other')),
    resource_type VARCHAR(20) DEFAULT 'article' CHECK (resource_type IN ('video', 'article', 'course', 'tutorial', 'documentation', 'interactive')),
    
    -- 内容特征
    difficulty_level VARCHAR(15) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_minutes INTEGER CHECK (duration_minutes > 0),
    language VARCHAR(10) DEFAULT 'zh' CHECK (language IN ('zh', 'en', 'other')),
    tags TEXT[] DEFAULT '{}',
    
    -- 作者和来源信息
    author TEXT,
    thumbnail_url TEXT,
    view_count BIGINT DEFAULT 0,
    
    -- AI分析的内容特征 (JSON格式)
    content_features JSONB DEFAULT '{}',
    
    -- 评分和质量指标
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
    quality_score INTEGER DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
    engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    
    -- 状态管理
    status VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_review')),
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 用户资源交互记录表
CREATE TABLE public.user_resource_interactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_id BIGINT REFERENCES public.learning_resources(id) ON DELETE CASCADE,
    
    -- 交互类型和详情
    interaction_type VARCHAR(15) NOT NULL CHECK (interaction_type IN ('view', 'bookmark', 'complete', 'rate', 'share')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    time_spent_minutes INTEGER CHECK (time_spent_minutes >= 0),
    feedback TEXT,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- 确保同一用户对同一资源的同一类型交互只记录一次（除了view）
    UNIQUE(user_id, resource_id, interaction_type)
);

-- 3. 资源推荐记录表
CREATE TABLE public.resource_recommendations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_id BIGINT REFERENCES public.learning_resources(id) ON DELETE CASCADE,
    
    -- 推荐信息
    recommendation_reason TEXT NOT NULL,
    relevance_score INTEGER NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 100),
    obstacle_match VARCHAR(30), -- 匹配的障碍类型
    
    -- 推荐效果跟踪
    clicked BOOLEAN DEFAULT false,
    helpful_rating INTEGER CHECK (helpful_rating >= 1 AND helpful_rating <= 5),
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 用户学习偏好表
CREATE TABLE public.user_learning_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- 偏好设置
    preferred_platforms TEXT[] DEFAULT '{}',
    preferred_resource_types TEXT[] DEFAULT '{}',
    preferred_difficulty VARCHAR(15) DEFAULT 'beginner',
    preferred_language VARCHAR(10) DEFAULT 'zh',
    preferred_duration_range JSONB DEFAULT '{"min": 0, "max": 60}', -- 分钟
    
    -- 学习风格偏好
    learning_style JSONB DEFAULT '{}', -- 视觉、听觉、实践等偏好
    topics_of_interest TEXT[] DEFAULT '{}',
    avoided_topics TEXT[] DEFAULT '{}',
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_resource_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_preferences ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- learning_resources: 所有人可读，只有管理员可写
CREATE POLICY "所有人可以查看学习资源" ON public.learning_resources 
FOR SELECT USING (true);

-- user_resource_interactions: 用户只能操作自己的交互记录
CREATE POLICY "用户只能操作自己的资源交互记录" ON public.user_resource_interactions 
FOR ALL USING (auth.uid() = user_id);

-- resource_recommendations: 用户只能查看自己的推荐
CREATE POLICY "用户只能查看自己的推荐记录" ON public.resource_recommendations 
FOR ALL USING (auth.uid() = user_id);

-- user_learning_preferences: 用户只能操作自己的偏好
CREATE POLICY "用户只能操作自己的学习偏好" ON public.user_learning_preferences 
FOR ALL USING (auth.uid() = user_id);

-- 创建索引以提高查询性能
-- learning_resources 索引
CREATE INDEX idx_learning_resources_platform ON public.learning_resources(platform);
CREATE INDEX idx_learning_resources_type ON public.learning_resources(resource_type);
CREATE INDEX idx_learning_resources_difficulty ON public.learning_resources(difficulty_level);
CREATE INDEX idx_learning_resources_language ON public.learning_resources(language);
CREATE INDEX idx_learning_resources_tags ON public.learning_resources USING GIN(tags);
CREATE INDEX idx_learning_resources_quality ON public.learning_resources(quality_score DESC);
CREATE INDEX idx_learning_resources_rating ON public.learning_resources(rating DESC);
CREATE INDEX idx_learning_resources_content_features ON public.learning_resources USING GIN(content_features);

-- user_resource_interactions 索引
CREATE INDEX idx_user_interactions_user ON public.user_resource_interactions(user_id);
CREATE INDEX idx_user_interactions_resource ON public.user_resource_interactions(resource_id);
CREATE INDEX idx_user_interactions_type ON public.user_resource_interactions(interaction_type);
CREATE INDEX idx_user_interactions_created ON public.user_resource_interactions(created_at DESC);

-- resource_recommendations 索引
CREATE INDEX idx_recommendations_user ON public.resource_recommendations(user_id);
CREATE INDEX idx_recommendations_resource ON public.resource_recommendations(resource_id);
CREATE INDEX idx_recommendations_score ON public.resource_recommendations(relevance_score DESC);
CREATE INDEX idx_recommendations_created ON public.resource_recommendations(created_at DESC);

-- user_learning_preferences 索引
CREATE INDEX idx_learning_preferences_user ON public.user_learning_preferences(user_id);

-- 创建更新时间触发器
CREATE TRIGGER update_learning_resources_updated_at 
    BEFORE UPDATE ON public.learning_resources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_learning_preferences_updated_at 
    BEFORE UPDATE ON public.user_learning_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建有用的视图
-- 热门资源视图
CREATE VIEW public.popular_resources AS
SELECT 
    lr.*,
    COUNT(uri.id) as interaction_count,
    AVG(uri.rating) as avg_user_rating,
    COUNT(CASE WHEN uri.interaction_type = 'complete' THEN 1 END) as completion_count
FROM public.learning_resources lr
LEFT JOIN public.user_resource_interactions uri ON lr.id = uri.resource_id
WHERE lr.status = 'active'
GROUP BY lr.id
ORDER BY interaction_count DESC, lr.quality_score DESC;

-- 用户推荐资源视图
CREATE VIEW public.user_recommended_resources AS
SELECT 
    rr.*,
    lr.title,
    lr.description,
    lr.url,
    lr.platform,
    lr.resource_type,
    lr.difficulty_level,
    lr.duration_minutes,
    lr.thumbnail_url,
    lr.rating,
    lr.quality_score
FROM public.resource_recommendations rr
JOIN public.learning_resources lr ON rr.resource_id = lr.id
WHERE lr.status = 'active'
ORDER BY rr.relevance_score DESC, rr.created_at DESC;

-- 添加表注释
COMMENT ON TABLE public.learning_resources IS '学习资源主表，存储来自各平台的学习资源信息';
COMMENT ON TABLE public.user_resource_interactions IS '用户与学习资源的交互记录';
COMMENT ON TABLE public.resource_recommendations IS '为用户生成的资源推荐记录';
COMMENT ON TABLE public.user_learning_preferences IS '用户学习偏好设置';

-- 示例content_features JSON结构
/*
content_features 示例：
{
  "topics": ["JavaScript", "React", "前端开发"],
  "prerequisites": ["HTML基础", "CSS基础"],
  "learning_outcomes": ["掌握React组件开发", "理解状态管理", "能够构建单页应用"],
  "suitable_for_obstacles": ["knowledge_gap", "technical_issue"],
  "keywords": ["组件", "状态", "生命周期", "Hook"],
  "complexity_indicators": {
    "code_examples": true,
    "practical_exercises": true,
    "theory_heavy": false
  }
}
*/
