import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  ArrowRight,
  PlayCircle,
  BarChart3,
  Calculator,
  MapPin,
  Zap
} from 'lucide-react';
import InteractiveSimulator from '@/components/enhanced/pain-points/InteractiveSimulator';
import MetricsCalculator from '@/components/enhanced/pain-points/MetricsCalculator';
import ConcreteScenarios from '@/components/enhanced/pain-points/ConcreteScenarios';

interface PainPoint {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affectedStudents: number;
  traditionalSolution: string;
  aiSolution: string;
  improvementRate: number;
  demoVideo?: string;
  beforeAfterData: {
    before: { metric: string; value: number; unit: string }[];
    after: { metric: string; value: number; unit: string }[];
  };
}

const painPoints: PainPoint[] = [
  {
    id: 'abstract-concepts',
    title: '抽象概念理解困难',
    description: '学生难以理解寄存器、中断、定时器等抽象概念',
    severity: 'high',
    affectedStudents: 85,
    traditionalSolution: '教师口头讲解 + 静态图片展示',
    aiSolution: 'AI驱动的3D可视化 + 交互式概念图谱 + 个性化类比解释',
    improvementRate: 78,
    beforeAfterData: {
      before: [
        { metric: '概念理解率', value: 45, unit: '%' },
        { metric: '学习时间', value: 120, unit: '分钟' },
        { metric: '记忆保持率', value: 35, unit: '%' }
      ],
      after: [
        { metric: '概念理解率', value: 82, unit: '%' },
        { metric: '学习时间', value: 75, unit: '分钟' },
        { metric: '记忆保持率', value: 78, unit: '%' }
      ]
    }
  },
  {
    id: 'debugging-skills',
    title: '调试技能薄弱',
    description: '学生缺乏系统的代码调试方法和错误定位能力',
    severity: 'high',
    affectedStudents: 92,
    traditionalSolution: '教师示范调试过程 + 学生模仿练习',
    aiSolution: 'AI智能错误诊断 + 逐步调试指导 + 错误模式识别训练',
    improvementRate: 85,
    beforeAfterData: {
      before: [
        { metric: '错误定位速度', value: 25, unit: '分钟' },
        { metric: '调试成功率', value: 38, unit: '%' },
        { metric: '独立解决率', value: 22, unit: '%' }
      ],
      after: [
        { metric: '错误定位速度', value: 8, unit: '分钟' },
        { metric: '调试成功率', value: 89, unit: '%' },
        { metric: '独立解决率', value: 76, unit: '%' }
      ]
    }
  },
  {
    id: 'practical-application',
    title: '理论与实践脱节',
    description: '学生难以将理论知识应用到实际项目中',
    severity: 'high',
    affectedStudents: 78,
    traditionalSolution: '课堂理论讲解 + 简单实验验证',
    aiSolution: 'AI项目推荐引擎 + 渐进式实践路径 + 实时应用指导',
    improvementRate: 72,
    beforeAfterData: {
      before: [
        { metric: '项目完成率', value: 42, unit: '%' },
        { metric: '知识应用率', value: 28, unit: '%' },
        { metric: '创新能力', value: 15, unit: '%' }
      ],
      after: [
        { metric: '项目完成率', value: 88, unit: '%' },
        { metric: '知识应用率', value: 75, unit: '%' },
        { metric: '创新能力', value: 58, unit: '%' }
      ]
    }
  },
  {
    id: 'learning-motivation',
    title: '学习动机不足',
    description: '学生对单片机学习缺乏兴趣和持续动力',
    severity: 'medium',
    affectedStudents: 68,
    traditionalSolution: '教师激励 + 成绩评价',
    aiSolution: 'AI个性化激励系统 + 游戏化学习 + 成就系统',
    improvementRate: 65,
    beforeAfterData: {
      before: [
        { metric: '学习积极性', value: 35, unit: '%' },
        { metric: '课程完成率', value: 58, unit: '%' },
        { metric: '自主学习时间', value: 45, unit: '分钟/周' }
      ],
      after: [
        { metric: '学习积极性', value: 82, unit: '%' },
        { metric: '课程完成率', value: 91, unit: '%' },
        { metric: '自主学习时间', value: 125, unit: '分钟/周' }
      ]
    }
  }
];

const TeachingPainPointsDemo: React.FC = () => {
  const [selectedPainPoint, setSelectedPainPoint] = useState<string>(painPoints[0]?.id || '');
  const [activeTab, setActiveTab] = useState<string>('overview');

  const currentPainPoint = painPoints.find(p => p.id === selectedPainPoint) || painPoints[0];
  
  // 确保 currentPainPoint 不为 undefined
  if (!currentPainPoint) {
    return <div>加载中...</div>;
  }

  // 类型断言，确保 TypeScript 知道 currentPainPoint 不为 undefined
  const safePainPoint = currentPainPoint as PainPoint;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <Clock className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          教学痛点具象化展示
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          基于真实教学场景，展示传统教学方法的局限性以及AI平台的创新解决方案
        </p>
      </div>

      {/* 痛点选择器 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {painPoints.map((painPoint) => (
          <Card 
            key={painPoint.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedPainPoint === painPoint.id 
                ? 'ring-2 ring-blue-500 bg-blue-50' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedPainPoint(painPoint.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge className={`${getSeverityColor(painPoint.severity)} flex items-center gap-1`}>
                  {getSeverityIcon(painPoint.severity)}
                  {painPoint.severity === 'high' ? '高' : painPoint.severity === 'medium' ? '中' : '低'}
                </Badge>
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="w-4 h-4 mr-1" />
                  {painPoint.affectedStudents}%
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {painPoint.title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {painPoint.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 详细展示区域 */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{safePainPoint.title}</CardTitle>
            <div className="flex items-center gap-4">
              <Badge className={`${getSeverityColor(safePainPoint.severity)} flex items-center gap-1`}>
                {getSeverityIcon(safePainPoint.severity)}
                严重程度: {safePainPoint.severity === 'high' ? '高' : safePainPoint.severity === 'medium' ? '中' : '低'}
              </Badge>
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-1" />
                影响学生: {safePainPoint.affectedStudents}%
              </div>
            </div>
          </div>
          <p className="text-gray-600">{safePainPoint.description}</p>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">解决方案对比</TabsTrigger>
              <TabsTrigger value="data">效果数据</TabsTrigger>
              <TabsTrigger value="simulator" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                交互模拟器
              </TabsTrigger>
              <TabsTrigger value="calculator" className="flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                数据计算器
              </TabsTrigger>
              <TabsTrigger value="scenarios" className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                真实案例
              </TabsTrigger>
              <TabsTrigger value="demo">演示视频</TabsTrigger>
              <TabsTrigger value="implementation">实施方案</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 传统解决方案 */}
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-red-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      传统教学方法
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-700">{safePainPoint.traditionalSolution}</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center text-sm text-red-600">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                        效果有限，难以个性化
                      </div>
                      <div className="flex items-center text-sm text-red-600">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                        依赖教师经验，标准化程度低
                      </div>
                      <div className="flex items-center text-sm text-red-600">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                        学生参与度和反馈机制不足
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI创新解决方案 */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-800 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      AI创新解决方案
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-green-700">{safePainPoint.aiSolution}</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center text-sm text-green-600">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        智能化、个性化教学
                      </div>
                      <div className="flex items-center text-sm text-green-600">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        数据驱动，持续优化
                      </div>
                      <div className="flex items-center text-sm text-green-600">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        实时反馈，互动性强
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-green-600">改善效果:</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-800">
                          +{safePainPoint.improvementRate}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="simulator" className="space-y-6">
              <InteractiveSimulator />
            </TabsContent>

            <TabsContent value="calculator" className="space-y-6">
              <MetricsCalculator />
            </TabsContent>

            <TabsContent value="scenarios" className="space-y-6">
              <ConcreteScenarios />
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 改进前数据 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">传统方法效果</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {safePainPoint.beforeAfterData.before.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{item.metric}</span>
                          <span className="text-sm text-gray-600">
                            {item.value}{item.unit}
                          </span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 改进后数据 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">AI方案效果</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {safePainPoint.beforeAfterData.after.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{item.metric}</span>
                          <span className="text-sm text-gray-600">
                            {item.value}{item.unit}
                          </span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* 改善对比图表 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    效果对比分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {safePainPoint.beforeAfterData.before.map((beforeItem, index) => {
                      const afterItem = safePainPoint.beforeAfterData.after[index];
                      if (!afterItem) return null;
                      const improvement = ((afterItem.value - beforeItem.value) / beforeItem.value * 100).toFixed(1);
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <span className="font-medium">{beforeItem.metric}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-red-600">
                              {beforeItem.value}{beforeItem.unit}
                            </span>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="text-green-600">
                              {afterItem.value}{afterItem.unit}
                            </span>
                            <Badge className="bg-green-100 text-green-800">
                              +{improvement}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="demo" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="w-5 h-5" />
                    解决方案演示
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <PlayCircle className="w-16 h-16 text-gray-400 mx-auto" />
                      <div>
                        <h3 className="font-semibold text-gray-700">
                          {safePainPoint.title} - AI解决方案演示
                        </h3>
                        <p className="text-sm text-gray-500 mt-2">
                          点击播放查看AI平台如何解决这一教学痛点
                        </p>
                        <Button className="mt-4">
                          播放演示视频
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="implementation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>实施方案与步骤</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              1
                            </div>
                            <h4 className="font-semibold text-blue-800">问题识别</h4>
                          </div>
                          <p className="text-sm text-blue-700">
                            通过数据分析和用户反馈，精确识别教学痛点的具体表现和影响范围
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              2
                            </div>
                            <h4 className="font-semibold text-green-800">AI方案设计</h4>
                          </div>
                          <p className="text-sm text-green-700">
                            基于AI技术特点，设计针对性的解决方案，包括算法选择和功能设计
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-purple-200 bg-purple-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              3
                            </div>
                            <h4 className="font-semibold text-purple-800">效果验证</h4>
                          </div>
                          <p className="text-sm text-purple-700">
                            通过A/B测试和用户反馈，验证AI解决方案的实际效果和改进空间
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="font-semibold mb-4">关键成功因素</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">精准的问题定义和需求分析</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">先进的AI算法和技术支撑</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">用户友好的界面设计</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">持续的数据收集和分析</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">教师培训和支持体系</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">迭代优化和功能完善</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeachingPainPointsDemo;