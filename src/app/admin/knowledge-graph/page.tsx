'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, Loader2, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  title: string;
  level: 1 | 2 | 3;
  chapter: number;
  description?: string;
  prerequisites?: string[];
  appliedIn?: string[];
  graphNodeId?: string | null;
  resources?: { videos?: number; exercises?: number; projects?: number; documents?: number };
  connections?: string[];
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
  const resourceCount = n.resources
    ? (n.resources.videos ?? 0) + (n.resources.exercises ?? 0) + (n.resources.projects ?? 0) + (n.resources.documents ?? 0)
    : 0;
  return {
    id: n.id,
    name: n.title,
    level: n.level,
    chapter: n.chapter,
    description: n.description ?? undefined,
    prerequisites: n.prerequisites ?? [],
    appliedIn: n.appliedIn ?? [],
    graphNodeId: n.graphNodeId ?? null,
    parentId: undefined,
    resourceCount,
  };
}

export default function AdminKnowledgeGraphPage() {
  const [nodes, setNodes] = useState<EditableNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState<'all' | number>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge-graph?type=nodes');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNodes((data.data as ApiNode[]).map(nodeFromApi));
      } else {
        setMessage({ kind: 'err', text: '读取节点失败：' + (data.error || '未知错误') });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: '读取节点失败：' + String(err) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const chapters = useMemo(() => Array.from(new Set(nodes.map((n) => n.chapter))).sort((a, b) => a - b), [nodes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((n) => {
      if (chapter !== 'all' && n.chapter !== chapter) return false;
      if (!q) return true;
      return n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
    });
  }, [nodes, chapter, query]);

  const startCreate = () => {
    setForm({
      ...EMPTY_FORM,
      mode: 'create',
      chapter: chapter === 'all' ? 1 : chapter,
      level: 3,
    });
  };

  const startEdit = (node: EditableNode) => {
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

  const parseList = (raw: string) =>
    raw
      .split(/[,\s，、]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const submitForm = async () => {
    if (!token) {
      setMessage({ kind: 'err', text: '请先登录' });
      return;
    }
    if (!form.name.trim() || !form.chapter || !form.level) {
      setMessage({ kind: 'err', text: '名称、章节、级别不能为空' });
      return;
    }
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
        if (!form.id.trim()) {
          setMessage({ kind: 'err', text: '新建节点必须填 id（如 8.1.6）' });
          setBusy(false);
          return;
        }
        res = await fetch('/api/admin/knowledge-nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: form.id.trim(), ...payload }),
        });
      } else {
        res = await fetch(`/api/admin/knowledge-nodes/${encodeURIComponent(form.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setMessage({ kind: 'ok', text: form.mode === 'create' ? '节点已创建' : '节点已更新' });
        cancelForm();
        await loadNodes();
      } else {
        setMessage({ kind: 'err', text: data.error || '保存失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setBusy(false);
  };

  const deleteNode = async (id: string) => {
    if (!token) return;
    if (!confirm(`确认删除节点 ${id}？`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/knowledge-nodes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setMessage({ kind: 'ok', text: `已删除 ${id}` });
        if (form.id === id) cancelForm();
        await loadNodes();
      } else {
        setMessage({ kind: 'err', text: data.error || '删除失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setBusy(false);
  };

  const seedFromStatic = async () => {
    if (!token) return;
    if (!confirm('把静态 270 节点一次性写入数据库？已有节点会被更新（按 id 幂等）。')) return;
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/seed-knowledge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setMessage({
          kind: 'ok',
          text: `种子完成：${data.inserted} 新增、${data.updated} 更新、${data.total} 总数`,
        });
        await loadNodes();
      } else {
        setMessage({ kind: 'err', text: data.error || '种子失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setSeeding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              返回管理后台
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold">知识图谱维护</h1>
          <p className="text-sm text-muted-foreground">
            编辑、新增、删除知识点节点。修改即写入 KnowledgeNode 表，下个 /api/knowledge-graph 调用立即生效。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={seedFromStatic}
            disabled={seeding || busy}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
            title="把 src/lib/knowledge-points.ts 里的 270 节点一次性 upsert 到数据库；已有节点按 id 更新"
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            种子静态数据
          </button>
          <button
            type="button"
            onClick={loadNodes}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
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
        >
          {message.text}
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
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={chapter === 'all' ? 'all' : String(chapter)}
              onChange={(e) => setChapter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="h-9 rounded-md border bg-background px-2 text-sm"
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
          <div className="max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
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
              <tbody>
                {filtered.map((n) => (
                  <tr
                    key={n.id}
                    className={cn(
                      'border-t hover:bg-muted/50',
                      form.id === n.id && form.mode === 'edit' && 'bg-muted/40',
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{n.id}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(n)}
                        className="text-left hover:underline"
                      >
                        {n.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">L{n.level}</td>
                    <td className="px-3 py-2 font-mono text-xs">CH{n.chapter}</td>
                    <td className="px-3 py-2 font-mono text-xs">{n.prerequisites.length || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{n.appliedIn.length || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteNode(n.id)}
                        disabled={busy}
                        className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
                  <li>第一次使用先点「种子静态数据」把 270 节点写到数据库</li>
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
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    className="mt-1 h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
                    placeholder="8.1.6"
                  />
                </label>
              )}

              <label className="block text-xs">
                <span className="text-muted-foreground">名称</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="text-muted-foreground">级别</span>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) as 1 | 2 | 3 }))}
                    className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
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
                    className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="text-muted-foreground">描述</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">父节点 id（留空=顶层）</span>
                <input
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
                  placeholder="如 8.1"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">graphNodeId（留空可选）</span>
                <input
                  value={form.graphNodeId}
                  onChange={(e) => setForm((f) => ({ ...f, graphNodeId: e.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">前置 id（逗号或空格分隔）</span>
                <input
                  value={form.prerequisites}
                  onChange={(e) => setForm((f) => ({ ...f, prerequisites: e.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
                  placeholder="如 5, 2.2.3"
                />
              </label>

              <label className="block text-xs">
                <span className="text-muted-foreground">应用于实验 refId（逗号分隔）</span>
                <input
                  value={form.appliedIn}
                  onChange={(e) => setForm((f) => ({ ...f, appliedIn: e.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
                  placeholder="如 exp03, exp06"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="h-8 rounded-md px-3 text-xs hover:bg-muted"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
