# 发布说明

页脚「近期更新」和 `GET /api/site/version` 只读取 `src/lib/site-version.ts` 里的 `PUBLIC_RELEASE_NOTES`。
本文件可以写维护者需要的内部说明。标成「内部」的内容不要复制进公开条目。

版本号用语义化版本，从正式站 `1.0.0` 起算。运行时版本字符串以 `package.json` 的 `version` 为准，`SITE_VERSION` 直接引用它。`PUBLIC_RELEASE_NOTES` 的第一条必须是同一个版本，否则模块会在启动时抛错。

## 下次如何升版本

1. 按变更大小修改 `package.json` 的 `version`：修复用补丁号，新功能用次版本号，学生可见的不兼容变化用主版本号。
2. 在 `src/lib/site-version.ts` 的 `PUBLIC_RELEASE_NOTES` **最前面**加一条，`version` 与 `package.json` 相同，`highlights` 只写同学能看懂的要点。
3. 在本文件最前面加同一版本的小节。内部部署、表结构、限流口径写在「内部」下面。
4. 如果这次改了数据库，先执行 `npx prisma migrate deploy`（或套用 `prisma/migrations/` 里对应的 SQL），再发布应用。

不要把数据库连接、对象存储、账单、口令或密钥写进公开要点。

## 1.0.0 — 2026-10-27

### 公开

- 开放学生反馈与勋章
- 版本号展示

### 内部

- 新增 `SiteFeedback` 表（迁移 `20261027100000_add_site_feedback`）。登录学生可提交，`userId` 必填；`anonymous` 只影响教师列表是否显示姓名和学号。
- 反馈勋章 `feedback_first` / `feedback_second` / `feedback_third` 按该生有效反馈条数 1 / 2 / 3 解锁，走现有 `UserAchievement` 唯一约束，重复发放不会加积分。以后加第 4 枚：在 `achievements-v2` 再追加一条 `criteria.type = valid_feedbacks` 的成就即可。
- 写入限流：同一学生两次成功提交至少间隔 1 分钟；每个北京时间自然日最多 5 条。过短或单字符重复的正文会拒绝，不入库。
- 教师和管理员在 `/teacher/feedback` 查看最新反馈。匿名条目展示「匿名」，响应里不带姓名、学号和用户 id。
- 本版没有改动数据库托管、对象存储或账单配置。
