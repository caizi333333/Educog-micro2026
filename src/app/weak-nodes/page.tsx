'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Cpu, Layers, Loader2, RotateCcw, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { knowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';
import { quizQuestions } from '@/lib/quiz-data';

type AssessmentSnapshot = {
  weakKAs?: string[];
  totalScore?: number;
  timestamp?: string;
};

const HIERARCHICAL_ID = /^\d+(\.\d+)*$/;
const POINT_BY_ID: Record<string, KnowledgePoint> = (() => {
  const m: Record<string, KnowledgePoint> = {};
  for (const p of knowledgePoints) m[p.id] = p;
  return m;
})();

const EXP_TITLE_BY_REF: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const p of knowledgePoints) {
    p.resources?.forEach((r) => {
      if (r.type === 'experiment' && r.refId && !m[r.refId]) m[r.refId] = r.title;
    });
  }
  return m;
})();

export default function WeakNodesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AssessmentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (typeof window !== 'undefined') {
      try {
        const key = user ? `assessment-results-${user.id}` : 'assessment-results';
        const raw = localStorage.getItem(key);
        if (raw) setSnapshot(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, [user]);

  const weakNodes = useMemo(() => {
    const ids = (snapshot?.weakKAs || []).filter((ka) => HIERARCHICAL_ID.test(ka));
    return ids
      .map((id) => POINT_BY_ID[id])
      .filter((p): p is KnowledgePoint => Boolean(p));
  }, [snapshot]);

  const otherWeakKAs = useMemo(() => {
    return (snapshot?.weakKAs || []).filter((ka) => !HIERARCHICAL_ID.test(ka));
  }, [snapshot]);

  const goToReview = () => {
    if (!snapshot?.weakKAs?.length) return;
    const encoded = encodeURIComponent(JSON.stringify(snapshot.weakKAs));
    router.push(`/learning-path?weakKAs=${encoded}`);
  };

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber-200">
              Weak Nodes · 我的薄弱节点
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">一站式复习薄弱知识点</h1>
            <p className="mt-1 text-sm text-slate-400">
              基于最近一次测验结果，把薄弱节点的描述、关联实验和自测题目都汇总在这页。
              {snapshot?.timestamp && ` 测验于 ${new Date(snapshot.timestamp).toLocaleString('zh-CN')}。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/quiz"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              <RotateCcw className="h-4 w-4" />
              重新测验
            </Link>
            {snapshot?.weakKAs?.length ? (
              <button
                type="button"
                onClick={goToReview}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200"
              >
                生成学习路径
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        )}

        {!loading && (!snapshot || !snapshot.weakKAs?.length) && (
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
            <Target className="mx-auto h-8 w-8 text-cyan-200" />
            <h2 className="mt-3 text-base font-semibold text-slate-100">还没有测验记录</h2>
            <p className="mt-1 text-sm text-slate-400">
              先去做一次综合测验（或某章测验）。系统会自动识别得分低于 60% 的知识原子，作为薄弱节点出现在这里。
            </p>
            <Link
              href="/quiz"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200"
            >
              开始测验
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && snapshot?.weakKAs?.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">薄弱节点</div>
                <div className="mt-1 font-mono text-2xl text-slate-50">{weakNodes.length}</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">非节点 ka</div>
                <div className="mt-1 font-mono text-2xl text-slate-50">{otherWeakKAs.length}</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">最近总分</div>
                <div className="mt-1 font-mono text-2xl text-slate-50">
                  {snapshot.totalScore !== undefined ? `${Math.round(snapshot.totalScore)}` : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {weakNodes.map((node) => (
                <WeakNodeCard key={node.id} node={node} />
              ))}
            </div>

            {otherWeakKAs.length > 0 && (
              <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <div className="mb-2 text-xs font-semibold text-amber-200">未对齐到知识图谱节点的薄弱项</div>
                <p className="text-xs text-slate-400">
                  下列 ka 还是文本关键词（多为旧题或综合应用），暂时无法直接跳节点。后续题库继续 backfill 后会自动收敛。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherWeakKAs.map((ka) => (
                    <span
                      key={ka}
                      className="rounded-md border border-amber-300/15 bg-black/20 px-2 py-1 font-mono text-[11px] text-amber-100"
                    >
                      {ka}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function WeakNodeCard({ node }: { node: KnowledgePoint }) {
  const parent = node.parentId ? POINT_BY_ID[node.parentId] : null;
  const children = knowledgePoints.filter((p) => p.parentId === node.id);
  const prereqs = (node.prerequisites || [])
    .map((id) => POINT_BY_ID[id])
    .filter((p): p is KnowledgePoint => Boolean(p));
  const applied = (node.appliedIn || []).map((refId) => ({
    refId,
    title: EXP_TITLE_BY_REF[refId] || refId,
  }));
  const matchingQuestions = quizQuestions.filter((q) => q.ka === node.id).slice(0, 3);
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <article className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
      <div className="border-b border-white/[0.08] bg-[#0c1117] p-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-cyan-200">
          <span>NODE · CH{node.chapter}</span>
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">L{node.level}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">#{node.id}</span>
          <Link
            href={`/knowledge-graph?node=${encodeURIComponent(node.id)}`}
            className="ml-auto text-[11px] text-cyan-300 hover:text-cyan-100"
          >
            在知识图谱查看 →
          </Link>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-50">{node.name}</h3>
        {node.description && (
          <p className="mt-2 text-sm leading-6 text-slate-400">{node.description}</p>
        )}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {(parent || prereqs.length > 0) && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <Layers className="h-3 w-3" />
                先修与上下文
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parent && (
                  <Link
                    href={`/knowledge-graph?node=${encodeURIComponent(parent.id)}`}
                    className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    上级 / {parent.name}
                  </Link>
                )}
                {prereqs.map((p) => (
                  <Link
                    key={p.id}
                    href={`/knowledge-graph?node=${encodeURIComponent(p.id)}`}
                    className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    前置 / #{p.id} {p.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {applied.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <Cpu className="h-3 w-3" />
                配套实验
              </div>
              <div className="flex flex-wrap gap-1.5">
                {applied.map((exp) => (
                  <Link
                    key={exp.refId}
                    href={`/simulation?experiment=${encodeURIComponent(exp.refId)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] px-2 py-1 text-[11px] text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-300/[0.08]"
                  >
                    <span className="font-mono text-[10px] text-emerald-300">{exp.refId}</span>
                    <span>{exp.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <BookOpen className="h-3 w-3" />
                下级展开 · {children.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {children.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/knowledge-graph?node=${encodeURIComponent(c.id)}`}
                    className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200">本节自测 · {matchingQuestions.length}</div>
            {matchingQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAnswers((v) => !v)}
                className="text-[10px] text-cyan-300 hover:text-cyan-100"
              >
                {showAnswers ? '隐藏答案' : '查看答案'}
              </button>
            )}
          </div>
          {matchingQuestions.length === 0 ? (
            <p className="text-[11px] text-slate-500">该节点暂无配套题目。</p>
          ) : (
            <ul className="space-y-2">
              {matchingQuestions.map((q, i) => (
                <li key={q.id} className="rounded-sm border border-white/[0.06] bg-black/30 p-2">
                  <div className="text-[11px] leading-5 text-slate-200">
                    Q{i + 1}. {q.questionText}
                  </div>
                  {showAnswers && (
                    <div className="mt-1 rounded-sm border border-emerald-300/15 bg-emerald-300/[0.06] px-1.5 py-1 text-[10px] text-emerald-100">
                      正确答案：{q.correctAnswer}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/quiz?chapter=${node.chapter}`}
            className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/[0.10] text-[11px] text-cyan-100 hover:bg-cyan-300/[0.18]"
          >
            做本章 quiz
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
