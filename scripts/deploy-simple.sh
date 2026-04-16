#!/bin/bash

# 简单部署脚本
set -e

echo "🚀 开始部署到 Vercel..."

# 先设置环境变量
echo "设置环境变量..."

# 读取环境变量
source .env.production.local

# 设置 Vercel 环境变量
vercel env add DATABASE_URL production <<< "$DATABASE_URL"
vercel env add JWT_SECRET production <<< "$JWT_SECRET"
vercel env add NEXTAUTH_SECRET production <<< "$NEXTAUTH_SECRET"

echo "开始部署..."
vercel --prod

echo "🎉 部署完成！"