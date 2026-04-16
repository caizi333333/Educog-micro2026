import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  Activity,
  Calculator,
  Target,
  Clock,
  Users,
  Award,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { colorTheme } from '@/lib/color-theme';

interface MetricData {
  name: string;
  traditional: number;
  aiEnhanced: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  isReverse?: boolean; // 是否是越低越好的指标
}

interface CalculationParams {
  classSize: number;
  conceptComplexity: number;
  teacherExperience: number;
  aiCapability: number;
}

const MetricsCalculator: React.FC = () => {
  const [params, setParams] = useState<CalculationParams>({
    classSize: 40,
    conceptComplexity: 3,
    teacherExperience: 3,
    aiCapability: 4
  });

  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // 实时计算各项指标
  useEffect(() => {
    const calculateMetrics = () => {
      setIsCalculating(true);
      
      // 模拟计算延迟
      setTimeout(() => {
        const newMetrics: MetricData[] = [
          {
            name: '概念理解率',
            traditional: Math.max(20, Math.min(80, 65 - (params.classSize - 30) * 0.5 - (params.conceptComplexity - 3) * 8 + (params.teacherExperience - 3) * 5)),
            aiEnhanced: Math.max(70, Math.min(95, 85 - (params.classSize - 30) * 0.2 - (params.conceptComplexity - 3) * 3 + params.aiCapability * 2)),
            unit: '%',
            icon: <Target className="w-4 h-4" />,
            color: 'blue'
          },
          {
            name: '学习完成时间',
            traditional: Math.max(60, Math.min(180, 120 + (params.classSize - 30) * 1.2 + (params.conceptComplexity - 3) * 15 - (params.teacherExperience - 3) * 8)),
            aiEnhanced: Math.max(45, Math.min(120, 80 + (params.classSize - 30) * 0.5 + (params.conceptComplexity - 3) * 8 - params.aiCapability * 5)),
            unit: '分钟',
            icon: <Clock className="w-4 h-4" />,
            color: 'green',
            isReverse: true
          },
          {
            name: '学生参与度',
            traditional: Math.max(25, Math.min(70, 45 - (params.classSize - 30) * 0.6 - (params.conceptComplexity - 3) * 5 + (params.teacherExperience - 3) * 8)),
            aiEnhanced: Math.max(70, Math.min(95, 88 - (params.classSize - 30) * 0.3 - (params.conceptComplexity - 3) * 2 + params.aiCapability * 1.5)),
            unit: '%',
            icon: <Users className="w-4 h-4" />,
            color: 'purple'
          },
          {
            name: '知识保持率',
            traditional: Math.max(20, Math.min(60, 40 - (params.conceptComplexity - 3) * 8 + (params.teacherExperience - 3) * 6)),
            aiEnhanced: Math.max(60, Math.min(90, 78 - (params.conceptComplexity - 3) * 3 + params.aiCapability * 2.5)),
            unit: '%',
            icon: <Award className="w-4 h-4" />,
            color: 'yellow'
          },
          {
            name: '错误率',
            traditional: Math.max(15, Math.min(50, 35 + (params.classSize - 30) * 0.3 + (params.conceptComplexity - 3) * 5 - (params.teacherExperience - 3) * 3)),
            aiEnhanced: Math.max(5, Math.min(25, 12 + (params.classSize - 30) * 0.1 + (params.conceptComplexity - 3) * 2 - params.aiCapability * 1.5)),
            unit: '%',
            icon: <Activity className="w-4 h-4" />,
            color: 'red',
            isReverse: true
          },
          {
            name: '学习满意度',
            traditional: Math.max(4.0, Math.min(7.5, 6.2 - (params.classSize - 30) * 0.02 - (params.conceptComplexity - 3) * 0.3 + (params.teacherExperience - 3) * 0.4)),
            aiEnhanced: Math.max(7.0, Math.min(10.0, 8.8 - (params.classSize - 30) * 0.01 - (params.conceptComplexity - 3) * 0.15 + params.aiCapability * 0.2)),
            unit: '/10',
            icon: <CheckCircle className="w-4 h-4" />,
            color: 'indigo'
          }
        ].map(metric => ({
          ...metric,
          traditional: Math.round(metric.traditional * 10) / 10,
          aiEnhanced: Math.round(metric.aiEnhanced * 10) / 10
        }));

        setMetrics(newMetrics);
        setIsCalculating(false);
      }, 500);
    };

    calculateMetrics();
  }, [params]);

  const calculateImprovement = (traditional: number, aiEnhanced: number, isReverse = false) => {
    if (isReverse) {
      return Math.round(((traditional - aiEnhanced) / traditional) * 100);
    }
    return Math.round(((aiEnhanced - traditional) / traditional) * 100);
  };

  const getColorClasses = (color: string) => {
    // 使用统一的主题颜色系统
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      blue: colorTheme.chart.blue,
      green: colorTheme.chart.green,
      purple: colorTheme.chart.purple,
      yellow: colorTheme.chart.yellow,
      red: colorTheme.chart.red,
      indigo: colorTheme.chart.indigo
    };
    return colorMap[color] || colorTheme.chart.blue;
  };

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <Calculator className="w-6 h-6" />
          教学效果实时计算器
        </h2>
        <p className="text-muted-foreground">
          基于教学参数实时计算并对比传统教学与AI增强教学的各项指标
        </p>
      </div>

      {/* 参数输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            计算参数设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`text-center p-4 ${colorTheme.neutral.bg} rounded-lg`}>
              <div className="text-2xl font-bold text-foreground">{params.classSize}</div>
              <div className={`text-sm ${colorTheme.neutral.muted}`}>班级人数</div>
            </div>
            <div className={`text-center p-4 ${colorTheme.neutral.bg} rounded-lg`}>
              <div className="text-2xl font-bold text-foreground">{params.conceptComplexity}/5</div>
              <div className={`text-sm ${colorTheme.neutral.muted}`}>概念复杂度</div>
            </div>
            <div className={`text-center p-4 ${colorTheme.neutral.bg} rounded-lg`}>
              <div className="text-2xl font-bold text-foreground">{params.teacherExperience}/5</div>
              <div className={`text-sm ${colorTheme.neutral.muted}`}>教师经验</div>
            </div>
            <div className={`text-center p-4 ${colorTheme.neutral.bg} rounded-lg`}>
              <div className="text-2xl font-bold text-foreground">{params.aiCapability}/5</div>
              <div className={`text-sm ${colorTheme.neutral.muted}`}>AI能力等级</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 计算结果展示 */}
      {isCalculating ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">正在计算教学效果指标...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metrics.map((metric, index) => {
            const colors = getColorClasses(metric.color);
            const improvement = calculateImprovement(metric.traditional, metric.aiEnhanced, metric.isReverse);
            
            return (
              <motion.div
                key={metric.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className={`${colors.border} ${colors.bg}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className={`${colors.text} flex items-center gap-2 text-lg`}>
                      {metric.icon}
                      {metric.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${colorTheme.status.error.text}`}>
                          {metric.traditional}{metric.unit}
                        </div>
                        <div className={`text-xs ${colorTheme.status.error.text}`}>传统教学</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${colorTheme.status.success.text}`}>
                          {metric.aiEnhanced}{metric.unit}
                        </div>
                        <div className={`text-xs ${colorTheme.status.success.text}`}>AI增强</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${colorTheme.neutral.muted}`}>传统教学</span>
                        <span className={`text-sm ${colorTheme.status.error.text}`}>{metric.traditional}{metric.unit}</span>
                      </div>
                      <Progress 
                        value={metric.isReverse ? 100 - metric.traditional : metric.traditional} 
                        className="h-2"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${colorTheme.neutral.muted}`}>AI增强教学</span>
                        <span className={`text-sm ${colorTheme.status.success.text}`}>{metric.aiEnhanced}{metric.unit}</span>
                      </div>
                      <Progress 
                        value={metric.isReverse ? 100 - metric.aiEnhanced : metric.aiEnhanced} 
                        className="h-2"
                      />
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <Badge 
                        className={`${improvement > 0 ? colorTheme.status.success.badge : colorTheme.status.error.badge} flex items-center gap-1`}
                      >
                        {improvement > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {improvement > 0 ? '+' : ''}{improvement}% 
                        {metric.isReverse ? '降低' : '提升'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 综合评估 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              综合效果评估
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 整体改善率 */}
              <div className={`text-center p-6 ${colorTheme.gradient.info} rounded-xl`}>
                <div className="text-4xl font-bold text-white mb-2">
                  {Math.round(metrics.reduce((acc, metric) => {
                    const improvement = calculateImprovement(metric.traditional, metric.aiEnhanced, metric.isReverse);
                    return acc + improvement;
                  }, 0) / metrics.length)}%
                </div>
                <div className="text-sm text-white/90 font-medium">平均改善率</div>
                <div className="text-xs text-white/70 mt-1">相比传统教学</div>
              </div>

              {/* 最佳改善项 */}
              <div className={`text-center p-6 ${colorTheme.gradient.success} rounded-xl`}>
                <div className="text-lg font-bold text-white mb-2">
                  {metrics.length > 0 && metrics[0] ? metrics.reduce((best, current) => {
                    const currentImprovement = calculateImprovement(current.traditional, current.aiEnhanced, current.isReverse);
                    const bestImprovement = calculateImprovement(best.traditional, best.aiEnhanced, best.isReverse);
                    return currentImprovement > bestImprovement ? current : best;
                  }, metrics[0]!).name : '暂无数据'}
                </div>
                <div className="text-sm text-white/90 font-medium">最佳改善项</div>
                <div className="text-xs text-white/70 mt-1">
                  +{metrics.length > 0 ? Math.max(...metrics.map(m => calculateImprovement(m.traditional, m.aiEnhanced, m.isReverse))) : 0}% 提升
                </div>
              </div>

              {/* ROI估算 */}
              <div className={`text-center p-6 ${colorTheme.gradient.primary} rounded-xl`}>
                <div className="text-4xl font-bold text-white mb-2">3.2x</div>
                <div className="text-sm text-white/90 font-medium">投资回报率</div>
                <div className="text-xs text-white/70 mt-1">基于效率提升计算</div>
              </div>
            </div>

            {/* 应用建议 */}
            <div className={`mt-6 p-4 ${colorTheme.status.warning.bg} ${colorTheme.status.warning.border} border rounded-lg`}>
              <h4 className={`font-semibold ${colorTheme.status.warning.text} mb-2`}>应用建议</h4>
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 text-sm ${colorTheme.status.warning.text}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>优先在大班教学中应用AI系统</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>重点关注概念理解和参与度提升</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>结合教师经验与AI能力优势</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>建立持续改进和反馈机制</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default MetricsCalculator;