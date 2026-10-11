-- 跨端数据同步 · 共享 schema 幂等迁移
-- 目标：让小程序与 App 共用同一套 Supabase 表，以「手机号」作为同一客户标识。
-- 该脚本可重复执行（IF NOT EXISTS 幂等）。

-- 1) users 增加共享身份与资料字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS openid varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;

-- 2) users 增加健康指标列（打卡后回写；若线上表已存在则跳过）
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_weight numeric(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_waist numeric(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bmi numeric(4,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bmi_level varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_fat_rate numeric(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_fat_level varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS waist_level varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_date varchar(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_weight numeric(5,1);

-- 3) 手机号唯一索引（Postgres 唯一索引对 NULL 不冲突，可安全创建）
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users(phone);

-- 4) 意见反馈表
CREATE TABLE IF NOT EXISTS feedback (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  contact varchar(128),
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
