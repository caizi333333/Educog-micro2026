-- 初始化数据库脚本
-- 这个脚本会在PostgreSQL容器首次启动时执行

-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE educog_micro'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'educog_micro')\gexec

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建扩展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE educog_micro TO educog_user;