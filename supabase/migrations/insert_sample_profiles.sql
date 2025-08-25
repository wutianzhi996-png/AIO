-- 插入一些示例用户档案数据（仅用于演示，实际部署时可以删除）
-- 注意：这些是示例数据，实际使用时应该删除或修改

DO $$
DECLARE
    sample_user_id UUID;
BEGIN
    -- 为清华大学创建示例数据
    INSERT INTO user_profiles (user_id, province, university, major) VALUES
    (gen_random_uuid(), '北京市', '清华大学', '计算机科学与技术'),
    (gen_random_uuid(), '北京市', '清华大学', '计算机科学与技术'),
    (gen_random_uuid(), '北京市', '清华大学', '计算机科学与技术'),
    (gen_random_uuid(), '北京市', '清华大学', '软件工程'),
    (gen_random_uuid(), '北京市', '清华大学', '软件工程'),
    (gen_random_uuid(), '北京市', '清华大学', '人工智能'),
    (gen_random_uuid(), '北京市', '清华大学', '人工智能'),
    (gen_random_uuid(), '北京市', '清华大学', '人工智能'),
    (gen_random_uuid(), '北京市', '清华大学', '人工智能'),
    (gen_random_uuid(), '北京市', '清华大学', '电子信息工程'),
    (gen_random_uuid(), '北京市', '清华大学', '电子信息工程'),
    (gen_random_uuid(), '北京市', '清华大学', '机械工程'),
    (gen_random_uuid(), '北京市', '清华大学', '机械工程'),
    (gen_random_uuid(), '北京市', '清华大学', '土木工程'),
    (gen_random_uuid(), '北京市', '清华大学', '金融学');

    -- 为北京大学创建示例数据
    INSERT INTO user_profiles (user_id, province, university, major) VALUES
    (gen_random_uuid(), '北京市', '北京大学', '计算机科学与技术'),
    (gen_random_uuid(), '北京市', '北京大学', '计算机科学与技术'),
    (gen_random_uuid(), '北京市', '北京大学', '软件工程'),
    (gen_random_uuid(), '北京市', '北京大学', '数学与应用数学'),
    (gen_random_uuid(), '北京市', '北京大学', '数学与应用数学'),
    (gen_random_uuid(), '北京市', '北京大学', '数学与应用数学'),
    (gen_random_uuid(), '北京市', '北京大学', '物理学'),
    (gen_random_uuid(), '北京市', '北京大学', '物理学'),
    (gen_random_uuid(), '北京市', '北京大学', '经济学'),
    (gen_random_uuid(), '北京市', '北京大学', '经济学'),
    (gen_random_uuid(), '北京市', '北京大学', '法学'),
    (gen_random_uuid(), '北京市', '北京大学', '心理学');

    -- 为复旦大学创建示例数据
    INSERT INTO user_profiles (user_id, province, university, major) VALUES
    (gen_random_uuid(), '上海市', '复旦大学', '计算机科学与技术'),
    (gen_random_uuid(), '上海市', '复旦大学', '计算机科学与技术'),
    (gen_random_uuid(), '上海市', '复旦大学', '临床医学'),
    (gen_random_uuid(), '上海市', '复旦大学', '临床医学'),
    (gen_random_uuid(), '上海市', '复旦大学', '临床医学'),
    (gen_random_uuid(), '上海市', '复旦大学', '临床医学'),
    (gen_random_uuid(), '上海市', '复旦大学', '金融学'),
    (gen_random_uuid(), '上海市', '复旦大学', '金融学'),
    (gen_random_uuid(), '上海市', '复旦大学', '新闻学'),
    (gen_random_uuid(), '上海市', '复旦大学', '化学'),
    (gen_random_uuid(), '上海市', '复旦大学', '生物科学');

END $$;