#!/bin/bash

# 部署脚本 - 芯智育才平台
# 使用方法: ./scripts/deploy.sh [production|staging]

set -e

ENV=${1:-production}
echo "🚀 开始部署到 $ENV 环境..."

# 检查必要的工具
command -v git >/dev/null 2>&1 || { echo "❌ 需要安装 git"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ 需要安装 node.js"; exit 1; }
command -v vercel >/dev/null 2>&1 || { echo "❌ 需要安装 vercel CLI: npm i -g vercel"; exit 1; }

# 检查环境变量文件
if [ ! -f ".env.$ENV" ]; then
    echo "❌ 找不到环境变量文件: .env.$ENV"
    echo "请创建 .env.$ENV 文件并配置以下变量:"
    echo "  - DATABASE_URL"
    echo "  - JWT_SECRET"
    echo "  - NEXTAUTH_SECRET"
    exit 1
fi

# 运行测试
echo "📋 运行类型检查..."
npm run typecheck

# 构建项目
echo "🔨 构建项目..."
npm run build

# 生成 Prisma 客户端
echo "🗄️ 生成 Prisma 客户端..."
npx prisma generate

# 部署到 Vercel
echo "☁️ 部署到 Vercel..."
if [ "$ENV" = "production" ]; then
    vercel --prod
else
    vercel
fi

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
if [ "$ENV" = "production" ]; then
    read -p "⚠️  确定要在生产环境运行数据库迁移吗? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx prisma migrate deploy
    fi
else
    npx prisma db push
fi

echo "✅ 部署完成!"
echo ""
echo "下一步:"
echo "1. 访问 Vercel 控制台查看部署状态"
echo "2. 检查应用日志确保一切正常"
echo "3. 如果是首次部署，运行种子数据: npm run prisma:seed"