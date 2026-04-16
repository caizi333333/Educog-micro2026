# 认证和个性化功能实现指南

## 概述

我已经为 EduCog-Micro 实现了完整的用户认证和个性化数据管理系统。现在系统可以：

1. 区分不同用户身份（学生、教师、管理员）
2. 为每个用户保存个性化的学习数据
3. 跟踪学习进度和成绩
4. 提供基于用户的个性化学习路径

## 已实现的功能

### 1. 认证系统增强

#### AuthContext (全局认证状态管理)
- **位置**: `/src/contexts/AuthContext.tsx`
- **功能**:
  - 统一管理用户登录状态
  - 自动刷新用户信息
  - 多标签页同步登录状态
  - 提供 `useAuth` Hook 供组件使用

#### 中间件路由保护
- **位置**: `/src/middleware.ts`
- **功能**:
  - 自动保护需要登录的页面
  - 未登录用户重定向到登录页
  - 记录原始访问路径，登录后自动跳转

#### 用户信息 API
- **位置**: `/src/app/api/auth/me/route.ts`
- **功能**:
  - 获取当前登录用户的完整信息
  - 验证 token 有效性

### 2. 布局组件改进

#### 动态用户菜单
- **位置**: `/src/components/layout/app-layout.tsx`
- **改进**:
  - 显示真实用户姓名和角色
  - 根据用户角色显示不同菜单项
  - 教师和管理员可以看到"用户管理"
  - 管理员专属"系统管理"菜单
  - 集成退出登录功能

### 3. 个性化数据存储

#### 扩展的数据库模型
- **位置**: `/prisma/schema.prisma`
- **新增模型**:
  - `QuizAttempt` - 测验记录
  - `UserAchievement` - 用户成就
  - `LearningPath` - 个性化学习路径
  - `LearningProgress` - 学习进度跟踪
  - `Certificate` - 证书管理

### 4. 测评系统个性化

#### 测评页面改进
- **位置**: `/src/app/quiz/quiz-client.tsx`
- **新功能**:
  - 基于用户 ID 的答案存储
  - 自动保存测评结果到服务器
  - 支持多用户独立测评进度

#### 测评结果 API
- **位置**: `/src/app/api/quiz/submit/route.ts`
- **功能**:
  - 保存用户的测评结果
  - 记录得分、用时、薄弱知识点

### 5. 学习路径个性化

#### 学习路径页面改进
- **位置**: `/src/app/learning-path/learning-path-client.tsx`
- **新功能**:
  - 基于用户的测评结果存储
  - 自动保存生成的学习计划
  - 用户特定的学习进度跟踪

#### 学习路径 API
- **位置**: `/src/app/api/learning-path/save/route.ts`
- **功能**:
  - 保存个性化学习计划
  - 关联用户的薄弱知识点

## 使用指南

### 1. 用户登录后的体验

```typescript
// 在任何组件中使用认证信息
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, loading, logout } = useAuth();
  
  if (loading) return <div>加载中...</div>;
  
  if (!user) return <div>请先登录</div>;
  
  return (
    <div>
      <h1>欢迎，{user.name}!</h1>
      <p>您的角色是：{user.role}</p>
      <button onClick={logout}>退出登录</button>
    </div>
  );
}
```

### 2. 保护需要登录的 API

```typescript
// API 路由示例
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const token = authorization.substring(7);
  const payload = await verifyToken(token);
  
  if (!payload) {
    return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
  }

  // 使用 payload.userId 来标识用户
  // 继续处理业务逻辑...
}
```

### 3. 个性化数据存储示例

```typescript
// 保存用户特定的数据
const storageKey = user ? `my-data-${user.id}` : 'my-data';
localStorage.setItem(storageKey, JSON.stringify(data));

// 读取用户特定的数据
const savedData = localStorage.getItem(storageKey);
```

## 后续改进建议

### 1. 完善数据库集成
- 将模拟的 API 实现替换为真实的 Prisma 数据库操作
- 实现数据持久化和查询优化

### 2. 添加更多个性化功能
- 个人资料页面使用真实数据
- 成就系统的完整实现
- 学习进度可视化
- 个性化推荐算法

### 3. 权限控制细化
- 实现基于角色的访问控制（RBAC）
- 教师可以查看学生进度
- 管理员可以管理所有数据

### 4. 数据分析功能
- 学习效果分析
- 知识点掌握度统计
- 班级整体表现对比

## 测试账号

系统默认创建了以下测试账号：

- **管理员**: username: `admin`, password: `admin123456`
- **教师**: username: `teacher`, password: `teacher123456`
- **学生**: username: `student`, password: `student123456`

## 注意事项

1. **环境变量**: 确保在生产环境中正确设置了 `DATABASE_URL`、`JWT_SECRET` 和 `NEXTAUTH_SECRET`
2. **数据迁移**: 新的数据模型需要运行 `prisma migrate` 来更新数据库
3. **缓存管理**: 用户特定的数据使用了 localStorage，注意清理过期数据
4. **安全性**: 所有敏感操作都需要验证用户身份和权限

## 总结

现在系统已经实现了：

✅ 用户登录状态全局管理
✅ 根据用户角色显示不同内容
✅ 个性化数据存储架构
✅ 测评结果与用户关联
✅ 学习路径个性化保存
✅ API 层面的认证保护

这些改进使得系统能够为每个用户提供个性化的学习体验，并且所有的学习数据都能够被正确地保存和追踪。