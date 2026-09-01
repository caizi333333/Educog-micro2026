'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  fetchClientRequest,
} from '@/lib/client-fetch';
import { cn } from '@/lib/utils';

// -- Types ------------------------------------------------------------------

interface AssessmentLinkItem {
  id: string;
  assessmentType: string;
  assessmentTargetId: string;
  weight: number;
  maxScore: number;
  chapter?: number | null;
  description?: string | null;
  resourceValid?: boolean;
  resourceIssue?: string | null;
  resolvedDescription?: string | null;
}

interface CourseObjectiveItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  supportWeight: number;
  version: number;
  isActive: boolean;
  indicatorPoint: {
    id: string;
    code: string;
    description: string;
  };
  assessmentLinks: AssessmentLinkItem[];
  totalWeight?: number;
  configurationIssues?: string[];
}

interface AssessmentResourceOption {
  type: string;
  targetId: string;
  chapter: number | null;
  description: string;
}

interface ObjectiveImpact {
  achievementRecordCount: number;
  affectedStudentCount: number;
  affectedClassCount: number;
  affectedSemesterCount: number;
  latestCalculatedAt?: string | null;
  recordsWillBeRetained: boolean;
  requiresRecalculation: boolean;
}

interface IndicatorPointItem {
  id: string;
  code: string;
  description: string;
  achievementThreshold: number;
  graduationRequirement: {
    code: string;
    name: string;
  };
}

// -- Constants --------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  QUIZ: '测验',
  EXPERIMENT: '实验',
  LEARNING_PROGRESS: '学习进度',
  COMPREHENSIVE: '综合',
};

const TYPE_COLORS: Record<string, string> = {
  QUIZ: 'bg-cyan-300/10 text-cyan-200',
  EXPERIMENT: 'bg-emerald-300/10 text-emerald-200',
  LEARNING_PROGRESS: 'bg-amber-300/10 text-amber-200',
  COMPREHENSIVE: 'bg-mauve-300/10 text-purple-200',
};

// -- Component --------------------------------------------------------------

export default function ObjectivesPage() {
  return <ObjectivesManager />;
}

function ObjectivesManager() {
  const { user, loading: authLoading, logout } = useAuth();
  const [objectives, setObjectives] = useState<CourseObjectiveItem[]>([]);
  const [indicators, setIndicators] = useState<IndicatorPointItem[]>([]);
  const [assessmentResources, setAssessmentResources] = useState<AssessmentResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedCO, setExpandedCO] = useState<string | null>(null);
  const [editingCO, setEditingCO] = useState<string | null>(null);
  const [pendingEditorId, setPendingEditorId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) throw new Error('登录状态已失效，请重新登录');
        const headers = { Authorization: `Bearer ${token}` };

        const [coRes, ipRes] = await Promise.all([
          fetchClientRequest('/api/obe/course-objectives', {
            headers,
            signal: controller.signal,
          }, CLIENT_READ_TIMEOUT_MS),
          fetchClientRequest('/api/obe/graduation-requirements', {
            headers,
            signal: controller.signal,
          }, CLIENT_READ_TIMEOUT_MS),
        ]);

        if (coRes.status === 401 || ipRes.status === 401) {
          await logout();
          return;
        }
        if (!coRes.ok || !ipRes.ok) throw new Error('课程目标或指标点数据未完整加载');

        const coJson = await coRes.json() as {
          objectives?: CourseObjectiveItem[];
          assessmentResources?: AssessmentResourceOption[];
        };
        const ipJson = await ipRes.json() as {
          graduationRequirements?: Array<{
            code: string;
            name: string;
            indicatorPoints?: Omit<IndicatorPointItem, 'graduationRequirement'>[];
          }>;
        };
        const allIPs: IndicatorPointItem[] = [];
        for (const gr of ipJson.graduationRequirements ?? []) {
          for (const ip of gr.indicatorPoints ?? []) {
            allIPs.push({ ...ip, graduationRequirement: { code: gr.code, name: gr.name } });
          }
        }
        if (controller.signal.aborted) return;
        if (user.role === 'ADMIN' && !Array.isArray(coJson.assessmentResources)) {
          throw new Error('正式考核资源清单未完整加载');
        }
        setObjectives(Array.isArray(coJson.objectives) ? coJson.objectives : []);
        setAssessmentResources(Array.isArray(coJson.assessmentResources) ? coJson.assessmentResources : []);
        setIndicators(allIPs);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch objectives:', err);
        setObjectives([]);
        setIndicators([]);
        setAssessmentResources([]);
        setExpandedCO(null);
        setEditingCO(null);
        setError(err instanceof Error ? err.message : '加载课程目标数据失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [logout, reloadKey, user]);

  const handleConfigurationSaved = (message: string) => {
    setNotice(message);
    setPendingEditorId(null);
    setEditingCO(null);
    setCreateOpen(false);
    setReloadKey((current) => current + 1);
  };

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] text-sm text-slate-400 sm:-m-6">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在核对访问权限...
      </div>
    );
  }

  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Target className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">仅教师和管理员可访问此页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
            <BookOpen className="h-3.5 w-3.5" />
            OBE · 课程目标
          </div>
          <h1 id="obe-objectives-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">课程目标配置</h1>
          <p className="mt-1 text-sm text-slate-400">
            核对课程目标、指标点与正式考核资源的对应关系
          </p>
          <div className="mt-3 inline-flex min-h-7 items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-slate-400">
            {user.role === 'ADMIN' ? '管理员视图 · 含未启用草稿' : '教师视图 · 仅展示已启用目标'}
          </div>
        </div>
      </div>

      <section aria-labelledby="obe-objectives-page-title" className="px-4 py-5 md:px-6">
        {notice && (
          <div role="status" aria-live="polite" className="mb-5 flex items-start justify-between gap-3 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100">
            <span>{notice}</span>
            <button
              type="button"
              aria-label="关闭成功提示"
              onClick={() => setNotice(null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && (
          <div role="alert" aria-live="assertive" className="mb-5 rounded-md border border-red-300/20 bg-red-300/[0.06] p-4 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-md bg-white/[0.06] px-4 text-xs text-slate-300 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        )}
        {user.role === 'ADMIN' && !loading && !error && (
          <div className="mb-5 rounded-md border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  管理员配置区
                </div>
                <p className="mt-1 text-xs text-slate-500">正式目标不做硬删除；停用后保留历史记录，重新启用前必须核对完整配置。</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen((current) => !current)}
                aria-expanded={createOpen}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-xs font-medium text-cyan-100 hover:bg-cyan-300/[0.12] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              >
                {createOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {createOpen ? '取消新增' : '新增课程目标'}
              </button>
            </div>
            {createOpen && (
              <CreateObjectiveForm
                indicators={indicators}
                onSaved={handleConfigurationSaved}
                onUnauthorized={logout}
              />
            )}
          </div>
        )}
        {/* Indicator Points Summary */}
        {indicators.length > 0 && (
          <div className="mb-5 rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <Target className="h-3.5 w-3.5" />
              支撑指标点 ({indicators.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {indicators.map((ip) => (
                <div key={ip.id} className="rounded-sm border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-cyan-200">{ip.code}</span>
                    <span className="text-[11px] text-slate-400">{ip.description}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">
                    {ip.graduationRequirement.code} · 阈值 {(ip.achievementThreshold * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course Objectives with Assessment Links */}
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">加载中...</div>
        ) : objectives.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-white/[0.1] px-6 text-center">
            <BookOpen className="h-8 w-8 text-slate-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-slate-300">尚未配置可维护的课程目标</p>
              <p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">
                管理员需先启用毕业要求及支撑指标点，教师才能在此配置课程目标与考核环节。当前无配置不会生成达成度结论。
              </p>
            </div>
            <Link
              href="/obe/teacher"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-xs font-medium text-cyan-100 hover:bg-cyan-300/[0.12] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
            >
              返回达成度总览
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {objectives.map((co) => {
              const isExpanded = expandedCO === co.id;
              const totalWeight = co.totalWeight
                ?? co.assessmentLinks.reduce((sum, link) => sum + link.weight, 0);
              const issues = Array.isArray(co.configurationIssues) ? co.configurationIssues : [];
              const healthy = co.isActive && issues.length === 0;

              return (
                <div key={co.id} className="rounded-md border border-white/[0.08] bg-white/[0.035]">
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingEditorId === null) setExpandedCO(isExpanded ? null : co.id);
                    }}
                    aria-expanded={isExpanded}
                    disabled={pendingEditorId !== null}
                    title={pendingEditorId !== null ? '配置请求结果待核对，不能折叠或切换目标' : undefined}
                    className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs font-semibold text-cyan-200">
                        {co.code.replace('CO', '')}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{co.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-slate-500">→ {co.indicatorPoint.code}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-500">{co.assessmentLinks.length} 个考核环节</span>
                          <span className="text-slate-600">|</span>
                          <span className={issues.length === 0 ? 'text-slate-500' : 'text-amber-200'}>
                            权重合计 {(totalWeight * 100).toFixed(0)}%
                          </span>
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                            healthy
                              ? 'bg-emerald-300/10 text-emerald-200'
                              : 'bg-amber-300/10 text-amber-200',
                          )}>
                            {healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {healthy ? '配置正常' : co.isActive ? '配置待修复' : '未启用'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.06] p-4">
                      {/* Mapping chain */}
                      <div className="mb-4 flex items-center gap-2 rounded-md bg-white/[0.02] p-3 text-xs">
                        <span className="font-mono text-cyan-200">{co.code}</span>
                        <span className="text-slate-600">→</span>
                        <span className="font-mono text-amber-200">{co.indicatorPoint.code}</span>
                        <span className="text-slate-500">({co.indicatorPoint.description})</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400">支撑权重 {(co.supportWeight * 100).toFixed(0)}%</span>
                      </div>

                      {user.role === 'ADMIN' && (
                        <div className="mb-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (pendingEditorId === null) setEditingCO(editingCO === co.id ? null : co.id);
                            }}
                            aria-expanded={editingCO === co.id}
                            disabled={pendingEditorId !== null}
                            title={pendingEditorId !== null ? '先核对原请求或明确放弃，才能关闭配置' : undefined}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-4 text-xs text-slate-200 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editingCO === co.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                            {editingCO === co.id ? '关闭配置' : '管理此目标'}
                          </button>
                        </div>
                      )}

                      {issues.length > 0 && (
                        <div className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-100">
                          <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            当前配置不会通过达成度计算前检查
                          </div>
                          <ul className="mt-2 space-y-1 text-amber-100/80">
                            {issues.map((issue) => <li key={issue}>· {issue}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Assessment Links */}
                      {co.assessmentLinks.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">暂无考核环节映射</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="hidden grid-cols-[minmax(0,1fr)_80px_60px_60px_110px] gap-2 px-3 text-[10px] font-medium uppercase tracking-wider text-slate-600 md:grid">
                            <span>考核环节</span>
                            <span>类型</span>
                            <span>满分</span>
                            <span>权重</span>
                            <span>目标 ID</span>
                          </div>
                          {co.assessmentLinks.map((link) => (
                            <div key={link.id} className="grid grid-cols-2 gap-3 rounded-sm border border-white/[0.04] bg-white/[0.015] px-3 py-3 text-xs md:grid-cols-[minmax(0,1fr)_80px_60px_60px_110px] md:gap-2 md:py-2">
                              <div className="col-span-2 min-w-0 md:col-span-1">
                                <span className="mb-1 block text-[10px] text-slate-600 md:hidden">考核环节</span>
                                <span className="block text-slate-300">{link.resolvedDescription || link.description || link.assessmentTargetId}</span>
                                {link.resourceIssue && <span className="mt-1 block text-[10px] text-amber-200">{link.resourceIssue}</span>}
                              </div>
                              <div>
                                <span className="mb-1 block text-[10px] text-slate-600 md:hidden">类型</span>
                                <span className={cn('inline-flex rounded-sm px-1.5 py-0.5 text-[10px]', TYPE_COLORS[link.assessmentType] || 'bg-white/[0.05] text-slate-400')}>
                                  {TYPE_LABELS[link.assessmentType] || link.assessmentType}
                                </span>
                              </div>
                              <div>
                                <span className="mb-1 block text-[10px] text-slate-600 md:hidden">满分</span>
                                <span className="font-mono text-slate-400">{link.maxScore}</span>
                              </div>
                              <div>
                                <span className="mb-1 block text-[10px] text-slate-600 md:hidden">权重</span>
                                <span className="font-mono text-cyan-200">{(link.weight * 100).toFixed(0)}%</span>
                              </div>
                              <div className="min-w-0">
                                <span className="mb-1 block text-[10px] text-slate-600 md:hidden">目标 ID</span>
                                <span className="block truncate font-mono text-slate-500">{link.assessmentTargetId}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {user.role === 'ADMIN' && editingCO === co.id && (
                        <AdminObjectiveEditor
                          key={`${co.id}:${co.version}`}
                          objectiveId={co.id}
                          indicators={indicators}
                          resources={assessmentResources}
                          onSaved={handleConfigurationSaved}
                          onCancel={() => {
                            if (pendingEditorId !== co.id) setEditingCO(null);
                          }}
                          onPendingChange={(pending) => setPendingEditorId((current) => (
                            pending ? co.id : current === co.id ? null : current
                          ))}
                          onUnauthorized={logout}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const controlClassName = 'h-11 w-full rounded-md border border-white/[0.1] bg-[#0a0e13] px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-55';

function CreateObjectiveForm({
  indicators,
  onSaved,
  onUnauthorized,
}: {
  indicators: IndicatorPointItem[];
  onSaved: (message: string) => void;
  onUnauthorized: () => Promise<void>;
}) {
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [indicatorPointId, setIndicatorPointId] = useState(indicators[0]?.id ?? '');
  const [supportWeight, setSupportWeight] = useState('30');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const weight = Number(supportWeight) / 100;
    if (!code.trim() || !name.trim() || !indicatorPointId) {
      setError('请完整填写编码、名称和支撑指标点');
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1) {
      setError('支撑权重应为 1% 至 100%');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const response = await fetchClientRequest('/api/obe/course-objectives', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          indicatorPointId,
          supportWeight: weight,
        }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const data = await response.json().catch(() => ({})) as { error?: string; duplicate?: boolean };
      if (response.status === 401) {
        await onUnauthorized();
        return;
      }
      if (!response.ok) throw new Error(data.error || '课程目标草稿创建失败');
      onSaved(data.duplicate ? '已恢复同一课程目标草稿，请继续配置考核环节' : '课程目标草稿已创建，请继续配置考核环节');
    } catch (err) {
      setError(err instanceof Error ? err.message : '课程目标草稿创建失败');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 border-t border-white/[0.07] pt-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-slate-400">
          目标编码
          <input value={code} onChange={(event) => setCode(event.target.value)} disabled={submitting} maxLength={16} placeholder="例如 CO6" className={`${controlClassName} mt-2`} />
        </label>
        <label className="text-xs text-slate-400">
          目标名称
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} maxLength={200} placeholder="说明学生应达到的可观察能力" className={`${controlClassName} mt-2`} />
        </label>
        <label className="text-xs text-slate-400">
          支撑指标点
          <select value={indicatorPointId} onChange={(event) => setIndicatorPointId(event.target.value)} disabled={submitting} className={`${controlClassName} mt-2`}>
            {indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code} · {indicator.description}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          支撑权重（%）
          <input type="number" min="1" max="100" step="1" value={supportWeight} onChange={(event) => setSupportWeight(event.target.value)} disabled={submitting} className={`${controlClassName} mt-2`} />
        </label>
        <label className="text-xs text-slate-400 md:col-span-2">
          目标说明
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={submitting} maxLength={2000} rows={3} className="mt-2 w-full rounded-md border border-white/[0.1] bg-[#0a0e13] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-55" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-200">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus:ring-2 focus:ring-cyan-200/40">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          创建未启用草稿
        </button>
      </div>
    </form>
  );
}

interface EditorLink {
  assessmentType: string;
  assessmentTargetId: string;
  chapter: number | null;
  description: string;
  weightPercent: string;
  maxScore: string;
}

interface PendingOperation {
  kind: 'metadata' | 'links' | 'status';
  endpoint: string;
  method: 'PATCH' | 'PUT';
  body: Record<string, unknown>;
}

function makeRequestId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function AdminObjectiveEditor({
  objectiveId,
  indicators,
  resources,
  onSaved,
  onCancel,
  onPendingChange,
  onUnauthorized,
}: {
  objectiveId: string;
  indicators: IndicatorPointItem[];
  resources: AssessmentResourceOption[];
  onSaved: (message: string) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  onUnauthorized: () => Promise<void>;
}) {
  const submittingRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objective, setObjective] = useState<CourseObjectiveItem | null>(null);
  const [impact, setImpact] = useState<ObjectiveImpact | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [indicatorPointId, setIndicatorPointId] = useState('');
  const [supportWeight, setSupportWeight] = useState('');
  const [links, setLinks] = useState<EditorLink[]>([]);
  const [selectedResource, setSelectedResource] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [confirmAbandonPending, setConfirmAbandonPending] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const clearPendingOperation = () => {
    setPendingOperation(null);
    setConfirmAbandonPending(false);
    onPendingChange(false);
  };

  useEffect(() => {
    if (!pendingOperation) return undefined;
    const protectBrowserExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '配置请求结果尚未确认，请先核对原请求或明确放弃。';
    };
    window.addEventListener('beforeunload', protectBrowserExit);
    return () => window.removeEventListener('beforeunload', protectBrowserExit);
  }, [pendingOperation]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) throw new Error('登录状态已失效，请重新登录');
        const response = await fetchClientRequest(`/api/obe/course-objectives/${objectiveId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS);
        const data = await response.json().catch(() => ({})) as {
          error?: string;
          objective?: CourseObjectiveItem;
          impact?: ObjectiveImpact;
        };
        if (response.status === 401) {
          await onUnauthorized();
          return;
        }
        if (!response.ok || !data.objective || !data.impact) throw new Error(data.error || '配置影响范围加载失败');
        if (controller.signal.aborted) return;
        setObjective(data.objective);
        setImpact(data.impact);
        setName(data.objective.name);
        setDescription(data.objective.description ?? '');
        setIndicatorPointId(data.objective.indicatorPoint.id);
        setSupportWeight(String(Math.round(data.objective.supportWeight * 10000) / 100));
        setLinks(data.objective.assessmentLinks.map((link) => ({
          assessmentType: link.assessmentType,
          assessmentTargetId: link.assessmentTargetId,
          chapter: link.chapter ?? null,
          description: link.resolvedDescription || link.description || link.assessmentTargetId,
          weightPercent: String(Math.round(link.weight * 10000) / 100),
          maxScore: String(link.maxScore),
        })));
        setConfirmed(false);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '配置影响范围加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [objectiveId, onUnauthorized, reloadKey]);

  const executeOperation = async (operation: PendingOperation) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setRecoveryNotice(null);
    setConfirmAbandonPending(false);
    setPendingOperation(operation);
    onPendingChange(true);
    let retrySameRequest = true;
    try {
      const token = getStoredAccessToken();
      if (!token) {
        retrySameRequest = false;
        clearPendingOperation();
        throw new Error('登录状态已失效，请重新登录');
      }
      const response = await fetchClientRequest(operation.endpoint, {
        method: operation.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(operation.body),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const data = await response.json().catch(() => ({})) as { error?: string; duplicate?: boolean };
      if (response.status === 401) {
        retrySameRequest = false;
        clearPendingOperation();
        await onUnauthorized();
        return;
      }
      if (response.ok) {
        retrySameRequest = false;
        clearPendingOperation();
        onSaved(data.duplicate ? '已恢复同一配置请求并核对服务端结果' : '课程目标配置已保存，旧达成度记录仍保留并按新版本隔离');
        return;
      }
      const retryableConflict = response.status >= 500
        || (response.status === 409 && (data.error ?? '').includes('同一请求编号'));
      retrySameRequest = retryableConflict;
      if (!retrySameRequest) clearPendingOperation();
      throw new Error(data.error || '配置保存失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '配置保存失败';
      setError(retrySameRequest
        ? `${message}。若结果尚未确认，请使用下方原请求重试，不要重复创建新操作。`
        : message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const abandonPendingOperation = () => {
    if (!pendingOperation || submitting) return;
    clearPendingOperation();
    setConfirmed(false);
    setRecoveryNotice('已明确放弃原请求，正在重新读取服务端版本。读取完成后请重新核对影响范围。');
    setReloadKey((current) => current + 1);
  };

  const submitMetadata = () => {
    if (!objective || !impact) return;
    const weight = Number(supportWeight) / 100;
    if (!name.trim() || !indicatorPointId || !Number.isFinite(weight) || weight <= 0 || weight > 1) {
      setError('请核对目标名称、指标点和 1% 至 100% 的支撑权重');
      return;
    }
    if ((objective.isActive || impact.achievementRecordCount > 0) && !confirmed) {
      setError('请先核对并确认下方影响范围');
      return;
    }
    const body = {
      requestId: makeRequestId('objective'),
      expectedVersion: objective.version,
      name: name.trim(),
      description: description.trim() || null,
      indicatorPointId,
      supportWeight: weight,
      confirm: 'APPLY_OBJECTIVE_CONFIGURATION',
    };
    void executeOperation({ kind: 'metadata', endpoint: `/api/obe/course-objectives/${objectiveId}`, method: 'PATCH', body });
  };

  const submitLinks = () => {
    if (!objective || !impact) return;
    const normalized = links.map((link) => ({
      assessmentType: link.assessmentType,
      assessmentTargetId: link.assessmentTargetId,
      chapter: link.chapter,
      weight: Number(link.weightPercent) / 100,
      maxScore: Number(link.maxScore),
    }));
    if (normalized.some((link) => !Number.isFinite(link.weight) || link.weight <= 0 || link.weight > 1 || !Number.isFinite(link.maxScore) || link.maxScore <= 0)) {
      setError('每个考核环节都必须填写有效的正权重和满分值');
      return;
    }
    const totalWeight = normalized.reduce((sum, link) => sum + link.weight, 0);
    if (totalWeight > 1 + 1e-9 || (objective.isActive && Math.abs(totalWeight - 1) > 1e-9)) {
      setError(objective.isActive ? '已启用目标的考核权重合计必须保持为 100%' : '草稿考核权重合计不能超过 100%');
      return;
    }
    if ((objective.isActive || impact.achievementRecordCount > 0) && !confirmed) {
      setError('请先核对并确认下方影响范围');
      return;
    }
    const body = {
      requestId: makeRequestId('assessment'),
      expectedVersion: objective.version,
      links: normalized,
      confirm: 'APPLY_ASSESSMENT_CONFIGURATION',
    };
    void executeOperation({ kind: 'links', endpoint: `/api/obe/course-objectives/${objectiveId}/assessment-links`, method: 'PUT', body });
  };

  const submitStatus = () => {
    if (!objective) return;
    const metadataChanged = name.trim() !== objective.name
      || (description.trim() || null) !== (objective.description ?? null)
      || indicatorPointId !== objective.indicatorPoint.id
      || Math.abs((Number(supportWeight) / 100) - objective.supportWeight) > 1e-9;
    const savedLinks = objective.assessmentLinks.map((link) => ({
      assessmentType: link.assessmentType,
      assessmentTargetId: link.assessmentTargetId,
      weight: link.weight,
      maxScore: link.maxScore,
      chapter: link.chapter ?? null,
    })).sort((left, right) => (
      left.assessmentType.localeCompare(right.assessmentType)
      || left.assessmentTargetId.localeCompare(right.assessmentTargetId)
    ));
    const draftLinks = links.map((link) => ({
      assessmentType: link.assessmentType,
      assessmentTargetId: link.assessmentTargetId,
      weight: Number(link.weightPercent) / 100,
      maxScore: Number(link.maxScore),
      chapter: link.chapter,
    })).sort((left, right) => (
      left.assessmentType.localeCompare(right.assessmentType)
      || left.assessmentTargetId.localeCompare(right.assessmentTargetId)
    ));
    if (metadataChanged || JSON.stringify(savedLinks) !== JSON.stringify(draftLinks)) {
      setError('启用或停用前请先分别保存目标信息和考核映射，避免未保存内容被误认为已生效');
      return;
    }
    const totalWeight = links.reduce((sum, link) => sum + (Number(link.weightPercent) || 0), 0);
    if (!objective.isActive && (links.length === 0 || Math.abs(totalWeight - 100) > 1e-6)) {
      setError('启用前必须先保存完整且合计 100% 的考核映射');
      return;
    }
    if (!confirmed) {
      setError('请先核对并确认下方影响范围');
      return;
    }
    const body = {
      requestId: makeRequestId(objective.isActive ? 'deactivate' : 'activate'),
      expectedVersion: objective.version,
      isActive: !objective.isActive,
      confirm: 'APPLY_OBJECTIVE_CONFIGURATION',
    };
    void executeOperation({ kind: 'status', endpoint: `/api/obe/course-objectives/${objectiveId}`, method: 'PATCH', body });
  };

  const addSelectedResource = () => {
    const resource = resources.find((item) => `${item.type}:${item.targetId}` === selectedResource);
    if (!resource) {
      setError('请先选择一个正式考核资源');
      return;
    }
    if (links.some((link) => link.assessmentType === resource.type && link.assessmentTargetId === resource.targetId)) {
      setError('该正式考核资源已在当前配置中');
      return;
    }
    setLinks((current) => [...current, {
      assessmentType: resource.type,
      assessmentTargetId: resource.targetId,
      chapter: resource.chapter,
      description: resource.description,
      weightPercent: '10',
      maxScore: '100',
    }]);
    setSelectedResource('');
    setConfirmed(false);
    setError(null);
  };

  if (loading) {
    return <div className="mt-4 flex min-h-32 items-center justify-center rounded-md border border-cyan-300/15 bg-cyan-300/[0.025] text-xs text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在读取配置版本和影响范围...</div>;
  }
  if (!objective || !impact) {
    return (
      <div className="mt-4 rounded-md border border-red-300/20 bg-red-300/[0.04] p-4">
        <p role="alert" className="text-xs text-red-200">{error || '配置影响范围加载失败'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="inline-flex h-11 items-center gap-2 rounded-md bg-white/[0.06] px-4 text-xs text-slate-200"><RefreshCcw className="h-4 w-4" />重试</button>
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center gap-2 rounded-md bg-white/[0.04] px-4 text-xs text-slate-400"><X className="h-4 w-4" />关闭</button>
        </div>
      </div>
    );
  }

  const totalWeight = links.reduce((sum, link) => sum + (Number(link.weightPercent) || 0), 0);
  const inputsLocked = submitting || pendingOperation !== null;

  return (
    <div className="mt-5 rounded-md border border-cyan-300/20 bg-[#091016] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-100"><ShieldCheck className="h-4 w-4" />受控配置 · {objective.code}</div>
          <p className="mt-1 text-xs text-slate-500">当前版本 v{objective.version}；保存成功后版本递增，旧版本计算结果不会被静默沿用。</p>
        </div>
        <button type="button" onClick={onCancel} disabled={inputsLocked} title={pendingOperation ? '请求结果待核对，不能取消编辑' : undefined} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.08] px-4 text-xs text-slate-300 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" />取消编辑</button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[10px] text-slate-600">达成度记录</div><div className="mt-1 font-mono text-lg text-slate-200">{impact.achievementRecordCount}</div></div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[10px] text-slate-600">涉及学生</div><div className="mt-1 font-mono text-lg text-slate-200">{impact.affectedStudentCount}</div></div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[10px] text-slate-600">涉及班级</div><div className="mt-1 font-mono text-lg text-slate-200">{impact.affectedClassCount}</div></div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[10px] text-slate-600">涉及学期</div><div className="mt-1 font-mono text-lg text-slate-200">{impact.affectedSemesterCount}</div></div>
      </div>
      <div className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/[0.045] p-3 text-xs text-amber-100/85">
        历史记录会保留。若配置发生变化，教师需要按新版本明确重算后，汇总与持续改进页面才会使用新结果。
        {impact.latestCalculatedAt && <span className="mt-1 block text-amber-100/60">最近一次计算：{new Date(impact.latestCalculatedAt).toLocaleString('zh-CN')}</span>}
      </div>

      <section className="mt-5 border-t border-white/[0.07] pt-5">
        <h3 className="text-sm font-medium text-slate-200">目标信息</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">目标名称<input value={name} onChange={(event) => { setName(event.target.value); setConfirmed(false); }} disabled={inputsLocked} maxLength={200} className={`${controlClassName} mt-2`} /></label>
          <label className="text-xs text-slate-400">支撑指标点<select value={indicatorPointId} onChange={(event) => { setIndicatorPointId(event.target.value); setConfirmed(false); }} disabled={inputsLocked} className={`${controlClassName} mt-2`}>{indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code} · {indicator.description}</option>)}</select></label>
          <label className="text-xs text-slate-400">支撑权重（%）<input type="number" min="1" max="100" step="0.1" value={supportWeight} onChange={(event) => { setSupportWeight(event.target.value); setConfirmed(false); }} disabled={inputsLocked} className={`${controlClassName} mt-2`} /></label>
          <label className="text-xs text-slate-400 md:col-span-2">目标说明<textarea value={description} onChange={(event) => { setDescription(event.target.value); setConfirmed(false); }} disabled={inputsLocked} maxLength={2000} rows={3} className="mt-2 w-full rounded-md border border-white/[0.1] bg-[#0a0e13] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-55" /></label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submitMetadata} disabled={submitting || pendingOperation !== null} aria-busy={submitting && pendingOperation?.kind === 'metadata'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-xs text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"><Save aria-hidden="true" className="h-4 w-4" />{submitting && pendingOperation?.kind === 'metadata' ? '正在保存目标信息…' : '保存目标信息'}</button>
        </div>
      </section>

      <section className="mt-5 border-t border-white/[0.07] pt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-slate-200">考核映射</h3>
          <span className={cn('text-xs font-mono', Math.abs(totalWeight - 100) <= 1e-6 ? 'text-emerald-200' : 'text-amber-200')}>当前合计 {totalWeight.toFixed(1)}%</span>
        </div>
        <div className="mt-3 space-y-2">
          {links.length === 0 && <div className="rounded-md border border-dashed border-white/[0.08] p-4 text-center text-xs text-slate-500">当前草稿没有考核映射</div>}
          {links.map((link, index) => (
            <div key={`${link.assessmentType}:${link.assessmentTargetId}`} className="grid gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_44px] md:items-end">
              <div className="min-w-0"><div className="truncate text-xs text-slate-300">{link.description}</div><div className="mt-1 font-mono text-[10px] text-slate-600">{TYPE_LABELS[link.assessmentType] || link.assessmentType} · {link.assessmentTargetId}</div></div>
              <label className="text-[10px] text-slate-500">权重（%）<input type="number" min="0.1" max="100" step="0.1" value={link.weightPercent} onChange={(event) => { const value = event.target.value; setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, weightPercent: value } : item)); setConfirmed(false); }} disabled={inputsLocked} className={`${controlClassName} mt-1`} /></label>
              <label className="text-[10px] text-slate-500">满分<input type="number" min="1" max="1000" step="1" value={link.maxScore} onChange={(event) => { const value = event.target.value; setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, maxScore: value } : item)); setConfirmed(false); }} disabled={inputsLocked} className={`${controlClassName} mt-1`} /></label>
              <button type="button" aria-label={`移除 ${link.description}`} onClick={() => { setLinks((current) => current.filter((_, itemIndex) => itemIndex !== index)); setConfirmed(false); }} disabled={inputsLocked} className="flex h-11 w-11 items-center justify-center rounded-md border border-red-300/15 text-red-200 hover:bg-red-300/[0.07] disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <select value={selectedResource} onChange={(event) => setSelectedResource(event.target.value)} disabled={inputsLocked} aria-label="选择正式考核资源" className={controlClassName}>
            <option value="">选择正式考核资源...</option>
            {Object.keys(TYPE_LABELS).map((type) => (
              <optgroup key={type} label={TYPE_LABELS[type]}>
                {resources.filter((resource) => resource.type === type).map((resource) => <option key={`${resource.type}:${resource.targetId}`} value={`${resource.type}:${resource.targetId}`}>{resource.description} · {resource.targetId}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={addSelectedResource} disabled={inputsLocked} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-4 text-xs text-slate-200 disabled:opacity-50"><Plus className="h-4 w-4" />添加资源</button>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submitLinks} disabled={submitting || pendingOperation !== null} aria-busy={submitting && pendingOperation?.kind === 'links'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-xs text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"><Save aria-hidden="true" className="h-4 w-4" />{submitting && pendingOperation?.kind === 'links' ? '正在保存考核映射…' : '保存考核映射'}</button>
        </div>
      </section>

      <section className="mt-5 border-t border-white/[0.07] pt-5">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-white/[0.07] bg-white/[0.025] p-3 text-xs text-slate-300">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={inputsLocked} className="mt-0.5 h-5 w-5 accent-cyan-300" />
          <span>我已核对当前版本、影响人数和历史记录保留规则，确认本次操作完成后由教师按需重新计算。</span>
        </label>
        {pendingOperation && (
          <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/[0.05] p-3 text-xs text-amber-100">
            <p>上一次请求结果尚未确认，页面已锁定输入、取消编辑和“关闭配置”。浏览器刷新或离开时也会提示保护。</p>
            <p className="mt-1 text-amber-100/70">请优先使用原请求编号核对；只有明确放弃后，系统才会解除锁定并重新读取服务端版本。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void executeOperation(pendingOperation)} disabled={submitting} aria-busy={submitting} className="inline-flex h-11 items-center gap-2 rounded-md bg-amber-200 px-4 font-medium text-slate-950 disabled:opacity-50"><RefreshCcw aria-hidden="true" className={cn('h-4 w-4', submitting && 'animate-spin')} />{submitting ? '正在核对原请求…' : '使用原请求重试'}</button>
              {!confirmAbandonPending ? (
                <button type="button" onClick={() => setConfirmAbandonPending(true)} disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-md border border-red-300/20 px-4 text-red-100 disabled:opacity-50">明确放弃原请求</button>
              ) : (
                <div role="alert" className="w-full rounded-md border border-red-300/20 bg-red-300/[0.05] p-3">
                  <p>服务端可能已经执行该请求。确认放弃后将先解除本地重试，再强制重新读取服务端版本；不要根据当前表单继续判断结果。</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setConfirmAbandonPending(false)} className="inline-flex h-11 items-center rounded-md border border-white/[0.1] px-4 text-slate-200">返回继续核对</button>
                    <button type="button" onClick={abandonPendingOperation} className="inline-flex h-11 items-center rounded-md bg-red-200 px-4 font-medium text-red-950">确认放弃并重新读取</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {recoveryNotice && <p role="status" className="mt-3 text-xs text-cyan-100">{recoveryNotice}</p>}
        {error && <p role="alert" className="mt-3 text-xs text-red-200">{error}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{objective.isActive ? '停用后不再参与新的达成度计算，但历史记录不会删除。' : '启用前会再次校验正式资源及 100% 权重。'}</p>
          <button type="button" onClick={submitStatus} disabled={submitting || pendingOperation !== null} aria-busy={submitting && pendingOperation?.kind === 'status'} className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50', objective.isActive ? 'border border-amber-300/20 bg-amber-300/[0.07] text-amber-100' : 'bg-emerald-300 text-slate-950')}>
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />{submitting && pendingOperation?.kind === 'status' ? '正在保存状态…' : objective.isActive ? '确认停用此目标' : '确认启用此目标'}
          </button>
        </div>
      </section>
    </div>
  );
}
