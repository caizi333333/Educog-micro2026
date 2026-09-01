'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  ChevronDown, BookOpen, Cpu, ListChecks, Zap, AlertTriangle,
  Lightbulb, Globe, CircuitBoard, HelpCircle, GraduationCap, Clock, MapPin,
  Flag, Gauge, Star, Target, Loader2, CheckCircle2, ImageOff, MonitorPlay,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTeachingContent } from '@/lib/teaching-content';
import { getExperimentVisualAssets, toSvgDataUri } from '@/lib/experiment-visual-assets';
import {
  emptyProj04CompletionEvidence,
  type ExperimentConfig,
  type Proj04CompletionEvidence,
  type Proj04MilestoneId,
} from '@/lib/experiment-config';
import AnimationRenderer from './animations/AnimationRegistry';
import PreClassQuiz from './PreClassQuiz';

interface Props {
  experiment: ExperimentConfig | null;
  projectCompletion?: Proj04CompletionEvidence;
  isLoadingProjectCompletion?: boolean;
  isSavingProjectCompletion?: boolean;
  projectCompletionError?: string | null;
  projectCompletionBlockedReason?: string | null;
  onProjectMilestoneChange?: (milestoneId: Proj04MilestoneId, confirmed: boolean) => Promise<void>;
}

// 星级评分（速度/灵活性量化）
function StarRating({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-[#6c7086]">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className="w-2.5 h-2.5"
            style={{ color: n <= value ? color : '#313244', fill: n <= value ? color : 'transparent' }}
          />
        ))}
      </div>
    </div>
  );
}

// Collapsible section wrapper
function Section({
  title, icon: Icon, children, defaultOpen = true, accent = 'blue',
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'cyan';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colors: Record<string, string> = {
    blue: 'text-[#89b4fa]',
    amber: 'text-[#f9e2af]',
    green: 'text-[#a6e3a1]',
    red: 'text-[#f38ba8]',
    purple: 'text-[#cba6f7]',
    cyan: 'text-[#89dceb]',
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-[#313244]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200">
        <ChevronDown className={cn('w-3 h-3 text-[#585b70] transition-transform', !open && '-rotate-90')} />
        <Icon className={cn('w-3.5 h-3.5', colors[accent])} />
        <span className="text-xs font-semibold text-[#cdd6f4]">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ExperimentGuide({
  experiment,
  projectCompletion = emptyProj04CompletionEvidence(),
  isLoadingProjectCompletion = false,
  isSavingProjectCompletion = false,
  projectCompletionError = null,
  projectCompletionBlockedReason = null,
  onProjectMilestoneChange,
}: Props) {
  const [quizStatus, setQuizStatus] = useState<'PENDING' | 'PASSED' | 'SKIPPED'>('PENDING');

  if (!experiment) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#6c7086] gap-2 p-6">
        <BookOpen className="w-8 h-8 opacity-30" />
        <p className="text-xs">加载实验后查看教学指南</p>
      </div>
    );
  }

  const tc = getTeachingContent(experiment.id);
  const hasContent = tc.theory.length > 0 || tc.stepByStep.length > 0;
  const visualAssets = getExperimentVisualAssets(experiment.id);
  const completedProjectMilestones = projectCompletion.milestones
    .filter((item) => item.confirmed && item.confirmedAt).length;

  const recordQuizStatus = (status: 'PASSED' | 'SKIPPED') => {
    setQuizStatus(status);
    if (typeof window === 'undefined') return;
    const token = getStoredAccessToken();
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const pathId = params.get('taskPathId');
    const stepId = params.get('taskStepId');
    fetch('/api/learning-events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        events: [{
          clientEventId: `preclass-quiz:${experiment.id}:${pathId || 'standalone'}:${status.toLowerCase()}`,
          eventType: status === 'PASSED' ? 'PRECLASS_QUIZ_PASSED' : 'PRECLASS_QUIZ_SKIPPED',
          targetType: 'EXPERIMENT',
          targetId: experiment.id,
          experimentId: experiment.id,
          metadata: { source: 'experiment-guide', pathId, stepId, status },
        }],
      }),
    }).catch(() => { /* 状态提示仍保留在当前页面 */ });
  };

  // 三维教学目标：知识/能力优先取结构化字段，否则由知识点/学习目标自动派生；思政取自思政卡主题
  const knowledgeGoals = tc.objectives3D?.knowledge ?? experiment.knowledgePoints.slice(0, 3).map((k) => `理解并掌握${k}`);
  const abilityGoals = tc.objectives3D?.ability ?? experiment.objectives;
  const ideologicalGoal = tc.ideological?.theme;

  // 教学重点/难点：优先结构化字段，否则由知识点/常见错误派生
  const focusPoints = tc.keyPoints?.focus ?? experiment.knowledgePoints.slice(0, 2);
  const difficultyPoints = tc.keyPoints?.difficulty ?? tc.commonMistakes.slice(0, 2).map((m) => m.mistake);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 py-2">
        {/* ── 课前预习测试 ── */}
        {experiment.id.startsWith('exp') && quizStatus === 'PENDING' && (
          <div className="mx-3 mb-2">
            <PreClassQuiz
              experimentId={experiment.id}
              onPass={() => recordQuizStatus('PASSED')}
              onSkip={() => recordQuizStatus('SKIPPED')}
            />
          </div>
        )}
        {quizStatus === 'SKIPPED' && (
          <div className="mx-3 mb-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-[11px] leading-5 text-amber-100">
            已跳过课前检测：可以继续查看实验指导，但本次不记为“预习达标”。
          </div>
        )}

        {/* ── 大纲定位 ── */}
        {tc.syllabusMapping && (
          <div className="mx-3 mb-2 rounded-lg bg-gradient-to-r from-[#89b4fa]/10 to-[#cba6f7]/10 border border-[#89b4fa]/20 p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <GraduationCap className="w-3.5 h-3.5 text-[#89b4fa]" />
              <span className="text-[10px] font-bold text-[#cdd6f4]">课程大纲定位</span>
              <span className="text-[9px] text-[#585b70] ml-auto">微控制器应用技术 · 3学分/48学时</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#f9e2af] flex-shrink-0" />
                <span className="text-[10px] text-[#a6adc8]">
                  <span className="text-[#f9e2af] font-semibold">{tc.syllabusMapping.week}</span>
                  {' · '}{tc.syllabusMapping.hours > 0 ? `${tc.syllabusMapping.hours}学时` : '学时待核实'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#a6e3a1] flex-shrink-0" />
                <span className="text-[10px] text-[#a6e3a1] font-semibold">{tc.syllabusMapping.chapter}</span>
              </div>
            </div>
            <div className="mt-1.5 text-[9px] text-[#a6adc8] leading-relaxed">
              <span className="text-[#89b4fa]">📖</span> {tc.syllabusMapping.textbookRef}
            </div>
            {tc.syllabusMapping.knowledgeMap && (
              <div className="mt-1 text-[9px] text-[#6c7086]">
                <span className="text-[#cba6f7]">🗺️</span> {tc.syllabusMapping.knowledgeMap}
              </div>
            )}
            {!tc.ideological && tc.syllabusMapping.ideologicalPoint && (
              <div className="mt-1 text-[9px] text-[#6c7086]">
                <span className="text-[#f38ba8]">🎯</span> 课程思政：{tc.syllabusMapping.ideologicalPoint}
              </div>
            )}
          </div>
        )}

        {/* ── 课程思政（结构化卡片：金句 + 融入点） ── */}
        {tc.ideological && (
          <div className="mx-3 mb-2 rounded-lg border border-[#f38ba8]/25 bg-gradient-to-r from-[#f38ba8]/10 to-[#fab387]/10 p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Flag className="w-3.5 h-3.5 text-[#f38ba8]" />
              <span className="text-[10px] font-bold text-[#cdd6f4]">课程思政</span>
              <span className="text-[9px] text-[#f38ba8] font-medium ml-auto">{tc.ideological.theme}</span>
            </div>
            <ul className="space-y-1">
              {tc.ideological.insights.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8] leading-relaxed">
                  <span className="text-[#f38ba8] mt-0.5 flex-shrink-0">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            {tc.ideological.goldenQuote && (
              <div className="mt-2 rounded-md border-l-2 border-[#f38ba8] bg-[#f38ba8]/10 px-2 py-1 text-[10px] italic text-[#f9c6d3]">
                “{tc.ideological.goldenQuote}”
              </div>
            )}
          </div>
        )}

        {/* ── 实验概述 ── */}
        <Section title="实验概述" icon={BookOpen} accent="blue">
          <div className="space-y-2.5">
            {experiment.description && (
              <p className="text-[11px] text-[#a6adc8] leading-relaxed">{experiment.description}</p>
            )}

            {(knowledgeGoals.length > 0 || abilityGoals.length > 0) && (
              <div>
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#cdd6f4]">
                  <GraduationCap className="h-3 w-3 text-[#89b4fa]" /> 三维教学目标
                </div>
                <div className="space-y-1.5">
                  {knowledgeGoals.length > 0 && (
                    <div>
                      <div className="mb-0.5 text-[9px] font-semibold text-[#89b4fa]">知识目标</div>
                      <ul className="space-y-0.5">
                        {knowledgeGoals.map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                            <span className="mt-0.5 text-[#89b4fa]">•</span><span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {abilityGoals.length > 0 && (
                    <div>
                      <div className="mb-0.5 text-[9px] font-semibold text-[#a6e3a1]">能力目标</div>
                      <ul className="space-y-0.5">
                        {abilityGoals.map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                            <span className="mt-0.5 text-[#a6e3a1]">•</span><span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ideologicalGoal && (
                    <div>
                      <div className="mb-0.5 text-[9px] font-semibold text-[#f38ba8]">思政目标</div>
                      <div className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                        <span className="mt-0.5 text-[#f38ba8]">•</span>
                        <span>{ideologicalGoal}（详见下方课程思政）</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(focusPoints.length > 0 || difficultyPoints.length > 0) && (
              <div>
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#cdd6f4]">
                  <Target className="h-3 w-3 text-[#f9e2af]" /> 教学重点与难点
                </div>
                <div className="space-y-1.5">
                  {focusPoints.length > 0 && (
                    <div className="rounded-md border border-[#f9e2af]/15 bg-[#f9e2af]/5 p-2">
                      <div className="mb-0.5 text-[9px] font-semibold text-[#f9e2af]">重点</div>
                      <ul className="space-y-0.5">
                        {focusPoints.map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                            <span className="mt-0.5 text-[#f9e2af]">•</span><span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {difficultyPoints.length > 0 && (
                    <div className="rounded-md border border-[#f38ba8]/15 bg-[#f38ba8]/5 p-2">
                      <div className="mb-0.5 text-[9px] font-semibold text-[#f38ba8]">难点</div>
                      <ul className="space-y-0.5">
                        {difficultyPoints.map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                            <span className="mt-0.5 text-[#f38ba8]">•</span><span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {experiment.knowledgePoints.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {experiment.knowledgePoints.map((kp, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#313244] text-[#a6adc8] border border-[#45475a]">
                    {kp}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        {tc.projectBrief && (
          <Section title="综合项目任务书（内置模板）" icon={Target} accent="cyan">
            <div className="space-y-3">
              <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3">
                <div className="text-xs font-semibold text-amber-100">{tc.projectBrief.evidenceStatus}</div>
                <p className="mt-1 text-[11px] leading-5 text-amber-50/85">{tc.projectBrief.simulationBoundary}</p>
              </div>
              <div className="grid gap-2">
                <div className="rounded-md border border-sky-300/15 bg-sky-300/[0.05] p-2.5">
                  <div className="text-[11px] font-semibold text-sky-100">开始前</div>
                  <p className="mt-1 text-[11px] leading-5 text-sky-50/80">{tc.projectBrief.prerequisiteGate}</p>
                </div>
                <div className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.05] p-2.5">
                  <div className="text-[11px] font-semibold text-emerald-100">完成后</div>
                  <p className="mt-1 text-[11px] leading-5 text-emerald-50/80">{tc.projectBrief.completionNextStep}</p>
                </div>
              </div>
              <div
                className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] p-3"
                role={projectCompletionError ? 'alert' : 'status'}
                aria-live="polite"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100">
                  {isLoadingProjectCompletion || isSavingProjectCompletion
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : completedProjectMilestones === 5
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      : <ListChecks className="h-3.5 w-3.5" />}
                  <span>项目证据自检 · {completedProjectMilestones}/5</span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-cyan-50/80">
                  逐项确认已形成对应材料；每次确认由服务端保存，刷新或重新登录后可恢复。确认只代表证据自检，不替代教师评价。
                </p>
                {projectCompletion.updatedAt && (
                  <p className="mt-1 text-[11px] text-cyan-100/75">
                    最近保存：{new Date(projectCompletion.updatedAt).toLocaleString('zh-CN', { hour12: false })}
                  </p>
                )}
                {projectCompletionError && (
                  <p className="mt-1 text-[11px] leading-5 text-red-100">{projectCompletionError}</p>
                )}
                {!projectCompletionError && projectCompletionBlockedReason && (
                  <p className="mt-1 text-[11px] leading-5 text-amber-100">{projectCompletionBlockedReason}</p>
                )}
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-[#d7def7]">跨专业角色</div>
                <div className="grid gap-1.5">
                  {tc.projectBrief.roles.map((item) => (
                    <div key={item.role} className="rounded-md border border-[#313244] bg-[#181825] p-2">
                      <div className="text-[11px] font-semibold text-cyan-200">{item.role}</div>
                      <p className="mt-1 text-[11px] leading-5 text-[#bac2de]">{item.responsibility}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-[#d7def7]">五个里程碑与完成规则</div>
                <div className="space-y-1.5">
                  {tc.projectBrief.milestones.map((item) => (
                    <div key={item.title} className="rounded-md border border-[#313244] bg-[#181825] px-2.5 py-2">
                      <div className="text-[11px] font-semibold text-emerald-200">{item.title}</div>
                      <p className="mt-0.5 text-[11px] leading-5 text-[#bac2de]">{item.completionRule}</p>
                      {((): React.JSX.Element => {
                        const evidence = projectCompletion.milestones.find((entry) => entry.id === item.id);
                        const confirmed = evidence?.confirmed === true && evidence.confirmedAt !== null;
                        return (
                          <label className="mt-1.5 flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.035] px-2 py-1.5 text-[11px] leading-4 text-[#c5d3d5] transition-colors hover:bg-white/[0.06] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-200 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
                            <input
                              type="checkbox"
                              checked={confirmed}
                              disabled={isLoadingProjectCompletion || isSavingProjectCompletion || Boolean(projectCompletionBlockedReason) || !onProjectMilestoneChange}
                              onChange={(event) => {
                                if (onProjectMilestoneChange) void onProjectMilestoneChange(item.id, event.target.checked);
                              }}
                              className="h-4 w-4 shrink-0 accent-cyan-300"
                              aria-label={`确认${item.title}的提交证据已完成自检`}
                            />
                            <span className={confirmed ? 'text-emerald-200' : ''}>
                              {confirmed ? '已确认并由服务端保存' : '确认已形成并核对本项提交证据'}
                            </span>
                          </label>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-[#d7def7]">提交证据</div>
                <ul className="space-y-1">
                  {tc.projectBrief.deliverables.map((item) => (
                    <li key={item} className="flex gap-2 text-[11px] leading-5 text-[#bac2de]">
                      <span aria-hidden="true" className="text-cyan-200">□</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-[#d7def7]">评价量规</div>
                <div className="overflow-hidden rounded-md border border-[#313244]">
                  {tc.projectBrief.rubric.map((item) => (
                    <div key={item.dimension} className="grid grid-cols-[66px_36px_minmax(0,1fr)] gap-1.5 border-b border-[#313244] bg-[#181825] px-2 py-2 text-[11px] leading-4 last:border-b-0">
                      <span className="font-semibold text-[#d7def7]">{item.dimension}</span>
                      <span className="font-mono text-amber-200">{item.weight}%</span>
                      <span className="text-[#bac2de]">{item.evidence}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── 寻址方式星级对比（教学锚点） ── */}
        {tc.addressingComparison && tc.addressingComparison.length > 0 && (
          <Section title="寻址方式对比" icon={Gauge} accent="amber">
            <div className="space-y-1.5">
              {tc.addressingComparison.map((m, i) => (
                <div key={i} className="rounded-md border border-[#313244] bg-[#181825] p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#f9e2af]">{m.name}</span>
                    <code className="text-[9px] font-mono text-[#a6e3a1]">{m.example}</code>
                  </div>
                  <div className="flex items-center gap-3 mb-1">
                    <StarRating label="速度" value={m.speed} color="#89dceb" />
                    <StarRating label="灵活" value={m.flexibility} color="#cba6f7" />
                  </div>
                  <p className="text-[9px] leading-relaxed text-[#6c7086]">{m.note}</p>
                </div>
              ))}
              <p className="pt-1 text-[9px] italic leading-relaxed text-[#585b70]">
                ★ 越多越强 · 速度与灵活性常此消彼长——没有最好的寻址方式，只有最合适的。
              </p>
            </div>
          </Section>
        )}

        {/* ── 动画演示 ── */}
        {tc.animations && tc.animations.length > 0 && (
          <Section title="动画演示" icon={Zap} accent="cyan">
            <div className="space-y-3">
              {tc.animations.map((anim, i) => (
                <div key={i}>
                  <div className="text-[10px] font-semibold text-[#89dceb] mb-1.5">{anim.title}</div>
                  <AnimationRenderer animationId={anim.id} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 理论背景 ── */}
        {tc.theory.length > 0 && (
          <Section title="理论背景" icon={BookOpen} accent="purple" defaultOpen={false}>
            <div className="space-y-3">
              {tc.theory.map((sec, i) => (
                <div key={i}>
                  <div className="text-[10px] font-semibold text-[#cba6f7] mb-1">{sec.title}</div>
                  <pre className="text-[10px] text-[#a6adc8] leading-relaxed whitespace-pre-wrap font-mono bg-[#181825] rounded-md p-2 border border-[#313244] overflow-x-auto">
                    {sec.content}
                  </pre>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 实验图示与素材状态 ── */}
        <Section title="实验图示与素材状态" icon={CircuitBoard} accent="cyan">
          <div className="space-y-3">
            {visualAssets.length > 0 ? visualAssets.map((asset) => (
              <figure key={asset.id} className="overflow-hidden rounded-md border border-cyan-300/15 bg-[#080d12]">
                <img
                  src={toSvgDataUri(asset.svg)}
                  alt={`${asset.title}（教学示意图）`}
                  loading="lazy"
                  className="block w-full bg-[#080d12]"
                />
                <figcaption className="border-t border-cyan-300/10 bg-white/[0.035] px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="text-[10px] font-semibold text-[#89dceb]">{asset.title}</div>
                    <span className="rounded border border-slate-400/20 bg-slate-300/[0.05] px-1.5 py-0.5 text-[8px] text-slate-400">
                      教学示意图 · 非实物照片
                    </span>
                  </div>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-[#a6adc8]">{asset.description}</p>
                </figcaption>
              </figure>
            )) : (
              <div className="rounded-md border border-dashed border-slate-400/25 bg-slate-300/[0.04] p-3" role="note">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-300">
                  <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
                  本实验的接线图尚未发布
                </div>
                <p className="mt-1 text-[9px] leading-5 text-slate-500">素材缺失期间保留明确占位，不使用生成图或示意图冒充实物证据。</p>
              </div>
            )}

            <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3" role="note">
              <div className="flex flex-wrap items-center gap-2">
                <MonitorPlay className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
                <span className="text-[10px] font-semibold text-amber-100">实物操作录屏</span>
                <span className="rounded border border-amber-200/20 bg-amber-200/[0.06] px-1.5 py-0.5 text-[8px] text-amber-200">素材待补充</span>
              </div>
              <p className="mt-1 text-[9px] leading-5 text-amber-100/65">当前未发布实物实验录屏；动态仿真只用于展示程序与外设状态，不替代真实学生操作证据。</p>
              <a
                href="#experiment-live-canvas"
                className="mt-2 inline-flex min-h-11 items-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-[10px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                先查看当前动态仿真
              </a>
            </div>
          </div>
        </Section>

        {/* ── 硬件电路 ── */}
        {tc.circuitDescription && (
          <Section title="硬件电路" icon={CircuitBoard} accent="cyan" defaultOpen={false}>
            <pre className="text-[10px] text-[#89dceb] leading-relaxed whitespace-pre-wrap font-mono bg-[#181825] rounded-md p-2 border border-[#313244] overflow-x-auto">
              {tc.circuitDescription}
            </pre>
            {experiment.hardwareRequirements.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-[#89dceb] mb-1">元器件清单</div>
                <ul className="space-y-0.5">
                  {experiment.hardwareRequirements.map((hw, i) => (
                    <li key={i} className="text-[10px] text-[#a6adc8] flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#89dceb]" />{hw}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ── 寄存器参考 ── */}
        {tc.registerReference.length > 0 && (
          <Section title="寄存器参考" icon={Cpu} accent="amber" defaultOpen={false}>
            <div className="space-y-2">
              {tc.registerReference.map((reg, i) => (
                <div key={i} className="bg-[#181825] rounded-md p-2 border border-[#313244]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#f9e2af] font-mono">{reg.name}</span>
                    <span className="text-[9px] text-[#585b70] font-mono">{reg.address}</span>
                  </div>
                  {reg.bits.length > 0 && (
                    <div className="flex gap-0.5 mb-1">
                      {reg.bits.map((bit, j) => (
                        <span key={j} className="flex-1 text-center text-[8px] font-mono text-[#89b4fa] bg-[#313244] rounded px-0.5 py-0.5">
                          {bit}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-[#6c7086]">{reg.description}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 分步指导 ── */}
        {tc.stepByStep.length > 0 && (
          <Section title="分步指导" icon={ListChecks} accent="green">
            <div className="space-y-1.5">
              {tc.stepByStep.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#a6e3a1]/10 border border-[#a6e3a1]/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[#a6e3a1]">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-[#cdd6f4]">{s.step.replace(/^\d+\.\s*/, '')}</div>
                    <div className="text-[9px] text-[#6c7086] mt-0.5">{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 指令速查 ── */}
        {tc.instructionRef.length > 0 && (
          <Section title="指令速查" icon={Zap} accent="amber" defaultOpen={false}>
            <div className="space-y-1">
              {tc.instructionRef.map((ins, i) => (
                <div key={i} className="bg-[#181825] rounded-md p-1.5 border border-[#313244]">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-[#f9e2af] font-mono">{ins.instr}</span>
                    <span className="text-[9px] text-[#585b70] font-mono">{ins.syntax}</span>
                  </div>
                  <div className="text-[9px] text-[#a6adc8]">{ins.desc}</div>
                  <code className="text-[9px] text-[#a6e3a1] font-mono">{ins.example}</code>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 实际应用 ── */}
        {tc.realWorldApplications.length > 0 && (
          <Section title="工程应用场景" icon={Globe} accent="cyan" defaultOpen={false}>
            <ul className="space-y-1">
              {tc.realWorldApplications.map((app, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                  <Globe className="w-3 h-3 text-[#89dceb] flex-shrink-0 mt-0.5" />
                  {app}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── 常见错误 ── */}
        {tc.commonMistakes.length > 0 && (
          <Section title="常见错误与陷阱" icon={AlertTriangle} accent="red" defaultOpen={false}>
            <div className="space-y-2">
              {tc.commonMistakes.map((cm, i) => (
                <div key={i} className="bg-[#f38ba8]/5 rounded-md p-2 border border-[#f38ba8]/10">
                  <div className="text-[10px] font-semibold text-[#f38ba8] flex items-center gap-1 mb-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    {cm.mistake}
                  </div>
                  <div className="text-[9px] text-[#a6adc8] leading-relaxed">{cm.explanation}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 思考题 ── */}
        {tc.thinkingQuestions.length > 0 && (
          <Section title="思考与拓展" icon={HelpCircle} accent="purple" defaultOpen={false}>
            <ol className="space-y-1.5">
              {tc.thinkingQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-[10px] text-[#a6adc8]">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#cba6f7]/10 border border-[#cba6f7]/20 flex items-center justify-center text-[8px] font-bold text-[#cba6f7]">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{q}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ── 预期结果 & 排障 ── */}
        {experiment.expectedResults.length > 0 && (
          <Section title="预期结果" icon={Lightbulb} accent="green" defaultOpen={false}>
            <ul className="space-y-0.5">
              {experiment.expectedResults.map((r, i) => (
                <li key={i} className="text-[10px] text-[#a6adc8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1]" />{r}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {experiment.troubleshooting.length > 0 && (
          <Section title="故障排除" icon={AlertTriangle} accent="amber" defaultOpen={false}>
            <div className="space-y-1.5">
              {experiment.troubleshooting.map((ts, i) => (
                <div key={i} className="text-[10px]">
                  <span className="font-semibold text-[#f9e2af]">问题：</span>
                  <span className="text-[#a6adc8]">{ts.issue}</span>
                  <br />
                  <span className="font-semibold text-[#a6e3a1]">解决：</span>
                  <span className="text-[#a6adc8]">{ts.solution}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 无教学内容提示 */}
        {!hasContent && (
          <div className="px-3 py-6 text-center text-[#585b70]">
            <Lightbulb className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="text-[10px]">该实验的详细教学内容正在制作中</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
