# vLayout 设计原则（#66）

确认：2026-10-28（Asia/Shanghai）。父单 [#65](https://github.com/caizi333333/Educog-micro2026/issues/65)，本单 [#66](https://github.com/caizi333333/Educog-micro2026/issues/66)。

这一页只锁定原则和 token 名字。页面间距、课件栏宽、练一练位置、「回课次」按钮都还没改。

## 目标

在不砍知识点、不破坏练一练、深链和学情口径的前提下，让「读课件 → 练一练 → 回课次/章」在手机和桌面上松紧一致、位置可预期。

## 已拍板

| # | 决定 |
| --- | --- |
| 1 | 课件正文 `max-width` 为 **800px**（`--content-max-width`）。仿真图面仍是 **`min(100%, 960px)`** 居中，不跟正文收成 800px。 |
| 2 | 窄屏练一练用 **展开压上**：练习在上，课件在下并可滚动。宽屏可以并排，练习栏宽 **≤ 40%**。宽屏断点由 #67 实现时定，本页不新造断点 token。 |
| 3 | 必须有显式 **「回课次」** 按钮。不能只靠浏览器 history。 |

## 原则

### P1 一屏一事

同一视口优先保证一个主任务：要么读（课件区），要么练（练一练展开区）。窄屏默认读；练一练默认折叠。展开后练习区在上，课件可滚或暂缩。禁止练习条和 sticky 页签同时抢竖向空间，导致哪儿都点不到。

### P2 间距阶梯

松紧只走四档，不在页面里随手写 2px 或 32px。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--space-1` | 4px | 芯片内缝 |
| `--space-2` | 8px | 控件组内 |
| `--space-3` | 16px | 卡片内边距、栏间距 |
| `--space-4` | 24px | 区块之间、主栏与边 |

过挤：连续区块间距小于 `--space-3`。过松：主内容栏两侧空白把正文栏宽压到可读下限以下，却没有结构分区。

颜色、圆角、交界色仍用现有 cell / junction token（见 `docs/student-cell-junction.md`）。`--cell-gap` 现在是 `0.5rem`（根字号 16px 时等于 8px，与 `--space-2` 同档），本单不把它改写成 `var(--space-2)`。

### P3 栏宽与触控

- 课件正文 max-width **800px**。仿真图面 **`min(100%, 960px)`** 居中。
- 触控热区 ≥ **44px**（页签、返回、「回课次」、展开练一练）。现有 `min-h-11` 已是 44px，本单不另加触控 token。
- 手机 390：sticky 一级页签一屏可见约 5–6 个，超出收入「更多/课次」，不整排横滑撑破屏。

### P4 导航可复述

学生任何时刻应能回答：我在哪一章、哪一课次、哪一小节，以及怎么回去。

| 动作 | 行为 |
| --- | --- |
| 回课次 | 显式按钮，回到课次入口或章总览。不靠浏览器 history 乱跳。 |
| 课次切换 | 同章内横向或列表切换，保留当前阅读模式。 |
| 深链进入 | 落地后仍显示面包屑或等价的「章 › 课次 › 小节」。锚点丢失视为缺陷（如 `#hex-split`）。 |
| 练一练 | 不改变「当前小节」身份，只切换专注层。 |

### P5 视觉跟 token

颜色、圆角、描边、cell 交界感继续走站点已有 design tokens。本大版本不换技术栈、不加付费渲染。仿真页只调布局比例与留白（#69），不重开「换渲染引擎」。

## Token 空壳与引用点

变量定义在 `src/app/globals.css` 的 `:root`。本单没有任何页面读取它们。课件 HTML 在 iframe 里，读不到应用的 `:root`；#68 再决定怎么把同一组值带进课件，本单不改课件样式。

| 之后的单 | 引用点 | 将读取 |
| --- | --- | --- |
| #67 lesson-notes 壳层 | `src/app/lesson-notes/page.tsx`（现为 `max-w-7xl` 栏、单元切换、篇目页签、`CoursewareSeam`） | `--space-1`…`--space-4`；课件栏收向 `--content-max-width` |
| #67 练一练 | `src/components/practice/DragMatchPractice.tsx`（`data-practice`） | 窄屏展开压上；宽屏练习 ≤ 40% |
| #70 导航 | 同一 lesson-notes 壳 | 显式「回课次」；深链落点与面包屑 |
| #68 课件 HTML | 先抽测 u4 / u5。现宽：`u4/u4-classroom.html` 的 `.kp-wrap`（1120px，后段 1360px）、`u5/lib/kp-theme.css` 的 `.kp-wrap`（1120px）、`u5/lib/u5-interrupt-classroom.css` 的 `.wrap`（`min(1360px, 100%)`） | 正文栏对齐 800px；页内密度走间距阶梯 |
| #69 仿真 | `src/app/simulation/page.tsx`、`HyperExperimentCanvas` | `--simulation-canvas-max-width`（960px）；图面 `min(100%, var(--simulation-canvas-max-width))` 居中；留白用 `--space-3` / `--space-4`；画布控件条不浮压接线区 |
| #71 模式 | 壳层阅读 / 练习专注层 | 仅当 #67 的展开压上不够时再做独立模式 |

从 #67 起，每个改布局的 PR 附 390 与 1280 对照，并冒烟至少一块练一练和一条深链。本单无视觉差异，不附截图。

## 落地顺序

1. **#66** 原则入库（本文 + CSS 变量空壳）
2. **#67** lesson-notes 壳层松紧
3. **#70** 导航 / 返回 / 面包屑（含「回课次」与深链落点）
4. **#68** 课件 HTML 页内密度（按章抽测，先 u4 / u5）
5. **#69** `/simulation` 图面比例
6. **#71** 阅读 / 练习模式（若 #67 之后仍需要）

## #68 怎么把 token 带进课件

课件在 iframe 里，读不到 `src/app/globals.css` 的 `:root`。同一组数值写在 `public/resources/course/courseware/lib/vlayout-density.css`（`--space-1`…`--space-4`、`--content-max-width: 800px`）。u2–u5 的 HTML 在 `</head>` 前链入这份样式和 `vlayout-tabs.js`。第 5 章总览的 srcdoc 由 `containFrame` 再注入。窄屏（≤760px）页签超过 6 个时，前 5 个留在条上，其余进「更多」；当前选中的页签即使靠后也保持可见。课次行不折叠。页签触控高度 44px。图和寄存器表在框内横滑，不把整页撑出横向滚动条。

## 明确不做

- **#33** 课件/练习游戏互动新板、**#56** 反馈按钮全站覆盖、**#57** 勋章配色：视觉大改推迟，方案未定前不并行。
- 不借布局 PR 改知识点正文或删锚点。
- 不引入新付费服务，不重写题库。
- 不在本单改 lesson-notes 布局、MatchBoard，或颜色体系。
