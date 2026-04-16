'use client';
import { PolarGrid, PolarAngleAxis, Radar, RadarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  { level: '记忆', score: 82 },
  { level: '理解', score: 75 },
  { level: '应用', score: 60 },
  { level: '分析', score: 55 },
  { level: '评估', score: 45 },
  { level: '创造', score: 30 },
];

const chartConfig = {
  score: {
    label: '分数',
    color: 'hsl(var(--primary))',
  },
};

interface WeeklyProgressData {
  week: string;
  progress: number;
  [key: string]: unknown;
}

interface QuizScoreData {
  date: string;
  score: number;
  [key: string]: unknown;
}

interface KnowledgeMasteryData {
  topic: string;
  mastery: number;
  [key: string]: unknown;
}

interface AnalyticsChartsProps {
  weeklyProgress?: WeeklyProgressData[];
  quizScoreTrend?: QuizScoreData[];
  knowledgeMastery?: KnowledgeMasteryData[];
  loading?: boolean;
}

export function AnalyticsCharts({ loading }: AnalyticsChartsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[350px] -mt-4">
        <RadarChart data={chartData}>
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <PolarAngleAxis dataKey="level" tick={{ fill: 'hsl(var(--foreground))', fontSize: 13 }} />
          <PolarGrid />
          <Radar
            dataKey="score"
            fill="var(--color-score)"
            fillOpacity={0.6}
            stroke="var(--color-score)"
          />
        </RadarChart>
    </ChartContainer>
  );
}
