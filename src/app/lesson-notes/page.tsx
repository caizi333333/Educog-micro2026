'use client';

// 讲解笔记（试运行）
// ---------------------------------------------------------------------------
// 平台已有"图谱定位 → 动画学习 → 专项测评 → 薄弱补学 → 仿真实践 → 复测"的闭环，
// 缺的是闭环里 STEP 02 那一环的"讲透"：把单元 2 的硬件结构、单元 3 的指令系统
// 按知识点逐条拆开，每篇含讲解 / 疑点 / 自测三栏。
//
// 内容本身是自包含的静态 HTML，按单元放在 /resources/course/courseware/u2/、u3/ 下，
// 与既有的 lab-report PDF、diagrams SVG 同级。本页只做外壳：单元切换 + 页签 + 同源 iframe。
// 这样讲解页可以单独迭代、单独深链，不进入平台构建，也不与平台的样式和全局 id
// 发生任何耦合。
//
// 同源 iframe 在平台现有安全头下是允许的：CSP frame-src 'self'，
// 且 /resources/* 被显式放宽为 X-Frame-Options: SAMEORIGIN（见 next.config.ts）。
//
// 讲解笔记只对已登录且已加入班级的学生，以及教师、管理员开放。
// 登录后由 AppLayout 提供侧边栏，本页只出内容，不重复顶栏。
//
// 讲解页里指向别篇的链接（含跨单元，如第 3 章指向第 2 章的 P0~P3 口），嵌在这里时
// 由讲解页 postMessage {type:'lesson-note:open', file, hash} 交给外壳切单元、切页签，
// 不在 iframe 里再套一层讲解页。只收同源消息，只认下面登记过的篇目。
// 深链：/lesson-notes?note=u3-jump 直接打开某一篇，?unit=5#int-2 打开第 5 章总览的那一节。
// 页内 hash 要写进 iframe 的地址；外壳自己吃掉 hash 时，#int-2 会停在本章主线，对比短片不出现。
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, NotebookPen, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CellSwitch, CellSwitchItem, CoursewareSeam, SurfaceKicker, cellSurfaceClass } from '@/components/shared/Cell';
import { PublicSiteHeader } from '@/components/shared/PublicSiteChrome';
import {
  readEmbeddedSection,
  resolveLessonDeepLink,
  resolveLessonVisit,
  standaloneCoursewareHref,
} from '@/lib/classroom-sections';
import { scrollLeftForChip } from '@/lib/reveal-horizontal-chip';
import { useLearningPresence } from '@/hooks/useLearningPresence';
import { cn } from '@/lib/utils';
import { DragMatchPractice } from '@/components/practice/DragMatchPractice';
import { ADDRESSING_MODE_BOARD, CPU_STRUCTURE_BOARD, INTERRUPT_SOURCE_FLAG_BOARD, type MatchBoard } from '@/lib/practice-match';

type LessonNote = {
  /** 静态文件名（不含扩展名），同时用作 tab key */
  file: string;
  title: string;
  /** 一句话点出这一篇要破的那个误解 */
  sub: string;
  /** 对应 knowledge-points.ts 中的知识点 id，用于回跳图谱 */
  pointId: string;
  /** 图谱按钮上显示的知识点名，缺省同 title */
  pointName?: string;
};

type LessonUnit = {
  /** 单元号，同时是教材章号 */
  id: number;
  name: string;
  base: string;
  notes: readonly LessonNote[];
  /** 试运行横幅中间那句 */
  bannerMid: React.ReactNode;
  intro: string;
  figures: string;
};

const U2_NOTES: readonly LessonNote[] = [
  { file: 'u2-cpu-structure', title: 'CPU 结构', sub: '运算器、控制器与那几个"记事本"', pointId: '2.1' },
  { file: 'u2-memory', title: '存储器组织', sub: '地址会重号，靠指令区分', pointId: '2.2' },
  { file: 'u2-io-port', title: 'I/O 接口', sub: '四张位结构图其实是同一张图', pointId: '2.3' },
  { file: 'u2-clock-timing', title: '时钟与时序', sub: '四种周期是套娃，不是并列', pointId: '2.4' },
  { file: 'u2-reset', title: '复位系统', sub: '一个高电平，把全机拨回原点', pointId: '2.5' },
  { file: 'u2-bus', title: '总线结构', sub: 'P0 为什么要"分时"，P2 为什么不用', pointId: '2.6' },
] as const;

const U3_NOTES: readonly LessonNote[] = [
  { file: 'u3-video', title: '讲解视频', sub: '寻址收官：变址·相对·位，11 分 49 秒', pointId: '3.1', pointName: '寻址方式' },
  { file: 'u3-overview', title: '第 3 章交互总览', sub: '先选第 1–4 次课，再进小节；#jump 等旧锚点仍打开原来那一节', pointId: '3', pointName: '指令系统' },
  // 原子页仍在 u3/ 目录，教学内容在总览 DATA 里，不删。入口按四次课收进总览，避免十几节摊在一屏。
  // 旧 ?note=u3-jump 等别名仍打开总览对应锚点（见 NOTE_ALIAS）。#lesson-a 留给第 5 章，第 3 章课次用 #u3-lesson-a。
] as const;

const U4_NOTES: readonly LessonNote[] = [
  { file: 'u4-video', title: '讲解视频', sub: '第一讲精讲版：伪指令到查表，约 25 分钟', pointId: '3.5', pointName: '控制转移（前置）' },
  { file: 'u4-classroom', title: '课堂互动台', sub: '指令判对错 / 寻址 / 例程演练 / 当堂自测', pointId: '3.5', pointName: '控制转移（前置）' },
] as const;

const U5_NOTES: readonly LessonNote[] = [
  { file: 'u5-overview', title: '第 5 章交互总览', sub: '先选中断或定时，再进第 1–3 次课；⑭装值见课堂页 #hex-split', pointId: '5', pointName: '中断系统' },
  { file: 'u5-knowledge', title: '知识导览', sub: '三次课入口与媒资；#int-2 等深链仍回总览', pointId: '5', pointName: '中断系统' },
] as const;

const LESSON_UNITS: readonly LessonUnit[] = [
  {
    id: 2,
    name: '硬件结构',
    base: '/resources/course/courseware/u2',
    notes: U2_NOTES,
    bannerMid: (
      <>
        按平台知识点导航逐条展开，每篇含<b className="font-semibold text-amber-100">讲解 / 疑点 / 自测</b>三栏
      </>
    ),
    intro: '平台的学习闭环里已经有测评和仿真，这一批补的是中间那一环：把教材第 2 章讲不透的地方逐条拆开。CPU 结构这一篇可以练一练：把 6 块碎片放回运算器、控制器和其他寄存器。',
    figures: '图 2-1 / 2-3 / 2-5~2-10，表 2-2 / 2-3 / 2-7',
  },
  {
    id: 3,
    name: '指令系统',
    base: '/resources/course/courseware/u3',
    notes: U3_NOTES,
    bannerMid: (
      <>
        先选课次再进小节：<b className="font-semibold text-amber-100">数在哪 · 怎么搬 · 怎么算 · 怎么跳</b>
      </>
    ),
    intro: '指令系统难在“看不见”：数从哪取、往哪去、为什么要这样设计。第 3 章总览先出四次课，每次只显示这一课的小节。旧链接 ?note=u3-jump、#addressing 仍打开原来的那一节。每节先抛一个设计难题，你选了方案再看后果和 80C51 的做法，最后动手练、当场小测。',
    figures: '表 3-2~3-6 / 3-13 / 3-14，例 3-1~3-26',
  },
  {
    id: 4,
    name: '汇编语言程序设计',
    base: '/resources/course/courseware/u4',
    notes: U4_NOTES,
    bannerMid: (
      <>
        讲解视频 + 课堂互动台：例程可<b className="font-semibold text-amber-100">单步演练、当堂自测</b>
      </>
    ),
    intro: '第 4 章配套讲解视频与课堂互动台：先看视频把伪指令、程序设计步骤、查表思路过一遍，再到互动台里判指令、拆例程、做当堂自测。',
    figures: '例 4-1~4-16，伪指令 ORG / DB / DW / EQU / DATA / BIT',
  },
  {
    id: 5,
    name: '中断系统与定时器',
    base: '/resources/course/courseware/u5',
    notes: U5_NOTES,
    bannerMid: (
      <>
        先选课次再进小节：<b className="font-semibold text-amber-100">第 1 次课入门 · 第 2 次课案例 · 第 3 次课收口</b>
      </>
    ),
    intro: '第 5 章先选门：中断或定时。中断按三次课打开——第 1 次课入门（①–⑧）、第 2 次课案例（⑨–⑬）、第 3 次课装值与收口（⑭起）。旧链接 #int-2 仍打开总览里的那一节；÷256 拆字节仍是课堂页 #hex-split。第 1 次课③上方可以练一练：把 5 个中断源对上请求标志。',
    figures: '课件第5章例5-1~5-9（无5-7）；向量 0003H/000BH/0013H/001BH/0023H',
  },
] as const;

const DEFAULT_UNIT = LESSON_UNITS[0]!;

function findNote(file: string): { unit: LessonUnit; note: LessonNote } | undefined {
  for (const unit of LESSON_UNITS) {
    const note = unit.notes.find((item) => item.file === file);
    if (note) return { unit, note };
  }
  return undefined;
}

// 第 3 章原单页已并入总览：旧链接（?note=u3-classroom、页内跳转）改开总览对应一节
const NOTE_ALIAS: Readonly<Record<string, string>> = {
  // 整合后：七种寻址、课堂互动台、机器周期并入“寻址方式与机器周期”；29 条总表并入 MOV（原页在总览“备用资料”）
  'u3-isa-map': '#isa-map', 'u3-isa-design': '#isa-map', 'u3-addressing': '#addressing', 'u3-addressing-design': '#addressing',
  'u3-classroom': '#addressing', 'u3-machine-cycle': '#addressing', 'u3-transfer': '#transfer', 'u3-stack-push-pop': '#stack',
  'u3-mov-design': '#transfer', 'u3-movx-movc': '#movx-movc', 'u3-xch': '#xch',
  'u3-arith': '#arith', 'u3-logic': '#logic', 'u3-jump': '#jump', 'u3-bit': '#bit',
};

// 讲解页传来的 hash 只用于页内定位（如 #m=bit、#i=…），格式不对就丢掉
const HASH_PATTERN = /^#[\w=%.~-]{1,160}$/;

export default function LessonNotesPage(): React.JSX.Element {
  const { user } = useAuth();
  const [activeFile, setActiveFile] = useState<string>(DEFAULT_UNIT.notes[0]!.file);
  // 已经打开过的篇目保持挂载：切回去时图上的端口、模式、自测进度都还在。
  const [mounted, setMounted] = useState<readonly string[]>([DEFAULT_UNIT.notes[0]!.file]);
  // 首次挂载时带上的页内定位；已挂载的篇目改 hash 走 frames 直接设
  const [initialHash, setInitialHash] = useState<Readonly<Record<string, string>>>({});
  // 每个单元上次看到哪一篇，切回该单元时回到那里
  const [lastInUnit, setLastInUnit] = useState<Readonly<Record<number, string>>>({});
  const [sectionId, setSectionId] = useState('');
  const [frameReady, setFrameReady] = useState<Readonly<Record<string, boolean>>>({});
  // null follows the courseware section; true/false is the student's own open or close.
  const [practiceOpen, setPracticeOpen] = useState<boolean | null>(null);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const unitStripRef = useRef<HTMLDivElement>(null);
  const activeFileRef = useRef(activeFile);
  activeFileRef.current = activeFile;

  const openNote = useCallback((rawFile: string, rawHash = ''): void => {
    const aliasHash = NOTE_ALIAS[rawFile];
    const file = aliasHash ? 'u3-overview' : rawFile;
    const hash = aliasHash ?? rawHash;
    const hit = findNote(file);
    if (!hit) return;
    const sectionFromHash = hash.startsWith('#') ? hash.slice(1) : '';
    if (/^[\w=%.~-]{1,64}$/.test(sectionFromHash)) setSectionId(sectionFromHash);
    if (file !== activeFileRef.current) setPracticeOpen(null);
    setActiveFile(file);
    setLastInUnit((prev) => (prev[hit.unit.id] === file ? prev : { ...prev, [hit.unit.id]: file }));
    if (mounted.includes(file)) {
      const frame = frames.current.get(file);
      const win = hash ? frame?.contentWindow : null;
      let loadedHere = false;
      if (win) {
        try {
          loadedHere = win.location.pathname.endsWith(`/${file}.html`);
        } catch {
          loadedHere = false;
        }
      }
      if (win && loadedHere) {
        try {
          // 用 replace 改 hash：不在浏览器历史里留一串页内跳转，"后退"仍是离开本页。
          // 相对地址会按外壳页解析（会把外壳整页套进框里），所以拼成讲解页自己的路径。
          // 同一个 hash 再点一次不会触发 hashchange，先清一下再设。
          const here = `${win.location.pathname}${win.location.search}`;
          if (win.location.hash === hash) win.location.replace(`${here}#`);
          win.location.replace(`${here}${hash}`);
        } catch {
          // 同源页面不会走到这里；万一跨源就放弃定位，只切页签
        }
        return;
      }
      // 默认篇在首屏就已经挂上，这时框里还是空白页。把 hash 写进 src，
      // 避免对空白页 replace，也让 #cpu 这类入口能滚到图 2-3。
      if (hash) setInitialHash((prev) => (prev[file] === hash ? prev : { ...prev, [file]: hash }));
      return;
    }
    if (hash) setInitialHash((prev) => ({ ...prev, [file]: hash }));
    setMounted((prev) => (prev.includes(file) ? prev : [...prev, file]));
  }, [mounted]);

  const openUnit = useCallback((unit: LessonUnit): void => {
    openNote(lastInUnit[unit.id] ?? unit.notes[0]!.file);
  }, [lastInUnit, openNote]);

  // 讲解页里点了别篇的链接
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (typeof data !== 'object' || data === null) return;
      const { type, file, hash } = data as { type?: unknown; file?: unknown; hash?: unknown };
      if (type !== 'lesson-note:open' || typeof file !== 'string') return;
      openNote(file, typeof hash === 'string' && HASH_PATTERN.test(hash) ? hash : '');
    };
    window.addEventListener('message', onMessage);
    return (): void => window.removeEventListener('message', onMessage);
  }, [openNote]);

  useEffect(() => {
    let stopped = false;
    const read = (): void => {
      if (stopped) return;
      const next = readEmbeddedSection(frames.current.get(activeFile));
      setSectionId((previous) => (previous === next ? previous : next));
    };
    read();
    const timer = window.setInterval(read, 2000);
    return (): void => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeFile, mounted]);

  // 深链：?note=、?unit= 和页内 hash（如 #int-2）只在进页时读一次
  const deepLinkRead = useRef(false);
  useEffect(() => {
    if (deepLinkRead.current) return;
    deepLinkRead.current = true;
    const params = new URLSearchParams(window.location.search);
    const unitParam = params.get('unit');
    const unitId = unitParam != null && /^\d+$/.test(unitParam) ? Number(unitParam) : null;
    const target = resolveLessonDeepLink({
      note: params.get('note'),
      unitId,
      hash: window.location.hash,
      alias: NOTE_ALIAS,
      notesInUnit: (id) => LESSON_UNITS.find((item) => item.id === id)?.notes.map((item) => item.file) ?? [],
      isKnownNote: (file) => Boolean(findNote(file)),
    });
    if (target) openNote(target.file, target.hash);
  }, [openNote]);

  // 窄屏单元条横滑。深链落到靠后的单元时，把当前芯片滚进可视区。
  useEffect(() => {
    const strip = unitStripRef.current;
    const narrow = window.matchMedia?.('(max-width: 639px)')?.matches ?? false;
    if (!strip || !narrow) return;
    const chip = strip.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!chip) return;
    const stripBox = strip.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const next = scrollLeftForChip(
      {
        scrollLeft: strip.scrollLeft,
        clientWidth: strip.clientWidth,
        scrollWidth: strip.scrollWidth,
        stripLeft: stripBox.left,
      },
      { left: chipBox.left, width: chipBox.width },
    );
    if (next !== strip.scrollLeft) strip.scrollLeft = next;
  }, [activeFile]);

  const { unit: activeUnit, note: active } = findNote(activeFile) ?? { unit: DEFAULT_UNIT, note: DEFAULT_UNIT.notes[0]! };
  const practiceBoard: MatchBoard | null = active.file === 'u5-overview'
    ? INTERRUPT_SOURCE_FLAG_BOARD
    : active.file === 'u3-overview'
      ? ADDRESSING_MODE_BOARD
      : active.file === 'u2-cpu-structure'
        ? CPU_STRUCTURE_BOARD
        : null;
  const lessonVisit = resolveLessonVisit({
    unitId: activeUnit.id,
    noteFile: active.file,
    pointId: active.pointId,
    sectionId,
  });
  useLearningPresence('section', user?.role === 'STUDENT' ? {
    eventType: 'SECTION_VISIT',
    targetType: 'KNOWLEDGE_POINT',
    targetId: lessonVisit.targetId,
    moduleId: lessonVisit.moduleId,
    chapterId: lessonVisit.chapterId,
    metadata: {
      source: 'lesson-notes',
      route: '/lesson-notes',
      sectionId: lessonVisit.sectionId,
      noteFile: active.file,
      knowledgePointId: lessonVisit.knowledgePointId,
    },
  } : null);
  const mountedNotes = LESSON_UNITS.flatMap((unit) =>
    unit.notes.filter((note) => mounted.includes(note.file)).map((note) => ({ unit, note })));
  const isPublicShell = !user;
  const ContentLandmark: 'main' | 'div' = isPublicShell ? 'main' : 'div';

  // 知识图谱要登录才能进。访客直接给登录入口并带上 from，按平台既有写法
  // （见 HyperCoursesPage 的 SampleLessonPanel）——否则点进去会被中间件
  // 静默弹回登录页，访客也不知道为什么。
  const graphHref = `/knowledge-graph?chapter=${activeUnit.id}&node=${encodeURIComponent(active.pointId)}`;
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
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 md:px-6 sm:py-2.5">
            <span className="rounded-sm bg-amber-300 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.14em] text-[#1a1206]">
              试运行
            </span>
            <p className="min-w-0 text-xs leading-5 text-slate-300 line-clamp-2 sm:line-clamp-none">
              单元 {activeUnit.id}「{activeUnit.name}」讲解笔记{' '}
              <b className="font-semibold text-amber-100">{activeUnit.notes.length} 篇</b>
              <span className="mx-2 text-slate-600">·</span>
              {activeUnit.bannerMid}
              <span className="mx-2 text-slate-600">·</span>
              内容依据教材第 {activeUnit.id} 章，属课堂讲解补充，欢迎反馈
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-3 md:px-6 sm:pb-8 sm:pt-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between sm:gap-4">
            <div className="min-w-0">
              <SurfaceKicker tone="notes" className="mb-2 sm:mb-3">
                <NotebookPen aria-hidden="true" className="h-3.5 w-3.5" />
                LESSON NOTES · 单元 {activeUnit.id} · {activeUnit.name}
              </SurfaceKicker>
              <h1 className="heading-gradient text-2xl font-semibold tracking-tight md:text-3xl">讲解笔记</h1>
              <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-slate-400 sm:block">
                {activeUnit.intro}
                每篇都能单独读完，也能从知识图谱里的对应节点直接进来。
              </p>
            </div>
            <Link
              href={graphLinkHref}
              className="hidden min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 sm:inline-flex"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              在知识图谱中查看 {active.pointId} {active.pointName ?? active.title}
              {isPublicShell && <span className="text-slate-400">（需登录）</span>}
            </Link>
          </div>

          {/* 单元切换：笔记色。窄屏横滑，避免再占一行高度。 */}
          <p className="mt-3 font-mono text-xs text-slate-500 sm:hidden">左右滑动切换单元</p>
          <CellSwitch ref={unitStripRef} label="选择单元" className="mt-2 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 sm:mt-5">
            {LESSON_UNITS.map((unit) => {
              const selected = unit.id === activeUnit.id;
              return (
                <CellSwitchItem
                  key={unit.id}
                  pressed={selected}
                  tone="notes"
                  onClick={() => openUnit(unit)}
                  className="inline-flex shrink-0 items-center gap-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
                >
                  单元 {unit.id} · {unit.name}
                  <span className="font-mono opacity-60">{unit.notes.length} 篇</span>
                </CellSwitchItem>
              );
            })}
          </CellSwitch>

          {/* 页签 */}
          <div className="mt-3 overflow-x-auto pb-1">
            <div role="tablist" aria-label={`单元 ${activeUnit.id} 讲解笔记`} className="flex w-max gap-2">
              {activeUnit.notes.map((note) => {
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
                    data-tone={selected ? 'course' : 'shell'}
                    data-state={selected ? 'active' : 'idle'}
                    className={cellSurfaceClass({
                      compact: true,
                      active: selected,
                      interactive: true,
                      className: cn(
                        'flex min-h-11 shrink-0 flex-col justify-center gap-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
                        selected ? 'text-cyan-50' : 'text-slate-300 hover:text-cyan-100',
                      ),
                    })}
                  >
                    <span className="whitespace-nowrap text-sm font-semibold leading-5">{note.title}</span>
                    <span className="hidden whitespace-nowrap text-xs leading-4 opacity-70 sm:block">{note.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {practiceBoard && (
            <DragMatchPractice
              key={practiceBoard.id}
              board={practiceBoard}
              expanded={practiceOpen ?? sectionId === practiceBoard.sectionId}
              onExpandedChange={setPracticeOpen}
              onOpenSection={() => {
                setPracticeOpen(true);
                openNote(practiceBoard.moduleId, `#${practiceBoard.sectionId}`);
              }}
            />
          )}

          {/* 内容区：同源 iframe。缝先占住高度，避免外壳和课件之间闪一下空框。 */}
          <CoursewareSeam className="mt-3" ready={Boolean(frameReady[activeFile])} label="这一篇正在打开，版面高度保持不变。">
            {mountedNotes.map(({ unit, note }) => (
              <div
                key={note.file}
                role="tabpanel"
                id={`note-panel-${note.file}`}
                aria-labelledby={`note-tab-${note.file}`}
                hidden={note.file !== activeFile}
              >
                <iframe
                  ref={(el) => {
                    if (el) frames.current.set(note.file, el);
                    else frames.current.delete(note.file);
                  }}
                  src={`${unit.base}/${note.file}.html${initialHash[note.file] ?? ''}`}
                  title={`${note.title} · 讲解笔记`}
                  loading="lazy"
                  tabIndex={frameReady[note.file] ? 0 : -1}
                  onLoad={() => {
                    setFrameReady((previous) => (previous[note.file] ? previous : { ...previous, [note.file]: true }));
                    if (activeFileRef.current !== note.file) return;
                    const next = readEmbeddedSection(frames.current.get(note.file));
                    setSectionId((previous) => (previous === next ? previous : next));
                  }}
                  className="block h-[calc(100dvh-14rem)] w-full border-0 sm:h-[min(78dvh,860px)]"
                />
              </div>
            ))}
          </CoursewareSeam>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-slate-500">
            <span>
              教材　<b className="font-semibold text-slate-300">韩兴国《微控制器原理及接口控制技术》第 {activeUnit.id} 章</b>
            </span>
            <span>
              图表　<b className="font-semibold text-slate-300">{activeUnit.figures}</b>
            </span>
            <Link
              href={graphLinkHref}
              className="inline-flex min-h-11 items-center rounded px-1 text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 sm:hidden"
            >
              知识图谱 · {active.pointId}
              {isPublicShell && <span className="text-slate-400">（需登录）</span>}
            </Link>
            <a
              href={standaloneCoursewareHref(activeUnit.base, active.file, sectionId)}
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
