
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { quizQuestions, type Question, type CodeCompletionQuestion } from '@/lib/quiz-data';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Activity,
  ArrowRight,
  BarChart4,
  BookCopy,
  CheckCircle,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  FileText,
  GitBranch,
  Lightbulb,
  ListChecks,
  Loader2,
  RotateCcw,
  Target,
  TerminalSquare,
  Timer,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { processAchievementResponse } from '@/hooks/use-achievement-notifications';

type AnswersState = { [key: number]: string };
type ScorePerKa = { [ka: string]: { correct: number; total: number; score: number } };

// Fisher-Yates shuffle algorithm
const shuffleArray = (array: Question[]) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
};

export function QuizClient() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersState>(() => {
    // 如果有用户，使用用户特定的存储键
    const storageKey = user ? `quiz-answers-${user.id}` : 'quiz-answers';
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : {};
      } catch (error) {
        console.warn('Failed to load saved quiz answers:', error);
        return {};
      }
    }
    return {};
  });
  const [answerStatus, setAnswerStatus] = useState<{ [key: number]: 'correct' | 'incorrect' }>({});
  const [showResults, setShowResults] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [, setIsSavingResults] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Shuffling is done on the client-side to avoid hydration mismatch
    setShuffledQuestions(shuffleArray(quizQuestions));
    
    // 尝试恢复测评进度
    if (typeof window !== 'undefined') {
      try {
        const savedProgress = localStorage.getItem('quiz-progress');
        if (savedProgress) {
          const progress = JSON.parse(savedProgress);
          // 检查是否在24小时内
          const isRecent = new Date().getTime() - new Date(progress.timestamp).getTime() < 24 * 60 * 60 * 1000;
          if (isRecent && progress.currentQuestionIndex !== undefined) {
            setCurrentQuestionIndex(progress.currentQuestionIndex);
            setAnswerStatus(progress.answerStatus || {});
            setShowResults(progress.showResults || false);
          }
        }
      } catch (error) {
        console.warn('Failed to load quiz progress:', error);
      }
    }
  }, []);

  // 保存答案到localStorage
  useEffect(() => {
    const storageKey = user ? `quiz-answers-${user.id}` : 'quiz-answers';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(answers));
      } catch (error) {
        console.warn('Failed to save quiz answers:', error);
      }
    }
  }, [answers, user]);

  // 保存测评进度
  const saveQuizProgress = () => {
    if (typeof window !== 'undefined') {
      try {
        const progress = {
          currentQuestionIndex,
          answerStatus,
          showResults,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('quiz-progress', JSON.stringify(progress));
      } catch (error) {
        console.warn('Failed to save quiz progress:', error);
      }
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };
  
  const handleCheckAnswer = () => {
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    if (!currentQuestion || !answers[currentQuestion.id]) return;

    const userAnswer = (answers[currentQuestion.id] || "").trim().toLowerCase();
    const correctAnswer = currentQuestion.correctAnswer.trim().toLowerCase();
    
    setAnswerStatus(prev => ({
        ...prev,
        [currentQuestion.id]: userAnswer === correctAnswer ? 'correct' : 'incorrect'
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => {
        const newIndex = prev + 1;
        // 保存进度
        setTimeout(saveQuizProgress, 100);
        return newIndex;
      });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => {
        const newIndex = prev - 1;
        // 保存进度
        setTimeout(saveQuizProgress, 100);
        return newIndex;
      });
    }
  };
  
  const handleSubmitQuiz = async () => {
    setShowResults(true);
    
    // 如果用户已登录，保存结果到数据库
    if (user) {
      setIsSavingResults(true);
      try {
        const quizResult = {
          quizId: 'comprehensive-assessment',
          score: totalScore,
          totalQuestions: shuffledQuestions.length,
          correctAnswers: Object.values(answerStatus).filter(status => status === 'correct').length,
          timeSpent: 0, // TODO: 实现计时功能
          answers: JSON.stringify(answers),
          weakAreas: weakKAs,
          scoresByKA: scores
        };
        
        const response = await fetch('/api/quiz/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify(quizResult)
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Process achievement notifications
          processAchievementResponse(data);
          
          toast({
            title: '测评结果已保存',
            description: '您的测评结果已成功保存到系统中。',
          });
        }
      } catch (error) {
        console.error('Failed to save quiz results to server:', error);
        toast({
          title: '保存失败',
          description: '测评结果保存失败，但您可以继续查看结果。',
          variant: 'destructive'
        });
      } finally {
        setIsSavingResults(false);
      }
    }
    
    // 立即保存测评结果用于生成学习计划
    if (typeof window !== 'undefined') {
      try {
        const assessmentResults = {
          weakKAs,
          totalScore,
          scores,
          answers,
          timestamp: new Date().toISOString()
        };
        const storageKey = user ? `assessment-results-${user.id}` : 'assessment-results';
        localStorage.setItem(storageKey, JSON.stringify(assessmentResults));
        // Assessment results saved successfully
      } catch (error) {
        console.warn('Failed to save assessment results:', error);
      }
    }
    // 保存最终状态
    setTimeout(saveQuizProgress, 100);
  }

  const handleRestart = () => {
    setShuffledQuestions(shuffleArray(quizQuestions));
    setCurrentQuestionIndex(0);
    setAnswers({});
    setAnswerStatus({});
    setShowResults(false);
    // 清除保存的数据
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(user ? `quiz-answers-${user.id}` : 'quiz-answers');
        localStorage.removeItem('quiz-progress');
        localStorage.removeItem(user ? `assessment-results-${user.id}` : 'assessment-results');
      } catch (error) {
        console.warn('Failed to clear quiz data:', error);
      }
    }
  };

  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    
    try {
      // 验证薄弱知识点
      if (!weakKAs || weakKAs.length === 0) {
        // 如果没有薄弱点，仍然可以生成一个通用的学习计划
        // No weak areas found, generating general learning plan
      }

      // 保存测评结果到localStorage作为备份
      if (typeof window !== 'undefined') {
        try {
          const assessmentResults = {
            weakKAs: weakKAs || [],
            totalScore,
            scores,
            answers,
            timestamp: new Date().toISOString()
          };
          const storageKey = user ? `assessment-results-${user.id}` : 'assessment-results';
          localStorage.setItem(storageKey, JSON.stringify(assessmentResults));
          // Assessment backup saved successfully
        } catch (error) {
          console.warn('Failed to save assessment backup:', error);
        }
      }

      const encodedKAs = encodeURIComponent(JSON.stringify(weakKAs || []));
      router.push(`/learning-path?weakKAs=${encodedKAs}`);
    } catch (error) {
      console.error('Error generating learning plan:', error);
      alert(error instanceof Error ? error.message : '生成学习计划时发生错误，请稍后重试');
    } finally {
      setIsGeneratingPlan(false);
    }
  };
  
  const { scores, totalScore, weakKAs } = useMemo(() => {
    // 允许部分完成的测评也能生成学习计划
    const scoresByKa: { [ka: string]: { correct: number; total: number } } = {};
    let totalCorrect = 0;
    let answeredQuestions = 0;
    
    quizQuestions.forEach(q => {
        if (!scoresByKa[q.ka]) {
            scoresByKa[q.ka] = { correct: 0, total: 0 };
        }
        const kaScore = scoresByKa[q.ka];
        if (kaScore) {
            kaScore.total += 1;
        }
        
        // 只计算已回答的题目
        if (answers[q.id]) {
            answeredQuestions++;
            const userAnswer = (answers[q.id] || "").trim().toLowerCase();
            const correctAnswer = q.correctAnswer.trim().toLowerCase();

            if (userAnswer === correctAnswer) {
                const kaScore = scoresByKa[q.ka];
                if (kaScore) {
                    kaScore.correct += 1;
                }
                totalCorrect++;
            }
        }
    });

    const finalScores: ScorePerKa = {};
    const weakKaList: string[] = [];

    for(const ka in scoresByKa) {
        const kaScore = scoresByKa[ka];
        if (!kaScore) continue;
        
        // 如果该知识点有题目被回答，则计算得分
        if (kaScore.correct > 0 || Object.keys(answers).some(answerId => {
            const questionId = parseInt(answerId);
            return quizQuestions.find(q => q.id === questionId && q.ka === ka);
        })) {
            const score = kaScore.total > 0 ? (kaScore.correct / kaScore.total) * 100 : 0;
            finalScores[ka] = { ...kaScore, score, correct: kaScore.correct, total: kaScore.total };
            if (score < 70) {
                weakKaList.push(ka);
            }
        } else {
            // 未回答的知识点默认为薄弱点
            finalScores[ka] = { correct: 0, total: kaScore.total, score: 0 };
            weakKaList.push(ka);
        }
    }
    
    return {
      scores: finalScores,
      totalScore: answeredQuestions > 0 ? (totalCorrect / answeredQuestions) * 100 : 0,
      weakKAs: weakKaList,
    };
  }, [answers]);

  if (shuffledQuestions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">正在准备题目...</p>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">题目加载错误，请刷新页面重试。</p>
      </div>
    );
  }
  
  const isCurrentQuestionChecked = !!answerStatus[currentQuestion.id];
  const isCurrentAnswerCorrect = answerStatus[currentQuestion.id] === 'correct';
  const answeredCount = Object.keys(answers).filter(key => answers[parseInt(key)]?.trim() !== '').length;
  const checkedCount = Object.keys(answerStatus).length;
  const correctCheckedCount = Object.values(answerStatus).filter(status => status === 'correct').length;
  const correctAnsweredCount = shuffledQuestions.filter(
    (question) => (answers[question.id] || '').trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
  ).length;
  const answerProgress = shuffledQuestions.length > 0 ? (answeredCount / shuffledQuestions.length) * 100 : 0;
  const checkedProgress = shuffledQuestions.length > 0 ? (checkedCount / shuffledQuestions.length) * 100 : 0;
  const currentAnswer = answers[currentQuestion.id] || '';
  const currentKaScore = scores[currentQuestion.ka]?.score ?? 0;
  const scoreEntries = Object.entries(scores).sort(([, a], [, b]) => a.score - b.score);
  const missedQuestions = shuffledQuestions.filter(
    (question) => (answers[question.id] || '').trim().toLowerCase() !== question.correctAnswer.trim().toLowerCase()
  );
  const chapterQuestionCount = shuffledQuestions.filter(question => question.chapter === currentQuestion.chapter).length;


  if (showResults) {
    return (
      <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100">
        <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
                <BarChart4 className="h-3.5 w-3.5" />
                Diagnostic Report · 8051
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">测试诊断报告</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                本报告基于当前答题记录生成，用于定位知识原子薄弱项和下一步学习入口。
              </p>
              <span className="sr-only">测试完成！</span>
              <span className="sr-only">这是您的诊断报告。</span>
              <span className="sr-only">您回答了 {answeredCount} 道题，答对 {correctAnsweredCount} 道题。</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleRestart}
                className="border border-white/[0.1] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-slate-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重新测试
                <span className="sr-only">再试一次</span>
              </Button>
              <Button asChild className="bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                <Link href="/analytics">
                  学情分析
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <main className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_360px] md:px-6">
          <section className="space-y-5">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-100">Overall Score</div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-mono text-6xl font-semibold text-slate-50">{totalScore.toFixed(0)}</span>
                    <span className="pb-2 font-mono text-xl text-slate-400">%</span>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/30">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, totalScore))}%` }} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                    <ClipboardCheck className="mb-3 h-4 w-4 text-cyan-200" />
                    <div className="font-mono text-2xl text-slate-50">{answeredCount}</div>
                    <div className="text-xs text-slate-500">已答题</div>
                  </div>
                  <div className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                    <CheckCircle className="mb-3 h-4 w-4 text-emerald-300" />
                    <div className="font-mono text-2xl text-slate-50">{correctAnsweredCount}</div>
                    <div className="text-xs text-slate-500">答对题</div>
                  </div>
                  <div className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                    <Target className="mb-3 h-4 w-4 text-amber-300" />
                    <div className="font-mono text-2xl text-slate-50">{weakKAs.length}</div>
                    <div className="text-xs text-slate-500">待加强原子</div>
                  </div>
                  <div className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                    <ListChecks className="mb-3 h-4 w-4 text-slate-300" />
                    <div className="font-mono text-2xl text-slate-50">{shuffledQuestions.length}</div>
                    <div className="text-xs text-slate-500">题目总数</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">知识原子掌握度</h2>
                  <span className="sr-only">知识原子掌握度分析</span>
                  <p className="mt-1 text-xs text-slate-500">按得分从低到高排列，优先处理低掌握项。</p>
                </div>
                <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-500">
                  {scoreEntries.length} KA
                </span>
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {scoreEntries.map(([ka, result]) => (
                  <div key={ka} className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-medium text-slate-100">{ka}</span>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-sm font-semibold',
                          result.score < 50 ? 'text-red-300' : result.score < 80 ? 'text-amber-300' : 'text-emerald-300'
                        )}
                      >
                        {result.score.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          result.score < 50 ? 'bg-red-400' : result.score < 80 ? 'bg-amber-300' : 'bg-emerald-300'
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, result.score))}%` }}
                      />
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-slate-500">{result.correct}/{result.total} correct</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">错题与未答题回看</h2>
                  <p className="mt-1 text-xs text-slate-500">保留正确答案和对应章节入口，便于回到课程实验复习。</p>
                </div>
                <span className="rounded-md border border-red-300/20 bg-red-300/[0.08] px-2 py-1 font-mono text-[10px] text-red-100">
                  {missedQuestions.length} items
                </span>
              </div>
              <div className="space-y-3 p-5">
                {missedQuestions.map((question) => (
                  <div key={question.id} className="rounded-md border border-red-300/15 bg-red-300/[0.06] p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-6 text-slate-100">
                          第 {shuffledQuestions.findIndex(item => item.id === question.id) + 1} 题：{question.questionText}
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                          <div className="rounded border border-white/[0.08] bg-black/20 p-2">
                            <span className="text-slate-500">你的答案：</span>
                            <span className={cn('ml-1 font-semibold text-slate-200', question.type === 'code-completion' && 'font-code')}>
                              {answers[question.id] || '未作答'}
                            </span>
                          </div>
                          <div className="rounded border border-emerald-300/15 bg-emerald-300/[0.06] p-2">
                            <span className="text-slate-500">正确答案：</span>
                            <span className={cn('ml-1 font-semibold text-emerald-200', question.type === 'code-completion' && 'font-code')}>
                              {question.correctAnswer}
                            </span>
                          </div>
                        </div>
                        <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-cyan-200 hover:text-cyan-100">
                          <Link href={`/#item-${question.chapter}`}>
                            <BookCopy className="mr-2 h-4 w-4" />
                            复习第 {question.chapter} 章
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {missedQuestions.length === 0 && (
                  <div className="flex items-center gap-3 rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-sm text-emerald-100">
                    <CheckCircle className="h-4 w-4" />
                    本次测试没有错题。
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
                <Lightbulb className="h-4 w-4 text-amber-300" />
                下一步
              </div>
              {weakKAs.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {weakKAs.slice(0, 8).map((ka) => (
                      <span key={ka} className="rounded border border-amber-300/20 bg-amber-300/[0.08] px-2 py-1 text-xs text-amber-100">
                        {ka}
                      </span>
                    ))}
                  </div>
                  <Button
                    onClick={handleGeneratePlan}
                    className="w-full bg-cyan-300 text-[#001014] hover:bg-cyan-200"
                    disabled={isGeneratingPlan}
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <GitBranch className="mr-2 h-4 w-4" />
                        生成学习计划
                        <span className="sr-only">获取个性化学习计划</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100">
                  当前没有明显薄弱项，可以继续进入仿真实验。
                </div>
              )}
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
                <Activity className="h-4 w-4 text-cyan-200" />
                记录状态
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="text-slate-500">已答进度</span>
                  <span className="font-mono text-slate-100">{answerProgress.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="text-slate-500">已核对题</span>
                  <span className="font-mono text-slate-100">{checkedCount}/{shuffledQuestions.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="text-slate-500">核对正确</span>
                  <span className="font-mono text-slate-100">{correctCheckedCount}/{checkedCount || 0}</span>
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Assessment Console · Quiz
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">综合测试</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              逐题核对，系统会记录知识原子掌握度，并用于后续学习路径推荐。
            </p>
          </div>
          <div className="grid min-w-[240px] gap-2">
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
              <span>ANSWERED</span>
              <span>{answeredCount}/{shuffledQuestions.length}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${answerProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <main className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[260px_minmax(0,1fr)_300px] md:px-6">
        <aside className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3 xl:sticky xl:top-20 xl:self-start">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-sm font-semibold text-slate-100">题目导航</div>
            <div className="font-mono text-[10px] text-slate-500">{checkedCount} checked</div>
          </div>
          <div className="grid max-h-[280px] grid-cols-5 gap-2 overflow-y-auto pr-1 md:max-h-[460px] xl:grid-cols-4">
            {shuffledQuestions.map((question, index) => {
              const status = answerStatus[question.id];
              const hasAnswer = !!answers[question.id]?.trim();
              const isCurrent = index === currentQuestionIndex;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-md border font-mono text-xs transition',
                    isCurrent && 'border-cyan-300/60 bg-cyan-300/[0.14] text-cyan-100',
                    !isCurrent && status === 'correct' && 'border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200',
                    !isCurrent && status === 'incorrect' && 'border-red-300/30 bg-red-300/[0.08] text-red-200',
                    !isCurrent && !status && hasAnswer && 'border-amber-300/30 bg-amber-300/[0.08] text-amber-200',
                    !isCurrent && !status && !hasAnswer && 'border-white/[0.08] bg-black/20 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200',
                  )}
                  aria-label={`第 ${index + 1} 题`}
                >
                  {status === 'correct' ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : status === 'incorrect' ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : hasAnswer ? (
                    <FileText className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300" /> 当前题</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /> 已作答未核对</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> 正确</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-300" /> 错误</div>
          </div>
        </aside>

        <section className="rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[11px] text-cyan-100">
                    Q{currentQuestionIndex + 1}/{shuffledQuestions.length}
                  </span>
                  <span className="sr-only">
                    第 {currentQuestionIndex + 1} / {shuffledQuestions.length} 题
                  </span>
              <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-400">
                CH{currentQuestion.chapter}
              </span>
              <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-400">
                {currentQuestion.type === 'code-completion' ? 'CODE' : 'CHOICE'}
              </span>
            </div>
            <h2 className="text-xl font-semibold leading-8 text-slate-50 md:text-2xl">{currentQuestion.questionText}</h2>
          </div>

          <div className="space-y-5 p-5">
            {currentQuestion.type === 'multiple-choice' && (
              <RadioGroup
                value={currentAnswer}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-3"
                disabled={isCurrentQuestionChecked}
              >
                {currentQuestion.options.map((option, index) => {
                  const isCorrectOption = option === currentQuestion.correctAnswer;
                  const isSelectedOption = currentAnswer === option;
                  return (
                    <Label
                      key={option}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-4 transition',
                        'border-white/[0.08] bg-black/20 text-slate-200 hover:bg-white/[0.06]',
                        isCurrentQuestionChecked && 'cursor-default hover:bg-black/20',
                        !isCurrentQuestionChecked && 'has-[input:checked]:border-cyan-300/50 has-[input:checked]:bg-cyan-300/[0.08]',
                        isCurrentQuestionChecked && isCorrectOption && 'border-emerald-300/40 bg-emerald-300/[0.08] text-emerald-100',
                        isCurrentQuestionChecked && !isCorrectOption && isSelectedOption && 'border-red-300/40 bg-red-300/[0.08] text-red-100',
                      )}
                    >
                      <RadioGroupItem value={option} id={`${currentQuestion.id}-${index}`} aria-label={option} className="mt-1" />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/[0.12] font-mono text-xs text-slate-400">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-6 md:text-base">{option}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            )}

            {currentQuestion.type === 'code-completion' && (() => {
              const codeCompletionQuestion = currentQuestion as CodeCompletionQuestion;
              const codeParts = codeCompletionQuestion.code.split('___');
              return (
                <div className="space-y-3">
                  {codeParts[0] && (
                    <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070a] p-4">
                      <pre className="font-code text-sm leading-6 text-slate-300"><code>{codeParts[0]}</code></pre>
                    </div>
                  )}
                  <Input
                    className={cn(
                      'h-12 border-white/[0.1] bg-black/30 font-code text-base text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-300/70',
                      isCurrentQuestionChecked && isCurrentAnswerCorrect && 'border-emerald-300/50 focus-visible:ring-emerald-300/70',
                      isCurrentQuestionChecked && !isCurrentAnswerCorrect && 'border-red-300/50 focus-visible:ring-red-300/70'
                    )}
                    placeholder="在此处输入代码..."
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    disabled={isCurrentQuestionChecked}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {codeParts[1] && (
                    <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070a] p-4">
                      <pre className="font-code text-sm leading-6 text-slate-300"><code>{codeParts[1]}</code></pre>
                    </div>
                  )}
                </div>
              );
            })()}

            {isCurrentQuestionChecked && (
              <div
                className={cn(
                  'rounded-md border p-4',
                  isCurrentAnswerCorrect ? 'border-emerald-300/25 bg-emerald-300/[0.08]' : 'border-red-300/25 bg-red-300/[0.08]'
                )}
              >
                <div className="flex items-start gap-3">
                  {isCurrentAnswerCorrect ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  )}
                  <div className="min-w-0">
                    <div className={cn('text-sm font-semibold', isCurrentAnswerCorrect ? 'text-emerald-100' : 'text-red-100')}>
                      {isCurrentAnswerCorrect ? '回答正确！' : '回答错误'}
                    </div>
                    {!isCurrentAnswerCorrect && (
                      <div className="mt-2 text-sm text-slate-300">
                        正确答案：
                        <span className="font-code font-semibold text-slate-50">{currentQuestion.correctAnswer}</span>
                      </div>
                    )}
                    <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-cyan-200 hover:text-cyan-100">
                      <Link href={`/#item-${currentQuestion.chapter}`}>
                        <BookCopy className="mr-2 h-4 w-4" />
                        复习第 {currentQuestion.chapter} 章的相关知识点
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="border border-white/[0.1] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-slate-50"
            >
              <ChevronsLeft className="mr-2 h-4 w-4" />
              上一题
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!isCurrentQuestionChecked ? (
                <Button
                  type="button"
                  onClick={handleCheckAnswer}
                  disabled={!currentAnswer}
                  className="bg-cyan-300 text-[#001014] hover:bg-cyan-200"
                >
                  核对答案
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={currentQuestionIndex >= shuffledQuestions.length - 1}
                  className="bg-cyan-300 text-[#001014] hover:bg-cyan-200"
                >
                  下一题
                  <ChevronsRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSubmitQuiz}
                disabled={answeredCount === 0}
                className="border border-amber-300/25 bg-amber-300/[0.12] text-amber-100 hover:bg-amber-300/[0.18] hover:text-amber-50"
              >
                完成并查看报告
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
              <Target className="h-4 w-4 text-cyan-200" />
              当前知识原子
            </div>
            <div className="rounded-md border border-white/[0.08] bg-black/20 p-4">
              <div className="text-base font-semibold text-slate-50">{currentQuestion.ka}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>章节内题量</span>
                <span className="font-mono text-slate-300">{chapterQuestionCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>当前掌握</span>
                <span className="font-mono text-slate-300">{currentKaScore.toFixed(0)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, currentKaScore))}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
              <Timer className="h-4 w-4 text-amber-300" />
              测试状态
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between font-mono text-[11px] text-slate-500">
                  <span>CHECKED</span>
                  <span>{checkedCount}/{shuffledQuestions.length}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-amber-300" style={{ width: `${checkedProgress}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">{correctCheckedCount}</div>
                  <div className="text-xs text-slate-500">核对正确</div>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">{weakKAs.length}</div>
                  <div className="text-xs text-slate-500">薄弱原子</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
              <TerminalSquare className="h-4 w-4 text-cyan-200" />
              待关注
            </div>
            <div className="flex flex-wrap gap-2">
              {weakKAs.slice(0, 7).map((ka) => (
                <span key={ka} className="rounded border border-amber-300/20 bg-amber-300/[0.08] px-2 py-1 text-xs text-amber-100">
                  {ka}
                </span>
              ))}
              {weakKAs.length === 0 && <span className="text-sm text-slate-500">暂无。</span>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
