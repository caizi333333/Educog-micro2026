
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { quizQuestions, type Question, type CodeCompletionQuestion } from '@/lib/quiz-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, BarChart4, Target, BookCopy, GitBranch, ChevronsRight, ChevronsLeft, RotateCcw, Loader2, Lightbulb } from 'lucide-react';
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
        localStorage.removeItem('quiz-answers');
        localStorage.removeItem('quiz-progress');
        localStorage.removeItem('assessment-results');
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
          localStorage.setItem('assessment-results', JSON.stringify(assessmentResults));
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


  if (showResults) {
    const answeredCount = Object.keys(answers).filter(key => answers[parseInt(key)]?.trim() !== '').length;
    const correctCount = Object.values(scores).reduce((acc, s) => acc + s.correct, 0);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <Card className="text-center">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">测试完成！</CardTitle>
                    <CardDescription>这是您的诊断报告。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-6xl font-bold text-primary">{totalScore.toFixed(0)}<span className="text-2xl text-muted-foreground">%</span></div>
                    <p className="text-muted-foreground">您回答了 {answeredCount} 道题，答对了 {correctCount} 道，共 {shuffledQuestions.length} 道题。</p>
                    <div className="flex flex-wrap gap-4 justify-center">
                         <Button variant="secondary" onClick={handleRestart}>
                            <RotateCcw className="mr-2 h-4 w-4"/>
                            再试一次
                         </Button>
                    </div>
                </CardContent>
            </Card>
            
            <Alert>
              <BarChart4 className="h-4 w-4" />
              <AlertTitle>干得漂亮！</AlertTitle>
              <AlertDescription>
                您的测试结果和学习积分已更新。前往您的
                <Link href="/analytics" className="font-semibold text-primary hover:underline mx-1">
                  学情分析
                </Link>
                页面，查看您的最新成就和排名。
              </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-6 w-6 text-primary"/>
                        知识原子掌握度分析
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {Object.entries(scores).sort(([, a], [, b]) => a.score - b.score).map(([ka, result]) => (
                         <div key={ka} className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-semibold">{ka}</span>
                                <span className={cn(
                                    "font-bold",
                                    result.score < 50 ? 'text-destructive' : result.score < 80 ? 'text-yellow-500' : 'text-primary'
                                )}>
                                    {result.score.toFixed(0)}%
                                    <span className="text-xs text-muted-foreground font-normal ml-1">({result.correct}/{result.total})</span>
                                </span>
                            </div>
                             <Progress value={result.score} className="h-2" />
                        </div>
                    ))}
                </CardContent>
            </Card>
            
            {weakKAs.length > 0 && (
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="h-6 w-6 text-primary"/>
                          下一步行动建议
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-center">
                      <p className="text-muted-foreground">
                          我们发现您在以下领域需要加强：<strong>{weakKAs.join('、')}</strong>。
                          <br/>
                          点击下方按钮，让AI为您生成一份专属的学习计划。
                      </p>
                      <Button 
                        onClick={handleGeneratePlan} 
                        className="w-full sm:w-auto"
                        disabled={isGeneratingPlan}
                      >
                          {isGeneratingPlan ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                              正在生成学习计划...
                            </>
                          ) : (
                            <>
                              <GitBranch className="mr-2 h-4 w-4"/>
                              获取个性化学习计划
                            </>
                          )}
                      </Button>
                  </CardContent>
              </Card>
            )}

            <div>
                <h3 className="text-xl font-semibold mb-4 text-center">回顾错题和未答题</h3>
                <div className="space-y-4">
                    {shuffledQuestions.filter(q => (answers[q.id] || "").trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase()).map((q) => (
                        <Alert key={q.id} variant="destructive">
                            <XCircle className="h-4 w-4"/>
                            <AlertTitle>第 {shuffledQuestions.findIndex(item => item.id === q.id) + 1} 题：{q.questionText}</AlertTitle>
                            <AlertDescription>
                                <p>你的答案: <span className={cn("font-semibold", q.type === 'code-completion' && "font-code")}>{answers[q.id] || "未作答"}</span></p>
                                <p>正确答案: <span className={cn("font-semibold", q.type === 'code-completion' && "font-code")}>{q.correctAnswer}</span></p>
                                 <Button variant="link" size="sm" asChild className="p-0 h-auto mt-2 text-destructive">
                                    <Link href={`/#item-${q.chapter}`}>
                                        <BookCopy className="mr-2 h-4 w-4"/>
                                        复习第 {q.chapter} 章
                                    </Link>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ))}
                    {shuffledQuestions.filter(q => (answers[q.id] || "").trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase()).length === 0 && (
                        <Alert>
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <AlertTitle>太棒了！</AlertTitle>
                            <AlertDescription>
                                您本次测试没有错题。
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
            <Progress value={((Object.keys(answerStatus).length) / shuffledQuestions.length) * 100} className="mb-4" />
            <CardTitle>第 {currentQuestionIndex + 1} / {shuffledQuestions.length} 题</CardTitle>
            <CardDescription className="text-lg pt-2 text-foreground">{currentQuestion.questionText}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            {currentQuestion.type === 'multiple-choice' && (
                <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                    className="space-y-3"
                    disabled={isCurrentQuestionChecked}
                >
                    {currentQuestion.options.map((option) => (
                        <Label 
                          key={option} 
                          className={cn(
                            "flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50",
                            isCurrentQuestionChecked && "cursor-default hover:bg-transparent",
                            isCurrentQuestionChecked && option === currentQuestion.correctAnswer && "border-primary bg-primary/10 text-primary",
                            isCurrentQuestionChecked && option !== currentQuestion.correctAnswer && answers[currentQuestion.id] === option && "border-destructive bg-destructive/10 text-destructive",
                            !isCurrentQuestionChecked && "has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary"
                          )}
                        >
                            <RadioGroupItem value={option} id={`${currentQuestion.id}-${option}`} />
                            <span className="text-base flex-1">{option}</span>
                        </Label>
                    ))}
                </RadioGroup>
            )}
             {currentQuestion.type === 'code-completion' && (() => {
                const codeCompletionQuestion = currentQuestion as CodeCompletionQuestion;
                const codeParts = codeCompletionQuestion.code.split('___');
                return (
                    <div className="space-y-3">
                        {codeParts[0] && (
                            <div className="font-code bg-secondary p-4 rounded-md text-sm whitespace-pre-wrap">
                                <code>{codeParts[0]}</code>
                            </div>
                        )}
                        <Input 
                            className={cn(
                                "font-code text-base",
                                isCurrentQuestionChecked && isCurrentAnswerCorrect && "border-primary focus-visible:ring-primary",
                                isCurrentQuestionChecked && !isCurrentAnswerCorrect && "border-destructive focus-visible:ring-destructive"
                            )}
                            placeholder="在此处输入代码..."
                            value={answers[currentQuestion.id] || ''}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            disabled={isCurrentQuestionChecked}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {codeParts[1] && (
                            <div className="font-code bg-secondary p-4 rounded-md text-sm whitespace-pre-wrap">
                                <code>{codeParts[1]}</code>
                            </div>
                        )}
                    </div>
                );
            })()}

            {isCurrentQuestionChecked && (
              <Alert variant={isCurrentAnswerCorrect ? 'default' : 'destructive'} className={cn(isCurrentAnswerCorrect && 'border-primary/50 bg-primary/5')}>
                {isCurrentAnswerCorrect ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4"/>}
                <AlertTitle>{isCurrentAnswerCorrect ? '回答正确！' : '回答错误'}</AlertTitle>
                <AlertDescription>
                  {!isCurrentAnswerCorrect && (
                     <p>正确答案是： <span className="font-semibold font-code">{currentQuestion.correctAnswer}</span></p>
                  )}
                   <Button variant="link" size="sm" asChild className="p-0 h-auto mt-2 text-current">
                     <Link href={`/#item-${currentQuestion.chapter}`}>
                        <BookCopy className="mr-2 h-4 w-4"/>
                        复习第 {currentQuestion.chapter} 章的相关知识点
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
        <div className="p-6 pt-0 flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
                <ChevronsLeft className="mr-2 h-4 w-4"/>
                上一题
            </Button>

            <div className="flex items-center gap-4">
                {!isCurrentQuestionChecked ? (
                    <Button onClick={handleCheckAnswer} disabled={!answers[currentQuestion.id]}>
                        核对答案
                    </Button>
                ) : (
                    <Button onClick={handleNext} disabled={currentQuestionIndex >= shuffledQuestions.length - 1}>
                        下一题
                        <ChevronsRight className="ml-2 h-4 w-4"/>
                    </Button>
                )}
                
                <Button onClick={handleSubmitQuiz} variant="secondary" disabled={Object.keys(answers).length === 0}>
                    完成并查看报告
                </Button>
            </div>
        </div>
      </Card>
    </div>
  );
}
