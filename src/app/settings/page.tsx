
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Database, Trash2 } from "lucide-react";
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

export default function SettingsPage() {
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
                         <Button variant="secondary">
                            <Database className="mr-2 h-4 w-4" />
                            导出数据
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
        </div>
    );
}
