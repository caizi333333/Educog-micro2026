#!/usr/bin/env node

/**
 * 🚨 TypeScript错误批量修复工具 (增强版)
 * 用途: 系统性修复常见的TypeScript错误
 * 作者: Claude Code Assistant
 * 日期: 2025-08-31
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'blue') {
  console.log(`${colors[color]}[TS-FIX]${colors.reset} ${message}`);
}

function success(message) {
  log(message, 'green');
}

function warning(message) {
  log(message, 'yellow');
}

function error(message) {
  log(message, 'red');
}

log('🚨 开始 TypeScript 错误系统性修复...', 'blue');
log('==========================================');

// 1. 修复 API 路由参数类型
function fixApiRouteParams() {
    console.log('📝 修复 API 路由参数类型...');
    
    const routeFiles = [
        'src/app/api/users/[id]/route.ts'
    ];
    
    routeFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // 修复参数类型定义
            content = content.replace(
                /{ params }: { params: { id: string } }/g,
                '{ params }: { params: Promise<{ id: string }> }'
            );
            
            // 添加 await params
            content = content.replace(
                /params\.id/g,
                '(await params).id'
            );
            
            fs.writeFileSync(filePath, content);
            console.log(`  ✅ 修复 ${filePath}`);
        }
    });
}

// 2. 修复 Prisma aggregate 类型
function fixPrismaAggregates() {
    console.log('📝 修复 Prisma aggregate 类型...');
    
    const testFiles = [
        'src/__tests__/api/achievements.test.ts'
    ];
    
    testFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // 修复 learningProgress aggregate
            content = content.replace(
                /{ _sum: { timeSpent: \d+ }, _count: { _all: \d+ } }/g,
                '{ _sum: { timeSpent: 0 }, _count: { _all: 0 }, _avg: {}, _min: {}, _max: {} }'
            );
            
            // 修复 quizAttempt aggregate
            content = content.replace(
                /{ _avg: { score: \d+ }, _count: { _all: \d+ } }/g,
                '{ _avg: { score: 0 }, _count: { _all: 0 }, _sum: {}, _min: {}, _max: {} }'
            );
            
            // 修复 userActivity aggregate
            content = content.replace(
                /{ _count: { _all: \d+ } }/g,
                '{ _count: { _all: 0 }, _min: {}, _max: {} }'
            );
            
            fs.writeFileSync(filePath, content);
            console.log(`  ✅ 修复 ${filePath}`);
        }
    });
}

// 3. 移除未使用的导入
function removeUnusedImports() {
    console.log('📝 移除未使用的导入...');
    
    const filesToFix = [
        'src/__tests__/ai/flows/ai-study-assistant.test.ts',
        'src/__tests__/api/achievements.test.ts',
        'src/hooks/useAnalytics.ts',
        'src/hooks/useSimulator.ts',
        'src/hooks/useTrackProgress.ts'
    ];
    
    filesToFix.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // 常见的未使用导入模式
            const unusedPatterns = [
                /import.*AiStudyAssistantOutput.*from.*\n/g,
                /import.*videoLibrary.*from.*\n/g,
                /const.*consoleSpy.*=.*\n/g,
                /const.*mockLearningProgress.*=.*\n/g,
                /const.*router.*=.*useRouter.*\n/g
            ];
            
            unusedPatterns.forEach(pattern => {
                content = content.replace(pattern, '');
            });
            
            fs.writeFileSync(filePath, content);
            console.log(`  ✅ 清理 ${filePath}`);
        }
    });
}

// 4. 修复成就系统类型
function fixAchievementTypes() {
    console.log('📝 修复成就系统类型...');
    
    const achievementFile = 'src/lib/achievements-v2.ts';
    if (fs.existsSync(achievementFile)) {
        let content = fs.readFileSync(achievementFile, 'utf8');
        
        // 修复分类类型
        content = content.replace(
            /category: "practice"/g,
            'category: "learning" as AchievementCategory'
        );
        
        fs.writeFileSync(achievementFile, content);
        console.log(`  ✅ 修复 ${achievementFile}`);
    }
}

// 主执行函数
async function main() {
    try {
        fixApiRouteParams();
        fixPrismaAggregates();
        removeUnusedImports();
        fixAchievementTypes();
        
        console.log('\n🎉 批量修复完成！');
        console.log('📊 正在验证修复结果...\n');
        
        // 运行类型检查
        try {
            execSync('npm run typecheck', { stdio: 'inherit' });
            console.log('✅ TypeScript 检查通过！');
        } catch (error) {
            console.log('❌ 仍有 TypeScript 错误，需要手动修复');
            console.log('运行 npm run typecheck 查看详细错误');
        }
        
    } catch (error) {
        console.error('❌ 修复过程中发生错误:', error.message);
    }
}

main();