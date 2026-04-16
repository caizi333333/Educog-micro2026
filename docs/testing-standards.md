# 测试架构标准

## 概述

本文档定义了项目的统一测试架构标准，确保测试代码的一致性、可维护性和高质量。

## 测试分类

### 1. 单元测试 (Unit Tests)
- **目标**: 测试单个函数、类或组件的功能
- **位置**: `src/__tests__/lib/`
- **命名**: `*.test.ts` 或 `*.test.tsx`
- **覆盖率目标**: 80%+

### 2. 集成测试 (Integration Tests)
- **目标**: 测试多个模块之间的交互
- **位置**: `src/__tests__/integration/`
- **命名**: `*.integration.test.ts`
- **覆盖率目标**: 70%+

### 3. API测试 (API Tests)
- **目标**: 测试API端点的功能和响应
- **位置**: `src/__tests__/api/`
- **命名**: `*.test.ts`
- **覆盖率目标**: 85%+

### 4. 组件测试 (Component Tests)
- **目标**: 测试React组件的渲染和交互
- **位置**: `src/__tests__/components/`
- **命名**: `*.test.tsx`
- **覆盖率目标**: 75%+

### 5. Hook测试 (Hook Tests)
- **目标**: 测试自定义React Hooks
- **位置**: `src/__tests__/hooks/`
- **命名**: `*.test.ts`
- **覆盖率目标**: 80%+

## 目录结构

```
src/
├── __tests__/
│   ├── api/                 # API测试
│   │   ├── achievements.test.ts
│   │   ├── auth.test.ts
│   │   └── knowledge-graph.test.ts
│   ├── components/          # 组件测试
│   │   ├── ui/
│   │   ├── achievements/
│   │   └── knowledge-graph/
│   ├── hooks/               # Hook测试
│   │   ├── useAuth.test.ts
│   │   └── useAchievements.test.ts
│   ├── integration/         # 集成测试
│   │   ├── auth-flow.integration.test.ts
│   │   └── achievement-system.integration.test.ts
│   ├── lib/                 # 工具库测试
│   │   ├── achievements-v2.test.ts
│   │   ├── simulator.test.ts
│   │   └── utils.test.ts
│   ├── utils/               # 测试工具
│   │   ├── test-utils.tsx
│   │   ├── mock-data.ts
│   │   └── test-helpers.ts
│   └── setup/               # 测试设置
│       ├── global-setup.ts
│       └── test-environment.ts
```

## 命名规范

### 测试文件命名
- 单元测试: `[module-name].test.ts`
- 集成测试: `[feature-name].integration.test.ts`
- API测试: `[endpoint-name].test.ts`
- 组件测试: `[ComponentName].test.tsx`
- Hook测试: `[hookName].test.ts`

### 测试用例命名
```typescript
// 使用 describe 和 it 的标准格式
describe('ModuleName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // 测试实现
    });
    
    it('should throw error when invalid input provided', () => {
      // 测试实现
    });
  });
});
```

## 测试模式和最佳实践

### 1. AAA模式 (Arrange-Act-Assert)
```typescript
it('should calculate total score correctly', () => {
  // Arrange - 准备测试数据
  const scores = [10, 20, 30];
  const expectedTotal = 60;
  
  // Act - 执行被测试的操作
  const result = calculateTotal(scores);
  
  // Assert - 验证结果
  expect(result).toBe(expectedTotal);
});
```

### 2. Mock策略
```typescript
// 外部依赖Mock
jest.mock('@/lib/api-client');

// 部分Mock
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  specificFunction: jest.fn()
}));

// 动态Mock
const mockApiClient = jest.mocked(apiClient);
mockApiClient.get.mockResolvedValue({ data: mockData });
```

### 3. 测试数据管理
```typescript
// 在 test-utils.ts 中定义通用测试数据
export const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'student' as const
};

export const mockAchievement = {
  id: 'test-achievement',
  title: 'Test Achievement',
  description: 'Test description',
  points: 100
};
```

### 4. 异步测试
```typescript
// Promise测试
it('should fetch user data', async () => {
  const userData = await fetchUser('user-id');
  expect(userData).toEqual(expectedUser);
});

// 错误处理测试
it('should handle API errors', async () => {
  mockApiClient.get.mockRejectedValue(new Error('API Error'));
  await expect(fetchUser('invalid-id')).rejects.toThrow('API Error');
});
```

### 5. 组件测试模式
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AchievementCard } from '@/components/achievements/AchievementCard';

describe('AchievementCard', () => {
  const mockProps = {
    achievement: mockAchievement,
    userProgress: mockProgress
  };
  
  it('should render achievement information', () => {
    render(<AchievementCard {...mockProps} />);
    
    expect(screen.getByText(mockAchievement.title)).toBeInTheDocument();
    expect(screen.getByText(mockAchievement.description)).toBeInTheDocument();
  });
  
  it('should handle click events', async () => {
    const onClick = jest.fn();
    render(<AchievementCard {...mockProps} onClick={onClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
```

## 覆盖率标准

### 全局覆盖率目标
- **语句覆盖率**: 70%+
- **分支覆盖率**: 65%+
- **函数覆盖率**: 75%+
- **行覆盖率**: 70%+

### 关键模块覆盖率目标
- **核心业务逻辑**: 85%+
- **API路由**: 80%+
- **工具函数**: 90%+
- **组件**: 70%+

## 测试配置

### Jest配置要点
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/__tests__/utils/test-utils.tsx'
  ],
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.{ts,tsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 75,
      lines: 70,
      statements: 70,
    },
  },
};
```

## 持续集成

### 测试脚本
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --coverage --watchAll=false",
    "test:unit": "jest src/__tests__/lib",
    "test:integration": "jest src/__tests__/integration",
    "test:api": "jest src/__tests__/api",
    "test:components": "jest src/__tests__/components"
  }
}
```

### 质量门禁
1. 所有测试必须通过
2. 覆盖率不能低于设定阈值
3. 不能有未处理的异步操作
4. 测试执行时间不能超过合理范围

## 性能测试

### 测试性能指标
- 单个测试用例执行时间 < 5秒
- 整体测试套件执行时间 < 2分钟
- 内存使用合理，无内存泄漏

### 性能优化策略
- 使用 `maxWorkers: 1` 避免并发问题
- 合理使用 `beforeEach` 和 `afterEach`
- 避免在测试中使用真实的网络请求
- 使用浅渲染减少组件测试开销

## 维护和更新

### 定期审查
- 每月审查测试覆盖率报告
- 识别和补充缺失的测试用例
- 更新过时的测试数据和Mock
- 优化慢速测试用例

### 文档更新
- 新增功能时同步更新测试标准
- 记录特殊测试场景和解决方案
- 维护测试最佳实践示例

---

**注意**: 本标准应随项目发展持续更新和完善。所有团队成员都应遵循这些标准，确保测试代码的质量和一致性。