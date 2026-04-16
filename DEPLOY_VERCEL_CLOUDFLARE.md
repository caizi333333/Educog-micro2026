## 目标
将本项目（Next.js + Prisma）部署到 **Vercel**，并通过 **Cloudflare 托管域名 `www.sunyancai.top`** 对外访问；数据库使用 **Postgres**。

> 说明：我已在代码侧完成适配（Prisma datasource 改为 `postgresql`、Vercel 构建阶段自动 `prisma db push`、init secret 改为环境变量）。  
> 你仍需要在 **Vercel/Cloudflare 控制台**完成授权与点击操作（我无法直接登录你的账号代你点）。

---

## 一、准备工作（你需要提供/确认）
1. **Postgres 连接串**（DATABASE_URL）
   - 推荐格式（含 SSL）：
     - `postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require`
   - 如果你的数据库有 IP 白名单：需要放行 Vercel 出网（或使用 Neon/Supabase 这类无需白名单的托管）。
2. 代码仓库：把项目推到 GitHub（Vercel 需要导入仓库）

---

## 二、把项目上传到 GitHub（一次性）
在项目根目录执行：
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

---

## 三、Vercel 部署（一次性）
1. 登录 Vercel → **New Project** → 导入你的 GitHub 仓库
2. Framework 选择 Next.js（一般自动识别）
3. 在 **Environment Variables** 设置（至少这些）：
   - `DATABASE_URL` = 你的 Postgres 连接串（建议带 `?sslmode=require`）
   - `JWT_SECRET` = 强随机字符串（长度 32+）
   - `JWT_REFRESH_SECRET` = 强随机字符串（长度 32+）
   - `INIT_SECRET` = 强随机字符串（用于首次初始化账号，不要用默认值）
   - `NEXT_PUBLIC_APP_URL` = `https://www.sunyancai.top`
4. 点击 Deploy

> 本项目已配置 `vercel-build`：Vercel 构建时会执行  
> `prisma generate && prisma db push && next build`  
> 作用：自动在 Postgres 中创建/同步表结构（适合第一次上线）。

---

## 四、首次初始化账号（上线后执行一次）
部署完成后，访问：
```
https://www.sunyancai.top/api/init?secret=<INIT_SECRET>
```

成功后会返回默认账号（admin/teacher/student）。  
安全建议：初始化成功后，你可以把 `INIT_SECRET` 改掉，或在 Vercel 里临时删除该环境变量以禁用初始化入口。

---

## 五、Cloudflare 绑定域名到 Vercel（一次性）
1. Vercel 项目 → **Settings → Domains** → Add `www.sunyancai.top`
2. Cloudflare DNS 添加记录：
   - Type：`CNAME`
   - Name：`www`
   - Target：`cname.vercel-dns.com`
   - Proxy：建议先 **DNS only**（灰云）完成验证，稳定后可改为 Proxied（橙云）
3. 回到 Vercel 等待域名校验通过（通常几分钟）

---

## 六、上线后检查清单（建议）
- [ ] `https://www.sunyancai.top/login` 可访问
- [ ] 使用初始化的 admin/teacher 可正常登录
- [ ] `/teacher` 教学仪表板可打开
- [ ] `/admin/users` 用户管理可打开
- [ ] 数据库中已出现 `User` 等表（可在你的 Postgres 控制台确认）

---

## 常见问题
### 1）Vercel 构建时连不上数据库
表现：`prisma db push` 报错连接失败。
解决：
- 检查 DATABASE_URL 是否正确（用户名/密码/库名/端口/sslmode）
- 数据库是否需要白名单（若是：放行 Vercel）

### 2）我不想用 db push，希望用 migrate
可以，但需要生成标准 Prisma migrations（目录 `prisma/migrations/<timestamp>_xxx/`）。  
你确认后我可以把迁移体系补齐，然后把 `vercel-build` 改回 `prisma migrate deploy`。

