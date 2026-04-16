# 数据库设置指南

由于您的Neon数据库流量用完了，这里提供几种本地数据库解决方案：

## 方案一：使用Docker（推荐）

### 1. 启动Docker
首先确保Docker Desktop正在运行：
- 打开Docker Desktop应用
- 等待Docker完全启动（状态栏显示绿色）

### 2. 运行设置脚本
```bash
./scripts/setup-local-db.sh
```

### 3. 手动启动（如果脚本失败）
```bash
# 启动数据库容器
docker-compose up -d postgres

# 等待数据库启动
sleep 10

# 复制本地配置
cp .env.local .env

# 运行数据库迁移
npx prisma generate
npx prisma db push
```

## 方案二：使用本地PostgreSQL

### 1. 安装PostgreSQL
```bash
# 使用Homebrew安装
brew install postgresql@15
brew services start postgresql@15
```

### 2. 创建数据库和用户
```bash
# 连接到PostgreSQL
psql postgres

# 在psql中执行以下命令：
CREATE USER educog_user WITH PASSWORD 'educog_password';
CREATE DATABASE educog_micro OWNER educog_user;
GRANT ALL PRIVILEGES ON DATABASE educog_micro TO educog_user;
\q
```

### 3. 更新环境变量
```bash
# 复制本地配置
cp .env.local .env
```

### 4. 运行迁移
```bash
npx prisma generate
npx prisma db push
```

## 方案三：使用SQLite（最简单）

### 1. 修改Prisma配置
编辑 `prisma/schema.prisma`：
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### 2. 更新环境变量
在 `.env` 文件中设置：
```env
DATABASE_URL="file:./prisma/dev.db"
```

### 3. 运行迁移
```bash
npx prisma generate
npx prisma db push
```

## 验证设置

设置完成后，运行以下命令验证数据库连接：
```bash
npx prisma studio
```

如果Prisma Studio能够打开，说明数据库连接成功。

## 启动应用

```bash
npm run dev
```

## 故障排除

### Docker问题
- 确保Docker Desktop正在运行
- 检查端口5432是否被占用：`lsof -i :5432`
- 查看Docker日志：`docker-compose logs postgres`

### PostgreSQL问题
- 检查PostgreSQL服务状态：`brew services list | grep postgresql`
- 重启PostgreSQL：`brew services restart postgresql@15`

### 权限问题
- 确保脚本有执行权限：`chmod +x scripts/setup-local-db.sh`
- 检查数据库用户权限

## 恢复Neon数据库

当您的Neon流量恢复后，可以通过以下步骤切换回云数据库：

1. 恢复原始 `.env` 配置：
```bash
cp .env.backup .env
```

2. 重新运行迁移：
```bash
npx prisma generate
npx prisma db push
```

## 数据迁移

如果需要将本地数据迁移到Neon：

1. 导出本地数据：
```bash
pg_dump postgresql://educog_user:educog_password@localhost:5432/educog_micro > backup.sql
```

2. 导入到Neon（当流量恢复后）：
```bash
psql "your-neon-connection-string" < backup.sql
```