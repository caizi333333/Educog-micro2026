'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellOff, Database, KeyRound, Palette, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';

const EXPORT_ENDPOINTS = [
  { key: 'profile', url: '/api/user/profile' },
  { key: 'stats', url: '/api/user/stats' },
  { key: 'progress', url: '/api/user/progress' },
  { key: 'activities', url: '/api/user/activities?limit=100' },
] as const;

type PasswordField = 'old' | 'new' | 'confirm' | 'form';

function passwordByteLength(value: string): number {
  return new Blob([value]).size;
}

function currentSettingsPath(): string {
  if (typeof window === 'undefined') return '/settings';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function settingsLoginHref(returnPath: string): string {
  return `/login?from=${encodeURIComponent(returnPath)}`;
}

export default function SettingsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordErrorField, setPasswordErrorField] = useState<PasswordField | null>(null);
  const [returnPath, setReturnPath] = useState('/settings');
  const accountActionLockRef = useRef(false);
  const oldPasswordRef = useRef<HTMLInputElement | null>(null);
  const newPasswordRef = useRef<HTMLInputElement | null>(null);
  const confirmPasswordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const updateReturnPath = (): void => setReturnPath(currentSettingsPath());
    updateReturnPath();
    window.addEventListener('hashchange', updateReturnPath);
    return (): void => window.removeEventListener('hashchange', updateReturnPath);
  }, []);

  const logoutToRecovery = async (): Promise<void> => {
    const href = settingsLoginHref(currentSettingsPath());
    await logout();
    router.replace(href);
  };

  const clearPasswordError = (): void => {
    setPasswordError(null);
    setPasswordErrorField(null);
  };

  const showPasswordValidation = (
    message: string,
    field: Exclude<PasswordField, 'form'>,
    input: HTMLInputElement | null,
    description?: string,
  ): void => {
    setPasswordError(message);
    setPasswordErrorField(field);
    toast({ title: message, ...(description ? { description } : {}), variant: 'destructive' });
    input?.focus();
  };

  const handleExportData = async (): Promise<void> => {
    if (accountActionLockRef.current) return;
    accountActionLockRef.current = true;
    setExporting(true);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        toast({ title: '登录状态已失效', description: '请重新登录后再导出数据。', variant: 'destructive' });
        await logoutToRecovery();
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const responses = await Promise.all(EXPORT_ENDPOINTS.map((item) => (
        fetchClientRequest(item.url, { headers }, CLIENT_READ_TIMEOUT_MS)
      )));
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) {
        const failed = responses[failedIndex];
        if (failed.status === 401 || failed.status === 403) {
          toast({ title: '登录状态已失效', description: '本次未生成不完整的数据文件，请重新登录。', variant: 'destructive' });
          await logoutToRecovery();
          return;
        }
        throw new Error(`数据读取失败（${failed.status}）`);
      }

      const values = await Promise.all(responses.map((response) => response.json()));
      const exportedData = Object.fromEntries(EXPORT_ENDPOINTS.map((item, index) => [item.key, values[index]]));
      const payload = {
        exportedAt: new Date().toISOString(),
        scope: ['profile', 'stats', 'progress', 'latest-100-activities'],
        ...exportedData,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `educog-data-${user?.username ?? 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: '数据已导出', description: '文件包含档案、统计、学习进度和最近100条活动记录。' });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '请检查网络后重试。',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
      accountActionLockRef.current = false;
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (accountActionLockRef.current) return;
    accountActionLockRef.current = true;
    try {
      if (!oldPassword || !newPassword || !confirmPassword) {
        const input = !oldPassword ? oldPasswordRef.current : !newPassword ? newPasswordRef.current : confirmPasswordRef.current;
        const field = !oldPassword ? 'old' : !newPassword ? 'new' : 'confirm';
        showPasswordValidation('请填写所有密码字段', field, input);
        return;
      }
      if (newPassword !== confirmPassword) {
        showPasswordValidation('两次输入的新密码不一致', 'confirm', confirmPasswordRef.current);
        return;
      }
      if (newPassword.length < 6) {
        showPasswordValidation('新密码长度至少为6位', 'new', newPasswordRef.current);
        return;
      }
      if (passwordByteLength(newPassword) > 72) {
        showPasswordValidation('新密码不能超过72字节', 'new', newPasswordRef.current, '中文字符通常占3字节。');
        return;
      }
      if (oldPassword === newPassword) {
        showPasswordValidation('新密码不能与当前密码相同', 'new', newPasswordRef.current);
        return;
      }

      const token = getStoredAccessToken();
      if (!token) {
        setPasswordError('登录状态已失效，请重新登录后再修改密码。');
        setPasswordErrorField('form');
        toast({ title: '登录状态已失效', description: '请重新登录后再修改密码。', variant: 'destructive' });
        await logoutToRecovery();
        return;
      }

      setChanging(true);
      clearPasswordError();
      const response = await fetchClientRequest('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const data: unknown = await response.json().catch(() => ({}));
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setPasswordError('登录状态已失效，请重新登录后再修改密码。');
          setPasswordErrorField('form');
          toast({ title: '登录状态已失效', description: '请重新登录后再修改密码。', variant: 'destructive' });
          await logoutToRecovery();
          return;
        }
        const message = typeof record.error === 'string' ? record.error : '修改密码失败';
        setPasswordError(message);
        setPasswordErrorField('form');
        toast({ title: message, variant: 'destructive' });
        return;
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      clearPasswordError();
      toast({ title: '密码已修改', description: '旧登录状态均已失效，请使用新密码重新登录。' });
      await logoutToRecovery();
    } catch (error) {
      if (isAmbiguousClientFailure(error)) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast({
          title: '修改结果暂时无法确认',
          description: '为避免继续使用可能失效的状态，平台将退出登录。请先用新密码登录；若失败，再使用原密码。',
          variant: 'destructive',
        });
        await logoutToRecovery();
      } else {
        setPasswordError('修改密码失败，请稍后重试。');
        setPasswordErrorField('form');
        toast({ title: '修改密码失败', description: '请稍后重试。', variant: 'destructive' });
      }
    } finally {
      setChanging(false);
      accountActionLockRef.current = false;
    }
  };

  if (authLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">正在核验账号状态…</div>;
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-5 pb-4 sm:space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Account control</p>
        <h1 className="mt-2 text-2xl font-semibold">账户与平台设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">仅展示当前真实生效的配置和可验证操作。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-5 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-cyan-300" />界面主题</CardTitle>
            <CardDescription>平台当前统一使用深色教学界面。</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6"><span className="inline-flex min-h-8 items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs text-cyan-100">深色主题 · 已生效</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-5 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base"><BellOff className="h-4 w-4 text-amber-300" />邮件通知</CardTitle>
            <CardDescription>当前未接入外部邮件发送服务，避免显示无效开关。</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6"><span className="inline-flex min-h-8 items-center rounded-full border border-amber-300/20 bg-amber-300/10 px-3 text-xs text-amber-100">未启用</span></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-5 sm:p-6">
          <CardTitle>数据管理</CardTitle>
          <CardDescription>导出当前账户档案、统计、学习进度和最近100条活动记录。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">导出账户数据</p>
              <p className="mt-1 text-xs text-muted-foreground">任一数据源读取失败时不会生成不完整文件。</p>
            </div>
            <Button className="min-h-11 w-full sm:w-auto" variant="secondary" onClick={handleExportData} disabled={exporting || changing || !user} aria-busy={exporting}>
              <Database className="mr-2 h-4 w-4" />{exporting ? '正在读取四类数据…' : '导出数据'}
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div id="account-removal-note">
              <p className="text-sm font-medium">账户停用</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">为保护课程任务和学习记录，平台不提供自助永久删除。请联系管理员核对班级、教学任务和历史记录后执行软删除。</p>
            </div>
            <Button className="min-h-11 w-full sm:w-auto" variant="outline" disabled aria-describedby="account-removal-note">
              <ShieldCheck className="mr-2 h-4 w-4" />需管理员核对
            </Button>
          </div>
        </CardContent>
      </Card>

      {user ? (
        <Card>
          <CardHeader className="p-5 sm:p-6">
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />修改密码</CardTitle>
            <CardDescription>修改成功后，当前设备及其他设备的旧登录状态都会失效。</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            <form className="space-y-4" onSubmit={handleChangePassword} aria-busy={changing}>
              {passwordError && (
                <div id="password-form-error" role="alert" aria-live="assertive" className="rounded-md border border-red-400/30 bg-red-400/[0.08] px-3 py-2 text-sm leading-5 text-red-200">
                  {passwordError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="old-password">当前密码</Label>
                <Input ref={oldPasswordRef} id="old-password" className="min-h-11" type="password" autoComplete="current-password" value={oldPassword} onChange={(event) => { setOldPassword(event.target.value); clearPasswordError(); }} placeholder="输入当前密码" disabled={changing || exporting} aria-invalid={passwordErrorField === 'old'} aria-describedby={passwordErrorField === 'old' ? 'password-form-error' : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input ref={newPasswordRef} id="new-password" className="min-h-11" type="password" autoComplete="new-password" maxLength={128} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); clearPasswordError(); }} placeholder="至少6位，最多72字节" disabled={changing || exporting} aria-invalid={passwordErrorField === 'new'} aria-describedby={passwordErrorField === 'new' ? 'new-password-help password-form-error' : 'new-password-help'} />
                <p id="new-password-help" className="text-xs leading-5 text-muted-foreground">至少 6 位，按 UTF-8 计算不超过 72 字节；不能与当前密码相同。</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input ref={confirmPasswordRef} id="confirm-password" className="min-h-11" type="password" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearPasswordError(); }} placeholder="再次输入新密码" disabled={changing || exporting} aria-invalid={passwordErrorField === 'confirm'} aria-describedby={passwordErrorField === 'confirm' ? 'password-form-error' : undefined} />
              </div>
              <Button className="min-h-11 w-full sm:w-auto" type="submit" disabled={changing || exporting} aria-busy={changing}>{changing ? '正在修改并撤销旧登录…' : '修改密码'}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
            <span>请重新登录后管理账户设置。</span>
            <Button asChild className="min-h-11 w-full sm:w-auto"><Link href={settingsLoginHref(returnPath)}>前往登录</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
