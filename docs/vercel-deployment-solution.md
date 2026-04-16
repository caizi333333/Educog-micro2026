# Vercel 部署解决方案

## 当前状态

您的项目已成功部署到 Vercel：
- 部署 URL: https://educog-micro-gym9fdds4-yancai-suns-projects.vercel.app

## 环境变量已设置

我已经为您的项目设置了以下环境变量：
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `JWT_SECRET`: JWT 加密密钥
- `NEXTAUTH_SECRET`: NextAuth 加密密钥
- `VERCEL_DEPLOYMENT_PROTECTION_BYPASS`: 部署保护绕过密钥

## 访问网站

### 1. 如果网站需要 Vercel 身份验证

您需要在 Vercel 控制台禁用部署保护：

1. 访问 https://vercel.com/dashboard
2. 点击您的项目 `educog-micro`
3. 进入 Settings → General
4. 找到 "Deployment Protection" 部分
5. 将其设置为 "Standard Protection" 或 "None"
6. 保存更改

### 2. 初始化数据库

一旦可以访问网站，使用以下 URL 初始化数据库：
```
https://educog-micro-gym9fdds4-yancai-suns-projects.vercel.app/api/init?secret=init-educog-2024
```

这将创建默认的测试账号：
- 管理员: username: `admin`, password: `admin123456`
- 教师: username: `teacher`, password: `teacher123456`
- 学生: username: `student`, password: `student123456`

### 3. 登录系统

登录页面位于：
```
https://educog-micro-gym9fdds4-yancai-suns-projects.vercel.app/login
```

或者通过主页的用户菜单 → "登录/注册" 进入。

## 常见问题

### Q: 为什么访问网站时需要 Vercel 身份验证？

A: 这是 Vercel 的部署保护功能。新项目默认启用此功能以防止未授权访问。您需要在 Vercel 控制台中手动禁用它。

### Q: 如何查看环境变量是否正确设置？

A: 运行以下命令：
```bash
vercel env ls production
```

### Q: 如何更新环境变量？

A: 使用以下命令：
```bash
vercel env rm DATABASE_URL production
echo "新的数据库URL" | vercel env add DATABASE_URL production
vercel --prod  # 重新部署
```

### Q: 如何查看部署日志？

A: 访问部署 URL 中的 Inspect 链接，或运行：
```bash
vercel logs
```

## 下一步

1. 在 Vercel 控制台禁用部署保护
2. 访问初始化 API 创建默认账号
3. 使用创建的账号登录系统
4. 开始使用账号管理功能

## 技术支持

如果遇到问题，请检查：
1. 环境变量是否正确设置
2. 数据库连接是否正常
3. Vercel 部署日志是否有错误