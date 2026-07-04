
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Database, Trash2, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changing, setChanging] = useState(false);
    const [exporting, setExporting] = useState(false);

    const handleExportData = async () => {
        setExporting(true);
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                toast({ title: '请先登录', variant: 'destructive' });
                return;
            }
            const headers = { Authorization: `Bearer ${token}` };
            const [profileRes, statsRes, progressRes, activitiesRes] = await Promise.all([
                fetch('/api/user/profile', { headers }),
                fetch('/api/user/stats', { headers }),
                fetch('/api/user/progress', { headers }),
                fetch('/api/user/activities?limit=100', { headers }),
            ]);
            const [profile, stats, progress, activities] = await Promise.all([
                profileRes.ok ? profileRes.json() : null,
                statsRes.ok ? statsRes.json() : null,
                progressRes.ok ? progressRes.json() : null,
                activitiesRes.ok ? activitiesRes.json() : null,
            ]);
            const payload = {
                exportedAt: new Date().toISOString(),
                profile,
                stats,
                progress,
                activities,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `educog-data-${user?.username || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast({ title: '数据已导出' });
        } catch {
            toast({ title: '导出失败，请稍后重试', variant: 'destructive' });
        } finally {
            setExporting(false);
        }
    };

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            toast({ title: '请填写所有密码字段', variant: 'destructive' });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: '两次输入的新密码不一致', variant: 'destructive' });
            return;
        }
        if (newPassword.length < 6) {
            toast({ title: '新密码长度至少为6位', variant: 'destructive' });
            return;
        }
        setChanging(true);
        try {
            const token = localStorage.getItem('accessToken');
            const res = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ oldPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast({ title: data.error || '修改密码失败', variant: 'destructive' });
                return;
            }
            toast({ title: '密码修改成功，请重新登录' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            toast({ title: '网络错误，请稍后重试', variant: 'destructive' });
        } finally {
            setChanging(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>外观</CardTitle>
                    <CardDescription>自定义平台的外观和感觉。</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="theme-mode" className="flex flex-col space-y-1">
                            <span>主题模式</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                选择亮色或暗色主题。
                            </span>
                        </Label>
                         <div className="flex items-center gap-2">
                             <Sun className="h-5 w-5" />
                            <Switch id="theme-mode" defaultChecked={true} />
                            <Moon className="h-5 w-5" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>通知</CardTitle>
                    <CardDescription>管理您希望如何收到通知。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                     <div className="flex items-center justify-between space-x-4">
                        <Label htmlFor="recommendation-emails" className="flex flex-col space-y-1">
                            <span>学习建议邮件</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                当有新的个性化学习建议时，接收邮件通知。
                            </span>
                        </Label>
                        <Switch id="recommendation-emails" defaultChecked={true} />
                    </div>
                    <Separator />
                     <div className="flex items-center justify-between space-x-4">
                        <Label htmlFor="progress-report-emails" className="flex flex-col space-y-1">
                            <span>每周进度报告</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                每周接收一份包含您学习进度的总结邮件。
                            </span>
                        </Label>
                        <Switch id="progress-report-emails" />
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>数据管理</CardTitle>
                    <CardDescription>管理您的账户数据。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex flex-col space-y-1">
                            <span>导出您的数据</span>
                             <span className="font-normal leading-snug text-muted-foreground">
                                将您的所有学习数据导出为JSON文件。
                            </span>
                        </Label>
                         <Button variant="secondary" onClick={handleExportData} disabled={exporting}>
                            <Database className="mr-2 h-4 w-4" />
                            {exporting ? '导出中...' : '导出数据'}
                        </Button>
                    </div>
                </CardContent>
                <CardContent>
                    <Separator />
                </CardContent>
                <CardContent>
                    <div className="flex items-center justify-between">
                         <Label className="flex flex-col space-y-1 text-destructive">
                            <span>删除账户</span>
                             <span className="font-normal leading-snug text-destructive/80">
                                此操作将永久删除您的账户及所有相关数据，无法撤销。
                            </span>
                        </Label>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                 <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除我的账户
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>您确定要删除您的账户吗？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        此操作无法撤销。这将永久删除您的账户并从我们的服务器上移除您的数据。
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction>是的，删除账户</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            {user && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        修改密码
                    </CardTitle>
                    <CardDescription>修改您的登录密码。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="old-password">当前密码</Label>
                        <Input
                            id="old-password"
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="输入当前密码"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-password">新密码</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="输入新密码（至少6位）"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">确认新密码</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="再次输入新密码"
                        />
                    </div>
                    <Button onClick={handleChangePassword} disabled={changing}>
                        {changing ? '修改中...' : '修改密码'}
                    </Button>
                </CardContent>
            </Card>
            )}
        </div>
    );
}
