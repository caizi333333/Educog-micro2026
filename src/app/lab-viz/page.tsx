import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const metadata = {
  title: '可视化演示 · 芯智育才',
  description: '流水灯 / 计数器 / 指令系统 / 定时器 实验可视化（基于本地 51 MCU lab 项目）',
};

export default function LabVizPage() {
  return (
    <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#070a0d] text-slate-100">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/simulation"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回仿真
          </Link>
          <div className="text-sm font-semibold text-slate-100">实验可视化演示</div>
          <span className="hidden rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-0.5 font-mono text-[10px] text-emerald-200 md:inline-flex">
            本地 51 MCU lab
          </span>
        </div>
        <a
          href="/resources/lab-viz/index.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          新标签打开
        </a>
      </div>
      <iframe
        src="/resources/lab-viz/index.html"
        title="实验可视化演示"
        className="min-h-0 w-full flex-1 bg-white"
      />
    </div>
  );
}
