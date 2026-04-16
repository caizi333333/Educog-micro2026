# 数据库部署和个性化功能指南

## 已完成的数据库集成

我已经完成了以下数据库相关的功能实现：

### 1. 数据库连接优化
- 创建了 Prisma 客户端单例 (`/src/lib/prisma.ts`)
- 避免了重复的数据库连接
- 移除了所有不必要的 `$disconnect()` 调用

### 2. 用户认证 API (真实数据库)
- **`/api/auth/me`** - 获取当前用户详细信息
- **`/api/auth/login`** - 用户登录（已有）
- **`/api/auth/register`** - 用户注册（已有）

### 3. 测验系统 API
- **`/api/quiz/submit`** - 保存测验结果到数据库
  - 自动记录分数、用时、答案详情
  - 自动解锁相关成就（首次测验、满分）
  - 记录用户活动日志

- **`/api/quiz/history`** - 获取用户测验历史
  - 返回最近20次测验记录
  - 包含统计信息（平均分、最高分等）

### 4. 学习路径 API
- **`/api/learning-path/save`** - 保存个性化学习计划
  - POST: 创建新的学习路径
  - GET: 获取用户的所有学习路径
  - 自动管理活跃/暂停状态

### 5. 学习进度 API
- **`/api/learning-progress`** - 跟踪学习进度
  - POST: 更新模块学习进度
  - GET: 获取学习进度统计
  - 自动计算完成状态
  - 支持时间跟踪

### 6. 成就系统 API
- **`/api/achievements`** - 管理用户成就
  - GET: 获取所有成就（已解锁/未解锁）
  - POST: 解锁新成就
  - 包含进度跟踪功能

### 7. 用户资料 API
- **`/api/user/profile`** - 完整的用户资料管理
  - GET: 获取详细用户信息和统计
  - PUT: 更新用户资料
  - 包含学习统计、测验统计、最近活动

### 8. 数据库初始化
- **脚本**: `/scripts/init-database.ts`
- **命令**: `npm run db:init`
- 创建默认用户账号
- 添加示例成就数据

## 部署步骤

### 1. 本地测试数据库迁移

```bash
# 设置环境变量
export DATABASE_URL="your-production-database-url"

# 生成 Prisma 客户端
npx prisma generate

# 创建迁移（如果需要）
npm run db:migrate add-personalization-features

# 推送到数据库
npx prisma db push
```

### 2. 初始化生产数据库

```bash
# 运行初始化脚本
DATABASE_URL="your-production-database-url" npm run db:init
```

### 3. 部署到 Vercel

```bash
# 确保环境变量已设置
vercel env ls production

# 部署
vercel --prod
```

### 4. 在生产环境初始化数据

访问以下 URL 初始化默认账号：
```
https://your-domain.vercel.app/api/init?secret=init-educog-2024
```

## 默认测试账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | admin123456 | 系统管理员 |
| 教师 | teacher | teacher123456 | 张老师 |
| 学生 | student | student123456 | 李同学 |
| 演示学生1 | demo1 | demo123456 | 王小明 |
| 演示学生2 | demo2 | demo123456 | 张小红 |

## 个性化功能使用流程

### 1. 新用户注册流程
1. 访问网站自动跳转到欢迎页 `/welcome`
2. 点击"注册账号"进入注册页面
3. 填写信息完成注册
4. 自动登录并解锁"首次登录"成就
5. 跳转到首页开始学习

### 2. 学生测验流程
1. 学生必须先登录系统（未登录会自动跳转到登录页）
2. 进入"在线测评"页面
3. 完成测验
4. 系统自动：
   - 保存测验结果到数据库（关联到当前用户）
   - 计算薄弱知识点
   - 解锁相关成就
   - 生成个性化学习计划

### 3. 学习路径流程
1. 完成测评后点击"生成学习计划"
2. 系统基于薄弱知识点生成个性化路径
3. 学习路径自动保存到用户账号
4. 用户可以随时查看和继续学习

### 4. 进度跟踪
- 每个学习模块都会自动记录进度（与用户账号关联）
- 支持暂停和继续学习
- 自动统计学习时间
- 完成所有模块后标记路径完成
- 所有进度数据都是用户私有的

### 5. 成就系统
自动解锁的成就：
- 首次登录
- 首次测验
- 满分成就
- 学习连续性成就
- 实验完成成就

## API 使用示例

### 获取用户完整资料
```javascript
const response = await fetch('/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const { profile } = await response.json();
```

### 保存测验结果
```javascript
const response = await fetch('/api/quiz/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    quizId: 'comprehensive-assessment',
    score: 85,
    totalQuestions: 20,
    correctAnswers: 17,
    timeSpent: 1200,
    answers: {...},
    weakAreas: ['指针', '中断系统']
  })
});
```

### 更新学习进度
```javascript
const response = await fetch('/api/learning-progress', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    pathId: 'path-id',
    moduleId: 'module-1',
    chapterId: 'chapter-1',
    progress: 100,
    timeSpent: 300
  })
});
```

## 注意事项

1. **数据库连接**: 确保 `DATABASE_URL` 正确设置
2. **迁移管理**: 生产环境的迁移会在部署时自动运行
3. **性能优化**: 使用了 Prisma 客户端单例避免连接泄漏
4. **错误处理**: 所有 API 都有完整的错误处理
5. **活动日志**: 重要操作都会记录到用户活动表

## 故障排除

### 数据库连接失败
- 检查 `DATABASE_URL` 格式是否正确
- 确认数据库服务器可访问
- 检查 SSL 设置（Neon 需要 `?sslmode=require`）

### 迁移失败
- 确保本地 schema 与生产环境同步
- 使用 `prisma migrate resolve` 解决冲突
- 检查数据库权限

### API 返回 401
- 检查 JWT token 是否过期
- 确认 `Authorization` header 格式正确
- 验证用户状态是否为 ACTIVE