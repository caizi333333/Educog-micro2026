# 环境变量详细说明

本文档详细解释每个环境变量的作用、如何获取以及示例值。

## 必需的环境变量

### 1. DATABASE_URL

**作用**: 数据库连接字符串，用于连接 PostgreSQL 数据库存储用户数据、实验记录等。

**格式**: 
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?sslmode=require
```

**如何获取**:

#### Neon (推荐)
1. 注册 https://neon.tech
2. 创建项目后，在 Dashboard 找到 "Connection Details"
3. 选择 "Pooled connection"
4. 复制连接字符串

**示例值**:
```
postgresql://alex:AbC123XyZ@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

#### Supabase
1. 注册 https://supabase.com
2. 创建项目
3. Settings → Database → Connection string
4. 替换 [YOUR-PASSWORD]

**示例值**:
```
postgresql://postgres:MyStr0ngP@ssw0rd@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### 2. JWT_SECRET

**作用**: 用于签名和验证 JWT 令牌，保护用户认证信息。

**格式**: 32位十六进制字符串（64个字符）

**如何生成**:

#### 在线工具
访问 https://generate-secret.vercel.app/32

#### 命令行
```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
-join (1..32 | ForEach {'{0:X}' -f (Get-Random -Max 16)})

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**示例值**:
```
a7f3d9b8e5c2f6a1d4e8b3c7f2a5d9e4b8c1f5a9d3e7b2c6f1a4d8e3b7c2f6a9
```

**重要**: 
- 必须是随机生成的
- 不要使用示例值
- 生产环境和开发环境应使用不同的密钥

### 3. NEXTAUTH_SECRET

**作用**: NextAuth.js 用于加密会话和 CSRF 令牌。

**格式**: 32位十六进制字符串（与 JWT_SECRET 格式相同，但值必须不同）

**如何生成**: 同 JWT_SECRET 的生成方法

**示例值**:
```
f8e4c9a3b7d2e6f1a5c9d4e8b3f7a2e6d1c5f9a4e8d3b7c2e6f1a5d9e4c8b3f7
```

## 可选的环境变量

### 4. NEXTAUTH_URL

**作用**: 应用的完整 URL，用于回调和重定向。

**格式**: `https://你的域名`

**默认值**: Vercel 会自动设置为 `https://${VERCEL_URL}`

**示例值**:
```
# 生产环境
https://educog.vercel.app

# 开发环境
http://localhost:3000
```

### 5. NODE_ENV

**作用**: 指定运行环境

**可选值**: 
- `development` - 开发环境
- `production` - 生产环境
- `test` - 测试环境

**默认值**: Vercel 自动设置为 `production`

### 6. 邮件配置（用于密码重置等功能）

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

**如何获取 Gmail 应用密码**:
1. 开启两步验证
2. 访问 https://myaccount.google.com/apppasswords
3. 生成应用专用密码

### 7. 文件上传（用于头像等）

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz
```

**如何获取**:
1. 注册 https://cloudinary.com
2. Dashboard 显示所有凭据

## 环境变量设置方法

### 本地开发

创建 `.env.local` 文件：
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
NEXTAUTH_SECRET=...
```

### Vercel 部署

#### 方法 1: 通过界面
1. Vercel Dashboard → 你的项目
2. Settings → Environment Variables
3. 添加每个变量
4. 选择环境（Production/Preview/Development）

#### 方法 2: 通过 CLI
```bash
vercel env add DATABASE_URL production
# 粘贴值并按回车
```

#### 方法 3: 通过 vercel.json
```json
{
  "env": {
    "JWT_SECRET": "@jwt_secret",
    "DATABASE_URL": "@database_url"
  }
}
```

### 其他平台

#### Railway
```bash
railway variables set DATABASE_URL="..."
```

#### Heroku
```bash
heroku config:set DATABASE_URL="..."
```

#### Docker
```yaml
environment:
  - DATABASE_URL=${DATABASE_URL}
  - JWT_SECRET=${JWT_SECRET}
```

## 安全最佳实践

### 1. 密钥管理
- ✅ 使用强随机密钥
- ✅ 不同环境使用不同密钥
- ❌ 不要在代码中硬编码
- ❌ 不要提交到 Git

### 2. 数据库安全
- ✅ 使用 SSL 连接 (`sslmode=require`)
- ✅ 使用连接池
- ✅ 定期轮换密码
- ❌ 不要暴露数据库端口

### 3. 环境隔离
```env
# .env.local (开发)
DATABASE_URL=postgresql://localhost/educog_dev

# .env.production (生产)
DATABASE_URL=postgresql://production-server/educog_prod
```

## 故障排查

### 问题: "Invalid DATABASE_URL"
**检查**:
- URL 格式是否正确
- 是否包含所有必需部分
- 特殊字符是否已编码

### 问题: "JWT_SECRET is not defined"
**检查**:
- 环境变量名称拼写
- Vercel 中是否已添加
- 是否需要重新部署

### 问题: "NEXTAUTH_SECRET is missing"
**解决**:
```bash
# 生成新密钥
openssl rand -hex 32
```

## 环境变量模板

复制以下模板并填入你的值：

```env
# === 必需 ===
# 数据库连接（从 Neon/Supabase 获取）
DATABASE_URL=

# JWT 密钥（运行 openssl rand -hex 32）
JWT_SECRET=

# NextAuth 密钥（再次运行 openssl rand -hex 32）
NEXTAUTH_SECRET=

# === 可选 ===
# 应用 URL（Vercel 自动设置）
NEXTAUTH_URL=

# 环境（Vercel 自动设置）
NODE_ENV=production

# 邮件服务（可选）
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# 文件上传（可选）
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

保存这个模板，部署时直接复制使用！