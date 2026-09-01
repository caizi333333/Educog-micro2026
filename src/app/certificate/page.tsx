'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Database,
  File,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
} from '@/lib/client-fetch';

const persistedCertificateSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  courseScore: z.number().finite().nullable().optional(),
  examScore: z.number().finite().nullable().optional(),
  totalScore: z.number().finite(),
  certificateNo: z.string().min(1),
  issuedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'invalid issuedAt'),
  expiresAt: z.string().nullable().optional(),
  awardScope: z.string().min(1),
  criteria: z.string().nullable(),
});

const certificateResponseSchema = z.object({
  success: z.literal(true),
  dataProvenance: z.object({
    mode: z.enum(['DEMO', 'REAL', 'MIXED']),
    label: z.string().min(1),
    note: z.string().min(1),
  }),
  asOf: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'invalid asOf'),
  profile: z.object({
    name: z.string().min(1),
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
  }),
  certificates: z.array(persistedCertificateSchema),
});

type CertificateResponse = z.infer<typeof certificateResponseSchema>;

const ROLE_LABELS: Record<CertificateResponse['profile']['role'], string> = {
  STUDENT: '学生账号',
  TEACHER: '教师账号',
  ADMIN: '管理员账号',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}

function scoreLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function CertificateLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6" role="status" aria-live="polite">
      <div className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
        <div className="border-b border-white/[0.08] p-6 md:p-10">
          <Skeleton className="h-6 w-40 bg-white/[0.08]" />
          <Skeleton className="mt-5 h-10 w-3/4 bg-white/[0.08]" />
          <Skeleton className="mt-3 h-5 w-56 bg-white/[0.08]" />
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 md:p-10">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-24 bg-white/[0.08]" />
          ))}
        </div>
      </div>
      <span className="sr-only">正在核对服务端证书记录</span>
    </div>
  );
}

export default function CertificatePage(): React.JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<CertificateResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [returnHref, setReturnHref] = useState('/certificate');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (window.location.pathname.startsWith('/certificate')) {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'STUDENT') {
      setData(null);
      setSelectedId(null);
      setError(null);
      setLoginRequired(false);
      setAccessErrorStatus(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();

    async function loadCertificates(): Promise<void> {
      setLoading(true);
      setError(null);
      setLoginRequired(false);
      setAccessErrorStatus(null);
      setData(null);

      const token = getStoredAccessToken();
      if (!token) {
        setLoginRequired(true);
        setAccessErrorStatus(401);
        setError('未检测到有效登录凭据，请重新登录后核对证书记录。');
        setLoading(false);
        return;
      }

      try {
        const response = await fetchClientRequest('/api/certificates', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS);
        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = payload && typeof payload === 'object'
            && typeof (payload as Record<string, unknown>).message === 'string'
            ? String((payload as Record<string, unknown>).message)
            : `证书记录读取失败（${response.status}）`;
          if (response.status === 401 || response.status === 403) {
            setLoginRequired(true);
            setAccessErrorStatus(response.status);
          }
          throw new Error(message);
        }

        const parsed = certificateResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error('证书记录格式异常，已停止展示，请重试或联系管理员。');
        }
        if (parsed.data.profile.role !== 'STUDENT') {
          throw new Error('证书记录的授予对象与当前学生账号不匹配，已停止展示。');
        }

        if (controller.signal.aborted) return;
        setData(parsed.data);
        setAccessErrorStatus(null);
        setSelectedId((current) => (
          current && parsed.data.certificates.some((item) => item.id === current)
            ? current
            : parsed.data.certificates[0]?.id ?? null
        ));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof ClientRequestTimeoutError
          ? '证书记录读取超时，请检查网络后重试。'
          : loadError instanceof Error ? loadError.message : '证书记录读取失败，请重试。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCertificates();
    return () => controller.abort();
  }, [authLoading, reloadToken, user]);

  if (authLoading) return <CertificateLoading />;

  const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}${accessErrorStatus === 403 ? '&reason=student-role' : ''}`;

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 py-10 text-slate-100 sm:-m-6">
        <section className="w-full max-w-lg rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <ShieldCheck className="mx-auto h-7 w-7 text-cyan-200" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-slate-50">登录后核对个人证书</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">登录成功后将返回当前地址，本页仅展示服务端已颁发记录。</p>
          <Link href={loginRecoveryHref} className="mt-5 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">前往登录</Link>
        </section>
      </div>
    );
  }

  if (user.role !== 'STUDENT') {
    const destination = user.role === 'TEACHER' ? '/teacher' : '/admin';
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 py-10 text-slate-100 sm:-m-6">
        <section className="w-full max-w-lg rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-6 text-center">
          <ShieldCheck className="mx-auto h-7 w-7 text-amber-200" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-amber-100">该页仅展示学生个人证书</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">教师和管理员账号不会读取、推断或临时生成学生证明。</p>
          <Link href={destination} className="mt-5 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
            {user.role === 'TEACHER' ? '返回教学仪表板' : '返回管理端'}
          </Link>
        </section>
      </div>
    );
  }

  if (loading) return <CertificateLoading />;

  if (error) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 py-10 text-slate-100 sm:-m-6">
        <section className="w-full max-w-lg rounded-md border border-red-300/20 bg-red-300/[0.055] p-6 text-center" aria-labelledby="certificate-error-title">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-red-300/20 bg-red-300/[0.08]">
            <AlertCircle className="h-6 w-6 text-red-200" aria-hidden="true" />
          </span>
          <h1 id="certificate-error-title" className="mt-4 text-xl font-semibold text-slate-50">证书记录暂不可用</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{error}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">读取失败时不会根据学习统计临时生成证明。</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {loginRequired ? (
              <Link href={loginRecoveryHref} className="inline-flex min-h-11 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
                {accessErrorStatus === 403 ? '切换学生账号' : '重新登录'}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setReloadToken((value) => value + 1)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                重新读取
              </button>
            )}
            <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回课程
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!data || data.certificates.length === 0) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 py-10 text-slate-100 sm:-m-6">
        <section className="w-full max-w-xl rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center md:p-8" aria-labelledby="certificate-empty-title">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/[0.08]">
            <Database className="h-7 w-7 text-amber-200" aria-hidden="true" />
          </span>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Persisted records · 0</div>
          <h1 id="certificate-empty-title" className="mt-2 text-2xl font-semibold text-slate-50">尚未获得学习证明</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
            当前{data ? ROLE_LABELS[data.profile.role] : '账号'}没有服务端已颁发的证书记录。本页不会依据学习时长、最高分或账号角色临时生成证明。
          </p>
          {data && (
            <div role="note" className="mx-auto mt-4 max-w-md rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-left text-xs leading-5 text-amber-100">
              <span className="font-semibold">{data.dataProvenance.label}：</span>{data.dataProvenance.note}
            </div>
          )}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              返回课程学习
            </Link>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              重新核对
            </button>
          </div>
        </section>
      </div>
    );
  }

  const certificate = data.certificates.find((item) => item.id === selectedId) ?? data.certificates[0];

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <header className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              已颁发 · 服务端持久化记录
            </div>
            <h1 id="certificate-page-title" className="mt-3 text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">学习证明</h1>
            <p className="mt-1 text-sm text-slate-400">仅展示数据库中已存在的证书，不从学习统计推断授予结果。</p>
          </div>
          {data.certificates.length > 1 && (
            <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
              选择已颁发记录
              <select
                value={certificate.id}
                onChange={(event) => setSelectedId(event.target.value)}
                className="min-h-11 max-w-full rounded-md border border-white/[0.1] bg-[#111820] px-3 text-sm text-slate-100"
              >
                {data.certificates.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {formatDate(item.issuedAt)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <section aria-labelledby="certificate-page-title" className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div
          role="note"
          className={`mb-5 rounded-md border px-4 py-3 text-xs leading-5 ${data.dataProvenance.mode === 'REAL'
            ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'
            : 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100'}`}
        >
          <div><span className="font-semibold">{data.dataProvenance.label}：</span>{data.dataProvenance.note}</div>
          <div className="mt-1 opacity-70">记录核对截至 {new Date(data.asOf).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}</div>
        </div>
        <article className="relative overflow-hidden rounded-md border border-amber-200/20 bg-[#0d1218] shadow-[0_24px_80px_rgba(0,0,0,0.34)]" aria-labelledby="persisted-certificate-name">
          <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-amber-200/10" />
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-cyan-200/10" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />
          </div>

          <div className="relative border-b border-white/[0.08] p-6 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/75">Certificate of learning</div>
                <h2 id="persisted-certificate-name" className="mt-3 text-2xl font-semibold leading-tight text-slate-50 md:text-4xl">{certificate.name}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  兹确认 <strong className="font-semibold text-slate-100">{data.profile.name}</strong> 名下存在以下已颁发记录；展示内容与服务端持久化记录一致。
                </p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-amber-200/20 bg-amber-200/[0.08]">
                <Star className="h-8 w-8 text-amber-200" aria-hidden="true" />
              </span>
            </div>
          </div>

          <div className="relative grid gap-px bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">
            <CertificateField icon={File} label="授予范围" value={certificate.awardScope} />
            <CertificateField icon={Calendar} label="颁发日期" value={formatDate(certificate.issuedAt)} />
            <CertificateField icon={KeyRound} label="证书编号" value={certificate.certificateNo} mono />
            <CertificateField icon={ShieldCheck} label="判定条件" value={certificate.criteria ?? '该颁发记录未登记判定条件，不作推断。'} />
            <CertificateField icon={Database} label="持久化记录 ID" value={certificate.id} mono />
            <CertificateField icon={Star} label="记录类型" value={certificate.type} mono />
          </div>

          <div className="relative border-t border-white/[0.08] p-6 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <RecordedMetric label="记录总分" value={scoreLabel(certificate.totalScore)} />
              {certificate.courseScore !== null && certificate.courseScore !== undefined && (
                <RecordedMetric label="课程成绩" value={scoreLabel(certificate.courseScore)} />
              )}
              {certificate.examScore !== null && certificate.examScore !== undefined && (
                <RecordedMetric label="考核成绩" value={scoreLabel(certificate.examScore)} />
              )}
              {certificate.expiresAt && (
                <RecordedMetric label="有效期至" value={formatDate(certificate.expiresAt)} />
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">以上数值仅复现颁发记录，不在本页重新计算资格或教学成效。</p>
          </div>
        </article>

        <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">当前共核对到 {data.certificates.length} 条已颁发记录。</p>
          <Link href="/profile" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回个人主页
          </Link>
        </div>
      </section>
    </div>
  );
}

function CertificateField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-h-32 bg-[#0d1218] p-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
        {label}
      </div>
      <p className={`mt-3 break-words text-sm leading-6 text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

function RecordedMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/20 px-4 py-3">
      <div className="font-mono text-lg font-semibold text-amber-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
