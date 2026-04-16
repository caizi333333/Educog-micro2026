#!/bin/bash

echo "🔧 生成 Prisma 数据库迁移..."

# 检查是否提供了迁移名称
if [ -z "$1" ]; then
  echo "❌ 请提供迁移名称"
  echo "用法: npm run db:migrate <migration-name>"
  exit 1
fi

# 从环境文件加载数据库URL
if [ -f .env.production.local ]; then
  export $(cat .env.production.local | grep DATABASE_URL | xargs)
fi

# 生成迁移
echo "正在生成迁移: $1"
npx prisma migrate dev --name "$1"

echo "✅ 迁移生成完成！"
echo ""
echo "下一步："
echo "1. 部署到生产环境: vercel --prod"
echo "2. 在生产环境运行迁移: 迁移会在部署时自动运行"