import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  FlaskConical,
  GraduationCap,
  Mail,
  Sparkles,
  Target,
  Workflow,
} from 'lucide-react';
import { experiments } from '@/lib/experiment-config';

const experiment = experiments.find((item) => item.id === 'proj04');

const metaItems = [
  { label: '实验类型', value: '综合设计型' },
  { label: '实验课时', value: '4 学时（课内 2 学时集中指导 + 课后 2 学时线上完成）' },
  { label: '所属课程', value: '《微控制器应用技术》（课程代码 0872，48 学时）' },
  { label: '面向专业', value: '机械电子工程（可辐射智能制造工程、机械设计制造及其自动化）' },
];

const stageGroups = [
  { stage: '需求分析', desc: '明确温湿度采集、阈值报警、串口遥测上报的功能需求与验收判据' },
  { stage: '接口设计', desc: '完成 DQ/BEEP/UART 端口分配、软件架构与 JSON 遥测帧格式设计' },
  { stage: '编码实现', desc: '编写串口初始化、定时器中断、单总线读写、阈值报警等 8051 汇编模块' },
  { stage: '系统联调', desc: '仿真运行观测、遥测帧核验、超阈报警验证、AI 诊断与故障修复' },
  { stage: '评审交付', desc: '五项里程碑证据自检、实验报告提交、AI 归因反馈与改进规划' },
];

const aiItems = [
  '实验前：AI 助教依据知识图谱薄弱点推荐预习内容与设计方案要点',
  '实验中：8051 汇编静态诊断引擎即时定位时序/寻址类错误，大模型在课程知识库约束下提供解释性答疑',
  '实验后：AI 依据实验过程数据生成错误归因与改进建议',
];

export default function Proj04IntroPage() {
  if (!experiment) notFound();

  return (
    <div className="min-h-[100dvh] bg-[#080c11] text-slate-200">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-sm font-medium text-slate-300">
            桂林航天工业学院 <span className="text-slate-500">·</span> 机电工程学院
          </div>
          <div className="font-mono text-xs text-slate-500">微控制器应用技术 · 虚拟仿真实验</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="chip-mark inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs text-cyan-200">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          综合设计型虚拟仿真实验 · 未来信息
        </div>

        <h1 className="mt-6 text-3xl font-bold leading-tight text-slate-50 sm:text-4xl">
          智慧农业大棚监控系统设计
        </h1>
        <p className="mt-3 text-lg text-slate-400">
          —— AI 赋能的微控制器综合虚拟仿真实验
        </p>
        <p className="mt-5 max-w-3xl leading-7 text-slate-300">
          本实验以智慧农业大棚温湿度监控系统这一真实物联网信息终端为对象，要求学生在虚拟仿真环境中完成从需求分析、
          接口设计、8051 汇编编程到系统联调与数据上报的完整工程闭环。仿真内核逐指令真实执行学生程序，
          串口输出 JSON 遥测帧，全程 AI 助教伴随引导，实验过程与成绩按国家虚拟仿真实验教学接口规范存证回传。
        </p>

        <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.07] sm:grid-cols-2">
          {metaItems.map((item) => (
            <div key={item.label} className="bg-[#080c11] px-5 py-4">
              <div className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500">{item.label}</div>
              <div className="mt-1.5 text-sm font-medium text-slate-200">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-50">
            <Target className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            实验教学目标
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {experiment.objectives.map((objective) => (
              <li key={objective} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-50">
            <Workflow className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            实验过程（五阶段 · 24 个交互步骤）
          </h2>
          <div className="mt-4 space-y-3">
            {stageGroups.map((group, index) => (
              <div key={group.stage} className="edu-panel flex items-start gap-4 rounded-lg p-4">
                <div className="chip-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-sm text-cyan-100">
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold text-slate-100">{group.stage}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">{group.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-50">
            <Sparkles className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            AI 全程引导
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-300">
            {aiItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            AI 只做解释与提示，不直接修改实验判定结果；AI 调用次数、模型与场景随实验成绩一并存证回传。
          </p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="edu-panel rounded-lg p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <BookOpen className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              学习准备
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
              {experiment.prerequisites.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="edu-panel rounded-lg p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <Cpu className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              使用环境
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
              <li>普通宽带（≥2Mbps），支持同时在线 100 人</li>
              <li>Windows 10+/macOS/Linux，Chrome/Firefox/Edge/Safari 浏览器</li>
              <li>支持平板与手机浏览器，无需安装插件或客户端</li>
            </ul>
          </div>
        </section>

        <section className="edu-panel mt-10 flex flex-col items-start gap-5 rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-cyan-200">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Start Experiment
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">进入虚拟仿真实验</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              通过实验空间（ilab-x）课程页进入可自动登录并回传实验成绩；亦可直接登录平台后从实验列表进入。
            </p>
          </div>
          <Link
            href="/simulation?experiment=proj04"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-6 py-2.5 font-semibold text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            进入实验
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section className="mt-10 rounded-xl border border-white/[0.08] px-5 py-4 text-sm text-slate-400">
          <div className="flex items-center gap-2 font-medium text-slate-300">
            <Mail className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            教学支持
          </div>
          <p className="mt-2 leading-6">
            课程团队于工作日提供在线答疑与技术支持。联系：机电工程学院 微控制器应用技术课程组（2024025@guat.edu.cn）。
          </p>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>主办：桂林航天工业学院 机电工程学院 &nbsp;·&nbsp; &copy; 2026 芯智育才微控制器虚拟仿真实验教学平台</p>
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
