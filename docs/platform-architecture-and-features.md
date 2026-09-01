# 芯智育才平台技术架构与功能说明

> 版本：2026-08-02　对应线上地址 https://sunyancai.top
> 代码仓库：https://github.com/caizi333333/Educog-micro2026
> 当前竞赛环境由服务端标识为 `DEMO`；种子账号与学习记录均属于演示数据，不代表真实教学成效。

---

## 1. 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | Next.js 15 + React + Tailwind CSS + ShadCN/UI | App Router，服务端/客户端组件混合 |
| 后端 | Next.js API Routes | RESTful，与前端同一项目 |
| 数据库 | PostgreSQL (Neon Serverless) | Prisma ORM，线上连接池 |
| AI 层 | 课程检索 + DeepSeek可选生成 + 本地回退 + 8051静态诊断 | 未进行模型微调；AI只作解释和提示 |
| 认证 | JWT (7天 access + 30天 refresh) + bcrypt | 自建认证，DB Session 表 |
| 部署 | Vercel (sin1 区域) | Git push 自动部署 |

---

## 2. 数据库设计

### 2.1 数据模型

当前 `prisma/schema.prisma` 定义24个模型。下表为课程运行核心模型；其余模型服务于工程教育认证和持续改进。

| 表名 | 用途 | 数据量（演示） |
|------|------|----------------|
| User | 用户账号（三角色） | 44 |
| ClassGroup | 班级 | 2 |
| ClassEnrollment | 班级注册（多对多） | 45 |
| LearningEvent | 学习事件追踪 | 334 |
| LearningProgress | 章节学习进度 | 334 |
| LearningPath | 学习路径 | 32 |
| QuizAttempt | 测验作答记录 | 429 |
| UserExperiment | 仿真实验记录 | 264 |
| UserActivity | 用户活动日志 | 2200 |
| UserAchievement | 成就徽章 | 118 |
| UserProgress | 综合进度汇总 | — |
| KnowledgeNode | 知识图谱节点 | — |
| Session | 登录会话 | — |
| Certificate | 结业证书 | 17 |
| UserPointsTransaction | 积分流水 | — |

### 2.2 用户模型（User）核心字段

```
id, email, username, password(bcrypt), name, avatar
role: STUDENT | TEACHER | ADMIN
status: ACTIVE | INACTIVE | SUSPENDED
studentId, class, grade, major          ← 学生字段
teacherId, department, title             ← 教师字段
totalPoints, lastLoginAt, createdAt
```

### 2.3 演示数据

- 2 个班级：机电2401（20人）、机电2402（20人）
- 每个学生有：学习进度（跨9章）、测验成绩（多次）、实验记录、活动日志、成就徽章
- 数据按能力值（ability 0.3~0.95）随机生成，体现学生差异

---

## 3. 账号体系

### 3.1 验收账号

申请书预留的教师账号与生产账号保持一致，并用于本轮线上登录验收。密码不写入仓库文档；演示学生仅使用一个账号，避免批量改变线上演示数据。

### 3.2 认证流程

```
注册: 前端表单 → /api/auth/register → bcrypt哈希 → 写User+ClassEnrollment → 返回JWT
登录: 前端表单 → /api/auth/login → 查User+验密码 → 写Session → 返回JWT
保持: AuthContext读localStorage → /api/auth/me → verifyToken → 返回用户信息
刷新: accessToken过期 → 用refreshToken调 /api/auth/refresh → 换新token
```

### 3.3 Token存储

- accessToken：localStorage + Cookie
- refreshToken：httpOnly Cookie（30天有效）
- 前端 AuthContext 自动管理，多标签页同步

---

## 4. 权限隔离（RBAC）

### 4.1 三层防护

```
第1层 Middleware    → 路由级拦截，未登录重定向，角色不符拦截
第2层 前端页面      → 客户端角色检查，显示"无权访问"提示
第3层 后端API       → 每个接口verifyToken + 角色校验，返回401/403
```

### 4.2 权限矩阵

| 功能 | 学生 | 教师 | 管理员 | 未登录 |
|------|------|------|--------|--------|
| 登录/注册 | ✅ | ✅ | ✅ | ✅ |
| 测验答题 | ✅ | ✅ | ✅ | ❌→登录 |
| 知识图谱 | ✅ | ✅ | ✅ | ❌→登录 |
| 仿真实验 | ✅ | ✅ | ✅ | ❌→登录 |
| AI助教 | ✅ | ✅ | ✅ | ❌→登录 |
| 个人资料 | 仅改自己 | 仅改自己 | 改全部 | ❌ |
| 教师仪表板 | ❌ 403 | ✅ 自己班 | ✅ 全部 | ❌ 401 |
| 数据导出CSV | ❌ 401 | ✅ 自己班 | ✅ 全部 | ❌ 401 |
| 推送学习任务 | ❌ 403 | ✅ | ✅ | ❌ 401 |
| 班级管理 | ❌ | ✅ 自己班 | ✅ 全部 | ❌ 401 |
| 用户管理CRUD | ❌ 403 | ✅ 只读 | ✅ 读写 | ❌ 401 |
| 系统管理后台 | ❌ | ❌ | ✅ | ❌→登录 |

### 4.3 数据隔离

- **教师间隔离**：教师只能看到自己班级的学生数据（`getAccessibleClassIds()`）
- **学生数据保护**：学生只能修改自己的 profile，不能改成绩/角色/他人数据
- **管理员**：可访问全部数据，可修改用户角色和状态

---

## 5. 功能清单

### 5.1 学生端

| 功能 | 路径 | 说明 |
|------|------|------|
| 测验系统 | `/quiz` | 按章节答题，即时反馈，显示薄弱知识点 |
| 知识图谱 | `/knowledge-graph` | 279节点三层图谱，可视化知识结构与先修关系 |
| 仿真实验 | `/simulation` | 8051代码仿真，13个实验，LED/数码管/波形可视化 |
| AI助教 | `/ai-assistant` | 课程检索、DeepSeek可选解释、本地回退和8051静态诊断 |
| 学习路径 | `/learning-path` | 个性化推荐，按章节推进 |
| 成就系统 | `/achievements` | 徽章、积分、排行榜 |
| 个人中心 | `/profile` | 学习统计、成就展示、进度总览 |

### 5.2 教师端

| 功能 | 路径 | 说明 |
|------|------|------|
| 教学仪表板 | `/teacher` | 学生列表、测验均分、实验完成率、活跃度、风险预警 |
| 数据导出 | `/teacher` 导出面板 | 4种CSV导出（学生综合/测验明细/活动日志/实验明细） |
| 推送任务 | `/teacher` | 向全班推送学习任务 |
| 课前布置 | `/teacher` | 布置课前实验任务 |
| 班级管理 | `/teacher/classes` | 创建班级、邀请码注册 |
| 推送回查 | `/teacher/pushed` | 查看任务推送后的学生完成情况 |
| 课堂表彰 | `/teacher` 右侧面板 | 授予学生成就徽章 |
| 知识图谱维护 | `/knowledge-graph` | 编辑节点、前置关系、实验关联 |

### 5.3 管理员端

| 功能 | 路径 | 说明 |
|------|------|------|
| 系统管理首页 | `/admin` | 平台统计概览 |
| 用户管理 | `/admin/users` | 增删改查用户、修改角色/状态、搜索筛选 |
| 知识图谱管理 | `/admin/knowledge-graph` | 节点级管理 |

### 5.4 数据导出详细说明

教师登录后，在教学仪表板页面可导出4种CSV文件：

| 导出类型 | 内容 | 用途 |
|----------|------|------|
| 学生综合报告 | 姓名/学号/班级/登录次数/学习时长/测验均分/实验完成/知识点覆盖率/AI使用 | 学生画像、过程记录与证据状态分析 |
| 测验详细记录 | 每次测验的得分/题数/用时/时间 | 深入分析答题情况 |
| 学习活动日志 | 每条学习事件的类型/目标/时长 | 学习行为分析 |
| 实验详细记录 | 每次实验的状态/得分/尝试次数 | 实验过程复核；不单独推出教学效果 |

文件格式：CSV（UTF-8 BOM），Excel 直接打开中文不乱码。支持按班级筛选。

---

## 6. 前后端交互架构

```
浏览器（React）
    │
    ├── 页面路由 ──→ Next.js App Router（SSR/CSR）
    │
    ├── API调用 ──→ /api/* （Bearer JWT）
    │                  │
    │                  ├── verifyToken()  ← src/lib/auth.ts
    │                  ├── 角色检查       ← role !== 'TEACHER' → 403
    │                  ├── 班级权限       ← getAccessibleClassIds()
    │                  │
    │                  └── Prisma ORM ──→ PostgreSQL (Neon)
    │
    └── Middleware ──→ 路由拦截（未登录重定向、角色不符拦截）
```

### API鉴权统一模式（所有受保护接口）

```typescript
// 1. 提取Token
const token = request.headers.get('authorization')?.substring(7);

// 2. 验证Token
const payload = await verifyToken(token);  // JWT解析+过期检查

// 3. 角色检查
if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
  return NextResponse.json({ error: '权限不足' }, { status: 403 });
}

// 4. 数据范围限制（教师只能看自己班）
const accessibleClassIds = await getAccessibleClassIds(payload);
```

---

## 7. 当前证据缺口与后续动作

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 真实教学结果 | 使用固定测验编号、同一对象和同一计分口径采集；完成前保持“待采集” |
| P0 | DeepSeek生成式基准 | 仅在现有密钥与额度可用时运行；未运行不填写推测值 |
| P1 | 数据库持续表现 | 即时探测仅按教师操作执行；长期判断继续依赖独立监测窗口 |
| P1 | 学生项目成果 | `proj04`先作为任务模板使用，后续补充可核验的代码、测试表和答辩记录 |
| P2 | 导出筛选 | 在真实教学启动后，根据研究协议增加日期和固定批次筛选 |

---

## 8. 实测边界（2026-08-02）

- AI固定基准：50道正式题库题不附加目标知识点名称，2026年8月25日本地固定运行记录的Recall@3为68%、全返回知识点命中率为80%、MRR为0.4453；48个静态诊断样例的Precision、Recall、F1均为1.00，行号定位准确率为100%。前者是固定课程检索样本，后者是确定性规则样本，不等同开放问答正确率，也不归因于DeepSeek。登录后可从`/ai-benchmark.json`下载完整运行日期、工作区状态、公式和样本口径。
- 最终生产部署只读核心接口：25并发、500次请求，错误率0.40%、p95为807.59ms，达到验收档；50并发、1000次请求错误率0%、p95为747.27ms，仅作短时容量观察。
- 教学效果：真实成绩、课堂观察、问卷和学生成果均为“待采集”；同一测验的首次/最近一次作答不表述为受控前后测。
- 数据库健康入口改为教师主动触发的单次只读探测，不自动轮询、不返回主机或库名。独立监测按30秒间隔完成61次探测，61次成功，成功率100%，成功请求p50为906.18ms、p95为1570.38ms、最大2362.74ms；实际窗口31分钟。该结果只适用于本次短时窗口，不能用于宣称历史可用率。

*本文件中的AI基准已于2026-08-25在本地复测；截至当日生产站点仍提供2026-08-03的schema v4历史记录，最终部署后需核对为schema v5。生产性能与数据库窗口仍对应2026-08-02记录，部署或数据源变化后需重新验证。*
