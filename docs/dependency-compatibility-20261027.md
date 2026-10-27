# 依赖安全与兼容性迁移（2026-10-27）

关联 [PR #26](https://github.com/caizi333333/Educog-micro2026/pull/26) 与 [Issue #25](https://github.com/caizi333333/Educog-micro2026/issues/25)。本文件说明该发布的依赖及兼容性变更；合并和生产状态以PR与对应部署记录为准。

## 最小升级路径

未执行 `npm audit fix --force`。Next.js 保持15.x，React、Prisma、React Hook Form的主版本不变。

| 依赖 | 原版本 → 本次锁定版本 | 用途与风险范围 |
|---|---|---|
| Next.js及配套编译器/ESLint配置 | 15.5.25/15.5.21 → 15.5.28 | 服务端和前端运行框架；升级安全补丁 |
| Zod | 3.25.76 → 4.6.7 | 前后端输入输出校验；主版本兼容迁移 |
| @hookform/resolvers | 4.1.3 → 5.2.2 | 与Zod4输出类型兼容的表单适配器；现有RHF7.72.1满足peer要求 |
| DOMPurify | 3.4.14 → 3.4.17 | jsPDF可选运行依赖 |
| source-map-js | 1.2.1 → 1.2.2 | PostCSS链，锁文件归入生产依赖，主要用于构建 |
| postcss-selector-parser | 6.1.4 → 6.1.5 | Tailwind/PostCSS链，锁文件归入生产依赖 |
| brace-expansion | 1.1.18/2.1.4/5.0.9 → 1.1.21/2.1.7/5.0.12 | 开发工具依赖；保留各自主版本的override |
| fast-uri | 3.1.6 → 3.1.9 | 开发链schema-utils/ajv；修正旧override |
| Handlebars | 4.7.9 → 4.7.10 | ts-jest开发依赖 |

审计严重度是依赖公告的风险评级，不代表已验证本应用可被利用。分别审计完整依赖与 `--omit=dev` 生产依赖，不以开发包分类隐藏运行风险。

## 保持的兼容行为

- 环境校验使用 `ZodError.issues`，仍返回原中文错误框架、字段路径、自定义消息；保留默认环境、JWT回退、PostgreSQL别名和不安全密钥拒绝。
- 诊断快照的四个 `record` 显式声明字符串键；仍接受稀疏键、原值类型和缺省快照，拒绝类型错误、未知顶层键及超限列表。鉴权和额度限制没有放宽。
- 备课请求编号使用 `z.guid()` 保留Zod3的8-4-4-4-12十六进制格式及小写归一化，避免Zod4更严格的UUID版本/variant检查破坏旧幂等回执。畸形编号继续拒绝。
- 模拟器一般保存响应允许缺省 `projectCompletion`，与Zod3行为一致；里程碑确认仍必须通过服务端证据校验，不能以缺失字段冒充完成。
- 模型结构化响应仍保留默认值与可选字段；无效结果继续回退。
- 真实表单适配器测试覆盖trim、默认复选值、缺省/显式可选字段与字段错误映射，无效值不会返回为有效表单结果。

迁移没有改动真实数据、数据库schema或迁移脚本，没有放宽认证、班级权限或成绩规则。

## 验证与来源

本次新增实际API、环境校验、模型响应、模拟器及表单适配器回归；全量测试、lint、typecheck、生产构建和两种依赖审计的精确结果记录在PR。仍需对应提交的远端CI通过后合并；不能以本地结果代替生产版本核验。

- [Zod4官方迁移说明](https://zod.dev/v4/changelog)
- [Zod安全公告及修复版本](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [表单适配器5.2.2官方发布说明](https://github.com/react-hook-form/resolvers/releases/tag/v5.2.2)
- [Next15.5.28官方发布说明](https://github.com/vercel/next.js/releases/tag/v15.5.28)
