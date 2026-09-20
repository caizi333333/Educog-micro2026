'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bug, Brain, BookOpen, Database, Gauge, ShieldCheck, Wrench, Loader2, Save } from 'lucide-react';
import ErrorDiagnostic from '@/components/ai-assistant/ErrorDiagnostic';
import IntelligentQA from '@/components/ai-assistant/IntelligentQA';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { cn } from '@/lib/utils';
import { knowledgePoints } from '@/lib/knowledge-points';
import benchmarkReport from '../../public/ai-benchmark.json';

const benchmarkDate = new Date(benchmarkReport.generatedAt).toLocaleDateString('zh-CN', {
  timeZone: 'Asia/Shanghai',
});
const generativeReport = benchmarkReport.generative as {
  status: string;
  sampleSize?: number;
  automaticRequiredFactPassRate?: number;
  groundedCitationRate?: number;
  forbiddenClaimRate?: number;
  latencyMs?: { p95?: number | null };
  reason?: string;
};
const generativeCompleted = generativeReport.status === 'COMPLETED';
const generativeNotRun = generativeReport.status === 'NOT_RUN';
const benchmarkSourceDigest = benchmarkReport.codeVersion.sourceManifest.digest.slice(0, 12);

type PrepKind = 'case' | 'exercise' | 'review';
type PrepSource = {
  refId: string;
  pointId: string;
  pointName: string;
  title: string;
  href: string;
  pdfPage?: number;
  available?: boolean;
  textIncluded?: boolean;
  excerpt?: string;
  readingNotes?: { text: string; title: string; url: string }[];
};
type PrepSnapshot = {
  ownerId: string;
  id: string;
  snapshot: string;
  savedAt: string;
  title: string;
  content: string;
  kind: PrepKind;
  pointId: string;
  slideRefId?: string | null;
  instruction: string;
  submission?: string;
  mode: 'generated' | 'manual';
  sources: PrepSource[];
  generationId?: string | null;
};
type PrepEditor = {
  kind: PrepKind;
  materialMode: 'knowledge' | 'slide';
  pointId: string;
  slideRefId: string;
  instruction: string;
  submission: string;
  anonymousConfirmed: boolean;
  title: string;
  content: string;
  generationId: string | null;
  origin: 'generated' | 'manual';
  sources: PrepSource[];
  savedReceipt: { snapshot: string; savedAt: string } | null;
  saveRequestId: string | null;
};
const PREP_ENDPOINT = '/api/ai/chat';
const PREP_REQUEST_TIMEOUT_MS = 35_000;
const PREP_LIMITS = { instruction: 2000, submission: 6000, title: 160, content: 12000 };
const prepKindLabels: Record<PrepKind, string> = { case: '案例设计', exercise: '练习题设计', review: '作业评阅建议' };
const prepUnits = knowledgePoints.filter((point) => point.level === 1);
const prepFieldClass = 'min-h-11 w-full min-w-0 rounded-md border border-white/[0.12] bg-[#0c1117] px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:opacity-60';
const prepButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-50';

function createPrepEditor(): PrepEditor {
  return { kind: 'case', materialMode: 'slide', pointId: '7.2.3', slideRefId: '', instruction: '', submission: '', anonymousConfirmed: false, title: '', content: '', generationId: null, origin: 'manual', sources: [], savedReceipt: null, saveRequestId: null };
}

function isPrepRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrepKind(value: unknown): value is PrepKind {
  return value === 'case' || value === 'exercise' || value === 'review';
}

function isPrepSource(value: unknown): value is PrepSource {
  return isPrepRecord(value)
    && ['refId', 'pointId', 'pointName', 'title', 'href'].every((field) => typeof value[field] === 'string')
    && Number.isInteger(value.pdfPage) && Number(value.pdfPage) > 0
    && value.href === `/resources/course/course-slides.pdf#page=${value.pdfPage}`
    && typeof value.available === 'boolean'
    && (value.textIncluded === undefined || typeof value.textIncluded === 'boolean')
    && (value.excerpt === undefined || typeof value.excerpt === 'string')
    && (value.readingNotes === undefined || (Array.isArray(value.readingNotes) && value.readingNotes.every((note) => (
      isPrepRecord(note) && typeof note.text === 'string' && typeof note.title === 'string'
      && typeof note.url === 'string' && (/^https:\/\/[^\s]+$/.test(note.url)
        || /^\/resources\/course\/course-slides\.pdf#page=\d+$/.test(note.url))
    ))));
}

function isPrepSnapshot(value: unknown): value is PrepSnapshot {
  return isPrepRecord(value)
    && ['ownerId', 'id', 'snapshot', 'savedAt', 'title', 'content', 'pointId', 'instruction'].every((field) => typeof value[field] === 'string')
    && String(value.id).length > 0 && String(value.snapshot).length > 0
    && Number.isFinite(Date.parse(String(value.savedAt)))
    && isPrepKind(value.kind) && (value.mode === 'generated' || value.mode === 'manual')
    && Array.isArray(value.sources) && value.sources.every(isPrepSource);
}

function waitForPrepResponse<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = (): void => reject(new DOMException('备课请求已停止', 'AbortError'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  return Promise.race([operation, cancelled]).finally(() => signal.removeEventListener('abort', abort));
}

function coursePrepTemplate(editor: PrepEditor, source: PrepSource): { title: string; content: string } {
  const activities: Record<PrepKind, string[]> = {
    case: [
      '课堂案例框架（由教师补充）',
      `1. 教学目标：请结合学生基础，写明学习“${source.pointName}”后需要解释或完成的任务。`,
      '2. 情境与已知条件：从课件中选取一个例子，列明器件、输入和适用条件；原页未给出的参数先列为待补充。',
      '3. 学生任务：说明概念或代码的作用，标出判断依据，并提出需要通过实验核对的问题。',
      '4. 验证安排：教师填写可用的代码或实验入口、预期观察和操作步骤。',
      '5. 讨论与修订：记录学生的解释及其依据，核对课件阅读提示中的限制，再完善案例。',
    ],
    exercise: [
      '练习设计框架（由教师补充题目和参考要点）',
      `1. 概念理解：请用自己的话解释“${source.pointName}”，指出所依据的课件表述。`,
      '2. 条件核对：选取课件中的一个示例，列出已知条件、适用范围和需要补充的参数。',
      '3. 应用验证：教师选定一段已有代码或一个实验，学生说明输入、预期观察及核对方法。',
      '参考要点：由教师依据完整课件和阅读提示填写；本模板未自动生成标准答案或判分规则。',
    ],
    review: [
      '作业评阅记录框架（由教师逐项填写）',
      '1. 作答观察：摘出需要讨论的匿名作答或代码，并记录其原意。',
      '2. 对照依据：引用下方课件与阅读提示，分别核对概念、条件和操作步骤。',
      '3. 待核实事项：区分已经发现的问题与仅凭现有片段无法判断的内容。',
      '4. 修改建议：教师写明建议补充的条件、修改位置和验证步骤。',
      '5. 后续核对：记录修改后的解释或运行观察；本模板未评价该作业，也不提供成绩、等级或通过结论。',
    ],
  };
  const notes = source.readingNotes?.flatMap((note) => [note.text, `${note.title}：${note.url}`]) ?? [];
  return {
    title: `${source.pointName} · ${prepKindLabels[editor.kind]}（课程模板）`.slice(0, PREP_LIMITS.title),
    content: [
      '课程备课模板（非生成内容）',
      '以下为固定教学框架与已返回的课程摘录，未调用生成服务。请对照完整原页并由教师补充、修改后使用。',
      ...activities[editor.kind],
      `教学要求：${editor.instruction.trim() || '［请教师填写学生基础、目标和课堂安排］'}`,
      `课程依据：${source.title} · 合并 PDF 第 ${source.pdfPage} 页`,
      source.href,
      `课件摘录（不代替完整原页）：\n${source.excerpt?.trim() ?? ''}`,
      ...(notes.length ? [`课件阅读提示（请与原页一并核对）：\n${notes.join('\n')}`] : []),
    ].join('\n\n'),
  };
}

function TeacherPreparationPanel({ editor, setEditor, ownerId }: {
  editor: PrepEditor;
  setEditor: React.Dispatch<React.SetStateAction<PrepEditor>>;
  ownerId: string;
}): React.JSX.Element {
  const { refreshUser } = useAuth();
  const [sources, setSources] = useState<PrepSource[]>([]);
  const [drafts, setDrafts] = useState<PrepSnapshot[]>([]);
  const [capability, setCapability] = useState<{ generationAvailable: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const mountedRef = useRef(true);
  const actionRef = useRef<AbortController | null>(null);
  const point = knowledgePoints.find((item) => item.id === editor.pointId);
  const unit = point?.chapter ?? 7;
  const selectedSource = sources.find((source) => source.refId === editor.slideRefId)
    ?? sources.find((source) => source.pointId === editor.pointId && source.available !== false);
  const canUseGeneration = capability?.generationAvailable === true && selectedSource?.available !== false && !!selectedSource;
  const sourcePreview = editor.sources.length > 0 ? editor.sources : selectedSource ? [selectedSource] : [];
  const localTemplate = selectedSource?.available === true && selectedSource.excerpt?.trim()
    ? coursePrepTemplate(editor, selectedSource) : null;

  const handleAccountChanged = useCallback((): void => {
    setEditor(createPrepEditor());
    setDrafts([]);
    setSources([]);
    setCapability(null);
    setNotice('');
    setTemplateOpen(false);
    setError('登录账号已变化，当前编辑区已清空。正在重新确认账号，请确认后再继续备课。');
    void refreshUser?.();
  }, [refreshUser, setEditor]);

  const updateEditor = (patch: Partial<PrepEditor>, changesSource = false): void => {
    setEditor((current) => ({
      ...current, ...patch, savedReceipt: null, saveRequestId: null,
      ...(changesSource ? { generationId: null, origin: 'manual' as const, sources: [] } : {}),
    }));
    setNotice('');
    setError('');
    if (changesSource) setTemplateOpen(false);
  };

  const applyTemplate = (): void => {
    if (actionRef.current || loading || !localTemplate || !selectedSource) return;
    const append = editor.content.trim().length > 0;
    const content = append ? `${editor.content}\n\n${localTemplate.content}` : localTemplate.content;
    if (content.length > PREP_LIMITS.content) {
      setError(`加入模板后将超过 ${PREP_LIMITS.content} 字，请先精简正文；当前草稿保持不变。`);
      return;
    }
    setEditor((current) => ({
      ...current, title: current.title.trim() ? current.title : localTemplate.title, content,
      // Appending is a teacher edit of the existing draft; adopting a template
      // into an empty draft must not retain an earlier generation receipt.
      ...(!append ? { generationId: null, origin: 'manual' as const, sources: [{ ...selectedSource, textIncluded: false }] } : {}),
      savedReceipt: null, saveRequestId: null,
    }));
    setTemplateOpen(false);
    setError('');
    setNotice(append ? '已追加课程模板，原草稿内容保留；本次未调用生成服务，请编辑后保存。' : '已采用课程模板，本次未调用生成服务；请补充教学安排后保存。');
  };

  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
      actionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), PREP_REQUEST_TIMEOUT_MS);
    setLoading(true);
    setError('');
    const load = async (): Promise<void> => {
      try {
        const token = getStoredAccessToken();
        if (!token) throw new Error('登录已过期，请重新登录后读取备课资料。');
        const response = await waitForPrepResponse(fetch(`${PREP_ENDPOINT}?mode=teacher-prep`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }), controller.signal);
        const result: unknown = await waitForPrepResponse(response.json(), controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;
        if (!response.ok) throw new Error(isPrepRecord(result) && typeof result.error === 'string' ? result.error : '备课资料读取失败，请重试。');
        const data = isPrepRecord(result) && result.success === true && isPrepRecord(result.data) ? result.data : null;
        if (data && typeof data.ownerId === 'string' && data.ownerId !== ownerId) {
          handleAccountChanged();
          return;
        }
        if (data?.ownerId !== ownerId || !isPrepRecord(data.capability) || typeof data.capability.generationAvailable !== 'boolean'
          || typeof data.capability.message !== 'string' || !Array.isArray(data.sources) || !data.sources.every(isPrepSource)
          || !Array.isArray(data.drafts) || !data.drafts.every((draft) => isPrepSnapshot(draft) && draft.ownerId === ownerId)) {
          throw new Error('备课资料返回不完整，请重新读取。');
        }
        const loadedSources = data.sources as PrepSource[];
        setSources(loadedSources);
        setDrafts(data.drafts as PrepSnapshot[]);
        setCapability({ generationAvailable: data.capability.generationAvailable, message: data.capability.message });
        setEditor((current) => {
          if (current.materialMode !== 'slide' || current.slideRefId || current.content) return current;
          const initialSource = loadedSources.find((source) => source.pointId === current.pointId && source.available !== false)
            ?? loadedSources.find((source) => source.available !== false) ?? loadedSources[0];
          return initialSource ? { ...current, pointId: initialSource.pointId, slideRefId: initialSource.refId } : current;
        });
      } catch (loadError) {
        if (!mountedRef.current || (controller.signal.aborted && controller.signal.reason !== 'timeout')) return;
        setError(controller.signal.reason === 'timeout' ? '备课资料读取超时，请重试。' : loadError instanceof Error ? loadError.message : '备课资料读取失败。');
      } finally {
        clearTimeout(timeout);
        if (mountedRef.current && (!controller.signal.aborted || controller.signal.reason === 'timeout')) setLoading(false);
      }
    };
    void load();
    return (): void => { clearTimeout(timeout); controller.abort(); };
  }, [reload, setEditor, ownerId, handleAccountChanged]);

  const runAction = async (action: 'generate' | 'save'): Promise<void> => {
    if (actionRef.current || loading) return;
    if (editor.kind === 'review' && (!editor.submission.trim() || !editor.anonymousConfirmed)) {
      setError('请填写已移除姓名、学号等个人信息的作业内容，并确认匿名处理。');
      return;
    }
    if (action === 'generate' && (!canUseGeneration || !editor.instruction.trim())) {
      setError('请选择可用的课件主题并填写教学要求；也可直接编写草稿。');
      return;
    }
    if (action === 'save' && (!editor.title.trim() || !editor.content.trim())) {
      setError('请填写草稿标题和正文后保存。');
      return;
    }
    const token = getStoredAccessToken();
    if (!token) { setError('登录已过期，请重新登录后继续。'); return; }
    const requestId = action === 'save' && editor.saveRequestId ? editor.saveRequestId : crypto.randomUUID();
    if (action === 'save') setEditor((current) => ({ ...current, saveRequestId: requestId, savedReceipt: null }));
    const controller = new AbortController();
    actionRef.current = controller;
    setBusy(action);
    setError('');
    setNotice('');
    const timeout = setTimeout(() => controller.abort('timeout'), PREP_REQUEST_TIMEOUT_MS);
    try {
      const response = await waitForPrepResponse(fetch(PREP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
        body: JSON.stringify({
          mode: 'teacher-prep', action, requestId, expectedUserId: ownerId, kind: editor.kind, pointId: editor.pointId,
          ...(editor.slideRefId ? { slideRefId: editor.slideRefId } : {}),
          instruction: editor.instruction.trim(),
          ...(editor.kind === 'review' ? { submission: editor.submission.trim() } : {}),
          ...(action === 'save' ? { title: editor.title.trim(), content: editor.content.trim(), ...(editor.generationId ? { generationId: editor.generationId } : {}) } : {}),
        }),
      }), controller.signal);
      const result: unknown = await waitForPrepResponse(response.json(), controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;
      if (!response.ok) {
        if (isPrepRecord(result) && result.code === 'ACCOUNT_CHANGED') {
          handleAccountChanged();
          return;
        }
        throw new Error(isPrepRecord(result) && typeof result.error === 'string' ? result.error : '本次操作未完成，请重试。');
      }
      const data = isPrepRecord(result) && result.success === true && isPrepRecord(result.data) ? result.data : null;
      if (data && typeof data.ownerId === 'string' && data.ownerId !== ownerId) {
        handleAccountChanged();
        return;
      }
      if (action === 'generate') {
        if (data?.ownerId !== ownerId) throw new Error('未收到当前账号的生成回执，原草稿已保留。');
        if (data?.mode === 'unavailable') {
          setNotice(typeof data.message === 'string' ? data.message : '生成服务暂不可用，当前未生成内容。可手动编写并保存草稿。');
          return;
        }
        if (data?.mode !== 'generated' || typeof data.generationId !== 'string' || !data.generationId
          || typeof data.title !== 'string' || typeof data.content !== 'string' || !data.content.trim()
          || !Array.isArray(data.sources) || !data.sources.every(isPrepSource)) {
          throw new Error('未收到完整的生成结果，原草稿已保留。');
        }
        setEditor((current) => ({ ...current, title: data.title as string, content: data.content as string, generationId: data.generationId as string, origin: 'generated', sources: data.sources as PrepSource[], savedReceipt: null, saveRequestId: null }));
        setNotice('已生成可编辑草稿，请核对内容后保存。');
      } else {
        if (!isPrepSnapshot(data)) throw new Error('未收到明确的保存回执，草稿仍保留在编辑区；请重试确认。');
        setEditor((current) => ({ ...current, savedReceipt: { snapshot: data.snapshot, savedAt: data.savedAt }, origin: data.mode, sources: data.sources }));
        setDrafts((current) => [data, ...current.filter((draft) => draft.id !== data.id)]);
      }
    } catch (actionError) {
      if (!mountedRef.current || (controller.signal.aborted && controller.signal.reason !== 'timeout')) return;
      setError(controller.signal.reason === 'timeout'
        ? action === 'save' ? '保存结果尚未确认，编辑内容已保留。请重试保存以确认结果。' : '生成等待超时，原草稿已保留。可稍后重试。'
        : actionError instanceof Error ? actionError.message : '本次操作未完成，编辑内容已保留。');
    } finally {
      clearTimeout(timeout);
      if (actionRef.current === controller) {
        actionRef.current = null;
        if (mountedRef.current) setBusy(null);
      }
    }
  };

  return (
    <section aria-labelledby="teacher-prep-title" className="mt-5 space-y-5 rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 sm:p-6">
      <div>
        <h2 id="teacher-prep-title" className="text-xl font-semibold text-slate-100">教师备课</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">选择课程主题，起草案例、练习或评阅建议；核对后保存为本人草稿。草稿不会自动发布给学生或写入成绩。</p>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />正在读取备课资料与本人草稿…</p>}
      {error && <p role="alert" className="rounded-md border border-amber-300/25 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">{error}</p>}
      {!loading && !capability && <button type="button" className={prepButtonClass} onClick={() => setReload((value) => value + 1)}>重新读取备课资料</button>}
      {capability && <p className="rounded-md border border-white/[0.08] bg-black/15 p-3 text-sm leading-6 text-slate-300">{capability.message}{!capability.generationAvailable && ' 可查看课程资料并手动编写草稿。'}</p>}

      <fieldset disabled={loading || !!busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="sr-only">备课主题与教学要求</legend>
        <label className="space-y-2 text-sm text-slate-300"><span>备课任务</span>
          <select className={prepFieldClass} value={editor.kind} onChange={(event) => updateEditor({ kind: event.target.value as PrepKind }, true)}>
            {Object.entries(prepKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-300"><span>选择依据</span>
          <select className={prepFieldClass} value={editor.materialMode} onChange={(event) => {
            const materialMode = event.target.value as PrepEditor['materialMode'];
            const first = sources.find((source) => source.available !== false) ?? sources[0];
            updateEditor({ materialMode, slideRefId: materialMode === 'slide' ? first?.refId ?? '' : '', ...(materialMode === 'slide' && first ? { pointId: first.pointId } : {}) }, true);
          }}><option value="knowledge">课程知识点</option><option value="slide">授课课件主题</option></select>
        </label>
        {editor.materialMode === 'slide' ? (
          <label className="space-y-2 text-sm text-slate-300 sm:col-span-2"><span>课件主题</span>
            <select className={prepFieldClass} value={editor.slideRefId} onChange={(event) => {
              const source = sources.find((item) => item.refId === event.target.value);
              if (source) updateEditor({ slideRefId: source.refId, pointId: source.pointId }, true);
            }}><option value="">请选择课件主题</option>{sources.map((source) => <option key={source.refId} value={source.refId}>{source.title}{source.available === false ? '（暂不可用于生成）' : ''}</option>)}</select>
          </label>
        ) : (<>
          <label className="space-y-2 text-sm text-slate-300"><span>平台单元</span>
            <select className={prepFieldClass} value={unit} onChange={(event) => updateEditor({ pointId: event.target.value, slideRefId: '' }, true)}>{prepUnits.map((item) => <option key={item.id} value={item.chapter}>{item.chapter} · {item.name}</option>)}</select>
          </label>
          <label className="space-y-2 text-sm text-slate-300"><span>课程知识点</span>
            <select className={prepFieldClass} value={editor.pointId} onChange={(event) => updateEditor({ pointId: event.target.value, slideRefId: '' }, true)}>{knowledgePoints.filter((item) => item.chapter === unit).map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select>
          </label>
        </>)}
        <label className="space-y-2 text-sm text-slate-300 sm:col-span-2"><span>教学要求</span>
          <textarea className={prepFieldClass} rows={3} maxLength={PREP_LIMITS.instruction} value={editor.instruction} onChange={(event) => updateEditor({ instruction: event.target.value }, true)} placeholder="说明学生基础、教学目标、课堂情境或希望重点检查的问题。" />
        </label>
        {editor.kind === 'review' && <div className="space-y-3 sm:col-span-2">
          <label className="block space-y-2 text-sm text-slate-300"><span>作业内容（请先删除姓名、学号等个人信息）</span>
            <textarea className={prepFieldClass} rows={6} maxLength={PREP_LIMITS.submission} value={editor.submission} onChange={(event) => updateEditor({ submission: event.target.value, anonymousConfirmed: false }, true)} placeholder="粘贴需要讨论的作答或代码片段。评阅建议不作为正式成绩。" />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={editor.anonymousConfirmed} onChange={(event) => updateEditor({ anonymousConfirmed: event.target.checked })} className="h-4 w-4 accent-cyan-300" />已移除姓名、学号等个人信息</label>
        </div>}
      </fieldset>

      <div className="space-y-3 rounded-md border border-white/[0.08] bg-black/15 p-4">
        <h3 className="text-sm font-semibold text-slate-100">本次参考资料</h3>
        {point && <p className="text-sm leading-6 text-slate-300"><a href={`/knowledge-graph?chapter=${point.chapter}&node=${encodeURIComponent(point.id)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded text-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-200/60">平台单元 {point.chapter} · {point.id} {point.name}</a><br />{point.description}</p>}
        {sourcePreview.map((source) => <div key={source.refId} className="text-xs leading-6 text-slate-400">
          <a href={source.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded text-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-200/60">{source.title} · 新标签查看</a>
          <p>{source.textIncluded ? '生成时已提供该来源的文字内容。' : '关联课件，供您对照；是否用于本次生成以生成结果的来源说明为准。'}</p>
          {source.readingNotes && source.readingNotes.length > 0 && <div className="mt-2 rounded-md border border-amber-200/20 bg-amber-200/[0.04] p-3 text-amber-50/90"><p className="font-medium">课件阅读提示</p>{source.readingNotes.map((note, index) => <div key={index} className="mt-1 whitespace-pre-wrap break-words"><p>{note.text}</p><a href={note.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">{note.title}</a></div>)}</div>}
          {source.excerpt && <details><summary className="min-h-11 cursor-pointer py-2 text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-200/60">查看课件文字摘录</summary><p className="whitespace-pre-wrap break-words border-l border-cyan-300/25 pl-3">{source.excerpt}</p></details>}
        </div>)}
        {!loading && capability && (!selectedSource || selectedSource.available === false) && <p className="text-xs leading-5 text-amber-100">此知识点暂无可用于生成的课件正文。可手写草稿，或改选已接入的课件主题。</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setTemplateOpen((value) => !value)} disabled={loading || !!busy || !localTemplate} aria-expanded={templateOpen} aria-controls={templateOpen ? 'course-prep-template' : undefined} className={prepButtonClass}>预览课程模板（不调用生成）</button>
        <button type="button" onClick={() => void runAction('generate')} disabled={loading || !!busy || !canUseGeneration || !editor.instruction.trim() || (editor.kind === 'review' && (!editor.submission.trim() || !editor.anonymousConfirmed))} className={prepButtonClass}>{busy === 'generate' && <Loader2 className="h-4 w-4 animate-spin" />}生成备课草稿</button>
        {busy === 'generate' && <button type="button" className={prepButtonClass} onClick={() => { actionRef.current?.abort(); actionRef.current = null; setBusy(null); setNotice('已取消本次生成，原草稿已保留。'); }}>取消生成</button>}
        {notice && <p role="status" className="text-sm leading-6 text-slate-300">{notice}</p>}
      </div>
      {!loading && capability && !localTemplate && <p className="text-xs leading-5 text-slate-400">课程模板需要已读取的课件摘录；可改选有正文的课件主题，或直接手写草稿。</p>}
      {templateOpen && localTemplate && (
        <section id="course-prep-template" aria-labelledby="course-prep-template-title" className="min-w-0 space-y-3 rounded-md border border-cyan-300/20 bg-cyan-300/[0.035] p-4">
          <h3 id="course-prep-template-title" className="font-semibold text-cyan-100">课程模板预览 · 非生成内容</h3>
          <p className="text-sm leading-6 text-slate-400">预览尚未修改草稿。采用后仍需教师补充，保存前可继续编辑。</p>
          <p className="break-words text-sm font-medium text-slate-100">{localTemplate.title}</p>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-300">{localTemplate.content}</pre>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={loading || !!busy} className={prepButtonClass} onClick={applyTemplate}>{editor.content.trim() ? '追加到当前草稿' : '采用此模板'}</button>
            <button type="button" className={prepButtonClass} onClick={() => setTemplateOpen(false)}>关闭预览</button>
          </div>
        </section>
      )}

      <fieldset disabled={!!busy} className="space-y-4 border-t border-white/[0.08] pt-5">
        <legend className="sr-only">编辑备课草稿</legend>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-100">草稿编辑</h3><span className="text-xs text-slate-400">{editor.origin === 'generated' ? '模型辅助起草，可由教师修订' : '手动编写草稿'}</span></div>
        <label className="block space-y-2 text-sm text-slate-300"><span>草稿标题</span><input className={prepFieldClass} maxLength={PREP_LIMITS.title} value={editor.title} onChange={(event) => updateEditor({ title: event.target.value })} /></label>
        <label className="block space-y-2 text-sm text-slate-300"><span>草稿正文</span><textarea className={cn(prepFieldClass, 'leading-7')} rows={14} maxLength={PREP_LIMITS.content} value={editor.content} onChange={(event) => updateEditor({ content: event.target.value })} placeholder="可编辑生成内容，也可直接手写教学草稿。" /></label>
        <p className="text-xs leading-5 text-slate-400">请核对技术参数、问题与参考答案。每次修改后保存都会形成新的草稿快照，既有草稿保留。</p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={loading || !!busy || !capability || !editor.title.trim() || !editor.content.trim()} onClick={() => void runAction('save')} className={prepButtonClass}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存草稿</button>
        {editor.savedReceipt ? <p role="status" className="text-sm text-emerald-200">已保存草稿 · {editor.savedReceipt.snapshot} · {new Date(editor.savedReceipt.savedAt).toLocaleString('zh-CN')}</p> : (editor.content || editor.title) && <p className="text-xs text-amber-100">当前修改尚未保存</p>}
      </div>
      <div className="space-y-3 border-t border-white/[0.08] pt-5">
        <h3 className="font-semibold text-slate-100">本人保存的草稿</h3>
        {!loading && capability && drafts.length === 0 && <p className="text-sm text-slate-400">尚未保存备课草稿。</p>}
        {drafts.map((draft) => <button key={draft.id} type="button" disabled={!!busy} onClick={() => {
          setEditor({ kind: draft.kind, materialMode: draft.slideRefId ? 'slide' : 'knowledge', pointId: draft.pointId, slideRefId: draft.slideRefId ?? '', instruction: draft.instruction, submission: draft.submission ?? '', anonymousConfirmed: false, title: draft.title, content: draft.content, generationId: draft.generationId ?? null, origin: draft.mode, sources: draft.sources, savedReceipt: { snapshot: draft.snapshot, savedAt: draft.savedAt }, saveRequestId: null });
          setError(''); setNotice('已打开已保存的草稿。修改后可另存为新快照。');
        }} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-black/15 px-3 py-3 text-left text-sm text-slate-200 hover:border-cyan-300/25 focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:opacity-50"><span>{draft.title}</span><span className="text-xs text-slate-400">{prepKindLabels[draft.kind]} · {draft.snapshot} · {new Date(draft.savedAt).toLocaleDateString('zh-CN')}</span></button>)}
      </div>
    </section>
  );
}

// 学生功能保持独立；教师草稿在切换标签时保留，账号变更由页面 key 重置。
const AIAssistant: React.FC = memo(() => {
  const { user } = useAuth();
  const canPrepare = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState('qa');
  const [prepEditor, setPrepEditor] = useState<PrepEditor>(createPrepEditor);

  // 缓存标签页配置
  const tabsConfig = useMemo(() => [
    { value: 'qa', icon: Brain, label: '智能问答' },
    { value: 'debug', icon: Bug, label: '错误诊断' },
    ...(canPrepare ? [{ value: 'teacher-prep', icon: BookOpen, label: '教师备课' }] : []),
  ], [canPrepare]);

  // 缓存标签页切换处理函数
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-0 sm:p-6">
      {/* 标题区域 */}
      <div className="order-1 space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Brain className="w-8 h-8 text-cyan-300" />
          <h1 className="text-3xl font-bold text-slate-50">
            AI智能助手
          </h1>
        </div>
        <p className="text-lg text-slate-400 max-w-3xl mx-auto">
          {canPrepare
            ? '基于课程资料辅助答疑、汇编错误诊断与教师备课，生成内容由教师核对后使用'
            : '基于课程知识库的AI辅助答疑与汇编错误诊断，帮助你理解问题，不代替你完成作答'}
        </p>
      </div>

      <details className="group order-3 overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c1117]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 sm:px-5">
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Gauge className="h-4 w-4 text-cyan-200" aria-hidden="true" />
              能力边界与固定基准
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">非作答区域 · 需要时展开查看口径和运行记录</span>
          </span>
          <span className="shrink-0 rounded-md border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 group-open:hidden">展开</span>
          <span className="hidden shrink-0 rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1 text-[11px] text-cyan-100 group-open:inline-flex">收起</span>
        </summary>
        <section className="border-t border-white/[0.08]" aria-labelledby="ai-capability-title">
        <div className="flex flex-col gap-2 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="ai-capability-title" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Gauge className="h-4 w-4 text-cyan-200" />
              能力构成与判定边界
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">当前系统未进行模型微调；生成式回答与规则诊断分别记录、分别评测。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2.5 py-1 text-[11px] font-medium text-cyan-100">
              本地固定基准运行记录 · 非线上当前版本
            </span>
            <span className="inline-flex w-fit rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-1 text-[11px] text-amber-100">
              {generativeCompleted
                ? '生成式质量：固定题集已实测'
                : generativeNotRun
                  ? '生成式质量：未运行（NOT_RUN）'
                  : `生成式质量：${generativeReport.status}`}
            </span>
            <a
              href="/ai-benchmark.json"
              download
              className="inline-flex min-h-11 items-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-3 text-xs text-cyan-100 transition hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              下载固定运行记录 JSON
            </a>
          </div>
        </div>
        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Database, title: '课程内容检索', text: '对正式知识点和实验资源做关键词召回，回答附节点编号。' },
            { icon: Brain, title: '智谱 GLM 解释', text: '仅在密钥可用时生成解释；失败后进入本地回退。' },
            { icon: Wrench, title: '8051 静态诊断', text: '规则检查助记符、操作数、标号和伪指令，结果不依赖大模型。' },
            { icon: ShieldCheck, title: '教学判定隔离', text: 'AI不直接修改测验得分、实验完成状态或教师评价。' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-[#0c1117] px-4 py-4">
              <Icon className="h-4 w-4 text-cyan-200" />
              <div className="mt-2 text-xs font-semibold text-slate-200">{title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
        <div className="grid border-t border-white/[0.08] bg-black/15 sm:grid-cols-2 lg:grid-cols-4">
          <div className="px-4 py-3">
            <div className="font-mono text-lg font-semibold text-cyan-100">{benchmarkReport.retrieval.recallAt3}% Recall@3</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              n={benchmarkReport.retrieval.sampleSize}｜全返回命中 {benchmarkReport.retrieval.knowledgePointHitRate}%｜MRR {benchmarkReport.retrieval.meanReciprocalRank.toFixed(4)}｜p95 {benchmarkReport.retrieval.latencyMs.p95}ms
            </p>
          </div>
          <div className="border-white/[0.08] px-4 py-3 sm:border-l">
            <div className="font-mono text-lg font-semibold text-emerald-200">F1 {benchmarkReport.staticDiagnostic.f1.toFixed(2)}</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              n={benchmarkReport.staticDiagnostic.sampleSize}｜P {benchmarkReport.staticDiagnostic.precision.toFixed(2)}｜R {benchmarkReport.staticDiagnostic.recall.toFixed(2)}｜行号 {benchmarkReport.staticDiagnostic.lineLocalizationAccuracy}%
            </p>
          </div>
          <div className="border-white/[0.08] px-4 py-3 lg:border-l">
            <div className="font-mono text-lg font-semibold text-sky-100">{benchmarkReport.localFallback.effectiveAnswerCoverageRate}% 回退主题匹配</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              n={benchmarkReport.localFallback.sampleSize}｜指定禁用表述检查 {benchmarkReport.localFallback.boundaryPassRate}%｜p95 {benchmarkReport.localFallback.latencyMs.p95}ms
            </p>
          </div>
          <div className="border-white/[0.08] px-4 py-3 sm:border-l">
            <div className="font-mono text-lg font-semibold text-amber-100">
              {generativeCompleted ? `${generativeReport.automaticRequiredFactPassRate ?? 0}% 事实通过` : generativeNotRun ? '未运行' : generativeReport.status}
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              {generativeCompleted
                ? `n=${generativeReport.sampleSize ?? 0}｜依据引用 ${generativeReport.groundedCitationRate ?? 0}%｜禁用陈述 ${generativeReport.forbiddenClaimRate ?? 0}%｜p95 ${generativeReport.latencyMs?.p95 ?? '—'}ms`
                : generativeNotRun
                  ? '生成式模型固定基准尚未运行，生成式回答质量未评定'
                  : `生成式模型固定基准｜${generativeReport.reason ?? '未形成可发布运行记录'}`}
            </p>
          </div>
        </div>
        <div className="border-t border-white/[0.06] px-4 py-2 text-[11px] leading-4 text-slate-400">
          <p>注：回退主题匹配只检查非空回答是否引用目标知识点，或标注相同平台单元；指定禁用表述检查只扫描预设的四类表述。二者都不判断答案是否正确、完整或适合教学。检索题来自正式题库，不额外写入目标节点名称；静态诊断指标不归因于外部生成式模型。</p>
          <p className="mt-1">延迟口径：检索、静态诊断和本地回退的 p95 是固定基准函数的本机运行耗时，不是页面端到端延迟或外部模型响应时间。</p>
          <p className="mt-1 font-mono text-slate-500">RUN {benchmarkDate} · SCHEMA v{benchmarkReport.schemaVersion} · SOURCE {benchmarkSourceDigest} · Recall@3=前3位命中数/n · F1=2PR/(P+R)</p>
        </div>
        </section>
      </details>

      {/* 功能选项卡 */}
      <Tabs id="ai-workspace" value={activeTab} onValueChange={handleTabChange} className="order-2 w-full scroll-mt-4">
        <TabsList className={cn('grid h-auto w-full', canPrepare ? 'grid-cols-3' : 'grid-cols-2')}>
          {tabsConfig.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex min-h-11 items-center gap-1 px-2 text-slate-300 data-[state=active]:text-cyan-100 sm:gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 智能问答 */}
        <TabsContent value="qa">
          <IntelligentQA />
        </TabsContent>

        {/* 错误诊断 */}
        <TabsContent value="debug">
          <ErrorDiagnostic />
        </TabsContent>
        {canPrepare && <TabsContent value="teacher-prep">
          <TeacherPreparationPanel editor={prepEditor} setEditor={setPrepEditor} ownerId={user?.id ?? ''} />
        </TabsContent>}
      </Tabs>
    </div>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;
