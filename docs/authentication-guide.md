# 认证和数据隔离指南

## 概述

EduCog-Micro 平台实现了完整的用户认证和数据隔离机制，确保：
1. 未登录用户无法访问学习内容
2. 每个用户只能看到自己的学习数据
3. 所有学习进度和成就与用户账号关联

## 认证流程

### 1. 访问控制

- **公开页面**（无需登录）：
  - `/welcome` - 欢迎页面
  - `/login` - 登录页面
  - `/register` - 注册页面
  - `/privacy` - 隐私政策
  - `/terms` - 使用条款

- **受保护页面**（需要登录）：
  - `/` - 课程内容
  - `/simulation` - 实验仿真
  - `/quiz` - 在线测评
  - `/analytics` - 学情分析
  - `/achievements` - 成就系统
  - `/learning-path` - 个性化学习
  - `/profile` - 个人资料
  - 其他所有页面

### 2. 中间件保护

`src/middleware.ts` 文件控制所有路由的访问权限：

```typescript
// 未登录用户访问首页会重定向到欢迎页
if (pathname === '/' && !token) {
  return NextResponse.redirect('/welcome');
}

// 其他受保护页面重定向到登录页
if (!token && !isPublicPath) {
  return NextResponse.redirect('/login?from=' + pathname);
}
```

### 3. 登录后重定向

- 用户登录成功后会自动重定向到原始请求的页面
- 如果没有来源页面，普通用户重定向到首页，管理员重定向到用户管理

## 数据隔离

### 1. API 层面的隔离

所有 API 端点都通过 JWT token 验证用户身份，并使用 `userId` 过滤数据：

```typescript
// 示例：获取用户的学习进度
const progress = await prisma.learningProgress.findMany({
  where: { userId: payload.userId }
});
```

### 2. 数据库设计

所有用户相关的表都包含 `userId` 字段：
- `QuizAttempt` - 测验记录
- `LearningProgress` - 学习进度
- `UserAchievement` - 用户成就
- `LearningPath` - 学习路径
- `UserExperiment` - 实验记录
- `UserActivity` - 活动日志

### 3. 实时数据同步

- 学习进度自动保存（每30秒）
- 页面切换时自动保存
- 浏览器关闭时使用 `sendBeacon` 保存

## 用户体验优化

### 1. 首次访问流程

1. 用户访问网站 → 重定向到欢迎页
2. 欢迎页展示平台功能 → 引导注册/登录
3. 登录成功 → 解锁"首次登录"成就
4. 自动跳转到首页开始学习

### 2. 个性化数据展示

每个用户看到的内容都是个性化的：
- **个人资料页**：显示用户的学习统计、成就、活动记录
- **学情分析**：基于用户的测验历史计算知识掌握度
- **成就系统**：显示用户已解锁/未解锁的成就
- **学习路径**：根据用户的薄弱知识点生成个性化计划

### 3. 数据持久化

- 所有学习活动自动保存到数据库
- 支持断点续学
- 跨设备同步学习进度

## 安全措施

1. **JWT Token 管理**
   - Access Token 有效期：1小时
   - Refresh Token 有效期：7天
   - Token 存储在 localStorage 和 httpOnly cookie

2. **密码安全**
   - 使用 bcrypt 加密
   - 最小长度要求：6位

3. **API 保护**
   - 所有 API 需要 Bearer Token
   - 验证失败返回 401 状态码

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123456 |
| 教师 | teacher | teacher123456 |
| 学生 | student | student123456 |

## 部署注意事项

1. 确保设置环境变量：
   ```
   DATABASE_URL=your-database-url
   JWT_SECRET=your-jwt-secret
   NEXTAUTH_SECRET=your-nextauth-secret
   ```

2. 初始化数据库：
   ```bash
   npm run db:init
   ```

3. 或通过 API 初始化：
   ```
   GET /api/init?secret=init-educog-2024
   ```