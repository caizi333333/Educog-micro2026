'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateLearningPlan, type LearningPlanOutput } from '@/ai/flows/learning-plan-flow';
import { Loader2, ArrowLeft, GitBranch, BookOpen, Cpu, MonitorPlay, ClipboardCheck, Info, GraduationCap, Trophy, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const iconMap: { [key: string]: React.ReactNode } = {
  read: <BookOpen className="w-5 h-5" />,
  simulate: <Cpu className="w-5 h-5" />,
  watch: <MonitorPlay className="w-5 h-5" />,
  quiz: <ClipboardCheck className="w-5 h-5" />,
};

const InfoCard = ({ icon, title, description, children }: { icon: React.ReactNode, title: string, description: string, children: React.ReactNode }) => (
    <div className="flex items-center justify-center h-[calc(100vh-theme(spacing.28))]">
        <Card className="w-full max-w-md text-center p-6">
            <CardHeader className="p-0">
                <div className="mx-auto bg-primary/10 rounded-full p-4 w-fit mb-4">
                    {icon}
                </div>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription className="pt-2">{description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-6 p-0">
                {children}
            </CardContent>
        </Card>
    </div>
);


export function LearningPathClient({ weakKAsParam }: { weakKAsParam?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [plan, setPlan] = useState<LearningPlanOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weakAreas = useMemo(() => {
    // 首先尝试从URL参数获取
    if (weakKAsParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(weakKAsParam));
        if (Array.isArray(decoded) && decoded.length > 0) {
          // Successfully parsed weakKAs from URL
          return decoded;
        }
      } catch (e) {
        console.error("Failed to parse weakKAsParam:", e);
      }
    }
    
    // 如果URL参数失败，尝试从localStorage恢复
    if (typeof window !== 'undefined') {
      try {
        // 使用用户特定的存储键
        const storageKey = user ? `assessment-results-${user.id}` : 'assessment-results';
        const savedResults = localStorage.getItem(storageKey);
        if (savedResults) {
          const results = JSON.parse(savedResults);
          // Found saved assessment results
          
          // 检查数据完整性
          if (results && typeof results === 'object' && results.weakKAs) {
            // 检查是否在48小时内（延长时间窗口）
            const isRecent = !results.timestamp || 
              (new Date().getTime() - new Date(results.timestamp).getTime() < 48 * 60 * 60 * 1000);
            
            if (isRecent && Array.isArray(results.weakKAs)) {
              // Recovered assessment results from localStorage
              // 显示恢复提示
              setTimeout(() => {
                toast({
                  title: '已恢复测评数据',
                  description: '已从本地存储恢复您的测评结果。',
                });
              }, 1000);
              return results.weakKAs.length > 0 ? results.weakKAs : [];
            }
          }
        }
      } catch (e) {
        console.warn('Failed to recover assessment results from localStorage:', e);
      }
    }
    
    // No valid assessment data found
    setError('没有找到有效的测评数据。请重新完成在线测评。');
    return null;
  }, [weakKAsParam, toast, user]);

  // 生成备用学习计划
  const generateFallbackPlan = (weakAreas: string[]): LearningPlanOutput => {
    const chapterMap: { [key: string]: number } = {
      'CPU结构': 1,
      '存储器结构': 2,
      'I/O 端口': 3,
      '指令系统': 4,
      '寻址方式': 2,
      '定时器/计数器': 5,
      '中断系统': 6,
      'LED动态扫描': 7,
      '矩阵键盘扫描': 8,
      'ADC 应用': 9,
      '串行通信': 9
    };

    interface LearningStep {
      step: number;
      type: 'read' | 'simulate' | 'quiz';
      title: string;
      description: string;
      resource: {
        text: string;
        href: string;
      };
    }

    const steps: LearningStep[] = [];
    let stepNumber = 1;

    // 为每个薄弱知识点生成详细的学习步骤
    weakAreas.forEach((area) => {
      const chapter = chapterMap[area];
      
      // 步骤1：理论学习
      steps.push({
        step: stepNumber++,
        type: 'read' as const,
        title: `学习${area}理论基础`,
        description: `深入学习${area}的基本概念、工作原理和应用场景。重点掌握相关寄存器配置和编程要点。`,
        resource: {
          text: `阅读第${chapter}章 - ${area}`,
          href: `/#item-${chapter}`
        }
      });

      // 步骤2：仿真实验（如果是实践性强的知识点）
      if (['定时器/计数器', '中断系统', 'LED动态扫描', '矩阵键盘扫描', 'ADC 应用', '串行通信'].includes(area)) {
        steps.push({
          step: stepNumber++,
          type: 'simulate' as const,
          title: `${area}仿真实验`,
          description: `通过仿真实验加深对${area}的理解，观察实际运行效果，掌握编程技巧。`,
          resource: {
            text: '开始仿真实验',
            href: '/simulation'
          }
        });
      }
    });

    // 添加综合练习步骤
    if (weakAreas.length > 1) {
      steps.push({
        step: stepNumber++,
        type: 'simulate' as const,
        title: '综合应用练习',
        description: '尝试将多个知识点结合，设计简单的综合应用项目，提升系统设计能力。',
        resource: {
          text: '综合仿真练习',
          href: '/simulation'
        }
      });
    }

    // 最终测评
    steps.push({
      step: stepNumber++,
      type: 'quiz' as const,
      title: '重新测评验证效果',
      description: '完成学习计划后，重新参加在线测评，检验学习效果和知识掌握程度。',
      resource: {
        text: '重新参加测评',
        href: '/quiz'
      }
    });

    return { plan: steps };
  };

  useEffect(() => {
    if (weakAreas && weakAreas.length > 0 && !plan && !isGenerating && !error) {
      const fetchPlan = async () => {
        setIsGenerating(true);
        
        try {
          // 首先检查缓存的计划
          const cacheKey = `learningPlan_${weakAreas.join('_')}`;
          const cachedPlan = localStorage.getItem(cacheKey);
          const cacheTime = localStorage.getItem(`${cacheKey}_time`);
          
          if (cachedPlan && cacheTime) {
            const isRecentCache = (Date.now() - parseInt(cacheTime)) < 24 * 60 * 60 * 1000; // 24小时缓存
            if (isRecentCache) {
              setPlan(JSON.parse(cachedPlan));
              toast({
                title: '学习计划已加载',
                description: '使用了缓存的个性化学习路径。',
              });
              setIsGenerating(false);
              return;
            }
          }
          
          // 立即使用备用计划，避免AI API延迟
          const fallbackPlan = generateFallbackPlan(weakAreas);
          setPlan(fallbackPlan);
          
          // 保存到缓存
          localStorage.setItem(cacheKey, JSON.stringify(fallbackPlan));
          localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
          
          toast({
            title: '学习计划生成成功',
            description: '已为您制定个性化学习路径。',
          });
          
          // 在后台异步尝试生成AI计划（可选）
          setTimeout(async () => {
            try {
              // 创建 AbortController 用于超时控制
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
              
              const result = await Promise.race([
                generateLearningPlan({ weakKnowledgeAreas: weakAreas }),
                new Promise((_, reject) => {
                  controller.signal.addEventListener('abort', () => {
                    reject(new Error('AI plan generation timeout'));
                  });
                })
              ]);
              
              clearTimeout(timeoutId);
              
              // 更新缓存但不立即显示，下次访问时使用
              localStorage.setItem(`${cacheKey}_ai`, JSON.stringify(result));
            } catch (error) {
              console.log('后台AI计划生成失败，继续使用备用计划:', error);
            }
          }, 100);
          
        } catch (e) {
          console.error('Failed to generate learning plan:', e);
          
          // 使用备用计划
          const fallbackPlan = generateFallbackPlan(weakAreas);
          setPlan(fallbackPlan);
          
          toast({
            title: '已生成学习计划',
            description: '已为您制定基础学习路径。',
          });
        } finally {
          setIsGenerating(false);
        }
      };

      fetchPlan();
    }
  }, [weakAreas, plan, isGenerating, error, toast]);

  if (weakAreas === null) {
      return (
        <InfoCard
            icon={<Info className="w-10 h-10 text-primary" />}
            title="无法生成学习计划"
            description={error || "我们没有找到您的测评数据。请先完成一次在线综合测评，我们才能为您量身打造学习路径。"}
        >
            <Button onClick={() => router.push('/quiz')}>
                <ArrowLeft className="mr-2 h-4 w-4"/>
                返回参加在线测评
            </Button>
        </InfoCard>
      );
  }
  
  if (weakAreas.length === 0) {
      return (
         <InfoCard
            icon={<GraduationCap className="w-10 h-10 text-primary" />}
            title="太棒了，没有薄弱点！"
            description="恭喜您！根据您最近的测评结果，您已经掌握了所有知识点，无需生成学习计划。"
        >
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <Button onClick={() => router.push('/achievements')}>
                    <Trophy className="mr-2 h-4 w-4"/>
                    查看我的成就
                </Button>
                 <Button variant="secondary" onClick={() => router.push('/quiz')}>
                    <RotateCcw className="mr-2 h-4 w-4"/>
                    再挑战一次
                </Button>
            </div>
        </InfoCard>
      );
  }

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-theme(spacing.28))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">您的专属学习计划正在生成中，请稍候...</p>
      </div>
    );
  }

  if (error) {
    return (
        <InfoCard
            icon={<XCircle className="w-10 h-10 text-destructive" />}
            title="出错了"
            description={error}
        >
             <Button onClick={() => router.push('/quiz')}>
                <ArrowLeft className="mr-2 h-4 w-4"/>
                返回在线测评
            </Button>
        </InfoCard>
    );
  }


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-primary" />
            个性化学习路径
          </CardTitle>
          <CardDescription>
            根据您的测试结果（薄弱点: {weakAreas.join('、')}），AI为您量身打造了这份学习计划。
          </CardDescription>
        </CardHeader>
      </Card>
      
      {plan?.plan && plan.plan.length > 0 ? (
        <div className="relative pl-6">
          <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-border -z-10"></div>
          <div className="space-y-10">
              {plan.plan.map((step) => (
                  <div key={step.step} className="relative">
                      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white border-4 border-background">
                          {iconMap[step.type] || <GitBranch className="w-5 h-5" />}
                      </div>
                      <div className="pl-16">
                           <Card>
                              <CardHeader>
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <Badge variant="secondary" className="mb-2">{step.type.toUpperCase()}</Badge>
                                          <CardTitle>{step.title}</CardTitle>
                                      </div>
                                      <span className="text-5xl font-bold text-primary/20">{step.step}</span>
                                  </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <p className="text-muted-foreground">{step.description}</p>
                                  <Button asChild>
                                      <Link href={step.resource.href} target={step.resource.href.startsWith('http') ? '_blank' : '_self'}>
                                          {step.resource.text}
                                      </Link>
                                  </Button>
                              </CardContent>
                          </Card>
                      </div>
                  </div>
              ))}
          </div>
        </div>
      ) : (
          <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                  AI未能生成有效的学习计划，请尝试返回测评页面重试。
              </CardContent>
          </Card>
      )}
    </div>
  );
}
