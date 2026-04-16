#!/bin/bash

echo "🔍 验证 Vercel 部署配置..."

# 检查是否已登录 Vercel
if ! vercel whoami > /dev/null 2>&1; then
  echo "❌ 未登录 Vercel，请运行: vercel login"
  exit 1
fi

echo "✅ 已登录 Vercel"

# 检查项目链接
if [ ! -f ".vercel/project.json" ]; then
  echo "❌ 项目未链接到 Vercel"
  echo "运行: vercel link"
  exit 1
fi

PROJECT_NAME=$(cat .vercel/project.json | grep '"name"' | cut -d'"' -f4)
echo "✅ 项目已链接: $PROJECT_NAME"

# 列出环境变量
echo ""
echo "📋 生产环境变量:"
vercel env ls production

echo ""
echo "🔧 如需更新部署:"
echo "1. 确保 .env.production.local 包含所有必需的环境变量"
echo "2. 运行: vercel --prod"
echo ""
echo "🌐 访问测试页面:"
echo "- https://$PROJECT_NAME.vercel.app/api/middleware-test"
echo "- https://$PROJECT_NAME.vercel.app/welcome"
echo "- https://$PROJECT_NAME.vercel.app/login"