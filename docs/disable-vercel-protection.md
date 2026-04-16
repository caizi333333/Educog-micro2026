# 禁用 Vercel 部署保护

您的网站目前启用了 Vercel 的部署保护，这导致需要登录才能访问。要禁用它：

## 方法一：通过 Vercel 网页控制台

1. 访问 https://vercel.com/dashboard
2. 找到您的项目 `educog-micro`
3. 进入项目设置（Settings）
4. 找到 "Deployment Protection" 部分
5. 将保护级别设置为 "None" 或 "Standard Protection"
6. 保存更改

## 方法二：使用环境变量

我已经为您添加了环境变量 `VERCEL_DEPLOYMENT_PROTECTION_BYPASS`，现在需要重新部署：

```bash
vercel --prod
```

## 验证

部署完成后，您应该能够直接访问：
- 主页：https://educog-micro-ilyiv2qj7-yancai-suns-projects.vercel.app
- 初始化 API：https://educog-micro-ilyiv2qj7-yancai-suns-projects.vercel.app/api/init?secret=init-educog-2024

## 注意事项

如果仍然需要身份验证，请在 Vercel 控制台中检查项目的部署保护设置。