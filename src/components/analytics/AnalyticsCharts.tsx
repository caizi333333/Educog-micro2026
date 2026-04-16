import React, { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  // PieChart,
  // Pie,
  // Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WeeklyProgress {
  week: string;
  progress: number;
  timeSpent: number;
}

interface QuizScoreTrend {
  quiz: string;
  score: number;
  date: string;
}

interface AnalyticsChartsProps {
  weeklyProgress: WeeklyProgress[];
  quizScoreTrend: QuizScoreTrend[];
  knowledgeMastery: {
    topic: string;
    mastery: number;
    details: Record<string, number>;
  }[];
}

// const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = memo(({
  weeklyProgress,
  quizScoreTrend,
  knowledgeMastery
}) => {
  // 缓存图表配置
  const chartConfig = useMemo(() => ({
    lineChart: {
      strokeWidth: 2,
      progressColor: '#8884d8',
      timeColor: '#82ca9d'
    },
    barChart: {
      fillColor: '#8884d8',
      domain: [0, 100]
    },
    grid: {
      strokeDasharray: '3 3'
    }
  }), []);

  // 缓存处理后的数据
  const processedData = useMemo(() => ({
    weeklyProgress: weeklyProgress || [],
    quizScoreTrend: quizScoreTrend || [],
    knowledgeMastery: knowledgeMastery || []
  }), [weeklyProgress, quizScoreTrend, knowledgeMastery]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 学习进度趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>学习进度趋势</CardTitle>
          <CardDescription>每周学习进度和时间统计</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processedData.weeklyProgress}>
              <CartesianGrid strokeDasharray={chartConfig.grid.strokeDasharray} />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="progress" 
                stroke={chartConfig.lineChart.progressColor}
                strokeWidth={chartConfig.lineChart.strokeWidth}
                name="进度 (%)"
              />
              <Line 
                type="monotone" 
                dataKey="timeSpent" 
                stroke={chartConfig.lineChart.timeColor}
                strokeWidth={chartConfig.lineChart.strokeWidth}
                name="学习时间 (小时)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 测验分数趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>测验分数趋势</CardTitle>
          <CardDescription>最近测验成绩变化</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.quizScoreTrend}>
              <CartesianGrid strokeDasharray={chartConfig.grid.strokeDasharray} />
              <XAxis dataKey="quiz" />
              <YAxis domain={chartConfig.barChart.domain} />
              <Tooltip />
              <Bar dataKey="score" fill={chartConfig.barChart.fillColor} name="分数" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 知识点掌握度分布 */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>知识点掌握度分布</CardTitle>
          <CardDescription>各知识点掌握程度统计</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processedData.knowledgeMastery} layout="horizontal">
              <CartesianGrid strokeDasharray={chartConfig.grid.strokeDasharray} />
              <XAxis type="number" domain={chartConfig.barChart.domain} />
              <YAxis dataKey="topic" type="category" width={120} />
              <Tooltip />
              <Bar dataKey="mastery" fill={chartConfig.barChart.fillColor} name="掌握度 (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
});

AnalyticsCharts.displayName = 'AnalyticsCharts';

export default AnalyticsCharts;