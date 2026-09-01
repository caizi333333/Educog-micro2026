'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Plus, Edit, Trash2, RefreshCw, User } from 'lucide-react';

interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  role: string;
  status: string;
  studentId?: string;
  teacherId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface UserListResponse {
  data?: User[];
  users?: User[];
  pagination?: { totalPages?: number };
}

interface PendingCreateMetadata {
  requestId: string;
  email: string;
  username: string;
  name: string;
  createdAt: number;
}

const ADMIN_USER_VIEW_KEY = 'admin-users:view:v1';
const ADMIN_USER_PENDING_CREATE_KEY = 'admin-users:pending-create:v1';
const PENDING_CREATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readSessionJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeSessionJson(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 浏览器禁用会话存储时，页面功能仍可继续使用。
  }
}

function removeSessionItem(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // 同上，存储不可用不应中断管理员操作。
  }
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    return data && typeof data === 'object' ? data as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function isRetryableMutationStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export default function UsersPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreateMetadata | null>(null);
  const { toast } = useToast();
  const listAbortRef = useRef<AbortController | null>(null);
  const listRequestSequenceRef = useRef(0);
  const operationLockRef = useRef(false);

  // 表单状态
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    name: '',
    role: 'STUDENT',
    studentId: '',
    teacherId: '',
    class: '',
    grade: '',
    major: '',
    department: '',
    title: ''
  });

  useEffect(() => {
    const savedView = readSessionJson<{
      search?: string;
      appliedSearch?: string;
      roleFilter?: string;
      statusFilter?: string;
      page?: number;
    }>(ADMIN_USER_VIEW_KEY);
    if (savedView) {
      setSearch(typeof savedView.search === 'string' ? savedView.search : '');
      setAppliedSearch(typeof savedView.appliedSearch === 'string' ? savedView.appliedSearch : '');
      setRoleFilter(['all', 'ADMIN', 'TEACHER', 'STUDENT'].includes(savedView.roleFilter ?? '') ? savedView.roleFilter! : 'all');
      setStatusFilter(['all', 'ACTIVE', 'INACTIVE', 'DELETED'].includes(savedView.statusFilter ?? '') ? savedView.statusFilter! : 'all');
      setPage(Number.isInteger(savedView.page) && (savedView.page ?? 0) > 0 ? savedView.page! : 1);
    }
    const savedPending = readSessionJson<PendingCreateMetadata>(ADMIN_USER_PENDING_CREATE_KEY);
    if (savedPending && Date.now() - savedPending.createdAt <= PENDING_CREATE_MAX_AGE_MS) {
      setPendingCreate(savedPending);
    } else if (savedPending) {
      removeSessionItem(ADMIN_USER_PENDING_CREATE_KEY);
    }
    setViewReady(true);
  }, []);

  useEffect(() => {
    if (!viewReady) return;
    writeSessionJson(ADMIN_USER_VIEW_KEY, { search, appliedSearch, roleFilter, statusFilter, page });
  }, [appliedSearch, page, roleFilter, search, statusFilter, viewReady]);

  // 获取用户列表：筛选变化时取消旧请求，避免旧结果覆盖新范围。
  const fetchUsers = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      listAbortRef.current?.abort();
      setUsers([]);
      setLoading(false);
      setListError('登录状态已失效，请重新登录后继续。');
      return;
    }

    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    const requestSequence = ++listRequestSequenceRef.current;
    try {
      setLoading(true);
      setListError(null);
      setUsers([]);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (appliedSearch) params.append('search', appliedSearch);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetchClientRequest(`/api/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      }, CLIENT_READ_TIMEOUT_MS);

      const data = await readJsonRecord(response) as UserListResponse & Record<string, unknown>;
      if (!response.ok) {
        const message = typeof data.error === 'string' ? data.error : '获取用户列表失败';
        if (response.status === 401) throw new Error('登录状态已失效，请重新登录后继续。');
        if (response.status === 403) throw new Error('当前账号没有用户管理权限。');
        throw new Error(message);
      }

      if (requestSequence !== listRequestSequenceRef.current) return;
      const nextTotalPages = data.pagination?.totalPages;
      const normalizedTotalPages = typeof nextTotalPages === 'number' && nextTotalPages > 0 ? nextTotalPages : 1;
      setTotalPages(normalizedTotalPages);
      if (page > normalizedTotalPages) {
        setPage(normalizedTotalPages);
        return;
      }
      setUsers(Array.isArray(data.data) ? data.data : Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (requestSequence !== listRequestSequenceRef.current) return;
      const message = error instanceof ClientRequestTimeoutError
        ? '读取用户列表超时，请检查网络后重试。'
        : error instanceof Error ? error.message : '获取用户列表失败';
      setListError(message);
    } finally {
      if (requestSequence === listRequestSequenceRef.current) setLoading(false);
    }
  }, [appliedSearch, page, roleFilter, statusFilter]);

  useEffect(() => {
    if (!viewReady || authLoading || !user || user.role !== 'ADMIN') return;
    void fetchUsers();
    return () => listAbortRef.current?.abort();
  }, [authLoading, fetchUsers, user, viewReady]);

  // 角色守卫必须放在全部 Hook 之后，否则重渲染时 Hook 数量变化会崩溃
  if (authLoading || !viewReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        正在核验管理权限…
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-md rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center">
          <AlertTriangle aria-hidden="true" className="mx-auto h-6 w-6 text-amber-200" />
          <h1 className="mt-3 text-lg font-semibold text-amber-50">需要系统管理员账号</h1>
          <p className="mt-2 text-sm leading-6 text-amber-50/75">当前账号不会读取或修改用户数据。切换账号后将返回本页。</p>
          <Link
            href="/login?from=%2Fadmin%2Fusers&reason=admin-role"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            {!user ? '前往登录' : '切换管理员账号'}
          </Link>
        </div>
      </div>
    );
  }

  const currentUserId = user.id;

  const clearPendingCreate = (): void => {
    setPendingCreate(null);
    removeSessionItem(ADMIN_USER_PENDING_CREATE_KEY);
  };

  const sendMutationWithReplay = async (url: string, init: RequestInit): Promise<Response> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetchClientRequest(url, init, CLIENT_WRITE_TIMEOUT_MS);
        const retryable = isRetryableMutationStatus(response.status);
        if (attempt === 0 && retryable) continue;
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

  const reconcileCreatedUser = async (email: string, username: string, token: string): Promise<boolean> => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '20', search: email });
      const response = await fetchClientRequest(`/api/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, CLIENT_READ_TIMEOUT_MS);
      if (!response.ok) return false;
      const data = await readJsonRecord(response) as UserListResponse;
      const candidates = Array.isArray(data.data) ? data.data : Array.isArray(data.users) ? data.users : [];
      return candidates.some((candidate) => candidate.email === email && candidate.username === username);
    } catch {
      return false;
    }
  };

  // 创建用户：同一 requestId 最多自动重放一次，服务端据此返回同一创建回执。
  const handleCreateUser = async () => {
    if (operationLockRef.current) return;
    const email = formData.email.trim();
    const username = formData.username.trim();
    const name = formData.name.trim();
    if (!email || !username || !name || formData.password.length < 6) {
      toast({
        title: '请完善账号信息',
        description: '邮箱、用户名、姓名均为必填项，初始密码至少6位。',
        variant: 'destructive'
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || username.length < 3 || username.length > 50 || name.length > 100) {
      toast({
        title: '账号信息格式不正确',
        description: '请检查邮箱格式；用户名应为3至50位，姓名不超过100个字符。',
        variant: 'destructive',
      });
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      setListError('登录状态已失效，请重新登录后继续。');
      return;
    }

    operationLockRef.current = true;
    const requestId = createRequestId();
    const pending: PendingCreateMetadata = { requestId, email, username, name, createdAt: Date.now() };
    setPendingCreate(pending);
    writeSessionJson(ADMIN_USER_PENDING_CREATE_KEY, pending);
    const requestBody = JSON.stringify({ ...formData, email, username, name, requestId });
    try {
      setSaving(true);
      const response = await sendMutationWithReplay('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: requestBody,
      });

      const responseData = await readJsonRecord(response);
      if (!response.ok) {
        if (isRetryableMutationStatus(response.status)) {
          throw new ClientRequestTimeoutError('创建请求返回临时错误');
        }
        clearPendingCreate();
        const message = typeof responseData.error === 'string' ? responseData.error : '创建用户失败';
        throw new Error(message);
      }
      if (responseData.success !== true || !responseData.user) {
        throw new ClientRequestTimeoutError('创建回执不完整');
      }

      toast({
        title: responseData.duplicate === true ? '创建结果已确认' : '用户创建成功',
        description: responseData.duplicate === true ? '此前提交已成功，本次未重复创建账号。' : `账号 ${username} 已创建。`,
      });

      clearPendingCreate();
      setShowCreateDialog(false);
      resetForm();
      await fetchUsers();
    } catch (error) {
      const ambiguous = isAmbiguousClientFailure(error)
        || (error instanceof ClientRequestTimeoutError && error.message === '创建回执不完整');
      if (ambiguous && await reconcileCreatedUser(email, username, token)) {
        toast({
          title: '创建结果已确认',
          description: `账号 ${username} 已存在于用户列表，本次未重复创建。`,
        });
        clearPendingCreate();
        setShowCreateDialog(false);
        resetForm();
        await fetchUsers();
        return;
      }
      if (ambiguous) {
        setShowCreateDialog(false);
        resetForm();
        setListError(`账号 ${username} 的创建结果暂时无法确认，请使用下方“核对待确认账号”按邮箱复核。`);
        toast({
          title: '创建结果待确认',
          description: '系统没有重复提交第三次，已保留不含密码的核对信息。',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建用户失败',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      operationLockRef.current = false;
    }
  };

  // 更新用户
  const handleUpdateUser = async () => {
    if (!editingUser || operationLockRef.current) return;
    const email = formData.email.trim();
    const username = formData.username.trim();
    const name = formData.name.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || username.length < 3 || username.length > 50 || !name || name.length > 100) {
      toast({
        title: '账号信息格式不正确',
        description: '请检查邮箱、用户名和姓名后再保存。',
        variant: 'destructive',
      });
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      setListError('登录状态已失效，请重新登录后继续。');
      return;
    }

    operationLockRef.current = true;
    const requestBody = JSON.stringify({
      email,
      username,
      name,
      role: formData.role,
      studentId: formData.role === 'STUDENT' ? formData.studentId.trim() || null : null,
      teacherId: formData.role === 'TEACHER' ? formData.teacherId.trim() || null : null,
    });

    try {
      setSaving(true);
      const response = await fetchClientRequest(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: requestBody,
      }, CLIENT_WRITE_TIMEOUT_MS);

      const responseData = await readJsonRecord(response);
      if (!response.ok) {
        throw new Error(typeof responseData.error === 'string' ? responseData.error : '更新用户失败');
      }

      if (responseData.reauthenticationRequired === true) {
        toast({
          title: '账号凭据已更新',
          description: '当前登录状态已失效，请使用更新后的账号信息重新登录。',
        });
        setEditingUser(null);
        resetForm();
        await logout();
        return;
      }

      toast({
        title: '用户更新成功',
        description: `账号 ${editingUser.username} 的资料已保存。`,
      });

      setEditingUser(null);
      resetForm();
      await fetchUsers();
    } catch (error) {
      if (isAmbiguousClientFailure(error)) {
        setEditingUser(null);
        resetForm();
        await fetchUsers();
        setListError(`账号 ${editingUser.username} 的更新结果暂时无法确认，列表已重新读取，请核对后再操作。`);
        return;
      }
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新用户失败',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      operationLockRef.current = false;
    }
  };

  // 删除用户：服务端软删除具备重复回执，网络异常时可安全重放同一请求一次。
  const handleDeleteUser = async () => {
    if (!deleteTarget || operationLockRef.current) return;
    const token = getStoredAccessToken();
    if (!token) {
      setListError('登录状态已失效，请重新登录后继续。');
      return;
    }

    operationLockRef.current = true;
    try {
      setDeleting(true);
      const response = await sendMutationWithReplay(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const responseData = await readJsonRecord(response);
      if (!response.ok) {
        throw new Error(typeof responseData.error === 'string' ? responseData.error : '删除用户失败');
      }

      toast({
        title: responseData.duplicate === true ? '删除状态已确认' : '用户已删除',
        description: responseData.duplicate === true ? '该账号此前已删除，本次没有重复执行。' : `账号 ${deleteTarget.username} 已软删除并退出登录。`,
      });

      setDeleteTarget(null);
      await fetchUsers();
    } catch (error) {
      if (isAmbiguousClientFailure(error)) {
        setDeleteTarget(null);
        await fetchUsers();
        setListError(`账号 ${deleteTarget.username} 的删除结果暂时无法确认，请刷新列表核对账号状态。`);
        return;
      }
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除用户失败',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      operationLockRef.current = false;
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      name: '',
      role: 'STUDENT',
      studentId: '',
      teacherId: '',
      class: '',
      grade: '',
      major: '',
      department: '',
      title: ''
    });
  };

  // 编辑用户
  const startEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      password: '',
      name: user.name || '',
      role: user.role,
      studentId: user.studentId || '',
      teacherId: user.teacherId || '',
      class: '',
      grade: '',
      major: '',
      department: '',
      title: ''
    });
  };

  const getRoleBadge = (role: string) => {
    const roleMap = {
      ADMIN: { label: '管理员', variant: 'destructive' as const },
      TEACHER: { label: '教师', variant: 'default' as const },
      STUDENT: { label: '学生', variant: 'secondary' as const },
      GUEST: { label: '访客', variant: 'outline' as const }
    };
    const { label, variant } = roleMap[role as keyof typeof roleMap] || { label: role, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      ACTIVE: { label: '激活', variant: 'default' as const },
      INACTIVE: { label: '未激活', variant: 'secondary' as const },
      SUSPENDED: { label: '暂停', variant: 'destructive' as const },
      DELETED: { label: '已删除', variant: 'outline' as const }
    };
    const { label, variant } = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              用户管理
            </span>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setShowCreateDialog(true)}
              disabled={saving || deleting || pendingCreate !== null}
            >
              <Plus aria-hidden="true" className="h-4 w-4 mr-2" />
              新建用户
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listError && (
            <div
              className="mb-4 flex flex-col gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <span>{listError}</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => void fetchUsers()} disabled={loading}>
                  重新读取
                </Button>
                {listError.includes('登录状态') && (
                  <Button type="button" className="min-h-11" onClick={() => router.push('/login?from=%2Fadmin%2Fusers')}>
                    重新登录
                  </Button>
                )}
              </div>
            </div>
          )}

          {pendingCreate && (
            <div className="mb-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm" role="status">
              <p className="font-medium text-amber-100">存在一笔待核对的账号创建请求</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingCreate.name} · {pendingCreate.username} · {pendingCreate.email}。未保存初始密码，也不会自动发起第三次创建。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => {
                    setSearch(pendingCreate.email);
                    setAppliedSearch(pendingCreate.email);
                    setPage(1);
                  }}
                >
                  核对待确认账号
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={clearPendingCreate}>
                  已人工核对，解除锁定
                </Button>
              </div>
            </div>
          )}

          {/* 筛选栏 */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索用户名、邮箱、姓名..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPage(1);
                      setAppliedSearch(search.trim());
                    }
                  }}
                  className="min-h-11 pl-10"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full md:w-auto"
              onClick={() => {
                setPage(1);
                setAppliedSearch(search.trim());
              }}
            >
              查询
            </Button>
            <Select value={roleFilter} onValueChange={(value) => { setPage(1); setRoleFilter(value); }}>
              <SelectTrigger className="min-h-11 w-full md:w-36">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="ADMIN">管理员</SelectItem>
                <SelectItem value="TEACHER">教师</SelectItem>
                <SelectItem value="STUDENT">学生</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setPage(1); setStatusFilter(value); }}>
              <SelectTrigger className="min-h-11 w-full md:w-36">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">激活</SelectItem>
                <SelectItem value="INACTIVE">未激活</SelectItem>
                <SelectItem value="DELETED">已删除</SelectItem>
              </SelectContent>
            </Select>
            <Button className="min-h-11 min-w-11 w-full md:w-auto" onClick={() => void fetchUsers()} variant="outline" aria-label="刷新用户列表" title="刷新用户列表" disabled={loading} aria-busy={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="md:sr-only">{loading ? '正在刷新…' : '刷新'}</span>
            </Button>
          </div>

          {/* 用户列表：桌面保持表格语义，移动端原位重排为信息卡，避免横向滚动。 */}
          <div className="rounded-lg border border-border/60" aria-busy={loading}>
          <Table className="block md:table">
            <TableHeader className="hidden md:table-header-group">
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>学号/工号</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="block space-y-3 p-3 md:table-row-group md:space-y-0 md:p-0">
              {loading ? (
                <TableRow className="block border-0 md:table-row md:border-b">
                  <TableCell colSpan={8} className="block h-28 text-center md:table-cell" role="status" aria-live="polite">
                    <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />正在读取用户列表…</span>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow className="block border-0 md:table-row md:border-b">
                  <TableCell colSpan={8} className="block h-28 text-center text-muted-foreground md:table-cell">
                    当前筛选范围内暂无用户。
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="block rounded-md border bg-card p-3 md:table-row md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:p-0">
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">用户名</span>
                      <span className="break-all text-right font-mono text-xs md:text-left">{user.username}</span>
                    </TableCell>
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">邮箱</span>
                      <span className="min-w-0 break-all text-right text-xs md:text-left">{user.email}</span>
                    </TableCell>
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">姓名</span>
                      <span className="text-right md:text-left">{user.name || '-'}</span>
                    </TableCell>
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">角色</span>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">状态</span>
                      {getStatusBadge(user.status)}
                    </TableCell>
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">学号/工号</span>
                      <span className="font-mono text-xs">{user.studentId || user.teacherId || '-'}</span>
                    </TableCell>
                    <TableCell className="flex items-center justify-between gap-4 px-0 py-1.5 md:table-cell md:p-4">
                      <span className="text-xs text-muted-foreground md:hidden">注册时间</span>
                      <span className="text-xs">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell className="mt-2 block border-t px-0 pb-0 pt-3 md:mt-0 md:table-cell md:border-t-0 md:p-4">
                      <div className="flex justify-end gap-2 md:justify-start">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-11 flex-1 md:flex-none"
                          onClick={() => startEditUser(user)}
                          disabled={saving || deleting || user.status === 'DELETED'}
                          aria-label={`编辑 ${user.name || user.username}`}
                          title={`编辑 ${user.name || user.username}`}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="md:sr-only">编辑</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-11 flex-1 md:flex-none"
                          onClick={() => setDeleteTarget(user)}
                          disabled={saving || deleting || user.id === currentUserId || user.status === 'DELETED'}
                          aria-label={`删除 ${user.name || user.username}`}
                          title={user.id === currentUserId ? '不能删除当前登录账号' : `删除 ${user.name || user.username}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="md:sr-only">删除</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={page === 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="flex items-center px-4">
                第 {page} / {totalPages} 页
              </span>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={page === totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑用户对话框 */}
      <Dialog open={showCreateDialog || !!editingUser} onOpenChange={(open) => {
        if (saving) return;
        if (!open) {
          setShowCreateDialog(false);
          setEditingUser(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]" aria-describedby="user-form-purpose">
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑用户' : '创建用户'}</DialogTitle>
            <p id="user-form-purpose" className="text-sm text-muted-foreground">
              {editingUser ? '保存后立即影响该账号的登录角色与可访问范围。' : '创建成功后，用户可使用此处设置的初始密码登录。'}
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="email" className="text-left sm:text-right">邮箱</Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="min-h-11 sm:col-span-3"
                inputMode="email"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="username" className="text-left sm:text-right">用户名</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="min-h-11 sm:col-span-3"
                autoComplete="off"
              />
            </div>
            {!editingUser && (
              <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="password" className="text-left sm:text-right">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="min-h-11 sm:col-span-3"
                  placeholder="至少6位，由管理员明确设置"
                  minLength={6}
                  required
                />
              </div>
            )}
            <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="name" className="text-left sm:text-right">姓名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="min-h-11 sm:col-span-3"
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="role" className="text-left sm:text-right">角色</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={editingUser?.id === currentUserId}
              >
                <SelectTrigger className="min-h-11 sm:col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  <SelectItem value="TEACHER">教师</SelectItem>
                  <SelectItem value="STUDENT">学生</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.role === 'STUDENT' && (
              <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="studentId" className="text-left sm:text-right">学号</Label>
                <Input
                  id="studentId"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="min-h-11 sm:col-span-3"
                />
              </div>
            )}
            {formData.role === 'TEACHER' && (
              <div className="grid gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="teacherId" className="text-left sm:text-right">工号</Label>
                <Input
                  id="teacherId"
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="min-h-11 sm:col-span-3"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => {
                setShowCreateDialog(false);
                setEditingUser(null);
                resetForm();
              }}
            >
              取消
            </Button>
            <Button
              className="min-h-11"
              onClick={editingUser ? handleUpdateUser : handleCreateUser}
              disabled={saving || (!editingUser && (
                !formData.email.trim()
                || !formData.username.trim()
                || !formData.name.trim()
                || formData.password.length < 6
              ))}
            >
              {saving ? '提交中…' : editingUser ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open && !deleting) setDeleteTarget(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认软删除用户账号</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `将删除 ${deleteTarget.name || deleteTarget.username}（${deleteTarget.email}）的登录会话，并从有效班级名单中移除。学习记录不会删除。`
                : '请确认删除范围。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            教师仍负责有效班级、或删除会导致平台没有可用管理员时，系统会拒绝执行。
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
            >
              {deleting ? '正在删除…' : '确认软删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
