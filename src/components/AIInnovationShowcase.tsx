'use client';

import AIAssistant from '@/components/AIAssistant';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * 旧“创新展示”组件曾包含未绑定运行记录的准确率、提升率与竞品对比。
 * 保留该导出仅为兼容历史引用；若未来重新接入页面，只展示当前可复核的
 * AI 能力、固定基准与判定边界，避免旧宣传数据重新进入评委视野。
 */
export default function AIInnovationShowcase(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section
        aria-labelledby="legacy-ai-showcase-title"
        className="flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-amber-50 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <h1 id="legacy-ai-showcase-title" className="text-sm font-semibold">AI 能力以固定运行记录为准</h1>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">
              当前实现包括课程内容检索、DeepSeek 可选解释、本地回退和 8051 静态诊断；未进行模型微调。
              生成式基准未运行时明确显示“未运行”，不以推测值或行业对比代替实测。
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-9 shrink-0 items-center gap-2 self-start rounded-md border border-emerald-300/20 bg-emerald-300/[0.07] px-3 text-xs text-emerald-100">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          AI 不参与成绩判定
        </span>
      </section>

      <AIAssistant />
    </div>
  );
}
