# EduCog-Micro 部署和调试指南

## 部署到 Vercel

### 1. 自动部署（推荐）

项目已配置自动部署，每次推送到 `master` 分支都会触发部署：

```bash
git add .
git commit -m "您的提交信息"
git push origin master
```

### 2. 手动部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 3. 环境变量配置

在 Vercel 控制台设置以下环境变量：

- `DATABASE_URL`: PostgreSQL 连接字符串
- `JWT_SECRET`: JWT 密钥（使用强密钥）
- `NODE_ENV`: 设置为 `production`

## 数据库优化

### 1. 应用索引优化

```bash
# 在生产数据库执行
psql $DATABASE_URL < prisma/migrations/add_indexes.sql
```

### 2. 监控慢查询

```sql
-- 查看慢查询
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## 性能测试

### 1. 本地测试

```bash
# 获取访问令牌
# 1. 登录应用
# 2. 从浏览器开发者工具获取 accessToken

# 运行性能测试
TEST_TOKEN="your_token" npm run test:performance
```

### 2. 生产环境测试

```bash
TEST_TOKEN="your_token" TEST_URL="https://your-app.vercel.app" npm run test:performance
```

## 调试技巧

### 1. 查看实时日志

```bash
# Vercel 日志
vercel logs --follow

# 本地开发日志
npm run dev
```

### 2. 调试 API 路由

在 API 路由中添加日志：

```typescript
import { requestLogger } from '@/lib/request-logger';

export const GET = withRequestLogging(async (request) => {
  // 您的代码
});
```

### 3. 性能监控

```typescript
import { performanceMonitor } from '@/lib/performance-monitor';

// 开始计时
performanceMonitor.startTimer('api-call');

// 执行操作
const result = await someOperation();

// 结束计时
const duration = performanceMonitor.endTimer('api-call');

// 记录指标
performanceMonitor.recordMetric('user-stats', {
  apiCallTime: duration,
  totalLoadTime: totalTime
});
```

### 4. 错误追踪

所有 API 错误会自动记录，查看错误日志：

```typescript
import { requestLogger } from '@/lib/request-logger';

// 获取最近的错误
const errors = requestLogger.getErrorLogs();

// 获取慢请求
const slowRequests = requestLogger.getSlowRequests(1000); // > 1秒
```

## 常见问题

### 1. 数据库连接错误

- 检查 `DATABASE_URL` 格式是否正确
- 确保数据库允许从 Vercel IP 访问
- 使用连接池 URL（如 Neon 的 pooler URL）

### 2. 构建失败

- 检查 TypeScript 错误：`npm run typecheck`
- 检查依赖：`npm install`
- 清除缓存：`rm -rf .next node_modules && npm install`

### 3. 性能问题

- 使用批量 API：`/api/learning-progress/batch`
- 启用客户端缓存
- 检查数据库索引
- 使用 CDN 加速静态资源

### 4. 内存问题

- 使用流式响应处理大数据
- 实现分页
- 优化图片大小
- 使用懒加载

## 监控建议

1. **设置告警**
   - API 响应时间 > 2秒
   - 错误率 > 5%
   - 数据库连接失败

2. **定期检查**
   - 每周查看性能报告
   - 每月优化慢查询
   - 定期更新依赖

3. **用户反馈**
   - 收集加载时间反馈
   - 监控用户会话时长
   - 跟踪功能使用情况

## 安全建议

1. **定期更新**
   - 依赖包：`npm audit fix`
   - 框架版本
   - 数据库补丁

2. **访问控制**
   - 使用强密码
   - 启用双因素认证
   - 定期轮换密钥

3. **数据保护**
   - 加密敏感数据
   - 定期备份
   - 日志脱敏