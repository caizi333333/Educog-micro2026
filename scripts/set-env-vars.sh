#!/bin/bash

# 设置 Vercel 环境变量脚本
echo "🔧 设置 Vercel 环境变量..."

# 从本地环境文件读取变量
source .env.production.local

# 设置环境变量
echo "设置 DATABASE_URL..."
echo "$DATABASE_URL" | vercel env add DATABASE_URL production

echo "设置 JWT_SECRET..."
echo "$JWT_SECRET" | vercel env add JWT_SECRET production  

echo "设置 NEXTAUTH_SECRET..."
echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET production

echo "✅ 环境变量设置完成！"
echo ""
echo "现在需要重新部署以使环境变量生效："
echo "vercel --prod"