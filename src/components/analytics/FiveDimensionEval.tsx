import React, { memo, useMemo } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// -- Types ------------------------------------------------------------------

interface FiveDimensionEvalProps {
  scores?: {
    selfLearning: number;       // 0-100
    taskParticipation: number;
    designCompletion: number;
    professionalGrowth: number;
    infoLiteracy: number;
  };
  detailedScores?: {
    videoWatching: number;      // 微视频 5%
    previewWork: number;        // 预习作业 15%
    studyFrequency: number;     // 学习次数 2%
    discussion: number;         // 疑感讨论 3%
    attendance: number;         // 签到 10%
    classInteraction: number;   // 课堂互动 20%
    presentation: number;       // 展示交流 10%
    homework: number;           // 课后作业 15%
    finalExam: number;          // 期末考试 20%
  };
  className?: string;
}

// -- Constants --------------------------------------------------------------

/** Catppuccin Mocha palette */
const MOCHA = {
  rosewater: '#f5e0dc',
  flamingo:  '#f2cdcd',
  pink:      '#f5c2e7',
  mauve:     '#cba6f7',
  red:       '#f38ba8',
  maroon:    '#eba0ac',
  peach:     '#fab387',
  yellow:    '#f9e2af',
  green:     '#a6e3a1',
  teal:      '#94e2d5',
  sky:       '#89dceb',
  sapphire:  '#74c7ec',
  blue:      '#89b4fa',
  lavender:  '#b4befe',
  text:      '#cdd6f4',
  subtext1:  '#bac2de',
  subtext0:  '#a6adc8',
  overlay2:  '#9399b2',
  overlay1:  '#7f849c',
  overlay0:  '#6c7086',
  surface2:  '#585b70',
  surface1:  '#45475a',
  surface0:  '#313244',
  base:      '#1e1e2e',
  mantle:    '#181825',
  crust:     '#11111b',
} as const;

const DIMENSION_COLORS = [
  MOCHA.blue,
  MOCHA.mauve,
  MOCHA.peach,
  MOCHA.green,
  MOCHA.pink,
] as const;

interface DimensionMeta {
  key: keyof NonNullable<FiveDimensionEvalProps['scores']>;
  label: string;
  phase: string;
  subIndicators: string[];
  color: string;
}

const DIMENSIONS: DimensionMeta[] = [
  {
    key: 'selfLearning',
    label: '自主学习开展度',
    phase: '课前',
    subIndicators: ['预习任务完成', '实践活动参与'],
    color: DIMENSION_COLORS[0],
  },
  {
    key: 'taskParticipation',
    label: '任务实施参与度',
    phase: '课中',
    subIndicators: ['积极参与', '专业技能展示'],
    color: DIMENSION_COLORS[1],
  },
  {
    key: 'designCompletion',
    label: '系统设计完成度',
    phase: '课中',
    subIndicators: ['交流展示', '团结协作'],
    color: DIMENSION_COLORS[2],
  },
  {
    key: 'professionalGrowth',
    label: '职业素质成长度',
    phase: '课中',
    subIndicators: ['工作规范', '劳动精神', '工匠精神'],
    color: DIMENSION_COLORS[3],
  },
  {
    key: 'infoLiteracy',
    label: '信息素养提升度',
    phase: '课后',
    subIndicators: ['任务拓展', '创新敬业'],
    color: DIMENSION_COLORS[4],
  },
];

interface WeightItem {
  key: keyof NonNullable<FiveDimensionEvalProps['detailedScores']>;
  label: string;
  weight: number;
  color: string;
}

const WEIGHT_ITEMS: WeightItem[] = [
  { key: 'videoWatching',    label: '微视频',   weight: 5,  color: MOCHA.sky },
  { key: 'previewWork',     label: '预习作业',  weight: 15, color: MOCHA.blue },
  { key: 'studyFrequency',  label: '学习次数',  weight: 2,  color: MOCHA.sapphire },
  { key: 'discussion',      label: '疑感讨论',  weight: 3,  color: MOCHA.lavender },
  { key: 'attendance',      label: '签到',      weight: 10, color: MOCHA.mauve },
  { key: 'classInteraction', label: '课堂互动', weight: 20, color: MOCHA.peach },
  { key: 'presentation',    label: '展示交流',  weight: 10, color: MOCHA.yellow },
  { key: 'homework',        label: '课后作业',  weight: 15, color: MOCHA.green },
  { key: 'finalExam',       label: '期末考试',  weight: 20, color: MOCHA.teal },
];

// -- Defaults ---------------------------------------------------------------

const DEFAULT_SCORES: NonNullable<FiveDimensionEvalProps['scores']> = {
  selfLearning: 78,
  taskParticipation: 85,
  designCompletion: 72,
  professionalGrowth: 88,
  infoLiteracy: 80,
};

const DEFAULT_DETAILED: NonNullable<FiveDimensionEvalProps['detailedScores']> = {
  videoWatching: 90,
  previewWork: 82,
  studyFrequency: 75,
  discussion: 68,
  attendance: 95,
  classInteraction: 85,
  presentation: 78,
  homework: 80,
  finalExam: 76,
};

// -- Helpers ----------------------------------------------------------------

function getLetterGrade(score: number): { letter: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (score >= 90) return { letter: 'A',  variant: 'default' };
  if (score >= 80) return { letter: 'B',  variant: 'default' };
  if (score >= 70) return { letter: 'C',  variant: 'secondary' };
  if (score >= 60) return { letter: 'D',  variant: 'outline' };
  return { letter: 'F', variant: 'destructive' };
}

function getScoreColor(score: number): string {
  if (score >= 90) return MOCHA.green;
  if (score >= 80) return MOCHA.blue;
  if (score >= 70) return MOCHA.yellow;
  if (score >= 60) return MOCHA.peach;
  return MOCHA.red;
}

// -- Custom Tooltip ---------------------------------------------------------

interface RadarPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, unknown>;
}

function RadarTooltip({ active, payload }: { active?: boolean; payload?: RadarPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-md"
      style={{ background: MOCHA.surface0, borderColor: MOCHA.surface2, color: MOCHA.text }}
    >
      <p className="font-medium">{item.payload?.dimension as string}</p>
      <p style={{ color: MOCHA.subtext1 }}>
        得分: <span className="font-semibold" style={{ color: getScoreColor(item.value ?? 0) }}>{item.value}</span>
      </p>
    </div>
  );
}

// -- Sub-components ---------------------------------------------------------

/** Radar chart card */
const RadarSection: React.FC<{ data: { dimension: string; score: number; fullMark: number }[] }> = memo(({ data }) => (
  <Card className="border-0" style={{ background: MOCHA.surface0 }}>
    <CardHeader>
      <CardTitle style={{ color: MOCHA.text }}>五维度雷达图</CardTitle>
      <CardDescription style={{ color: MOCHA.subtext0 }}>多元评价维度综合分布</CardDescription>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke={MOCHA.surface2} />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: MOCHA.subtext1, fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: MOCHA.overlay0, fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name="评价得分"
            dataKey="score"
            stroke={MOCHA.blue}
            fill={MOCHA.blue}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
));
RadarSection.displayName = 'RadarSection';

/** Score breakdown list */
const ScoreBreakdown: React.FC<{
  scores: NonNullable<FiveDimensionEvalProps['scores']>;
}> = memo(({ scores }) => (
  <Card className="border-0" style={{ background: MOCHA.surface0 }}>
    <CardHeader>
      <CardTitle style={{ color: MOCHA.text }}>各维度分项评价</CardTitle>
      <CardDescription style={{ color: MOCHA.subtext0 }}>五维度得分及子指标</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      {DIMENSIONS.map((dim) => {
        const score = scores[dim.key];
        return (
          <div key={dim.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: dim.color }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium" style={{ color: MOCHA.text }}>
                  {dim.label}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: MOCHA.overlay0, color: MOCHA.subtext1 }}>
                  {dim.phase}
                </Badge>
              </div>
              <span className="text-sm font-semibold tabular-nums" style={{ color: getScoreColor(score) }}>
                {score}
              </span>
            </div>
            <Progress
              value={score}
              className="h-2"
              style={{ background: MOCHA.surface1 }}
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {dim.subIndicators.map((sub) => (
                <span
                  key={sub}
                  className="text-[11px] rounded px-1.5 py-0.5"
                  style={{ background: MOCHA.surface1, color: MOCHA.subtext0 }}
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </CardContent>
  </Card>
));
ScoreBreakdown.displayName = 'ScoreBreakdown';

/** Overall grade card */
const OverallGrade: React.FC<{
  compositeScore: number;
  detailedScores: NonNullable<FiveDimensionEvalProps['detailedScores']>;
}> = memo(({ compositeScore, detailedScores }) => {
  const grade = getLetterGrade(compositeScore);

  // Build per-item weighted contribution data
  const contributionData = WEIGHT_ITEMS.map((item) => ({
    label: item.label,
    weighted: Number(((detailedScores[item.key] * item.weight) / 100).toFixed(1)),
    weight: item.weight,
    raw: detailedScores[item.key],
    color: item.color,
  }));

  return (
    <Card className="border-0" style={{ background: MOCHA.surface0 }}>
      <CardHeader>
        <CardTitle style={{ color: MOCHA.text }}>综合成绩</CardTitle>
        <CardDescription style={{ color: MOCHA.subtext0 }}>加权复合评分</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 mb-6">
          {/* Big grade circle */}
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-4xl font-bold"
            style={{ background: MOCHA.surface1, color: getScoreColor(compositeScore) }}
            role="img"
            aria-label={`综合成绩 ${grade.letter} (${compositeScore.toFixed(1)}分)`}
          >
            {grade.letter}
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold tabular-nums" style={{ color: MOCHA.text }}>
              {compositeScore.toFixed(1)}
              <span className="text-base font-normal ml-1" style={{ color: MOCHA.subtext0 }}>/ 100</span>
            </p>
            <p className="text-sm" style={{ color: MOCHA.subtext1 }}>
              基于 {WEIGHT_ITEMS.length} 项指标加权计算
            </p>
          </div>
        </div>

        {/* Stacked contribution bar (horizontal) */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: MOCHA.subtext0 }}>
            各指标加权贡献
          </p>
          <div className="flex h-5 w-full overflow-hidden rounded-full" role="img" aria-label="各指标加权贡献条形图">
            {contributionData.map((d) => (
              <div
                key={d.label}
                className="h-full transition-all"
                style={{ width: `${d.weight}%`, background: d.color }}
                title={`${d.label}: ${d.raw}分 (权重${d.weight}%, 贡献${d.weighted}分)`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
            {contributionData.map((d) => (
              <span key={d.label} className="flex items-center gap-1 text-[11px]" style={{ color: MOCHA.subtext1 }}>
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: d.color }} aria-hidden="true" />
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
OverallGrade.displayName = 'OverallGrade';

/** Weight visualization bar chart (Figure 13 model) */
const WeightVisualization: React.FC<{
  detailedScores: NonNullable<FiveDimensionEvalProps['detailedScores']>;
}> = memo(({ detailedScores }) => {
  const chartData = WEIGHT_ITEMS.map((item) => ({
    name: `${item.label} (${item.weight}%)`,
    score: detailedScores[item.key],
    weight: item.weight,
    color: item.color,
  }));

  return (
    <Card className="border-0" style={{ background: MOCHA.surface0 }}>
      <CardHeader>
        <CardTitle style={{ color: MOCHA.text }}>多指标权重模型</CardTitle>
        <CardDescription style={{ color: MOCHA.subtext0 }}>
          课程评价指标权重分配及得分 (对应申报书图13)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={MOCHA.surface2} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: MOCHA.subtext0, fontSize: 11 }}
              axisLine={{ stroke: MOCHA.surface2 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: MOCHA.subtext1, fontSize: 11 }}
              axisLine={{ stroke: MOCHA.surface2 }}
            />
            <Tooltip
              cursor={{ fill: MOCHA.surface1 }}
              contentStyle={{
                background: MOCHA.surface0,
                border: `1px solid ${MOCHA.surface2}`,
                borderRadius: 8,
                color: MOCHA.text,
              }}
              formatter={(value: number) => [`${value} 分`, '得分']}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={22}>
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Weight table */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {WEIGHT_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex flex-col items-center rounded-lg p-2 text-center"
              style={{ background: MOCHA.surface1 }}
            >
              <span className="text-lg font-bold tabular-nums" style={{ color: item.color }}>
                {item.weight}%
              </span>
              <span className="text-[11px]" style={{ color: MOCHA.subtext0 }}>
                {item.label}
              </span>
              <span className="text-xs font-medium tabular-nums mt-0.5" style={{ color: MOCHA.text }}>
                {detailedScores[item.key]}分
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
WeightVisualization.displayName = 'WeightVisualization';

// -- Main Component ---------------------------------------------------------

export const FiveDimensionEval: React.FC<FiveDimensionEvalProps> = memo(({
  scores: scoresProp,
  detailedScores: detailedProp,
  className,
}) => {
  const scores = scoresProp ?? DEFAULT_SCORES;
  const detailedScores = detailedProp ?? DEFAULT_DETAILED;

  // Radar chart data
  const radarData = useMemo(
    () =>
      DIMENSIONS.map((dim) => ({
        dimension: dim.label,
        score: scores[dim.key],
        fullMark: 100,
      })),
    [scores],
  );

  // Composite weighted score
  const compositeScore = useMemo(
    () =>
      WEIGHT_ITEMS.reduce(
        (sum, item) => sum + (detailedScores[item.key] * item.weight) / 100,
        0,
      ),
    [detailedScores],
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Row 1: Radar + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RadarSection data={radarData} />
        <ScoreBreakdown scores={scores} />
      </div>

      {/* Row 2: Overall Grade + Weight Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverallGrade compositeScore={compositeScore} detailedScores={detailedScores} />
        <WeightVisualization detailedScores={detailedScores} />
      </div>
    </div>
  );
});

FiveDimensionEval.displayName = 'FiveDimensionEval';

export default FiveDimensionEval;
