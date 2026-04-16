#!/bin/bash

# 芯智育才 - Vercel 部署修复脚本
# 此脚本将自动检查和修复常见的Vercel部署问题

set -e

echo "🔧 芯智育才 - Vercel 部署修复脚本"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否安装了必要的工具
check_tools() {
    echo -e "${BLUE}检查必要工具...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安装${NC}"
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}⚠️  Vercel CLI 未安装，正在安装...${NC}"
        npm install -g vercel
    fi
    
    echo -e "${GREEN}✅ 所有工具检查通过${NC}"
}

# 生成环境变量
generate_env_vars() {
    echo -e "${BLUE}生成环境变量...${NC}"
    
    # 生成JWT_SECRET
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # 生成NEXTAUTH_SECRET
    NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # 生成JWT_REFRESH_SECRET
    JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # 生成PEPPER
    PEPPER=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
    
    echo -e "${GREEN}✅ 环境变量生成完成${NC}"
    echo -e "${YELLOW}请保存以下环境变量：${NC}"
    echo "JWT_SECRET=${JWT_SECRET}"
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
    echo "JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}"
    echo "PEPPER=${PEPPER}"
}

# 检查环境变量
check_env_vars() {
    echo -e "${BLUE}检查环境变量配置...${NC}"
    
    # 检查是否已设置环境变量
    if vercel env ls production | grep -q "DATABASE_URL"; then
        echo -e "${GREEN}✅ DATABASE_URL 已设置${NC}"
    else
        echo -e "${RED}❌ DATABASE_URL 未设置${NC}"
        echo -e "${YELLOW}请设置数据库连接字符串：${NC}"
        echo "vercel env add DATABASE_URL production"
        ENV_MISSING=true
    fi
    
    if vercel env ls production | grep -q "JWT_SECRET"; then
        echo -e "${GREEN}✅ JWT_SECRET 已设置${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET 未设置${NC}"
        echo -e "${YELLOW}请运行: vercel env add JWT_SECRET production${NC}"
        ENV_MISSING=true
    fi
    
    if vercel env ls production | grep -q "NEXTAUTH_SECRET"; then
        echo -e "${GREEN}✅ NEXTAUTH_SECRET 已设置${NC}"
    else
        echo -e "${RED}❌ NEXTAUTH_SECRET 未设置${NC}"
        echo -e "${YELLOW}请运行: vercel env add NEXTAUTH_SECRET production${NC}"
        ENV_MISSING=true
    fi
}

# 检查数据库连接
check_database() {
    echo -e "${BLUE}检查数据库连接...${NC}"
    
    # 拉取环境变量到本地
    if vercel env pull .env.local.temp; then
        echo -e "${GREEN}✅ 环境变量拉取成功${NC}"
        
        # 测试数据库连接
        if npm run prisma:push &> /dev/null; then
            echo -e "${GREEN}✅ 数据库连接正常${NC}"
        else
            echo -e "${RED}❌ 数据库连接失败${NC}"
            echo -e "${YELLOW}请检查 DATABASE_URL 是否正确${NC}"
        fi
        
        # 清理临时文件
        rm -f .env.local.temp
    else
        echo -e "${RED}❌ 无法拉取环境变量${NC}"
    fi
}

# 检查构建
check_build() {
    echo -e "${BLUE}检查构建配置...${NC}"
    
    # 检查是否需要生成Prisma客户端
    if npx prisma generate; then
        echo -e "${GREEN}✅ Prisma 客户端生成成功${NC}"
    else
        echo -e "${RED}❌ Prisma 客户端生成失败${NC}"
        exit 1
    fi
    
    # 尝试构建
    if npm run build; then
        echo -e "${GREEN}✅ 构建成功${NC}"
    else
        echo -e "${RED}❌ 构建失败${NC}"
        echo -e "${YELLOW}请检查构建日志中的错误${NC}"
        exit 1
    fi
}

# 部署到Vercel
deploy_to_vercel() {
    echo -e "${BLUE}部署到 Vercel...${NC}"
    
    # 强制重新部署
    if vercel --prod --force; then
        echo -e "${GREEN}✅ 部署成功${NC}"
    else
        echo -e "${RED}❌ 部署失败${NC}"
        exit 1
    fi
}

# 监控部署状态
monitor_deployment() {
    echo -e "${BLUE}监控部署状态...${NC}"
    
    # 获取部署URL
    DEPLOYMENT_URL=$(vercel ls --limit 1 --json | jq -r '.[0].url')
    
    echo -e "${GREEN}✅ 部署完成${NC}"
    echo -e "${YELLOW}部署URL: https://${DEPLOYMENT_URL}${NC}"
    
    # 测试部署
    echo -e "${BLUE}测试部署...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" "https://${DEPLOYMENT_URL}" | grep -q "200"; then
        echo -e "${GREEN}✅ 部署正常运行${NC}"
    else
        echo -e "${RED}❌ 部署可能存在问题${NC}"
        echo -e "${YELLOW}请检查部署日志: vercel logs${NC}"
    fi
}

# 主执行流程
main() {
    echo -e "${BLUE}开始修复 Vercel 部署问题...${NC}"
    
    # 检查工具
    check_tools
    
    # 生成环境变量（如果需要）
    if [[ $1 == "--generate-env" ]]; then
        generate_env_vars
        exit 0
    fi
    
    # 检查环境变量
    check_env_vars
    
    # 如果环境变量缺失，退出
    if [[ $ENV_MISSING == true ]]; then
        echo -e "${RED}❌ 请先设置缺失的环境变量${NC}"
        echo -e "${YELLOW}运行 $0 --generate-env 生成新的环境变量${NC}"
        exit 1
    fi
    
    # 检查数据库
    check_database
    
    # 检查构建
    check_build
    
    # 部署
    deploy_to_vercel
    
    # 监控部署
    monitor_deployment
    
    echo -e "${GREEN}🎉 部署修复完成！${NC}"
    echo -e "${YELLOW}如果仍有问题，请查看详细日志：${NC}"
    echo "vercel logs --follow"
}

# 使用说明
usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --generate-env    生成新的环境变量"
    echo "  --help           显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                # 运行完整的修复流程"
    echo "  $0 --generate-env # 仅生成环境变量"
}

# 参数处理
case $1 in
    --help)
        usage
        exit 0
        ;;
    --generate-env)
        check_tools
        generate_env_vars
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac 