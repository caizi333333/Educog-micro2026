'use client';

// 讲解笔记（试运行）
// ---------------------------------------------------------------------------
// 平台已有"图谱定位 → 动画学习 → 专项测评 → 薄弱补学 → 仿真实践 → 复测"的闭环，
// 缺的是闭环里 STEP 02 那一环的"讲透"：把单元 2 的硬件结构按知识点逐条拆开，
// 每篇含讲解 / 疑点 / 自测三栏。
//
// 内容本身是自包含的静态 HTML，放在 /resources/course/courseware/u2/ 下，
// 与既有的 lab-report PDF、diagrams SVG 同级。本页只做外壳：页签 + 同源 iframe。
// 这样讲解页可以单独迭代、单独深链，不进入平台构建，也不与平台的样式和全局 id
// 发生任何耦合。
//
// 同源 iframe 在平台现有安全头下是允许的：CSP frame-src 'self'，
// 且 /resources/* 被显式放宽为 X-Frame-Options: SAMEORIGIN（见 next.config.ts）。
//
// 外壳沿用 HyperCoursesPage 的双形态写法：未登录访客套公开站顶栏，
// 登录后由 AppLayout 提供侧边栏，本页只出内容，不重复顶栏。
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, NotebookPen, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PublicSiteHeader } from '@/components/shared/PublicSiteChrome';
import { cn } from '@/lib/utils';

const RESOURCE_BASE = '/resources/course/courseware/u2';

type LessonNote = {
  /** 静态文件名（不含扩展名），同时用作 tab key */
  file: string;
  title: string;
  /** 一句话点出这一篇要破的那个误解 */
  sub: string;
  /** 对应 knowledge-points.ts 中的二级知识点 id，用于回跳图谱 */
  pointId: string;
};

const LESSON_NOTES: readonly LessonNote[] = [
  { file: 'u2-cpu-structure', title: 'CPU 结构', sub: '运算器、控制器与那几个"记事本"', pointId: '2.1' },
  { file: 'u2-memory', title: '存储器组织', sub: '地址会重号，靠指令区分', pointId: '2.2' },
  { file: 'u2-io-port', title: 'I/O 接口', sub: '四张位结构图其实是同一张图', pointId: '2.3' },
  { file: 'u2-clock-timing', title: '时钟与时序', sub: '四种周期是套娃，不是并列', pointId: '2.4' },
  { file: 'u2-reset', title: '复位系统', sub: '一个高电平，把全机拨回原点', pointId: '2.5' },
  { file: 'u2-bus', title: '总线结构', sub: 'P0 为什么要"分时"，P2 为什么不用', pointId: '2.6' },
] as const;

export default function LessonNotesPage(): React.JSX.Element {
  const { user } = useAuth();
  const [activeFile, setActiveFile] = useState<string>(LESSON_NOTES[0]!.file);
  // 已经打开过的篇目保持挂载：切回去时图上的端口、模式、自测进度都还在。
  const [mounted, setMounted] = useState<readonly string[]>([LESSON_NOTES[0]!.file]);

  const openNote = useCallback((file: string): void => {
    setActiveFile(file);
    setMounted((prev) => (prev.includes(file) ? prev : [...prev, file]));
  }, []);

  const active = LESSON_NOTES.find((note) => note.file === activeFile) ?? LESSON_NOTES[0]!;
  const isPublicShell = !user;
  const ContentLandmark: 'main' | 'div' = isPublicShell ? 'main' : 'div';

  // 知识图谱要登录才能进。访客直接给登录入口并带上 from，按平台既有写法
  // （见 HyperCoursesPage 的 SampleLessonPanel）——否则点进去会被中间件
  // 静默弹回登录页，访客也不知道为什么。
  const graphHref = `/knowledge-graph?chapter=2&node=${encodeURIComponent(active.pointId)}`;
  const graphLinkHref = isPublicShell
    ? `/login?role=student&from=${encodeURIComponent(graphHref)}`
    : graphHref;

  return (
    <div
      className={cn(
        'animate-fade-in bg-[#070a0d] text-slate-100',
        isPublicShell ? 'min-h-screen' : '-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto sm:-m-6',
      )}
    >
      {isPublicShell && (
        <>
          <a
            href="#main-content"
            className="fixed left-4 top-3 z-[100] inline-flex min-h-11 -translate-y-20 items-center rounded-md bg-cyan-200 px-4 text-sm font-semibold text-[#001014] shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-50"
          >
            跳到主要内容
          </a>
          <PublicSiteHeader active="notes" />
        </>
      )}

      <ContentLandmark
        id={isPublicShell ? 'main-content' : undefined}
        tabIndex={isPublicShell ? -1 : undefined}
        className={isPublicShell ? 'outline-none' : undefined}
      >
        {/* 试运行标识：讲清楚这是什么、从哪来，不冒充正式栏目 */}
        <div className="border-b border-amber-300/20 bg-amber-300/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 md:px-6">
            <span className="rounded-sm bg-amber-300 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.14em] text-[#1a1206]">
              试运行
            </span>
            <p className="min-w-0 text-xs leading-5 text-slate-300">
              单元 2「硬件结构」讲解笔记 <b className="font-semibold text-amber-100">6 篇</b>
              <span className="mx-2 text-slate-600">·</span>
              按平台知识点导航逐条展开，每篇含<b className="font-semibold text-amber-100">讲解 / 疑点 / 自测</b>三栏
              <span className="mx-2 text-slate-600">·</span>
              内容依据教材第 2 章，属课堂讲解补充，欢迎反馈
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
                <NotebookPen aria-hidden="true" className="h-3.5 w-3.5" />
                LESSON NOTES · 单元 2 · 硬件结构
              </div>
              <h1 className="heading-gradient text-2xl font-semibold tracking-tight md:text-3xl">讲解笔记</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                平台的学习闭环里已经有测评和仿真，这一批补的是中间那一环：把教材第 2 章讲不透的地方逐条拆开。
                每篇都能单独读完，也能从知识图谱里的对应节点直接进来。
              </p>
            </div>
            <Link
              href={graphLinkHref}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              在知识图谱中查看 {active.pointId} {active.title}
              {isPublicShell && <span className="text-slate-400">（需登录）</span>}
            </Link>
          </div>

          {/* 页签 */}
          <div className="mt-5 overflow-x-auto pb-1">
            <div role="tablist" aria-label="单元 2 讲解笔记" className="flex w-max gap-2">
              {LESSON_NOTES.map((note) => {
                const selected = note.file === activeFile;
                return (
                  <button
                    key={note.file}
                    type="button"
                    role="tab"
                    id={`note-tab-${note.file}`}
                    aria-selected={selected}
                    aria-controls={`note-panel-${note.file}`}
                    onClick={() => openNote(note.file)}
                    className={cn(
                      'flex min-h-11 shrink-0 flex-col justify-center gap-0.5 rounded-md border px-3 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
                      selected
                        ? 'border-cyan-300/25 bg-cyan-300/[0.12] text-cyan-50'
                        : 'border-white/[0.08] bg-white/[0.035] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] hover:text-cyan-100',
                    )}
                  >
                    <span className="whitespace-nowrap text-sm font-semibold leading-5">{note.title}</span>
                    <span className="hidden whitespace-nowrap text-xs leading-4 opacity-70 sm:block">{note.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 内容区：同源 iframe，讲解页自身带完整排版与交互 */}
          <div className="mt-3 overflow-hidden rounded-md border border-white/[0.08] bg-[#0b1117]">
            {LESSON_NOTES.filter((note) => mounted.includes(note.file)).map((note) => (
              <div
                key={note.file}
                role="tabpanel"
                id={`note-panel-${note.file}`}
                aria-labelledby={`note-tab-${note.file}`}
                hidden={note.file !== activeFile}
              >
                <iframe
                  src={`${RESOURCE_BASE}/${note.file}.html`}
                  title={`${note.title} · 讲解笔记`}
                  loading="lazy"
                  className="block h-[min(78dvh,860px)] w-full border-0"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-slate-500">
            <span>
              教材　<b className="font-semibold text-slate-300">韩兴国《微控制器原理及接口控制技术》第 2 章</b>
            </span>
            <span>
              图表　<b className="font-semibold text-slate-300">图 2-1 / 2-3 / 2-5~2-10，表 2-2 / 2-3 / 2-7</b>
            </span>
            <a
              href={`${RESOURCE_BASE}/${active.file}.html`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded px-1 text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              在新标签单独打开本篇
            </a>
          </div>
        </div>
      </ContentLandmark>
    </div>
  );
}
