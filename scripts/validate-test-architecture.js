#!/usr/bin/env node

/**
 * 测试架构验证脚本
 * 检查测试配置和结构的完整性
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TestArchitectureValidator {
  constructor() {
    this.projectRoot = process.cwd();
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  // 验证目录结构
  validateDirectoryStructure() {
    console.log('🔍 验证测试目录结构...');
    
    const requiredDirs = [
      'src/__tests__',
      'src/__tests__/api',
      'src/__tests__/components',
      'src/__tests__/hooks',
      'src/__tests__/integration',
      'src/__tests__/lib',
      'src/__tests__/utils',
      'src/__tests__/setup'
    ];

    requiredDirs.forEach(dir => {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        this.passed.push(`✅ 目录存在: ${dir}`);
      } else {
        this.errors.push(`❌ 缺少目录: ${dir}`);
      }
    });
  }

  // 验证配置文件
  validateConfigFiles() {
    console.log('🔍 验证配置文件...');
    
    const configFiles = [
      { file: 'jest.config.js', required: true },
      { file: 'jest.setup.js', required: true },
      { file: 'package.json', required: true },
      { file: 'tsconfig.json', required: true }
    ];

    configFiles.forEach(({ file, required }) => {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        this.passed.push(`✅ 配置文件存在: ${file}`);
        this.validateConfigContent(file, fullPath);
      } else if (required) {
        this.errors.push(`❌ 缺少配置文件: ${file}`);
      } else {
        this.warnings.push(`⚠️  可选配置文件不存在: ${file}`);
      }
    });
  }

  // 验证配置文件内容
  validateConfigContent(filename, filepath) {
    try {
      if (filename === 'jest.config.js') {
        const config = require(filepath);
        
        // 检查必要的配置项
        const requiredConfigs = [
          'preset',
          'testEnvironment',
          'setupFilesAfterEnv',
          'testMatch',
          'moduleNameMapper',
          'collectCoverageFrom',
          'coverageThreshold'
        ];

        requiredConfigs.forEach(configKey => {
          if (config[configKey]) {
            this.passed.push(`✅ Jest配置包含: ${configKey}`);
          } else {
            this.warnings.push(`⚠️  Jest配置缺少: ${configKey}`);
          }
        });

        // 检查覆盖率阈值
        if (config.coverageThreshold && config.coverageThreshold.global) {
          const thresholds = config.coverageThreshold.global;
          const minThreshold = 60;
          
          ['branches', 'functions', 'lines', 'statements'].forEach(metric => {
            if (thresholds[metric] >= minThreshold) {
              this.passed.push(`✅ 覆盖率阈值合理: ${metric} >= ${minThreshold}%`);
            } else {
              this.warnings.push(`⚠️  覆盖率阈值偏低: ${metric} = ${thresholds[metric]}%`);
            }
          });
        }
      }

      if (filename === 'package.json') {
        const pkg = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        // 检查测试脚本
        const requiredScripts = [
          'test',
          'test:watch',
          'test:coverage',
          'test:ci'
        ];

        requiredScripts.forEach(script => {
          if (pkg.scripts && pkg.scripts[script]) {
            this.passed.push(`✅ 测试脚本存在: ${script}`);
          } else {
            this.warnings.push(`⚠️  测试脚本缺少: ${script}`);
          }
        });

        // 检查测试依赖
        const requiredDevDeps = [
          '@testing-library/react',
          '@testing-library/jest-dom',
          'jest',
          'ts-jest'
        ];

        requiredDevDeps.forEach(dep => {
          if (pkg.devDependencies && pkg.devDependencies[dep]) {
            this.passed.push(`✅ 测试依赖存在: ${dep}`);
          } else {
            this.errors.push(`❌ 缺少测试依赖: ${dep}`);
          }
        });
      }
    } catch (error) {
      this.errors.push(`❌ 配置文件解析错误 ${filename}: ${error.message}`);
    }
  }

  // 验证测试工具文件
  validateTestUtils() {
    console.log('🔍 验证测试工具文件...');
    
    const utilFiles = [
      'src/__tests__/utils/test-utils.tsx',
      'src/__tests__/utils/mock-data.ts',
      'src/__tests__/utils/test-helpers.ts'
    ];

    utilFiles.forEach(file => {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        this.passed.push(`✅ 测试工具文件存在: ${file}`);
        
        // 检查文件内容
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.length > 100) {
          this.passed.push(`✅ 测试工具文件有内容: ${file}`);
        } else {
          this.warnings.push(`⚠️  测试工具文件内容较少: ${file}`);
        }
      } else {
        this.errors.push(`❌ 缺少测试工具文件: ${file}`);
      }
    });
  }

  // 验证测试文件命名规范
  validateTestFileNaming() {
    console.log('🔍 验证测试文件命名规范...');
    
    const testDirs = [
      'src/__tests__/api',
      'src/__tests__/components',
      'src/__tests__/hooks',
      'src/__tests__/integration',
      'src/__tests__/lib'
    ];

    testDirs.forEach(dir => {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        const testFiles = files.filter(file => 
          file.endsWith('.test.ts') || 
          file.endsWith('.test.tsx') || 
          file.endsWith('.integration.test.ts')
        );

        if (testFiles.length > 0) {
          this.passed.push(`✅ 测试文件存在于: ${dir} (${testFiles.length}个文件)`);
          
          // 检查命名规范
          testFiles.forEach(file => {
            if (dir.includes('integration') && !file.includes('.integration.test.')) {
              this.warnings.push(`⚠️  集成测试文件命名不规范: ${file}`);
            }
          });
        } else {
          this.warnings.push(`⚠️  目录中无测试文件: ${dir}`);
        }
      }
    });
  }

  // 运行基本测试
  runBasicTests() {
    console.log('🔍 运行基本测试验证...');
    
    try {
      // 运行一个简单的测试来验证配置
      const result = execSync('npm test -- --testNamePattern="应该能够运行基本测试" --passWithNoTests', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 30000
      });
      
      if (result.includes('PASS') || result.includes('passed')) {
        this.passed.push('✅ 基本测试运行成功');
      } else {
        this.warnings.push('⚠️  基本测试运行但结果不明确');
      }
    } catch (error) {
      this.errors.push(`❌ 基本测试运行失败: ${error.message}`);
    }
  }

  // 检查测试覆盖率配置
  validateCoverageConfig() {
    console.log('🔍 验证测试覆盖率配置...');
    
    try {
      const configPath = path.join(this.projectRoot, 'jest.config.js');
      const config = require(configPath);
      
      if (config.collectCoverageFrom) {
        this.passed.push('✅ 覆盖率收集配置存在');
        
        // 检查是否排除了不必要的文件
        const excludePatterns = config.collectCoverageFrom.filter(pattern => pattern.startsWith('!'));
        if (excludePatterns.length > 0) {
          this.passed.push(`✅ 覆盖率排除配置: ${excludePatterns.length}个模式`);
        } else {
          this.warnings.push('⚠️  建议添加覆盖率排除配置');
        }
      } else {
        this.warnings.push('⚠️  缺少覆盖率收集配置');
      }
      
      if (config.coverageReporters) {
        this.passed.push(`✅ 覆盖率报告器配置: ${config.coverageReporters.join(', ')}`);
      } else {
        this.warnings.push('⚠️  建议配置覆盖率报告器');
      }
    } catch (error) {
      this.errors.push(`❌ 覆盖率配置检查失败: ${error.message}`);
    }
  }

  // 生成报告
  generateReport() {
    console.log('\n📊 测试架构验证报告');
    console.log('='.repeat(50));
    
    console.log(`\n✅ 通过检查: ${this.passed.length}项`);
    this.passed.forEach(item => console.log(`  ${item}`));
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  警告: ${this.warnings.length}项`);
      this.warnings.forEach(item => console.log(`  ${item}`));
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ 错误: ${this.errors.length}项`);
      this.errors.forEach(item => console.log(`  ${item}`));
    }
    
    console.log('\n📈 总体评分');
    const total = this.passed.length + this.warnings.length + this.errors.length;
    const score = total > 0 ? Math.round((this.passed.length / total) * 100) : 0;
    
    console.log(`  总检查项: ${total}`);
    console.log(`  通过率: ${score}%`);
    
    if (score >= 90) {
      console.log('  评级: 🌟 优秀');
    } else if (score >= 75) {
      console.log('  评级: 👍 良好');
    } else if (score >= 60) {
      console.log('  评级: ⚠️  需要改进');
    } else {
      console.log('  评级: ❌ 需要重大改进');
    }
    
    console.log('\n💡 建议');
    if (this.errors.length > 0) {
      console.log('  1. 优先修复所有错误项');
    }
    if (this.warnings.length > 0) {
      console.log('  2. 考虑解决警告项以提升测试质量');
    }
    console.log('  3. 定期运行此验证脚本确保测试架构健康');
    console.log('  4. 参考 docs/testing-standards.md 了解详细标准');
    
    return this.errors.length === 0;
  }

  // 运行所有验证
  async validate() {
    console.log('🚀 开始测试架构验证...');
    console.log('='.repeat(50));
    
    this.validateDirectoryStructure();
    this.validateConfigFiles();
    this.validateTestUtils();
    this.validateTestFileNaming();
    this.validateCoverageConfig();
    this.runBasicTests();
    
    return this.generateReport();
  }
}

// 运行验证
if (require.main === module) {
  const validator = new TestArchitectureValidator();
  validator.validate().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('验证过程中发生错误:', error);
    process.exit(1);
  });
}

module.exports = TestArchitectureValidator;