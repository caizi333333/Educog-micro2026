# 部署检查清单

## 问题描述
Vercel 部署的网站可以直接访问，没有登录保护

## 解决步骤

### 1. 验证中间件部署
```bash
# 运行验证脚本
./scripts/verify-deployment.sh
```

### 2. 测试中间件是否工作
访问以下测试页面：
- https://educog-micro.vercel.app/auth-test
- https://educog-micro.vercel.app/api/middleware-test

### 3. 清除并重新部署
```bash
# 1. 确保本地构建成功
npm run build

# 2. 清除 Vercel 缓存并重新部署
vercel --prod --force

# 3. 等待部署完成后验证
```

### 4. 验证访问控制
- 访问 https://educog-micro.vercel.app/ 应该重定向到 /welcome
- 访问 https://educog-micro.vercel.app/simulation 应该重定向到 /login
- 只有登录后才能访问学习内容

## 中间件工作原理

### 文件位置
`/src/middleware.ts`

### 保护逻辑
1. 检查请求路径是否为公开路径
2. 检查用户是否有有效的 token（cookie 或 header）
3. 未登录用户：
   - 访问首页 → 重定向到 /welcome
   - 访问其他页面 → 重定向到 /login
4. 已登录用户：正常访问

### 公开路径列表
- `/login` - 登录页
- `/register` - 注册页
- `/welcome` - 欢迎页
- `/privacy` - 隐私政策
- `/terms` - 使用条款
- `/clear-auth` - 清除认证
- `/auth-test` - 测试页面

## Vercel 特殊配置

### vercel.json
```json
{
  "functions": {
    "src/middleware.ts": {
      "runtime": "edge"
    }
  }
}
```

### 环境变量
确保 Vercel 上设置了以下环境变量：
- DATABASE_URL
- JWT_SECRET
- NEXTAUTH_SECRET

## 故障排除

### 中间件不生效
1. 检查 Vercel 函数日志
2. 确认 middleware.ts 在正确位置
3. 验证 matcher 配置正确

### 重定向循环
1. 清除浏览器 cookie
2. 访问 /clear-auth 清除状态
3. 重新登录

### 部署后仍可直接访问
1. 确认部署成功完成
2. 清除 CDN 缓存
3. 使用隐私模式测试

## 紧急修复

如果需要立即阻止访问：
1. 在 Vercel 项目设置中启用密码保护
2. Settings → General → Password Protection
3. 设置访问密码

## 联系支持
如果问题持续，检查：
- Vercel 部署日志
- Edge 函数日志
- 浏览器控制台错误