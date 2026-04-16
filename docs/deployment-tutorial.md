# 芯智育才平台 - 手把手部署教程

本教程将一步步教你如何将项目部署到互联网，包括如何获取每个必需的配置。

## 📋 准备工作

在开始之前，请确保你有：
- GitHub 账号
- 一个可用的邮箱
- 大约 30 分钟时间

## 第一步：获取免费数据库

### 选项 A：使用 Neon（推荐，最简单）

1. **注册 Neon 账号**
   - 访问 https://neon.tech
   - 点击 "Start Free"
   - 使用 GitHub 账号登录（推荐）或邮箱注册

2. **创建数据库**
   - 登录后会自动进入创建项目页面
   - Project Name: 输入 `educog-micro`
   - Database Name: 保持默认 `neondb`
   - Region: 选择 `Asia Pacific (Singapore)` 
   - 点击 "Create Project"

3. **获取数据库连接字符串**
   - 创建完成后，会显示连接信息
   - 找到 "Connection string" 部分
   - 选择 "Pooled connection" 标签
   - 复制类似这样的字符串：
   ```
   postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   psql 'postgresql://neondb_owner:npg_vLcB01beKzgN@ep-solitary-salad-a1nlfmxn-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
   - **重要**：保存这个字符串，这就是你的 `DATABASE_URL`

### 选项 B：使用 Supabase

1. **注册 Supabase**
   - 访问 https://supabase.com
   - 点击 "Start your project"
   - 使用 GitHub 登录

2. **创建项目**
   - 点击 "New Project"
   - Project name: `educog-micro`
   - Database Password: 设置一个强密码（记住它！）
   - Region: 选择 `Southeast Asia (Singapore)`
   - 点击 "Create new project"

3. **获取连接字符串**
   - 等待项目创建完成（约2分钟）
   - 点击左侧菜单 "Settings" → "Database"
   - 找到 "Connection string" 部分
   - 选择 "URI" 标签
   - 复制连接字符串，替换 `[YOUR-PASSWORD]` 为你设置的密码

## 第二步：生成安全密钥

### 在线生成（最简单）

1. 访问 https://generate-secret.vercel.app/32
2. 点击 "Generate" 按钮两次
3. 复制生成的两个密钥，分别用作：
   - `JWT_SECRET` a8f096978ac0c48f5ba222199b96004e
   - `NEXTAUTH_SECRET` https://generate-secret.vercel.app/32

### 本地生成（更安全）

在终端运行：
```bash
# macOS/Linux
openssl rand -hex 32

# Windows (PowerShell)
-join (1..32 | ForEach {'{0:X}' -f (Get-Random -Max 16)})
```

运行两次，得到两个不同的密钥。

## 第三步：部署到 Vercel

### 方法 1：使用部署按钮（最简单）

1. **Fork 项目到你的 GitHub**
   - 访问 https://github.com/caizi333333/educog-micro
   - 点击右上角 "Fork" 按钮
   - 等待 Fork 完成

2. **点击部署按钮**
   - 在你 Fork 的项目 README 中
   - 点击 "Deploy with Vercel" 按钮

3. **配置 Vercel**
   - 如果没有 Vercel 账号，选择 "Continue with GitHub"
   - 授权 Vercel 访问你的 GitHub

4. **配置环境变量**
   在部署页面，你会看到环境变量配置：
   
   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | DATABASE_URL | `postgresql://...` | 第一步获取的数据库连接字符串 |
   | JWT_SECRET | `32位十六进制字符串` | 第二步生成的第一个密钥 |
   | NEXTAUTH_SECRET | `32位十六进制字符串` | 第二步生成的第二个密钥 |

5. **部署**
   - 检查所有环境变量已填写
   - 点击 "Deploy" 按钮
   - 等待部署完成（约3-5分钟）

### 方法 2：使用 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **创建环境变量文件**
   在项目根目录创建 `.env.production.local`：
   ```env
   DATABASE_URL=你的数据库连接字符串
   JWT_SECRET=你的JWT密钥
   NEXTAUTH_SECRET=你的NextAuth密钥
   ```

4. **部署**
   ```bash
   vercel --prod
   ```

## 第四步：初始化数据库

### 方法 1：使用 Vercel 界面（推荐）

1. **进入 Vercel 项目**
   - 访问 https://vercel.com/dashboard
   - 点击你的项目

2. **打开函数日志**
   - 点击 "Functions" 标签
   - 点击 "Create Function"

3. **运行数据库命令**
   创建一个临时 API 路由 `/api/setup`：
   ```typescript
   // app/api/setup/route.ts
   export async function GET() {
     try {
       // 初始化数据库
       await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS ...`;
       
       // 创建默认用户
       const admin = await prisma.user.create({
         data: {
           email: 'admin@educog.com',
           username: 'admin',
           password: '$2a$10$...', // bcrypt hash of 'admin123456'
           role: 'ADMIN'
         }
       });
       
       return Response.json({ success: true });
     } catch (error) {
       return Response.json({ error: error.message });
     }
   }
   ```

### 方法 2：使用本地连接

1. **安装 Prisma CLI**
   ```bash
   npm install -g prisma
   ```

2. **设置生产数据库URL**
   ```bash
   export DATABASE_URL="你的数据库连接字符串"
   ```

3. **推送数据库架构**
   ```bash
   npx prisma db push
   ```

4. **运行种子数据**
   ```bash
   npm run prisma:seed
   ```

## 第五步：验证部署

1. **访问你的应用**
   - Vercel 会提供一个 URL，如：`https://educog-micro-xxx.vercel.app`
   - 打开这个 URL

2. **测试登录**
   - 点击 "登录"
   - 使用默认账号：
     - 用户名：`admin`
     - 密码：`admin123456`

3. **检查功能**
   - [ ] 登录功能正常
   - [ ] 可以访问仿真页面
   - [ ] 可以创建新用户
   - [ ] 实验列表显示正常

## 第六步：后续维护

### 查看日志

1. **Vercel 日志**
   - 在 Vercel 项目页面
   - 点击 "Functions" → "Logs"
   - 可以看到实时日志

2. **数据库监控**
   - Neon: 在 Neon 控制台查看查询日志
   - Supabase: 在 Supabase 控制台查看

### 更新环境变量

1. **在 Vercel 更新**
   - 项目设置 → Environment Variables
   - 修改变量值
   - 点击 "Save"
   - 需要重新部署生效

2. **重新部署**
   ```bash
   vercel --prod
   ```

### 数据库备份

1. **Neon 备份**
   - Neon 自动每日备份
   - 可在控制台下载备份

2. **手动备份**
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

## 常见问题解答

### Q: 部署失败，提示 "Build Error"
**A:** 检查：
1. 所有环境变量是否正确设置
2. 运行 `npm run build` 本地测试
3. 查看 Vercel 构建日志

### Q: 数据库连接失败
**A:** 检查：
1. DATABASE_URL 格式是否正确
2. 是否包含 `?sslmode=require`
3. 数据库服务是否正常

### Q: 登录后立即退出
**A:** 检查：
1. JWT_SECRET 是否设置
2. NEXTAUTH_SECRET 是否设置
3. Cookie 设置是否正确

### Q: 如何修改默认密码？
**A:** 登录后：
1. 点击右上角用户菜单
2. 选择 "修改密码"
3. 输入新密码

### Q: 如何添加自定义域名？
**A:** 在 Vercel：
1. 项目设置 → Domains
2. 添加你的域名
3. 按照提示配置 DNS

## 费用说明

### 完全免费方案
- Vercel: 个人免费
- Neon: 3GB 免费
- 总计: $0/月

### 小型项目（<1000用户）
- Vercel Pro: $20/月
- Neon Pro: $19/月
- 总计: $39/月

### 获取帮助

如果遇到问题：
1. 查看 [Vercel 文档](https://vercel.com/docs)
2. 查看 [Neon 文档](https://neon.tech/docs)
3. 在项目 [Issues](https://github.com/your-username/educog-micro/issues) 提问

---

恭喜！你已经成功将芯智育才平台部署到互联网上了！🎉