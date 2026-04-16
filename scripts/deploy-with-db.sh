#!/bin/bash

echo "🚀 开始部署 EduCog-Micro 到 Vercel..."

# 检查环境变量
if [ ! -f .env.production.local ]; then
  echo "❌ 未找到 .env.production.local 文件"
  echo "请创建该文件并添加以下环境变量："
  echo "  DATABASE_URL=your-database-url"
  echo "  JWT_SECRET=your-jwt-secret"
  echo "  NEXTAUTH_SECRET=your-nextauth-secret"
  exit 1
fi

# 加载环境变量
export $(cat .env.production.local | xargs)

# 1. 生成 Prisma 客户端
echo "📦 生成 Prisma 客户端..."
npx prisma generate

# 2. 推送数据库架构（如果需要）
echo "🔄 同步数据库架构..."
npx prisma db push --skip-generate

# 3. 设置 Vercel 环境变量（如果尚未设置）
echo "🔧 检查 Vercel 环境变量..."
vercel env ls production | grep -q DATABASE_URL
if [ $? -ne 0 ]; then
  echo "设置环境变量..."
  ./scripts/set-env-vars.sh
fi

# 4. 部署到 Vercel
echo "🚢 部署到 Vercel..."
vercel --prod

# 5. 获取部署 URL
DEPLOYMENT_URL=$(vercel ls --json | jq -r '.[0].url')

echo ""
echo "✅ 部署完成！"
echo ""
echo "📌 部署 URL: https://$DEPLOYMENT_URL"
echo ""
echo "下一步："
echo "1. 初始化数据库（如果是首次部署）："
echo "   curl 'https://$DEPLOYMENT_URL/api/init?secret=init-educog-2024'"
echo ""
echo "2. 访问网站并使用默认账号登录："
echo "   管理员: admin / admin123456"
echo "   教师: teacher / teacher123456"
echo "   学生: student / student123456"