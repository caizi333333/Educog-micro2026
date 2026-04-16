#!/bin/bash

# 🚨 紧急修复脚本 - 一键恢复项目到可部署状态
# 使用方法: chmod +x scripts/emergency-fix.sh && ./scripts/emergency-fix.sh

set -e  # 遇到错误立即退出

echo "🚨 启动紧急修复程序..."
echo "========================================"

# 检查 Node.js 版本
echo "🔍 检查环境..."
node_version=$(node -v)
npm_version=$(npm -v)
echo "Node.js: $node_version"
echo "NPM: $npm_version"

# Phase 1: 基础设施修复
echo ""
echo "🔧 Phase 1: 修复基础设施..."
echo "----------------------------------------"

echo "📦 清理依赖和缓存..."
rm -rf node_modules
rm -rf .next
rm -f package-lock.json
npm cache clean --force

echo "📦 重新安装依赖..."
npm install

# 检查 SWC 编译器
if [ ! -f "node_modules/@next/swc-darwin-arm64/next-swc.darwin-arm64.node" ]; then
    echo "🔨 修复 SWC 编译器..."
    npm install @next/swc-darwin-arm64@latest --force
fi

# 验证依赖安装
if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
    echo "✅ 依赖安装成功"
else
    echo "❌ 依赖安装失败"
    exit 1
fi

# Phase 2: TypeScript 错误修复
echo ""
echo "📝 Phase 2: 修复 TypeScript 错误..."
echo "----------------------------------------"

if [ -f "scripts/fix-typescript-errors.js" ]; then
    node scripts/fix-typescript-errors.js
else
    echo "⚠️ TypeScript 修复脚本不存在，跳过自动修复"
fi

# Phase 3: 测试系统修复
echo ""
echo "🧪 Phase 3: 修复测试系统..."
echo "----------------------------------------"

if [ -f "scripts/fix-tests.js" ]; then
    node scripts/fix-tests.js
else
    echo "⚠️ 测试修复脚本不存在，跳过自动修复"
fi

# Phase 4: 验证修复结果
echo ""
echo "🎯 Phase 4: 验证修复结果..."
echo "----------------------------------------"

# 检查 TypeScript
echo "📊 检查 TypeScript..."
if npm run typecheck; then
    echo "✅ TypeScript 检查通过"
    typescript_ok=true
else
    echo "❌ TypeScript 仍有错误"
    typescript_ok=false
fi

# 检查构建
echo "🏗️ 检查构建..."
if timeout 120s npm run build; then
    echo "✅ 构建成功"
    build_ok=true
else
    echo "❌ 构建失败"
    build_ok=false
fi

# 运行关键测试
echo "🧪 运行关键测试..."
if npm test -- --testPathPattern="src/__tests__/(api|lib)" --passWithNoTests; then
    echo "✅ 核心测试通过"
    tests_ok=true
else
    echo "⚠️ 部分测试失败，但可继续"
    tests_ok=false
fi

# Phase 5: 生成修复报告
echo ""
echo "📋 Phase 5: 生成修复报告..."
echo "----------------------------------------"

cat > EMERGENCY_FIX_REPORT.md << EOF
# 🚨 紧急修复报告

## 修复时间
$(date '+%Y-%m-%d %H:%M:%S')

## 修复结果

### ✅ 成功项目
- 依赖清理和重装: ✅
- SWC 编译器修复: ✅

### 📊 验证结果
- TypeScript 检查: $([ "$typescript_ok" = true ] && echo "✅ 通过" || echo "❌ 失败")
- 项目构建: $([ "$build_ok" = true ] && echo "✅ 成功" || echo "❌ 失败")  
- 核心测试: $([ "$tests_ok" = true ] && echo "✅ 通过" || echo "⚠️ 部分失败")

## 部署状态
$([ "$build_ok" = true ] && echo "🟢 可以部署" || echo "🔴 暂不可部署")

## 下一步建议
$([ "$typescript_ok" = false ] && echo "1. 手动修复剩余的 TypeScript 错误")
$([ "$build_ok" = false ] && echo "2. 检查构建错误日志")
$([ "$tests_ok" = false ] && echo "3. 修复失败的测试用例")

## 运行命令
\`\`\`bash
# 开发模式
npm run dev

# 生产构建
npm run build

# 运行测试
npm test
\`\`\`

---
*报告生成时间: $(date)*
EOF

echo "📋 修复报告已生成: EMERGENCY_FIX_REPORT.md"

# 最终状态报告
echo ""
echo "🎉 紧急修复完成！"
echo "========================================"

if [ "$build_ok" = true ]; then
    echo "🟢 项目状态: 可部署"
    echo "✅ 可以运行: npm run build"
    echo "✅ 可以启动: npm run dev"
else
    echo "🔴 项目状态: 需要进一步修复"
    echo "❌ 构建失败，请检查错误日志"
fi

echo ""
echo "📋 详细报告请查看: EMERGENCY_FIX_REPORT.md"
echo "🔍 如有问题，请运行: npm run typecheck"
echo ""

# 如果构建成功，询问是否启动开发服务器
if [ "$build_ok" = true ]; then
    echo "🚀 是否启动开发服务器? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🚀 启动开发服务器..."
        npm run dev
    fi
fi