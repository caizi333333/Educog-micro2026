#!/bin/bash

# 一键部署脚本 - 芯智育才平台
# 支持 Vercel, Railway, Render 等平台

set -e

echo "🚀 芯智育才平台一键部署脚本"
echo "================================"
echo ""

# 检查必要工具
check_requirements() {
    local missing=()
    
    command -v git >/dev/null 2>&1 || missing+=("git")
    command -v node >/dev/null 2>&1 || missing+=("node.js")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo "❌ 缺少必要工具: ${missing[*]}"
        echo "请先安装这些工具后再运行此脚本"
        exit 1
    fi
}

# 设置部署平台
select_platform() {
    echo "请选择部署平台:"
    echo "1) Vercel (推荐)"
    echo "2) Railway"
    echo "3) Render"
    echo "4) Heroku"
    echo "5) 自定义服务器"
    
    read -p "请输入选项 (1-5): " platform_choice
    
    case $platform_choice in
        1) deploy_vercel ;;
        2) deploy_railway ;;
        3) deploy_render ;;
        4) deploy_heroku ;;
        5) deploy_custom ;;
        *) echo "无效选项"; exit 1 ;;
    esac
}

# 配置数据库
setup_database() {
    echo ""
    echo "📊 数据库配置"
    echo "请选择数据库服务:"
    echo "1) Neon (PostgreSQL, 免费 3GB)"
    echo "2) Supabase (PostgreSQL, 免费 500MB)"
    echo "3) PlanetScale (MySQL, 免费 5GB)"
    echo "4) 已有数据库"
    
    read -p "请输入选项 (1-4): " db_choice
    
    case $db_choice in
        1) 
            echo "请访问 https://neon.tech 创建数据库"
            echo "创建后，复制连接字符串"
            ;;
        2) 
            echo "请访问 https://supabase.com 创建项目"
            echo "在设置中找到数据库连接字符串"
            ;;
        3) 
            echo "请访问 https://planetscale.com 创建数据库"
            echo "生成连接字符串时选择 'Prisma' 格式"
            ;;
        4) 
            echo "请准备好您的数据库连接字符串"
            ;;
    esac
    
    echo ""
    read -p "请输入数据库连接字符串: " DATABASE_URL
    
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ 数据库连接字符串不能为空"
        exit 1
    fi
}

# 生成密钥
generate_secrets() {
    echo ""
    echo "🔐 生成安全密钥..."
    
    JWT_SECRET=$(openssl rand -hex 32)
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
    
    echo "✅ 密钥生成完成"
}

# Vercel 部署
deploy_vercel() {
    echo ""
    echo "☁️  Vercel 部署"
    
    # 检查是否安装 Vercel CLI
    if ! command -v vercel &> /dev/null; then
        echo "正在安装 Vercel CLI..."
        npm i -g vercel
    fi
    
    setup_database
    generate_secrets
    
    # 创建环境变量文件
    cat > .env.production.local <<EOF
DATABASE_URL="$DATABASE_URL"
JWT_SECRET="$JWT_SECRET"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
EOF
    
    echo ""
    echo "正在部署到 Vercel..."
    vercel --prod
    
    echo ""
    echo "✅ 部署完成！"
    echo ""
    echo "下一步:"
    echo "1. 运行数据库初始化: npm run prisma:push"
    echo "2. 运行种子数据: npm run prisma:seed"
    echo "3. 访问您的应用查看效果"
}

# Railway 部署
deploy_railway() {
    echo ""
    echo "🚂 Railway 部署"
    
    if ! command -v railway &> /dev/null; then
        echo "请先安装 Railway CLI:"
        echo "npm i -g @railway/cli"
        exit 1
    fi
    
    setup_database
    generate_secrets
    
    echo "正在初始化 Railway 项目..."
    railway login
    railway init
    
    # 设置环境变量
    railway variables set DATABASE_URL="$DATABASE_URL"
    railway variables set JWT_SECRET="$JWT_SECRET"
    railway variables set NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
    
    # 部署
    railway up
    
    echo "✅ 部署完成！"
}

# Render 部署
deploy_render() {
    echo ""
    echo "🎨 Render 部署"
    
    setup_database
    generate_secrets
    
    # 创建 render.yaml
    cat > render.yaml <<EOF
services:
  - type: web
    name: educog-micro
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        value: $DATABASE_URL
      - key: JWT_SECRET
        value: $JWT_SECRET
      - key: NEXTAUTH_SECRET
        value: $NEXTAUTH_SECRET
      - key: NODE_ENV
        value: production
EOF
    
    echo "✅ render.yaml 已创建"
    echo ""
    echo "请执行以下步骤:"
    echo "1. 将代码推送到 GitHub"
    echo "2. 访问 https://render.com"
    echo "3. 选择 'New' -> 'Web Service'"
    echo "4. 连接您的 GitHub 仓库"
    echo "5. Render 会自动检测 render.yaml 并部署"
}

# Heroku 部署
deploy_heroku() {
    echo ""
    echo "🟣 Heroku 部署"
    
    if ! command -v heroku &> /dev/null; then
        echo "请先安装 Heroku CLI:"
        echo "https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    setup_database
    generate_secrets
    
    # 创建 Procfile
    echo "web: npm start" > Procfile
    
    # 创建 app.json
    cat > app.json <<EOF
{
  "name": "芯智育才",
  "description": "8051微控制器仿真教育平台",
  "repository": "https://github.com/your-username/educog-micro",
  "scripts": {
    "postdeploy": "npm run prisma:push && npm run prisma:seed"
  },
  "env": {
    "DATABASE_URL": {
      "description": "PostgreSQL数据库连接字符串",
      "required": true
    },
    "JWT_SECRET": {
      "description": "JWT密钥",
      "generator": "secret"
    },
    "NEXTAUTH_SECRET": {
      "description": "NextAuth密钥",
      "generator": "secret"
    }
  },
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ]
}
EOF
    
    echo "正在创建 Heroku 应用..."
    heroku create educog-micro-$RANDOM
    
    # 设置环境变量
    heroku config:set DATABASE_URL="$DATABASE_URL"
    heroku config:set JWT_SECRET="$JWT_SECRET"
    heroku config:set NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
    
    # 部署
    git push heroku main
    
    echo "✅ 部署完成！"
}

# 自定义服务器部署
deploy_custom() {
    echo ""
    echo "🖥️  自定义服务器部署"
    
    setup_database
    generate_secrets
    
    # 创建 docker-compose.yml
    cat > docker-compose.yml <<EOF
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=$DATABASE_URL
      - JWT_SECRET=$JWT_SECRET
      - NEXTAUTH_SECRET=$NEXTAUTH_SECRET
      - NODE_ENV=production
    restart: unless-stopped
EOF
    
    # 创建 Dockerfile
    cat > Dockerfile <<EOF
FROM node:18-alpine AS base

# 依赖安装
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 构建应用
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# 生产环境
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
EOF
    
    echo "✅ Docker 配置已创建"
    echo ""
    echo "部署步骤:"
    echo "1. 将代码上传到服务器"
    echo "2. 运行: docker-compose up -d"
    echo "3. 配置反向代理 (Nginx/Caddy)"
    echo "4. 配置 SSL 证书"
}

# 部署后设置
post_deploy_setup() {
    echo ""
    echo "🎉 部署成功！"
    echo ""
    echo "📋 部署后检查清单:"
    echo "- [ ] 数据库连接是否正常"
    echo "- [ ] 运行数据库迁移: npm run prisma:push"
    echo "- [ ] 运行种子数据: npm run prisma:seed"
    echo "- [ ] 测试登录功能"
    echo "- [ ] 检查所有页面是否正常加载"
    echo ""
    echo "默认账号:"
    echo "管理员: admin / admin123456"
    echo "教师: teacher / teacher123456"
    echo "学生: student / student123456"
    echo ""
    echo "⚠️  重要: 请立即修改默认密码！"
}

# 主函数
main() {
    clear
    check_requirements
    select_platform
    post_deploy_setup
}

# 运行主函数
main