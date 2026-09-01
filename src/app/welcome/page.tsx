'use client';

import {
  ArrowRight,
  BarChart4,
  BookOpen,
  Bot,
  CheckCircle2,
  CircuitBoard,
  Cpu,
  FlaskConical,
  GitBranch,
  GraduationCap,
  ShieldCheck,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

const lessonSteps: Array<{ code: string; title: string; detail: string; icon: LucideIcon }> = [
  { code: '01', title: '图谱定位', detail: '定位 3.1 及其子节点', icon: GitBranch },
  { code: '02', title: '动画学习', detail: '比较七种寻址方式', icon: BookOpen },
  { code: '03', title: '专项测评', detail: '使用正式测验编号', icon: Target },
  { code: '04', title: '薄弱补学', detail: '按知识点返回资源', icon: CircuitBoard },
  { code: '05', title: 'exp02 实践', detail: '在指令仿真中验证', icon: FlaskConical },
  { code: '06', title: '再次测评', detail: '比较首次与最近作答', icon: CheckCircle2 },
];

const capabilityGroups: Array<{
  code: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  items: string[];
}> = [
  {
    code: 'LEARN',
    title: '学生学习有路径',
    desc: '每一步都说明目的、完成条件、当前状态和后续入口。',
    icon: GraduationCap,
    items: ['图谱、动画、测评与仿真实践相互衔接', '刷新、返回或重新登录后继续原进度'],
  },
  {
    code: 'TEACH',
    title: '教师干预有依据',
    desc: '从班级汇总下钻到学生，区分已有记录、证据不足与待采集信息。',
    icon: BarChart4,
    items: ['任务触达、测验作答和实验状态统一口径', '补充干预前先预览对象、步骤与影响'],
  },
  {
    code: 'ASSIST',
    title: 'AI辅助有边界',
    desc: '课程内容检索和代码诊断用于解释与提示，不代替测评判断。',
    icon: Bot,
    items: ['明确未进行模型微调', 'AI不能改动得分、实验完成或教师评价'],
  },
];

const primaryActionClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 px-6 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 hover:shadow-[0_0_32px_rgba(34,211,238,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d]';

const secondaryActionClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.045] px-6 text-sm font-medium text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d]';

export default function WelcomePage() {
  return (
    <div className="edu-shell min-h-[100dvh] overflow-x-hidden bg-[#070a0d]">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] inline-flex min-h-11 -translate-y-20 items-center rounded-md bg-cyan-200 px-4 text-sm font-semibold text-[#001014] shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-50"
      >
        跳到主要内容
      </a>
      <nav className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080c11]/90 backdrop-blur-xl" aria-label="平台入口">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/welcome"
            aria-label="芯智育才平台介绍"
            className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            <div className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
              <Cpu className="h-[18px] w-[18px] text-cyan-100" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-wide text-slate-50 sm:text-base">芯智育才</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">8051 Teaching Lab</span>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="hidden min-h-11 items-center rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:inline-flex"
            >
              公开课程
            </Link>
            <Link href="/login?role=teacher" className={secondaryActionClass.replace('min-h-12', 'min-h-11').replace('px-6', 'px-3 sm:px-4')}>
              登录
            </Link>
            <Link href="/register" className={primaryActionClass.replace('min-h-12', 'min-h-11').replace('px-6', 'px-3 sm:px-4')}>
              学生注册
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[minmax(0,0.86fr)_minmax(520px,1.14fr)] lg:items-center lg:gap-14 lg:pt-20">
          <div className="animate-fade-in motion-reduce:animate-none">
            <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100">
              <CircuitBoard className="h-3.5 w-3.5" aria-hidden="true" />
              8051 Course · Teaching Loop
            </div>
            <h1 className="mt-6 max-w-2xl text-3xl font-semibold leading-[1.16] tracking-tight text-slate-50 sm:text-5xl lg:text-[3.2rem]">
              3.1 寻址方式
              <span className="heading-gradient mt-1 block">微控制器教学闭环样板</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              教师定向布置，学生依次完成图谱、动画、专项测评、薄弱补学、仿真实践和再次测评，教师再依据已保存的过程记录复核与干预。
            </p>
            <div className="mt-5 flex max-w-xl items-start gap-2 rounded-md border border-amber-300/18 bg-amber-300/[0.055] px-3 py-2.5 text-xs leading-5 text-amber-100/90">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>平台演示记录明确标识数据身份；没有真实教学结果时显示“待采集”，不生成教学成效数值。</span>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?role=teacher" className={primaryActionClass}>
                教师端登录 <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/" className={secondaryActionClass}>
                查看公开课程 <BookOpen className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <dl className="mt-7 grid max-w-xl grid-cols-3 overflow-hidden rounded-md border border-white/[0.08] bg-black/20">
              {[
                ['课程章节', '10'],
                ['仿真实验', '13'],
                ['图谱系列', '3'],
              ].map(([label, value], index) => (
                <div key={label} className={index > 0 ? 'border-l border-white/[0.08] px-3 py-3' : 'px-3 py-3'}>
                  <dt className="text-[10px] tracking-[0.08em] text-slate-400">{label}</dt>
                  <dd className="mt-1 font-mono text-lg font-semibold text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-400">评审访问可使用申请材料中预留的教师账号。</p>
          </div>

          <section
            aria-labelledby="sample-loop-title"
            className="relative animate-slide-up overflow-hidden rounded-lg border border-white/[0.1] bg-[#0b1016]/95 shadow-[0_30px_90px_rgba(0,0,0,0.38)] motion-reduce:animate-none"
          >
            <div className="absolute inset-0 circuit-grid opacity-50" aria-hidden="true" />
            <div className="relative border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-200">Sample Lesson · 教学流程样板</div>
                  <h2 id="sample-loop-title" className="mt-1.5 text-xl font-semibold text-slate-50">3.1 寻址方式</h2>
                </div>
                <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.07] px-2.5 py-1 font-mono text-[10px] text-amber-100">
                  非成效数据
                </span>
              </div>
            </div>
            <ol className="relative grid gap-px bg-white/[0.07] sm:grid-cols-2">
              {lessonSteps.map(({ code, title, detail, icon: Icon }) => (
                <li key={code} className="group bg-[#0b1016]/95 p-4 transition-colors hover:bg-cyan-300/[0.045] sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="chip-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                      <Icon className="h-4 w-4 text-cyan-100" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-xs uppercase tracking-[0.12em] text-slate-400">STEP {code}</div>
                      <h3 className="mt-1 text-sm font-semibold text-slate-100">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="relative flex flex-col gap-2 border-t border-white/[0.08] bg-black/15 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>教师复核：任务状态 · 作答变化 · 实验完成 · 数据不足</span>
              <span className="font-mono text-[10px] text-emerald-200">AI = EXPLANATION ONLY</span>
            </div>
          </section>
        </section>

        <section className="border-y border-white/[0.07] bg-black/15">
          <div className="mx-auto grid max-w-7xl gap-px bg-white/[0.07] md:grid-cols-3">
            {capabilityGroups.map(({ code, title, desc, icon: Icon, items }) => (
              <article key={code} className="bg-[#080c11] px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="chip-mark flex h-10 w-10 items-center justify-center rounded-md">
                    <Icon className="h-5 w-5 text-cyan-100" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-slate-400">{code}</span>
                </div>
                <h2 className="mt-5 text-lg font-semibold text-slate-50">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
                <ul className="mt-5 space-y-2.5 text-xs leading-5 text-slate-300">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="edu-panel grid gap-8 rounded-lg p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-200">Role-aware Entrance · 角色入口</div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-50">从当前角色的下一项教学动作开始</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                学生可注册后进入学习空间；教师与管理员使用已分配账号登录，平台根据角色显示学习任务、教学复核或系统管理入口。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={secondaryActionClass}>创建学生账号</Link>
              <Link href="/login?role=teacher" className={primaryActionClass}>教师与管理员登录</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:px-6">
          <p>&copy; 2026 芯智育才 · 微控制器课程智能化教学辅助平台</p>
          <p className="flex items-center gap-3">
            <Link href="/privacy" className="inline-flex min-h-11 items-center rounded px-1 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">隐私政策</Link>
            <span className="h-3 w-px bg-slate-700" aria-hidden="true" />
            <Link href="/terms" className="inline-flex min-h-11 items-center rounded px-1 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">使用条款</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
