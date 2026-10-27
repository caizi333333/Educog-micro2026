# 学生端 cell 与交界（#34 / #35）

这一页是首页单元总览、我的任务、讲解笔记外壳共用的约定。后续学生页要接同一套，不要另写时长、圆角或骨架高度。

## Tokens

定义在 `src/app/globals.css` 的 `:root`（浅色覆盖只改阴影和交界色）。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--cell-pad-y` / `--cell-pad-x` | `0.75rem` | cell 内边距 |
| `--cell-radius` | `var(--radius)`（0.5rem） | 圆角 |
| `--cell-gap` | `0.5rem` | 网格与切换条间距 |
| `--cell-min-block` | `5.5rem` | 骨架与单元格的最低高度，避免加载后塌陷 |
| `--cell-shadow` | 深色石墨投影 | 浮起，不是另一套卡片语言 |
| `--cell-duration` | `180ms` | 进入、悬停、课件显现。禁止页面私自时长 |
| `--cell-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | 同上 |
| `--junction-course` | 青 | 课程 / 课件格 |
| `--junction-task` | 翠绿 | 任务 |
| `--junction-notes` | 琥珀 | 讲解笔记，以及笔记外壳进入课件的那一条边 |
| `--junction-shell` | 中性 | 空态、未选中 |

色相用 `data-tone="course|task|notes|shell"` 选，不把十六进制写进页面。

`prefers-reduced-motion: reduce` 已在全局把动画和过渡压到瞬间。cell 不另加动画库。

## 组件

`src/components/shared/Cell.tsx`

- `cellSurfaceClass` — 链到现有 `<a>` / `<button>`，不改标签
- `Cell` / `CellGrid` / `CellSkeleton`
- `CellSwitch` / `CellSwitchItem` — 单元切换，换行，不再加一条横滑
- `SurfaceKicker` — 三页共用的眉题芯片，色相不同
- `CoursewareSeam` — 外壳和同源 iframe 之间的交界：先占住高度，载入前出骨架

## 交界规则

| 时刻 | 做法 |
| --- | --- |
| 进入一块表面 | 顶部或左侧一条该表面的 junction 色。眉题用 `SurfaceKicker`，时长只用 `--cell-duration` |
| 离开去另一块表面 | 格子改成目的地的 tone。任务里的「当前步骤」和「课前实验」用 course，因为下一步是课件/实验，不是再一块任务卡 |
| 空 | `data-tone="shell"` 的紧凑 cell，文案仍由该页决定 |
| 载入 | `CellSkeleton` 占住 `--cell-min-block`。课件用 `CoursewareSeam`，iframe 保持挂载 |
| 错 | 沿用现有红框文案和重试，不换成另一套 toast |
| 成功 | 沿用现有翠绿回执条。完成路径仍是 task tone |

页面可以保留自己的强调色（任务路径的翠绿底、笔记页的试运行条）。交界感来自同一套几何加上不同的色条，不是把三页刷成同一张海报。

## 本轮接到的表面

- 首页课程单元总览（`CourseUnitOverview`）
- 我的任务（加载、路径格、步骤、课前实验、空态）
- 讲解笔记外壳（单元切换、篇目页签、课件缝）

深链不变：`/#item-N`、`/tasks#task-record-…`、`/lesson-notes?note=`、`?unit=`、`#int-2`。

## 留给后面的页面

这些页面还没有接 cell / junction，下一轮每次只改一类表面：

- 在线测评 `src/app/quiz`
- 成就徽章 `src/app/achievements`
- 知识图谱 `src/app/knowledge-graph` 与 `/hyper` 工作台
- 个性化学习、薄弱节点
- 实验仿真台
- 教师壳与教师表
- 课件 HTML 正文（`public/resources/course/courseware/u2`–`u5`）。本轮只处理外壳到 iframe 的缝，不改知识点正文
- 学情分析、个人资料、OBE 学生页
