# 芯智育才平台技术架构与功能说明

> 版本：2026-06-04　对应线上地址 https://sunyancai.top
> 代码仓库：https://github.com/caizi333333/Educog-micro2026

---

## 1. 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | Next.js 15 + React + Tailwind CSS + ShadCN/UI | App Router，服务端/客户端组件混合 |
| 后端 | Next.js API Routes | RESTful，与前端同一项目 |
| 数据库 | PostgreSQL (Neon Serverless) | Prisma ORM，线上连接池 |
| AI 层 | Google Genkit + DeepSeek | 答疑、代码分析、学习路径推荐 |
| 认证 | JWT (7天 access + 30天 refresh) + bcrypt | 自建认证，DB Session 表 |
| 部署 | Vercel (sin1 区域) | Git push 自动部署 |

---

## 2. 数据库设计

### 2.1 表结构（共 15 张表）

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

### 3.1 可用账号

| 角色 | 用户名 | 密码 | 用途 |
|------|--------|------|------|
| 教师（主账号） | `sunyancai` | `edu123456` | 孙延才本人 |
| 演示教师 | `demo_teacher` | `demo123456` | 评委体验教师端 |
| 演示学生 | `demo_student` | `stu123456` | 评委体验学生端 |
| 管理员 | `admin` | `edu123456` | 系统后台管理 |
| 学生（批量） | 学号如 `202401001` | `stu123456` | 40名模拟学生 |

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
| 知识图谱 | `/knowledge-graph` | 270节点三层图谱，可视化知识结构 |
| 仿真实验 | `/simulation` | 8051代码仿真，13个实验，LED/数码管/波形可视化 |
| AI助教 | `/ai-assistant` | DeepSeek驱动，答疑解惑，支持代码分析 |
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
| 学生综合报告 | 姓名/学号/班级/登录次数/学习时长/测验均分/实验完成/知识点覆盖率/AI使用 | 学生画像、教学成效分析 |
| 测验详细记录 | 每次测验的得分/题数/用时/时间 | 深入分析答题情况 |
| 学习活动日志 | 每条学习事件的类型/目标/时长 | 学习行为分析 |
| 实验详细记录 | 每次实验的状态/得分/尝试次数 | 实验教学效果 |

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

## 7. 待完善功能

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 前测实施 | 教学实验材料包已备好，需安排教学班发卷 |
| P0 | 确认校内选拔截止日 | 需向教务处确认，早于2026-09-01 |
| P1 | 说课视频（8分钟） | 脚本待写，需演示平台+教学成效 |
| P1 | 作品简介（≤1500字） | 推荐表必填 |
| P2 | 演示账号清理 | 线上旧测试账号（test/demo1/demo2等）可考虑停用 |
| P2 | 教师端CSV导出按钮优化 | 可加日期范围筛选 |
| P3 | 忘记密码功能 | 当前未实现，不影响大赛演示 |
| P3 | 登录限速 | 防暴力破解，可加 rate-limit 中间件 |

---

*本文件基于 2026-06-04 代码库状态编写，如平台有更新请同步修改。*
