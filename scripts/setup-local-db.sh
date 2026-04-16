#!/bin/bash

# 本地数据库设置脚本
# 此脚本将启动本地PostgreSQL数据库并运行必要的迁移

set -e

echo "🚀 开始设置本地数据库..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    echo "访问 https://docs.docker.com/get-docker/ 获取安装指南"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker和Docker Compose已安装"

# 停止现有容器（如果存在）
echo "🛑 停止现有数据库容器..."
docker-compose down 2>/dev/null || true

# 启动数据库容器
echo "🐘 启动PostgreSQL数据库容器..."
docker-compose up -d postgres

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 10

# 检查数据库是否健康
echo "🔍 检查数据库连接..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U educog_user -d educog_micro > /dev/null 2>&1; then
        echo "✅ 数据库连接成功！"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ 数据库启动失败，请检查Docker日志"
        docker-compose logs postgres
        exit 1
    fi
    
    echo "⏳ 等待数据库启动... (尝试 $attempt/$max_attempts)"
    sleep 2
    attempt=$((attempt + 1))
done

# 备份当前.env文件
if [ -f ".env" ]; then
    echo "📋 备份当前.env文件为.env.backup"
    cp .env .env.backup
fi

# 复制本地配置
echo "📝 更新环境变量配置..."
cp .env.local .env

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装项目依赖..."
    npm install
fi

# 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npx prisma generate

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
npx prisma db push

# 可选：填充种子数据
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
    echo "🌱 填充种子数据..."
    npx prisma db seed 2>/dev/null || echo "⚠️ 种子数据填充失败或未配置"
fi

echo ""
echo "🎉 本地数据库设置完成！"
echo ""
echo "📊 数据库信息:"
echo "  - 主机: localhost"
echo "  - 端口: 5432"
echo "  - 数据库: educog_micro"
echo "  - 用户名: educog_user"
echo "  - 密码: educog_password"
echo ""
echo "🔧 常用命令:"
echo "  - 启动数据库: docker-compose up -d postgres"
echo "  - 停止数据库: docker-compose down"
echo "  - 查看数据库日志: docker-compose logs postgres"
echo "  - 连接数据库: docker-compose exec postgres psql -U educog_user -d educog_micro"
echo "  - 重置数据库: npx prisma db push --force-reset"
echo ""
echo "🚀 现在可以运行 'npm run dev' 启动应用了！"