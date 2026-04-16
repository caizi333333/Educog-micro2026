'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Code, 
  Search, 
  TrendingUp, 
  Zap, 
  Eye, 
  MessageSquare, 
  Target,
  Cpu,
  Network,
  BarChart3,
  Lightbulb,
  Rocket,
  Shield,
  Sparkles,
  Award,
  Play
} from 'lucide-react';

// 导入增强组件
import LiveDemo from '@/components/enhanced/innovation/LiveDemo';
import CompetitiveMatrix from '@/components/enhanced/innovation/CompetitiveMatrix';
import TechHighlights from '@/components/enhanced/innovation/TechHighlights';

interface AIFeature {
  id: string;
  title: string;
  description: string;
  category: 'generation' | 'analysis' | 'prediction' | 'interaction';
  innovationLevel: number;
  capabilities: string[];
  technicalSpecs: {
    algorithm: string;
    accuracy: number;
    responseTime: string;
    supportedLanguages: string[];
  };
  useCases: {
    scenario: string;
    benefit: string;
    improvement: number;
  }[];
  demoData?: any;
}

const aiFeatures: AIFeature[] = [
  {
    id: 'intelligent-code-generation',
    title: '智能代码生成',
    description: '基于自然语言描述，自动生成高质量的8051单片机代码',
    category: 'generation',
    innovationLevel: 95,
    capabilities: [
      '自然语言理解与代码转换',
      '多种编程模式支持',
      '代码优化建议',
      '实时语法检查',
      '注释自动生成'
    ],
    technicalSpecs: {
      algorithm: 'Transformer + Code-specific Fine-tuning',
      accuracy: 92,
      responseTime: '< 2秒',
      supportedLanguages: ['C', 'Assembly', 'Pseudo-code']
    },
    useCases: [
      {
        scenario: '初学者快速入门',
        benefit: '降低编程门槛，提高学习效率',
        improvement: 78
      },
      {
        scenario: '复杂功能实现',
        benefit: '减少开发时间，提高代码质量',
        improvement: 65
      },
      {
        scenario: '代码学习与理解',
        benefit: '通过示例学习最佳实践',
        improvement: 82
      }
    ]
  },
  {
    id: 'predictive-learning-analytics',
    title: '预测性学习分析',
    description: '基于学习行为数据，预测学习困难并提供个性化干预',
    category: 'prediction',
    innovationLevel: 88,
    capabilities: [
      '学习轨迹分析',
      '困难点预测',
      '个性化推荐',
      '学习效果评估',
      '风险预警系统'
    ],
    technicalSpecs: {
      algorithm: 'LSTM + Attention Mechanism',
      accuracy: 87,
      responseTime: '实时',
      supportedLanguages: ['多语言支持']
    },
    useCases: [
      {
        scenario: '学习困难预警',
        benefit: '提前识别学习问题，及时干预',
        improvement: 73
      },
      {
        scenario: '个性化学习路径',
        benefit: '优化学习顺序，提高学习效率',
        improvement: 68
      },
      {
        scenario: '学习效果评估',
        benefit: '客观评价学习成果，指导教学',
        improvement: 75
      }
    ]
  },
  {
    id: 'multimodal-interaction',
    title: '多模态交互系统',
    description: '支持语音、文本、图像等多种交互方式的智能助教',
    category: 'interaction',
    innovationLevel: 91,
    capabilities: [
      '语音识别与合成',
      '图像理解与分析',
      '手势识别',
      '情感计算',
      '上下文理解'
    ],
    technicalSpecs: {
      algorithm: 'Multimodal Transformer + Cross-attention',
      accuracy: 89,
      responseTime: '< 1秒',
      supportedLanguages: ['中文', '英文', '多方言']
    },
    useCases: [
      {
        scenario: '语音编程指导',
        benefit: '解放双手，提高编程效率',
        improvement: 58
      },
      {
        scenario: '电路图识别',
        benefit: '快速理解电路结构，生成代码',
        improvement: 72
      },
      {
        scenario: '情感化学习支持',
        benefit: '识别学习情绪，提供个性化鼓励',
        improvement: 45
      }
    ]
  },
  {
    id: 'intelligent-error-analysis',
    title: '智能错误分析',
    description: '深度分析代码错误，提供精准的修复建议和学习指导',
    category: 'analysis',
    innovationLevel: 85,
    capabilities: [
      '语法错误检测',
      '逻辑错误分析',
      '性能问题识别',
      '安全漏洞扫描',
      '最佳实践建议'
    ],
    technicalSpecs: {
      algorithm: 'Graph Neural Network + Rule-based System',
      accuracy: 94,
      responseTime: '< 3秒',
      supportedLanguages: ['C', 'Assembly']
    },
    useCases: [
      {
        scenario: '代码调试辅助',
        benefit: '快速定位错误，提供修复方案',
        improvement: 85
      },
      {
        scenario: '代码质量提升',
        benefit: '识别潜在问题，优化代码结构',
        improvement: 67
      },
      {
        scenario: '学习错误模式',
        benefit: '分析常见错误，避免重复犯错',
        improvement: 71
      }
    ]
  }
];

const AIInnovationShowcase: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<string>(aiFeatures[0]?.id || 'intelligent-code-generation');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [animationProgress, setAnimationProgress] = useState<number>(0);

  const currentFeature = aiFeatures.find(f => f.id === selectedFeature) || aiFeatures[0];

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationProgress(prev => (prev + 1) % 101);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'generation': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'analysis': return 'bg-green-100 text-green-800 border-green-200';
      case 'prediction': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'interaction': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'generation': return <Code className="w-4 h-4" />;
      case 'analysis': return <Search className="w-4 h-4" />;
      case 'prediction': return <TrendingUp className="w-4 h-4" />;
      case 'interaction': return <MessageSquare className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'generation': return '智能生成';
      case 'analysis': return '智能分析';
      case 'prediction': return '预测分析';
      case 'interaction': return '交互系统';
      default: return '其他';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI功能创新展示
          </h1>
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            创新升级
          </Badge>
        </div>
        <p className="text-lg text-gray-600 max-w-4xl mx-auto">
          全方位展示平台最前沿的AI技术应用，包括现场演示、竞争对比、技术亮点等创新功能，突出我们在教育科技领域的领先优势
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <Badge className="bg-blue-100 text-blue-800 px-3 py-1">
            <Play className="w-3 h-3 mr-1" />
            实时演示
          </Badge>
          <Badge className="bg-green-100 text-green-800 px-3 py-1">
            <Target className="w-3 h-3 mr-1" />
            竞争对比
          </Badge>
          <Badge className="bg-purple-100 text-purple-800 px-3 py-1">
            <Award className="w-3 h-3 mr-1" />
            技术亮点
          </Badge>
        </div>
      </div>

      {/* 创新指标概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">AI功能模块</p>
                <p className="text-2xl font-bold">{aiFeatures.length}</p>
              </div>
              <Cpu className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">平均准确率</p>
                <p className="text-2xl font-bold">
                  {Math.round(aiFeatures.reduce((acc, f) => acc + f.technicalSpecs.accuracy, 0) / aiFeatures.length)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">创新水平</p>
                <p className="text-2xl font-bold">
                  {Math.round(aiFeatures.reduce((acc, f) => acc + f.innovationLevel, 0) / aiFeatures.length)}%
                </p>
              </div>
              <Rocket className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">响应速度</p>
                <p className="text-2xl font-bold">&lt; 2s</p>
              </div>
              <Zap className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI功能选择器 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {aiFeatures.map((feature) => (
          <Card 
            key={feature.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedFeature === feature.id 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedFeature(feature.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge className={`${getCategoryColor(feature.category)} flex items-center gap-1`}>
                  {getCategoryIcon(feature.category)}
                  {getCategoryName(feature.category)}
                </Badge>
                <div className="flex items-center text-sm text-gray-500">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  {feature.innovationLevel}%
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {feature.description}
              </p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>创新水平</span>
                  <span>{feature.innovationLevel}%</span>
                </div>
                <Progress value={feature.innovationLevel} className="h-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 详细展示区域 */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2">
                {getCategoryIcon(currentFeature?.category || 'generation')}
                {currentFeature?.title}
              </CardTitle>
            <div className="flex items-center gap-4">
              <Badge className={`${getCategoryColor(currentFeature?.category || 'generation')} flex items-center gap-1`}>
                {getCategoryIcon(currentFeature?.category || 'generation')}
                {getCategoryName(currentFeature?.category || 'generation')}
              </Badge>
              <div className="flex items-center text-sm text-gray-600">
                <Rocket className="w-4 h-4 mr-1" />
                创新水平: {currentFeature?.innovationLevel}%
              </div>
            </div>
          </div>
          <p className="text-gray-600">{currentFeature?.description}</p>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">功能概览</TabsTrigger>
              <TabsTrigger value="technical">技术规格</TabsTrigger>
              <TabsTrigger value="usecases">应用场景</TabsTrigger>
              <TabsTrigger value="demo">实时演示</TabsTrigger>
              <TabsTrigger value="livedemo">现场演示</TabsTrigger>
              <TabsTrigger value="competitive">竞争对比</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 核心能力 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      核心能力
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentFeature?.capabilities.map((capability, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm">{capability}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 创新亮点 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      创新亮点
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">技术先进性</span>
                        <div className="flex items-center gap-2">
                          <Progress value={currentFeature?.innovationLevel} className="w-20 h-2" />
                          <span className="text-sm text-gray-600">{currentFeature?.innovationLevel}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">准确率</span>
                        <div className="flex items-center gap-2">
                          <Progress value={currentFeature?.technicalSpecs.accuracy} className="w-20 h-2" />
                          <span className="text-sm text-gray-600">{currentFeature?.technicalSpecs.accuracy}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">响应速度</span>
                        <Badge className="bg-green-100 text-green-800">
                          {currentFeature?.technicalSpecs.responseTime}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">支持语言</span>
                        <span className="text-sm text-gray-600">
                          {currentFeature?.technicalSpecs.supportedLanguages.length} 种
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 算法架构 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Network className="w-5 h-5" />
                      算法架构
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">核心算法</label>
                        <p className="text-sm text-gray-600 mt-1">
                          {currentFeature?.technicalSpecs.algorithm}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">准确率</label>
                          <div className="mt-1">
                            <Progress value={currentFeature?.technicalSpecs.accuracy} className="h-2" />
                            <span className="text-xs text-gray-500">
                              {currentFeature?.technicalSpecs.accuracy}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">响应时间</label>
                          <p className="text-sm text-gray-600 mt-1">
                            {currentFeature?.technicalSpecs.responseTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 技术指标 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      性能指标
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">算法复杂度</span>
                        <Badge className="bg-gray-100 text-gray-800">O(n log n)</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium">内存占用</span>
                        <Badge className="bg-green-100 text-green-800">&lt; 512MB</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium">并发处理</span>
                        <Badge className="bg-purple-100 text-purple-800">1000+ 用户</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <span className="text-sm font-medium">可扩展性</span>
                        <Badge className="bg-orange-100 text-orange-800">水平扩展</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="usecases" className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {currentFeature?.useCases.map((useCase, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            {useCase.scenario}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {useCase.benefit}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="font-semibold text-green-600">
                              +{useCase.improvement}%
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">效果提升</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={useCase.improvement} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="demo" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    实时演示
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* 模拟演示界面 */}
                    <div className="bg-slate-800 text-slate-100 p-4 rounded-lg font-mono text-sm border border-slate-600">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-emerald-300">AI {currentFeature?.title} 实时演示</span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-slate-300">&gt; 初始化AI模型...</div>
                        <div className="text-slate-300">&gt; 加载训练数据...</div>
                        <div className="text-slate-300">&gt; 准备就绪，等待输入...</div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">&gt; 处理进度:</span>
                          <div className="flex-1 bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-emerald-400 h-2 rounded-full transition-all duration-100"
                              style={{ width: `${animationProgress}%` }}
                            ></div>
                          </div>
                          <span className="text-emerald-300">{animationProgress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 功能演示按钮 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button className="h-12" variant="outline">
                        <Code className="w-4 h-4 mr-2" />
                        代码生成演示
                      </Button>
                      <Button className="h-12" variant="outline">
                        <Search className="w-4 h-4 mr-2" />
                        错误分析演示
                      </Button>
                      <Button className="h-12" variant="outline">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        交互演示
                      </Button>
                    </div>

                    {/* 演示说明 */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-2">演示说明</h4>
                      <p className="text-sm text-gray-700">
                        此演示展示了{currentFeature?.title}的核心功能和实际应用效果。
                        通过实时数据处理和算法运算，展现AI技术在教育场景中的创新应用。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="livedemo" className="space-y-6">
              <LiveDemo />
            </TabsContent>

            <TabsContent value="competitive" className="space-y-6">
              <CompetitiveMatrix />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 技术亮点展示 */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Award className="w-6 h-6 text-yellow-500" />
            技术亮点与创新突破
          </CardTitle>
          <p className="text-gray-600">展示平台核心技术优势和创新突破</p>
        </CardHeader>
        <CardContent>
          <TechHighlights />
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInnovationShowcase;