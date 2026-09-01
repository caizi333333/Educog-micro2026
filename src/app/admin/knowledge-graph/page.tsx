'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Database, Loader2, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type EditableNode = {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  chapter: number;
  description?: string;
  parentId?: string | null;
  graphNodeId?: string | null;
  prerequisites: string[];
  appliedIn: string[];
  resourceCount?: number;
};

type ApiNode = {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  chapter: number;
  description?: string;
  parentId?: string | null;
  prerequisites?: string[];
  appliedIn?: string[];
  graphNodeId?: string | null;
  resources?: unknown[];
};

type FormState = {
  mode: 'create' | 'edit' | null;
  id: string;
  name: string;
  level: 1 | 2 | 3;
  chapter: number;
  description: string;
  parentId: string;
  graphNodeId: string;
  prerequisites: string;
  appliedIn: string;
};

const EMPTY_FORM: FormState = {
  mode: null,
  id: '',
  name: '',
  level: 3,
  chapter: 1,
  description: '',
  parentId: '',
  graphNodeId: '',
  prerequisites: '',
  appliedIn: '',
};

function nodeFromApi(n: ApiNode): EditableNode {
  return {
    id: n.id,
    name: n.name,
    level: n.level,
    chapter: n.chapter,
    description: n.description ?? undefined,
    prerequisites: n.prerequisites ?? [],
    appliedIn: n.appliedIn ?? [],
    graphNodeId: n.graphNodeId ?? null,
    parentId: n.parentId ?? null,
    resourceCount: Array.isArray(n.resources) ? n.resources.length : 0,
  };
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `seed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function AdminKnowledgeGraphPage() {
  const { user, loading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<EditableNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [chapter, setChapter] = useState<'all' | number>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [source, setSource] = useState<'db' | 'static' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditableNode | null>(null);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadSequenceRef = useRef(0);
  const operationLockRef = useRef(false);

  const loadNodes = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      loadAbortRef.current?.abort();
      setNodes([]);
      setSource(null);
      setLoading(false);
      setMessage({ kind: 'err', text: '登录状态已失效，请重新登录后继续。' });
      return;
    }

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setNodes([]);
    setSource(null);
    setMessage(null);
    try {
      const res = await fetchClientRequest('/api/knowledge-graph?type=raw', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }, CLIENT_READ_TIMEOUT_MS);
      const data: unknown = await res.json().catch(() => ({}));
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (res.ok && record.success === true && Array.isArray(record.data)) {
        if (sequence !== loadSequenceRef.current) return;
        setNodes((record.data as ApiNode[]).map(nodeFromApi));
        if (record.source === 'db' || record.source === 'static') setSource(record.source);
      } else {
        const error = typeof record.error === 'string' ? record.error : '未知错误';
        if (res.status === 401) throw new Error('登录状态已失效，请重新登录后继续。');
        if (res.status === 403) throw new Error('当前账号没有知识图谱维护权限。');
        throw new Error(error);
      }
    } catch (error) {
      if (controller.signal.aborted || sequence !== loadSequenceRef.current) return;
      const detail = error instanceof ClientRequestTimeoutError
        ? '读取超时，请检查网络后重试。'
        : error instanceof Error ? error.message : '未知错误';
      setMessage({ kind: 'err', text: `读取节点失败：${detail}` });
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || !['ADMIN', 'TEACHER'].includes(user.role)) return;
    void loadNodes();
    return () => loadAbortRef.current?.abort();
  }, [authLoading, loadNodes, user]);

  const chapters = useMemo(() => Array.from(new Set(nodes.map((n) => n.chapter))).sort((a, b) => a - b), [nodes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((n) => {
      if (chapter !== 'all' && n.chapter !== chapter) return false;
      if (!q) return true;
      return n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
    });
  }, [nodes, chapter, query]);
  const canSeed = user?.role === 'ADMIN';

  const startCreate = () => {
    if (form.mode !== null) {
      setMessage({ kind: 'err', text: '请先保存或取消当前节点编辑，再新建节点。' });
      return;
    }
    setForm({
      ...EMPTY_FORM,
      mode: 'create',
      chapter: chapter === 'all' ? 1 : chapter,
      level: 3,
    });
  };

  const startEdit = (node: EditableNode) => {
    if (form.mode !== null && (form.mode !== 'edit' || form.id !== node.id)) {
      setMessage({ kind: 'err', text: '请先保存或取消当前节点编辑，再切换节点。' });
      return;
    }
    setForm({
      mode: 'edit',
      id: node.id,
      name: node.name,
      level: node.level,
      chapter: node.chapter,
      description: node.description ?? '',
      parentId: node.parentId ?? '',
      graphNodeId: node.graphNodeId ?? '',
      prerequisites: node.prerequisites.join(', '),
      appliedIn: node.appliedIn.join(', '),
    });
  };

  const cancelForm = () => setForm(EMPTY_FORM);

  const parseList = (raw: string): string[] =>
    raw
      .split(/[,\s，、]+/)
      .map((s) => s.trim())
      .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index);

  const validateForm = (): string | null => {
    const id = form.id.trim();
    const name = form.name.trim();
    const parts = id.split('.');
    if (!/^\d+(?:\.\d+){0,2}$/.test(id)) return '节点编号应采用“章.节.知识点”格式';
    if (!name) return '节点名称不能为空';
    if (name.length > 120) return '节点名称不能超过120个字符';
    if (parts.length !== form.level) return `L${form.level} 节点编号应包含 ${form.level} 级编号`;
    if (!Number.isInteger(Number(form.chapter)) || Number(form.chapter) < 1 || Number(form.chapter) > 20) return '章节编号必须是1至20之间的整数';
    if (Number(parts[0]) !== Number(form.chapter)) return '节点编号所属章节必须与章节字段一致';
    const expectedParent = form.level === 1 ? '' : parts.slice(0, -1).join('.');
    if (form.parentId.trim() !== expectedParent) {
      return form.level === 1 ? 'L1章节节点不能设置父节点' : `父节点必须是 ${expectedParent}`;
    }
    const prerequisites = parseList(form.prerequisites);
    if (prerequisites.includes(id)) return '节点不能把自己设为前置知识点';
    if (prerequisites.some((item) => !/^\d+(?:\.\d+){0,2}$/.test(item))) return '前置知识点包含无效编号';
    if (parseList(form.appliedIn).some((item) => !/^(?:exp|proj)\d{2}$/.test(item))) {
      return '实验关联编号应采用 exp02 或 proj01 格式';
    }
    return null;
  };

  const sendMutationWithReplay = async (url: string, init: RequestInit): Promise<Response> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetchClientRequest(url, init, CLIENT_WRITE_TIMEOUT_MS);
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        if (retryable && attempt === 0) continue;
        if (retryable) throw new ClientRequestTimeoutError('请求返回临时错误');
        return response;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && isAmbiguousClientFailure(error)) continue;
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('请求结果无法确认');
  };

  const submitForm = async () => {
    if (operationLockRef.current) return;
    const token = getStoredAccessToken();
    if (!token) {
      setMessage({ kind: 'err', text: '登录状态已失效，请重新登录后继续。' });
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setMessage({ kind: 'err', text: validationError });
      return;
    }
    operationLockRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        level: form.level,
        chapter: Number(form.chapter),
        description: form.description.trim() || null,
        parentId: form.parentId.trim() || null,
        graphNodeId: form.graphNodeId.trim() || null,
        prerequisites: parseList(form.prerequisites),
        appliedIn: parseList(form.appliedIn),
      };
      let res: Response;
      if (form.mode === 'create') {
        res = await sendMutationWithReplay('/api/admin/knowledge-nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: form.id.trim(), ...payload }),
        });
      } else {
        res = await sendMutationWithReplay(`/api/admin/knowledge-nodes/${encodeURIComponent(form.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      const data: unknown = await res.json().catch(() => ({}));
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (res.ok && record.success !== false) {
        const duplicate = record.duplicate === true;
        const successMessage = duplicate
          ? '已确认此前请求生效，本次没有重复写入。'
          : form.mode === 'create' ? '节点已创建并记录操作日志。' : '节点已更新并记录操作日志。';
        cancelForm();
        await loadNodes();
        setMessage({ kind: 'ok', text: successMessage });
      } else {
        setMessage({ kind: 'err', text: typeof record.error === 'string' ? record.error : '保存失败' });
      }
    } catch (error) {
      if (isAmbiguousClientFailure(error)) {
        await loadNodes();
        setMessage({ kind: 'err', text: '保存结果暂时无法确认，已重新读取节点；请核对目标节点后再决定是否重试。' });
      } else {
        setMessage({ kind: 'err', text: error instanceof Error ? error.message : '保存失败' });
      }
    } finally {
      setBusy(false);
      operationLockRef.current = false;
    }
  };

  const deleteNode = async () => {
    if (!deleteTarget || operationLockRef.current) return;
    const token = getStoredAccessToken();
    if (!token) {
      setMessage({ kind: 'err', text: '登录状态已失效，请重新登录后继续。' });
      return;
    }
    operationLockRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const res = await sendMutationWithReplay(`/api/admin/knowledge-nodes/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: unknown = await res.json().catch(() => ({}));
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (res.ok && record.success !== false) {
        const successMessage = record.duplicate === true
          ? `节点 ${deleteTarget.id} 此前已删除。`
          : `已删除 ${deleteTarget.id} 并记录操作日志。`;
        if (form.id === deleteTarget.id) cancelForm();
        setDeleteTarget(null);
        await loadNodes();
        setMessage({ kind: 'ok', text: successMessage });
      } else {
        setMessage({ kind: 'err', text: typeof record.error === 'string' ? record.error : '删除失败' });
      }
    } catch (error) {
      if (isAmbiguousClientFailure(error)) {
        setDeleteTarget(null);
        await loadNodes();
        setMessage({ kind: 'err', text: '删除结果暂时无法确认，已重新读取节点，请核对后再操作。' });
      } else {
        setMessage({ kind: 'err', text: error instanceof Error ? error.message : '删除失败' });
      }
    } finally {
      setBusy(false);
      operationLockRef.current = false;
    }
  };

  const seedFromStatic = async () => {
    if (!canSeed || operationLockRef.current) return;
    const token = getStoredAccessToken();
    if (!token) {
      setMessage({ kind: 'err', text: '登录状态已失效，请重新登录后继续。' });
      return;
    }
    operationLockRef.current = true;
    setSeedConfirmOpen(false);
    setSeeding(true);
    setMessage(null);
    try {
      const requestBody = JSON.stringify({ requestId: createRequestId() });
      const res = await sendMutationWithReplay('/api/admin/seed-knowledge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: requestBody,
      });
      const data: unknown = await res.json().catch(() => ({}));
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (res.ok && record.success !== false) {
        await loadNodes();
        setMessage({
          kind: 'ok',
          text: record.duplicate === true
            ? `该静态同步请求此前已完成：${String(record.inserted ?? 0)} 新增、${String(record.updated ?? 0)} 覆盖、${String(record.total ?? 0)} 总数。`
            : `静态同步完成：${String(record.inserted ?? 0)} 新增、${String(record.updated ?? 0)} 覆盖、${String(record.total ?? 0)} 总数。`,
        });
      } else {
        setMessage({ kind: 'err', text: typeof record.error === 'string' ? record.error : '静态同步失败' });
      }
    } catch (error) {
      if (isAmbiguousClientFailure(error)) {
        await loadNodes();
        setMessage({ kind: 'err', text: '静态同步结果暂时无法确认。操作本身可重复执行，已重新读取当前节点数量，请人工核对后再决定是否重试。' });
      } else {
        setMessage({ kind: 'err', text: error instanceof Error ? error.message : '静态同步失败' });
      }
    } finally {
      setSeeding(false);
      operationLockRef.current = false;
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在核验维护权限…
      </div>
    );
  }

  if (!user || !['ADMIN', 'TEACHER'].includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-md rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center">
          <AlertTriangle aria-hidden="true" className="mx-auto h-6 w-6 text-amber-200" />
          <h1 className="mt-3 text-lg font-semibold text-amber-50">需要教师或管理员账号</h1>
          <p className="mt-2 text-sm leading-6 text-amber-50/75">当前账号不会读取或写入图谱维护数据。切换账号后将返回本页。</p>
          <Link
            href="/login?role=teacher&from=%2Fadmin%2Fknowledge-graph&reason=teacher-role"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            {!user ? '前往登录' : '切换教师或管理员账号'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={user.role === 'ADMIN' ? '/admin' : '/teacher'}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              {user.role === 'ADMIN' ? '返回管理后台' : '返回教学仪表板'}
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold">知识图谱维护</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span>编辑、新增或删除知识点；通过服务端校验后写入正式节点库，并刷新前台图谱。</span>
            <span className="font-mono text-xs">总计 {nodes.length} 节点</span>
            {source && (
              <span className={cn(
                'rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                source === 'db'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
              )}>
                {source === 'db' ? '数据库权威源' : '静态只读后备'}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSeed && (
            <button
              type="button"
              onClick={() => setSeedConfirmOpen(true)}
              disabled={seeding || busy || loading}
              aria-busy={seeding}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
              title="以静态课程定义覆盖数据库内同编号节点，新增缺失节点"
            >
              {seeding ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Database aria-hidden="true" className="h-4 w-4" />}
              {seeding ? '正在同步课程定义…' : '同步静态课程定义'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadNodes()}
            disabled={loading || busy || seeding}
            aria-busy={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={cn('h-4 w-4', loading && 'animate-spin')} />
            {loading ? '刷新中…' : '刷新'}
          </button>
          <button
            type="button"
            onClick={startCreate}
            disabled={loading || busy || seeding || source !== 'db'}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            新增节点
          </button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'rounded-md border px-4 py-2 text-sm',
            message.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
          )}
          role={message.kind === 'err' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{message.text}</span>
            {message.kind === 'err' && message.text.includes('读取节点失败') && (
              <button type="button" className="min-h-11 rounded-md border px-3 text-sm" onClick={() => void loadNodes()} disabled={loading} aria-busy={loading}>
                {loading ? '正在重试读取…' : '重试读取'}
              </button>
            )}
          </div>
        </div>
      )}

      {source === 'static' && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm">
          <div>
            <div className="font-medium">数据库还没有 KnowledgeNode 数据</div>
            <p className="mt-1 text-xs text-muted-foreground">
              当前只展示静态课程定义，编辑入口已锁定。管理员完成首次导入后才能写入数据库。
            </p>
          </div>
          {canSeed ? (
            <button
              type="button"
              onClick={() => setSeedConfirmOpen(true)}
              disabled={seeding}
              aria-busy={seeding}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {seeding ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Database aria-hidden="true" className="h-4 w-4" />}
              {seeding ? '正在导入课程定义…' : '导入课程定义'}
            </button>
          ) : (
            <span className="text-xs text-amber-100">请联系系统管理员完成首次导入。</span>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 id 或 名称"
                className="min-h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={chapter === 'all' ? 'all' : String(chapter)}
              onChange={(e) => setChapter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="min-h-11 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">全部章节</option>
              {chapters.map((c) => (
                <option key={c} value={c}>
                  CH{c}
                </option>
              ))}
            </select>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {filtered.length} / {nodes.length}
            </span>
          </div>
          <div className="max-h-[640px] overflow-y-auto" aria-busy={loading}>
            <table className="block w-full text-sm md:table">
              <thead className="sticky top-0 hidden bg-card text-xs uppercase tracking-wider text-muted-foreground md:table-header-group">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">名称</th>
                  <th className="px-3 py-2 text-left">L</th>
                  <th className="px-3 py-2 text-left">CH</th>
                  <th className="px-3 py-2 text-left">前置</th>
                  <th className="px-3 py-2 text-left">实验</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="block space-y-2 p-2 md:table-row-group md:space-y-0 md:p-0">
                {loading && (
                  <tr className="block border-0 md:table-row">
                    <td colSpan={7} className="block px-3 py-12 text-center text-sm text-muted-foreground md:table-cell" role="status" aria-live="polite">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />正在读取权威节点数据…</span>
                    </td>
                  </tr>
                )}
                {filtered.map((n) => (
                  <tr
                    key={n.id}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-md border p-3 hover:bg-muted/50 md:table-row md:rounded-none md:border-x-0 md:border-b-0 md:p-0',
                      form.id === n.id && form.mode === 'edit' && 'bg-muted/40',
                    )}
                  >
                    <td className="col-span-1 block self-end px-0 pb-0.5 pt-0 font-mono text-xs text-cyan-700 dark:text-cyan-200 md:table-cell md:px-3 md:py-2 md:text-foreground">{n.id}</td>
                    <td className="col-span-1 row-start-2 block px-0 py-0 md:table-cell md:px-3 md:py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(n)}
                        disabled={busy || seeding || source !== 'db'}
                        className="min-h-11 w-full text-left font-medium hover:underline disabled:opacity-50 md:font-normal"
                      >
                        {n.name}
                      </button>
                    </td>
                    <td className="col-span-1 row-start-3 inline-flex items-center gap-1 px-0 py-1 font-mono text-xs text-muted-foreground md:table-cell md:px-3 md:py-2 md:text-foreground"><span className="md:hidden">层级</span>L{n.level}</td>
                    <td className="col-span-1 row-start-3 inline-flex items-center gap-1 px-0 py-1 pl-12 font-mono text-xs text-muted-foreground md:table-cell md:px-3 md:py-2 md:text-foreground"><span className="md:hidden">章节</span>CH{n.chapter}</td>
                    <td className="col-span-1 row-start-4 inline-flex items-center gap-1 px-0 py-1 font-mono text-xs text-muted-foreground md:table-cell md:px-3 md:py-2 md:text-foreground"><span className="md:hidden">前置</span>{n.prerequisites.length || '-'}</td>
                    <td className="col-span-1 row-start-4 inline-flex items-center gap-1 px-0 py-1 pl-12 font-mono text-xs text-muted-foreground md:table-cell md:px-3 md:py-2 md:text-foreground"><span className="md:hidden">实验</span>{n.appliedIn.length || '-'}</td>
                    <td className="col-start-2 row-span-2 row-start-1 block self-center px-0 py-0 text-right md:table-cell md:px-3 md:py-2">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(n)}
                        disabled={busy || seeding || source !== 'db'}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                        aria-label={`删除节点 ${n.id} ${n.name}`}
                        title={`删除节点 ${n.id} ${n.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr className="block border-0 md:table-row">
                    <td colSpan={7} className="block px-3 py-8 text-center text-sm text-muted-foreground md:table-cell">
                      没有匹配的节点。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-md border bg-card p-4">
          {form.mode === null ? (
            <div className="text-sm text-muted-foreground">
              点击左侧任意节点名编辑，或点右上「新增节点」。
              <div className="mt-3 rounded-md border border-dashed border-muted-foreground/30 p-3 text-xs">
                <p className="font-medium text-foreground">提示</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>数据库为空时，先由管理员同步279个正式节点</li>
                  <li>修改保存后，前台 /knowledge-graph 立即看到更新（缓存自动失效）</li>
                  <li>删除前会校验：被引用为父节点或 prereq 的节点不能直接删</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {form.mode === 'create' ? '新增节点' : `编辑：${form.id}`}
                </h2>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={busy}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="取消当前节点编辑"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {form.mode === 'create' && (
                <label className="block text-xs">
                  <span className="text-muted-foreground">ID（如 8.1.6）</span>
                  <input
                    value={form.id}
                    onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 font-mono text-xs"
                    placeholder="8.1.6"
                  />
                </label>
              )}

              <label className="block text-xs">
                <span className="text-muted-foreground">名称</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="text-muted-foreground">级别</span>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) as 1 | 2 | 3 }))}
                    className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value={1}>L1</option>
                    <option value={2}>L2</option>
                    <option value={3}>L3</option>
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-muted-foreground">章节</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={form.chapter}
                    onChange={(e) => setForm((f) => ({ ...f, chapter: Number(e.target.value) }))}
                    className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="text-muted-foreground">描述</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 min-h-24 w-full rounded-md border bg-background px-2 py-2 text-sm"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">父节点 id（留空=顶层）</span>
                <input
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 font-mono text-xs"
                  placeholder="如 8.1"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">graphNodeId（留空可选）</span>
                <input
                  value={form.graphNodeId}
                  onChange={(e) => setForm((f) => ({ ...f, graphNodeId: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 font-mono text-xs"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">前置 id（逗号或空格分隔）</span>
                <input
                  value={form.prerequisites}
                  onChange={(e) => setForm((f) => ({ ...f, prerequisites: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 font-mono text-xs"
                  placeholder="如 5, 2.2.3"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">应用于实验 refId（逗号分隔）</span>
                <input
                  value={form.appliedIn}
                  onChange={(e) => setForm((f) => ({ ...f, appliedIn: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 font-mono text-xs"
                  placeholder="如 exp03, exp06"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={busy}
                  className="min-h-11 rounded-md px-3 text-xs hover:bg-muted disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={busy}
                  aria-busy={busy}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Save aria-hidden="true" className="h-3.5 w-3.5" />}
                  {busy ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open && !busy) setDeleteTarget(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除知识节点</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `将删除 ${deleteTarget.id}「${deleteTarget.name}」。存在下级节点或仍被其他节点列为前置时，系统会拒绝执行。`
                : '请确认删除范围。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            删除只影响该节点定义，不会改写学生既有测评和学习记录；删除成功后前台图谱立即刷新。
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void deleteNode();
              }}
            >
              {busy ? '正在删除…' : '确认删除节点'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seedConfirmOpen} onOpenChange={(open) => {
        if (!seeding) setSeedConfirmOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>同步静态课程定义到数据库</AlertDialogTitle>
            <AlertDialogDescription>
              将以代码中的279个正式节点为准：缺失编号会新增，同编号节点的名称、层级、父节点、资源、前置关系和实验关联会被覆盖。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            此操作可能覆盖后台手工修改。仅适用于首次初始化或确认需要恢复到正式课程定义时。
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={seeding}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={seeding || !canSeed}
              onClick={(event) => {
                event.preventDefault();
                void seedFromStatic();
              }}
            >
              {seeding ? '正在同步…' : '确认覆盖并同步'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
