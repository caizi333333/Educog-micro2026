'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, BookOpen, Cpu, ListChecks, Zap, AlertTriangle,
  Lightbulb, Globe, CircuitBoard, HelpCircle, GraduationCap, Clock, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTeachingContent, type TeachingContent } from '@/lib/teaching-content';
import type { ExperimentConfig } from '@/lib/experiment-config';
import AnimationRenderer from './animations/AnimationRegistry';
import PreClassQuiz from './PreClassQuiz';

interface Props {
  experiment: ExperimentConfig | null;
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
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#313244]/30 rounded-md transition-colors group">
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

export default function ExperimentGuide({ experiment }: Props) {
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
  const [quizPassed, setQuizPassed] = useState(false);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 py-2">
        {/* ── 课前预习测试 ── */}
        {experiment.id.startsWith('exp') && !quizPassed && (
          <div className="mx-3 mb-2">
            <PreClassQuiz
              experimentId={experiment.id}
              onPass={() => setQuizPassed(true)}
              onSkip={() => setQuizPassed(true)}
            />
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
                  {' · '}{tc.syllabusMapping.hours}学时
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
            {tc.syllabusMapping.ideologicalPoint && (
              <div className="mt-1 text-[9px] text-[#6c7086]">
                <span className="text-[#f38ba8]">🎯</span> 课程思政：{tc.syllabusMapping.ideologicalPoint}
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

            {experiment.objectives.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-[#89b4fa] mb-1">学习目标</div>
                <ul className="space-y-0.5">
                  {experiment.objectives.map((o, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-[#a6adc8]">
                      <span className="text-[#89b4fa] mt-0.5">•</span>
                      {o}
                    </li>
                  ))}
                </ul>
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
