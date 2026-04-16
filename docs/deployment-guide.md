# 部署指南 - 芯智育才平台

本文档详细说明如何将芯智育才平台部署到互联网。

## 部署方案概览

### 推荐的技术栈组合

1. **经济型方案（免费）**
   - 托管平台：Vercel（免费额度）
   - 数据库：Neon PostgreSQL（免费 3GB）
   - 文件存储：Cloudinary（免费额度）
   - 域名：Vercel 提供的子域名

2. **标准方案（约 $20/月）**
   - 托管平台：Vercel Pro
   - 数据库：Supabase（$25/月）
   - 文件存储：AWS S3
   - 域名：自定义域名

3. **企业方案**
   - 托管平台：AWS/阿里云
   - 数据库：AWS RDS/阿里云 RDS
   - 文件存储：OSS/S3
   - CDN：CloudFlare

## 详细部署步骤

### 1. 准备数据库（以 Neon 为例）

1. 注册 [Neon](https://neon.tech) 账号
2. 创建新项目和数据库
3. 获取连接字符串：
   ```
   postgresql://username:password@ep-xxx.region.neon.tech/dbname?sslmode=require
   ```

### 2. 准备 Vercel 部署

1. 安装 Vercel CLI（可选）：
   ```bash
   npm i -g vercel
   ```

2. 在项目根目录创建 `.env.production.local`：
   ```env
   DATABASE_URL="你的Neon数据库连接字符串"
   JWT_SECRET="使用 openssl rand -hex 32 生成"
   NEXTAUTH_SECRET="使用 openssl rand -hex 32 生成"
   ```

### 3. GitHub 仓库设置

1. 将代码推送到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/你的用户名/educog-micro.git
   git push -u origin main
   ```

2. 添加 `.gitignore` 确保安全：
   ```
   .env
   .env.local
   .env.production.local
   prisma/dev.db
   ```

### 4. Vercel 部署配置

1. 访问 [Vercel](https://vercel.com)
2. 导入 GitHub 项目
3. 配置环境变量：
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NODE_ENV` = `production`

4. 部署设置：
   - Build Command: `npm run vercel-build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### 5. 数据库初始化

部署完成后，需要初始化数据库：

1. 在 Vercel 项目设置中，运行一次性命令：
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

或者使用本地环境连接生产数据库：
```bash
# 设置生产环境变量
export DATABASE_URL="你的生产数据库URL"

# 推送架构
npx prisma db push

# 运行种子数据
npm run prisma:seed
```

### 6. 配置自定义域名（可选）

1. 在域名提供商处添加 CNAME 记录：
   ```
   CNAME  @  cname.vercel-dns.com
   CNAME  www  cname.vercel-dns.com
   ```

2. 在 Vercel 项目设置中添加域名

### 7. 监控和维护

1. **监控设置**
   - Vercel Analytics（内置）
   - Sentry 错误追踪（可选）
   - Uptime 监控（可选）

2. **备份策略**
   - 数据库每日自动备份
   - 代码通过 Git 版本控制

3. **安全措施**
   - 启用 HTTPS（Vercel 自动）
   - 设置 CORS 策略
   - 定期更新依赖

## 环境变量清单

### 必需的环境变量
```env
# 数据库
DATABASE_URL="postgresql://..."

# 认证
JWT_SECRET="32位十六进制字符串"
NEXTAUTH_SECRET="32位十六进制字符串"
NEXTAUTH_URL="https://你的域名.vercel.app"

# 环境
NODE_ENV="production"
```

### 可选的环境变量
```env
# 邮件服务
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="app-password"

# 文件存储
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# 分析
GOOGLE_ANALYTICS_ID="G-..."
```

## 常见问题

### 1. 数据库连接失败
- 检查 DATABASE_URL 格式
- 确认 SSL 设置（`?sslmode=require`）
- 检查 IP 白名单

### 2. 构建失败
- 检查 TypeScript 错误：`npm run typecheck`
- 确认所有依赖已安装
- 查看 Vercel 构建日志

### 3. 认证问题
- 确认 JWT_SECRET 已设置
- 检查 cookie 设置（secure, sameSite）
- 验证 NEXTAUTH_URL 配置

## 性能优化

1. **数据库优化**
   ```prisma
   // 添加索引
   @@index([email])
   @@index([createdAt])
   ```

2. **Next.js 优化**
   - 启用 ISR（增量静态再生）
   - 配置图片优化
   - 使用 Edge Runtime

3. **缓存策略**
   - 设置合理的 Cache-Control
   - 使用 CDN 缓存静态资源

## 成本估算

### 免费方案
- Vercel: 免费（个人项目）
- Neon: 免费（3GB 存储）
- 总计: $0/月

### 小型项目（<1000 用户）
- Vercel Pro: $20/月
- Neon Pro: $20/月
- 域名: $15/年
- 总计: ~$41/月

### 中型项目（<10000 用户）
- Vercel Pro: $20/月
- Supabase: $25/月
- Cloudinary: $89/月
- 总计: ~$134/月

## 部署检查清单

- [ ] 环境变量已配置
- [ ] 数据库已创建并初始化
- [ ] 生产构建成功
- [ ] HTTPS 已启用
- [ ] 错误监控已配置
- [ ] 备份策略已实施
- [ ] 性能监控已启用
- [ ] 安全头已配置

## 支持

如有问题，请查看：
- [Vercel 文档](https://vercel.com/docs)
- [Prisma 文档](https://www.prisma.io/docs)
- [Next.js 文档](https://nextjs.org/docs)