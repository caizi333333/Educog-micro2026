'use client';

import React, { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  User,
  Eye,
  Ear,
  Hand,
  Shuffle,
  TrendingUp,
  TrendingDown,
  Clock,
  Flame,
  CheckCircle2,
} from 'lucide-react';

// 10 chapters from knowledge-points.ts
const CHAPTER_NAMES: Record<number, string> = {
  1: '单片机概述',
  2: '硬件结构',
  3: '指令系统',
  4: 'C语言编程',
  5: '中断系统',
  6: '定时器/计数器',
  7: '串行通信',
  8: '接口技术',
  9: '系统设计',
  10: '前沿应用',
};

// Short labels for radar chart axes (avoid overcrowding)
const CHAPTER_SHORT: Record<number, string> = {
  1: '概述',
  2: '硬件',
  3: '指令',
  4: 'C语言',
  5: '中断',
  6: '定时器',
  7: '串口',
  8: '接口',
  9: '系统',
  10: '前沿',
};

type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'mixed';

export interface LearnerProfileProps {
  quizScores?: Record<number, number>;       // chapter -> score percentage
  experimentStatus?: Record<string, string>; // experimentId -> status
  totalStudyTime?: number;                   // minutes
  streakDays?: number;
  className?: string;
}

// --- Catppuccin Mocha palette ---
const MOCHA = {
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
};

/**
 * Infer a learning style from experiment engagement and quiz patterns.
 * This is a simplified heuristic for demonstration purposes.
 */
function inferLearningStyle(
  experimentStatus?: Record<string, string>,
  quizScores?: Record<number, number>
): LearningStyle {
  if (!experimentStatus && !quizScores) return 'mixed';

  const completedExperiments = experimentStatus
    ? Object.values(experimentStatus).filter((s) => s === 'completed').length
    : 0;
  const totalExperiments = experimentStatus
    ? Object.keys(experimentStatus).length
    : 0;
  const experimentRate = totalExperiments > 0 ? completedExperiments / totalExperiments : 0;

  const scores = quizScores ? Object.values(quizScores) : [];
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // High experiment completion -> kinesthetic
  if (experimentRate > 0.7 && avgScore < 70) return 'kinesthetic';
  // High quiz scores, low experiments -> visual
  if (avgScore > 80 && experimentRate < 0.4) return 'visual';
  // Balanced -> mixed, slight lean to auditory if mid-range
  if (avgScore >= 60 && avgScore <= 80 && experimentRate >= 0.3 && experimentRate <= 0.6)
    return 'auditory';

  return 'mixed';
}

const STYLE_CONFIG: Record<
  LearningStyle,
  { label: string; icon: React.ReactNode; color: string; bgColor: string; description: string }
> = {
  visual: {
    label: '视觉型',
    icon: <Eye className="h-4 w-4" />,
    color: MOCHA.blue,
    bgColor: `${MOCHA.blue}20`,
    description: '偏好通过图表、动画和课件进行学习',
  },
  auditory: {
    label: '听觉型',
    icon: <Ear className="h-4 w-4" />,
    color: MOCHA.mauve,
    bgColor: `${MOCHA.mauve}20`,
    description: '偏好通过讲解、讨论和视频进行学习',
  },
  kinesthetic: {
    label: '动觉型',
    icon: <Hand className="h-4 w-4" />,
    color: MOCHA.peach,
    bgColor: `${MOCHA.peach}20`,
    description: '偏好通过实验仿真和动手操作进行学习',
  },
  mixed: {
    label: '综合型',
    icon: <Shuffle className="h-4 w-4" />,
    color: MOCHA.teal,
    bgColor: `${MOCHA.teal}20`,
    description: '多种学习方式均衡发展',
  },
};

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} 小时`;
  return `${hours} 小时 ${mins} 分钟`;
}

export const LearnerProfile: React.FC<LearnerProfileProps> = ({
  quizScores = {},
  experimentStatus = {},
  totalStudyTime = 0,
  streakDays = 0,
  className,
}) => {
  // Build radar chart data from quiz scores, defaulting to 0 for missing chapters
  const radarData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const chapter = i + 1;
      return {
        chapter: CHAPTER_SHORT[chapter],
        fullName: CHAPTER_NAMES[chapter],
        mastery: quizScores[chapter] ?? 0,
        fullMark: 100,
      };
    });
  }, [quizScores]);

  // Strength / weakness analysis
  const { strengths, weaknesses } = useMemo(() => {
    const sorted = Array.from({ length: 10 }, (_, i) => ({
      chapter: i + 1,
      name: CHAPTER_NAMES[i + 1],
      score: quizScores[i + 1] ?? 0,
    })).sort((a, b) => b.score - a.score);

    return {
      strengths: sorted.slice(0, 3),
      weaknesses: sorted.slice(-3).reverse(),
    };
  }, [quizScores]);

  // Learning style
  const learningStyle = useMemo(
    () => inferLearningStyle(experimentStatus, quizScores),
    [experimentStatus, quizScores]
  );
  const styleConfig = STYLE_CONFIG[learningStyle];

  // Completion rate: chapters with score > 0 / total chapters
  const completionRate = useMemo(() => {
    const attempted = Object.keys(quizScores).length;
    return Math.round((attempted / 10) * 100);
  }, [quizScores]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            学习者画像
          </CardTitle>
          <CardDescription>基于测验成绩和实验完成情况的综合学习分析</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">知识掌握度雷达图</CardTitle>
            <CardDescription>10个章节知识点掌握程度</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid
                  stroke={MOCHA.surface2}
                  gridType="polygon"
                />
                <PolarAngleAxis
                  dataKey="chapter"
                  tick={{ fill: MOCHA.subtext1, fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: MOCHA.overlay0, fontSize: 10 }}
                  tickCount={5}
                />
                <Radar
                  name="掌握度"
                  dataKey="mastery"
                  stroke={MOCHA.mauve}
                  fill={MOCHA.mauve}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: MOCHA.surface0,
                    border: `1px solid ${MOCHA.surface2}`,
                    borderRadius: '8px',
                    color: MOCHA.text,
                  }}
                  formatter={(value: number) => [`${value}%`, '掌握度']}
                  labelFormatter={(label: string) => {
                    const item = radarData.find((d) => d.chapter === label);
                    return item ? item.fullName : label;
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right column: Style + Stats */}
        <div className="space-y-6">
          {/* Learning Style Badge */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">学习风格</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center h-12 w-12 rounded-xl"
                  style={{ backgroundColor: styleConfig.bgColor, color: styleConfig.color }}
                >
                  {styleConfig.icon}
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className="text-sm font-semibold mb-1"
                    style={{ borderColor: styleConfig.color, color: styleConfig.color }}
                  >
                    {styleConfig.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{styleConfig.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Learning Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">学习统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/50">
                  <Clock className="h-4 w-4" style={{ color: MOCHA.blue }} />
                  <span className="text-lg font-bold" style={{ color: MOCHA.text }}>
                    {formatStudyTime(totalStudyTime)}
                  </span>
                  <span className="text-xs text-muted-foreground">累计学习</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/50">
                  <Flame className="h-4 w-4" style={{ color: MOCHA.peach }} />
                  <span className="text-lg font-bold" style={{ color: MOCHA.text }}>
                    {streakDays} 天
                  </span>
                  <span className="text-xs text-muted-foreground">连续学习</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/50">
                  <CheckCircle2 className="h-4 w-4" style={{ color: MOCHA.green }} />
                  <span className="text-lg font-bold" style={{ color: MOCHA.text }}>
                    {completionRate}%
                  </span>
                  <span className="text-xs text-muted-foreground">完成率</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strength / Weakness Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">优势与薄弱分析</CardTitle>
              <CardDescription>基于各章节测验成绩</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Strengths */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4" style={{ color: MOCHA.green }} />
                  <span className="text-sm font-medium" style={{ color: MOCHA.green }}>
                    优势章节
                  </span>
                </div>
                <div className="space-y-1.5">
                  {strengths.map((item) => (
                    <div
                      key={item.chapter}
                      className="flex items-center justify-between p-2 rounded-md"
                      style={{ backgroundColor: `${MOCHA.green}10` }}
                    >
                      <span className="text-sm">
                        第{item.chapter}章 {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono"
                        style={{
                          borderColor: MOCHA.green,
                          color: MOCHA.green,
                        }}
                      >
                        {item.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4" style={{ color: MOCHA.red }} />
                  <span className="text-sm font-medium" style={{ color: MOCHA.red }}>
                    薄弱章节
                  </span>
                </div>
                <div className="space-y-1.5">
                  {weaknesses.map((item) => (
                    <div
                      key={item.chapter}
                      className="flex items-center justify-between p-2 rounded-md"
                      style={{ backgroundColor: `${MOCHA.red}10` }}
                    >
                      <span className="text-sm">
                        第{item.chapter}章 {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono"
                        style={{
                          borderColor: MOCHA.red,
                          color: MOCHA.red,
                        }}
                      >
                        {item.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

LearnerProfile.displayName = 'LearnerProfile';

export default LearnerProfile;
