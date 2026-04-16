#!/bin/bash

# 自动部署脚本 - 芯智育才平台
# 本脚本会自动配置环境变量并部署到 Vercel

set -e

echo "🚀 开始自动部署到 Vercel..."

# 检查 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "正在安装 Vercel CLI..."
    npm i -g vercel
fi

# 检查是否已登录 Vercel
if ! vercel whoami &> /dev/null; then
    echo "请先登录 Vercel："
    vercel login
fi

# 读取环境变量
if [ -f .env.production.local ]; then
    echo "✅ 找到生产环境配置文件"
    source .env.production.local
else
    echo "❌ 找不到 .env.production.local 文件"
    exit 1
fi

# 部署到 Vercel 并设置环境变量
echo "正在部署到 Vercel..."

# 检查是否已经链接到项目
if ! vercel list 2>/dev/null | grep -q "educog-micro"; then
    echo "首次部署，设置项目名称..."
    # 使用 Vercel CLI 设置环境变量并部署
    vercel --prod \
      --name educog-micro \
      --env DATABASE_URL="$DATABASE_URL" \
      --env JWT_SECRET="$JWT_SECRET" \
      --env NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
      --env NODE_ENV="production" \
      --yes
else
    echo "更新现有部署..."
    # 项目已存在，直接部署
    vercel --prod \
      --env DATABASE_URL="$DATABASE_URL" \
      --env JWT_SECRET="$JWT_SECRET" \
      --env NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
      --env NODE_ENV="production" \
      --yes
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "下一步："
echo "1. 访问你的应用 URL"
echo "2. 运行数据库初始化（如果是首次部署）"
echo "   vercel env pull .env.local"
echo "   npm run prisma:push"
echo "   npm run prisma:seed"