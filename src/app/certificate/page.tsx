'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Award, Star, Cpu, ClipboardCheck, BrainCircuit, Calendar, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface CertificateData {
    profile: { name: string };
    stats: {
        totalHours: number;
        quizHighScore: number;
        simulationsCompleted: number;
        knowledgePointsMastered: number;
    };
}

export default function CertificatePage() {
    const [data, setData] = useState<CertificateData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCertificateData() {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    setError('请先登录以查看证书');
                    setLoading(false);
                    return;
                }

                const res = await fetch('/api/certificates', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.message || `请求失败 (${res.status})`);
                }

                const json = await res.json();
                setData({
                    profile: json.profile,
                    stats: json.stats,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : '加载证书数据失败');
            } finally {
                setLoading(false);
            }
        }

        fetchCertificateData();
    }, []);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto">
                <Card className="overflow-hidden">
                    <CardContent className="p-10 space-y-8">
                        <div className="flex flex-col items-center gap-4">
                            <Skeleton className="w-24 h-24 rounded-full" />
                            <Skeleton className="h-10 w-48" />
                            <Skeleton className="h-6 w-64" />
                        </div>
                        <Skeleton className="h-6 w-full" />
                        <div className="grid md:grid-cols-2 gap-8 pt-8">
                            <div className="space-y-4">
                                <Skeleton className="h-8 w-40 mx-auto" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-8 w-40 mx-auto" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const { name } = data.profile;
    const { quizHighScore, simulationsCompleted, knowledgePointsMastered, totalHours } = data.stats;

    const issueDate = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-10 relative">
                        {/* Decorative elements */}
                        <div className="absolute top-0 left-0 w-32 h-32 border-t-4 border-l-4 border-primary/30 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-primary/30 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 border-b-4 border-l-4 border-primary/30 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-32 h-32 border-b-4 border-r-4 border-primary/30 rounded-br-lg"></div>

                        <div className="text-center space-y-4 z-10 relative">
                            <Award className="w-24 h-24 text-primary mx-auto" />
                            <h1 className="text-4xl font-bold text-primary-foreground/90 tracking-wider">
                                学 习 证 明
                            </h1>
                            <p className="text-xl text-muted-foreground">Certificate of Learning</p>
                        </div>
                    </div>
                    <div className="p-10 space-y-8">
                        <p className="text-lg leading-relaxed text-center">
                            兹证明学员 <strong className="text-primary font-semibold text-2xl mx-2">{name}</strong>
                            已在"芯智育才"AI驱动的数字化教学平台完成预设阶段的学习，
                            表现优异，特发此证，以兹鼓励。
                        </p>

                        <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-dashed">
                            <div className="space-y-6">
                                <h3 className="text-xl font-semibold text-center text-primary-foreground/90">学习成果概览</h3>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-4">
                                        <div className="p-3 bg-secondary rounded-lg"><Star className="w-6 h-6 text-primary" /></div>
                                        <div>
                                            <p className="font-semibold">累计学习时长</p>
                                            <p className="text-2xl font-bold text-primary">{totalHours}<span className="text-base font-normal text-muted-foreground"> 小时</span></p>
                                        </div>
                                    </li>
                                     <li className="flex items-center gap-4">
                                        <div className="p-3 bg-secondary rounded-lg"><Cpu className="w-6 h-6 text-primary" /></div>
                                        <div>
                                            <p className="font-semibold">完成仿真实验</p>
                                            <p className="text-2xl font-bold text-primary">{simulationsCompleted}<span className="text-base font-normal text-muted-foreground"> 个</span></p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                             <div className="space-y-6">
                                 <h3 className="text-xl font-semibold text-center text-primary-foreground/90">&nbsp;</h3>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-4">
                                        <div className="p-3 bg-secondary rounded-lg"><ClipboardCheck className="w-6 h-6 text-primary" /></div>
                                        <div>
                                            <p className="font-semibold">在线综合测评最高分</p>
                                            <p className="text-2xl font-bold text-primary">{quizHighScore}<span className="text-base font-normal text-muted-foreground"> 分</span></p>
                                        </div>
                                    </li>
                                    <li className="flex items-center gap-4">
                                        <div className="p-3 bg-secondary rounded-lg"><BrainCircuit className="w-6 h-6 text-primary" /></div>
                                        <div>
                                            <p className="font-semibold">掌握知识原子</p>
                                            <p className="text-2xl font-bold text-primary">{knowledgePointsMastered}<span className="text-base font-normal text-muted-foreground"> 个</span></p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="pt-10 flex justify-between items-end">
                             <div>
                                <p className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="w-4 h-4"/>
                                    <span>颁发日期: {issueDate}</span>
                                </p>
                            </div>
                            <div className="text-center">
                                 <p className="text-lg font-semibold font-code text-primary-foreground/90">芯智育才 &middot; AI教学平台</p>
                                <p className="text-sm text-muted-foreground">技术认证部</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
