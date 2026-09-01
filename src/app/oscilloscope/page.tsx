import Link from 'next/link';
import { ArrowLeft, ArrowRight, FlaskConical, XCircle } from 'lucide-react';

export default function FeatureRemovedPage(): React.JSX.Element {
  return (
    <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-x-hidden bg-[#070a0d] px-4 py-10 text-slate-100 sm:-m-6">
      <section className="w-full max-w-xl overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]" aria-labelledby="removed-feature-title">
        <div className="border-b border-white/[0.08] p-6 text-center md:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/[0.08]">
            <XCircle className="h-7 w-7 text-amber-200" aria-hidden="true" />
          </span>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Route retired · /oscilloscope</div>
          <h1 id="removed-feature-title" className="mt-2 text-2xl font-semibold text-slate-50">示波器独立页面已移除</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
            当前课程不再使用这一独立入口。实验操作、代码运行和外设观察已统一放在仿真实验工作台中。
          </p>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 md:p-8">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回课程内容
          </Link>
          <Link
            href="/simulation"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            进入实验仿真
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
