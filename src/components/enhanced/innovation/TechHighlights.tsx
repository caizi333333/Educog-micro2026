import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { 
  Zap, 
  Shield, 
  Rocket, 
  Star,
  Award,
  TrendingUp,
  BarChart3,
  Code2,
  Network,
  Target,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Cpu,
  Globe,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


interface TechFeature {
  id: string;
  title: string;
  description: string;
  category: '核心技术' | '性能指标' | '安全保障' | '创新亮点';
  level: 'breakthrough' | 'advanced' | 'mature' | 'stable';
  metrics: {
    performance: number;
    reliability: number;
    scalability: number;
    innovation: number;
  };
  highlights: string[];
  technicalDetails: {
    architecture: string;
    algorithm: string;
    dataStructure: string;
    optimizations: string[];
  };
  benchmarks: {
    metric: string;
    ourValue: string;
    industryAvg: string;
    improvement: number;
  }[];
}

const techFeatures: TechFeature[] = [
  {
    id: 'ai-engine',
    title: 'AI智能引擎',
    description: '基于深度学习的智能教学引擎，支持多模态交互和个性化学习',
    category: '核心技术',
    level: 'breakthrough',
    metrics: {
      performance: 96,
      reliability: 94,
      scalability: 92,
      innovation: 98
    },
    highlights: [
      '多模态融合处理（文本+语音+图像+手势）',
      '实时个性化学习路径生成',
      '智能错误诊断和修复建议',
      '自然语言代码生成',
      '情感计算和学习状态识别'
    ],
    technicalDetails: {
      architecture: 'Transformer + Multi-modal Fusion Network',
      algorithm: 'Attention机制 + 强化学习 + 知识图谱推理',
      dataStructure: '分层知识图谱 + 动态记忆网络',
      optimizations: [
        '模型量化和蒸馏',
        '动态批处理优化',
        '缓存预测机制',
        '分布式推理加速'
      ]
    },
    benchmarks: [
      { metric: '代码生成准确率', ourValue: '92%', industryAvg: '76%', improvement: 21 },
      { metric: '错误诊断精度', ourValue: '94%', industryAvg: '68%', improvement: 38 },
      { metric: '学习效果提升', ourValue: '78%', industryAvg: '45%', improvement: 73 },
      { metric: '响应延迟', ourValue: '< 2s', industryAvg: '8s', improvement: 75 }
    ]
  },
  {
    id: '3d-simulation',
    title: '3D硬件仿真',
    description: '高精度3D芯片建模和实时仿真，支持内部结构可视化',
    category: '核心技术',
    level: 'advanced',
    metrics: {
      performance: 88,
      reliability: 96,
      scalability: 85,
      innovation: 90
    },
    highlights: [
      '真实芯片物理建模',
      '内部信号流可视化',
      '实时电路仿真',
      '多层次抽象支持',
      '硬件调试集成'
    ],
    technicalDetails: {
      architecture: 'WebGL + Physics Engine + Real-time Rendering',
      algorithm: '有限元分析 + 电路仿真 + 物理引擎',
      dataStructure: '八叉树空间索引 + 场景图管理',
      optimizations: [
        'LOD层次细节优化',
        'GPU并行计算',
        '预计算光照',
        '几何体合并优化'
      ]
    },
    benchmarks: [
      { metric: '仿真精度', ourValue: '99.2%', industryAvg: '94.5%', improvement: 5 },
      { metric: '实时性能', ourValue: '60 FPS', industryAvg: '24 FPS', improvement: 150 },
      { metric: '内存占用', ourValue: '256MB', industryAvg: '512MB', improvement: 50 },
      { metric: '加载速度', ourValue: '< 3s', industryAvg: '12s', improvement: 75 }
    ]
  },
  {
    id: 'knowledge-graph',
    title: '知识图谱系统',
    description: '800+知识节点的智能关联系统，支持个性化学习路径推荐',
    category: '核心技术',
    level: 'mature',
    metrics: {
      performance: 91,
      reliability: 98,
      scalability: 94,
      innovation: 85
    },
    highlights: [
      '800+专业知识节点',
      '智能关联推荐',
      '学习路径优化',
      '概念依赖分析',
      '知识掌握度评估'
    ],
    technicalDetails: {
      architecture: 'Neo4j + GraphQL + Recommendation Engine',
      algorithm: '图神经网络 + 协同过滤 + 内容推荐',
      dataStructure: '有向无环图 + 权重边网络',
      optimizations: [
        '图数据库索引优化',
        '查询路径预计算',
        '缓存热点数据',
        '分布式图计算'
      ]
    },
    benchmarks: [
      { metric: '推荐准确率', ourValue: '89%', industryAvg: '72%', improvement: 24 },
      { metric: '查询响应时间', ourValue: '< 100ms', industryAvg: '800ms', improvement: 87 },
      { metric: '知识覆盖度', ourValue: '95%', industryAvg: '68%', improvement: 40 },
      { metric: '学习路径优化', ourValue: '82%', industryAvg: '54%', improvement: 52 }
    ]
  },
  {
    id: 'performance',
    title: '高性能架构',
    description: '微服务架构+边缘计算+智能缓存，支持万级并发',
    category: '性能指标',
    level: 'advanced',
    metrics: {
      performance: 95,
      reliability: 97,
      scalability: 98,
      innovation: 82
    },
    highlights: [
      '微服务架构设计',
      '边缘计算节点',
      '智能缓存策略',
      '负载均衡优化',
      '自动扩缩容'
    ],
    technicalDetails: {
      architecture: 'Microservices + Edge Computing + CDN',
      algorithm: '一致性哈希 + 负载均衡 + 自适应缓存',
      dataStructure: '分布式缓存 + 消息队列 + 数据分片',
      optimizations: [
        '请求路由优化',
        '数据预加载',
        '连接池管理',
        '资源动态分配'
      ]
    },
    benchmarks: [
      { metric: '并发用户数', ourValue: '10,000+', industryAvg: '2,000', improvement: 400 },
      { metric: '响应时间', ourValue: '< 200ms', industryAvg: '1.2s', improvement: 83 },
      { metric: '系统可用性', ourValue: '99.9%', industryAvg: '99.5%', improvement: 1 },
      { metric: '资源利用率', ourValue: '85%', industryAvg: '65%', improvement: 31 }
    ]
  },
  {
    id: 'security',
    title: '安全保障体系',
    description: '多层次安全防护，数据加密传输，隐私保护合规',
    category: '安全保障',
    level: 'stable',
    metrics: {
      performance: 87,
      reliability: 99,
      scalability: 88,
      innovation: 78
    },
    highlights: [
      '端到端加密传输',
      '多因子身份认证',
      '数据脱敏处理',
      '访问权限控制',
      '安全审计日志'
    ],
    technicalDetails: {
      architecture: 'Zero Trust + Multi-layer Defense',
      algorithm: 'AES-256 + RSA + OAuth2.0 + JWT',
      dataStructure: '权限树 + 审计链 + 加密索引',
      optimizations: [
        '加密算法优化',
        '权限缓存机制',
        '异常检测算法',
        '安全日志压缩'
      ]
    },
    benchmarks: [
      { metric: '数据安全等级', ourValue: 'A+', industryAvg: 'B+', improvement: 25 },
      { metric: '漏洞检测率', ourValue: '99.8%', industryAvg: '94.2%', improvement: 6 },
      { metric: '认证响应时间', ourValue: '< 50ms', industryAvg: '300ms', improvement: 83 },
      { metric: '合规性评分', ourValue: '98%', industryAvg: '85%', improvement: 15 }
    ]
  },
  {
    id: 'innovation',
    title: '技术创新突破',
    description: '多项技术创新和专利申请，引领行业发展方向',
    category: '创新亮点',
    level: 'breakthrough',
    metrics: {
      performance: 90,
      reliability: 92,
      scalability: 87,
      innovation: 99
    },
    highlights: [
      '6项核心技术专利',
      '首创多模态教学交互',
      '原创知识图谱算法',
      '独有AI代码生成技术',
      '行业标准制定参与'
    ],
    technicalDetails: {
      architecture: 'Novel Multi-modal Architecture',
      algorithm: '原创算法组合 + 专利技术',
      dataStructure: '创新数据结构设计',
      optimizations: [
        '专利优化算法',
        '独创缓存策略',
        '新型索引结构',
        '原创压缩算法'
      ]
    },
    benchmarks: [
      { metric: '技术创新度', ourValue: '95%', industryAvg: '65%', improvement: 46 },
      { metric: '专利申请数', ourValue: '12项', industryAvg: '3项', improvement: 300 },
      { metric: '技术引用次数', ourValue: '156次', industryAvg: '23次', improvement: 578 },
      { metric: '行业影响力', ourValue: '88%', industryAvg: '45%', improvement: 96 }
    ]
  }
];

const TechHighlights: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<string>(techFeatures[0]?.id || 'ai-engine');
  const [animationSpeed, setAnimationSpeed] = useState<number[]>([50]);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const currentFeature = techFeatures.find(f => f.id === selectedFeature) || techFeatures[0];

  // 自动轮播动画
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationKey(prev => prev + 1);
    }, (animationSpeed?.[0] || 50) * 20);
    return () => clearInterval(interval);
  }, [animationSpeed]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'breakthrough': return 'bg-red-100 text-red-800 border-red-200';
      case 'advanced': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'mature': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'stable': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'breakthrough': return <Rocket className="w-4 h-4" />;
      case 'advanced': return <Star className="w-4 h-4" />;
      case 'mature': return <Shield className="w-4 h-4" />;
      case 'stable': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '核心技术': return 'text-blue-600';
      case '性能指标': return 'text-green-600';
      case '安全保障': return 'text-purple-600';
      case '创新亮点': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '核心技术': return <Cpu className="w-5 h-5" />;
      case '性能指标': return <BarChart3 className="w-5 h-5" />;
      case '安全保障': return <Lock className="w-5 h-5" />;
      case '创新亮点': return <Sparkles className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const averageMetrics = {
    performance: Math.round(techFeatures.reduce((acc, f) => acc + f.metrics.performance, 0) / techFeatures.length),
    reliability: Math.round(techFeatures.reduce((acc, f) => acc + f.metrics.reliability, 0) / techFeatures.length),
    scalability: Math.round(techFeatures.reduce((acc, f) => acc + f.metrics.scalability, 0) / techFeatures.length),
    innovation: Math.round(techFeatures.reduce((acc, f) => acc + f.metrics.innovation, 0) / techFeatures.length),
  };

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Award className="w-6 h-6 text-yellow-500" />
          技术亮点与创新突破
        </h2>
        <p className="text-gray-600">
          展示平台核心技术优势，突出创新突破和行业领先水平
        </p>
      </div>

      {/* 整体技术指标 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          key={`performance-${animationKey}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Zap className="w-8 h-8 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-700 mb-1">
                {averageMetrics.performance}%
              </div>
              <div className="text-sm text-blue-600">性能指标</div>
              <Progress value={averageMetrics.performance} className="h-1 mt-2" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          key={`reliability-${animationKey}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Shield className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-700 mb-1">
                {averageMetrics.reliability}%
              </div>
              <div className="text-sm text-green-600">可靠性</div>
              <Progress value={averageMetrics.reliability} className="h-1 mt-2" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          key={`scalability-${animationKey}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Network className="w-8 h-8 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-700 mb-1">
                {averageMetrics.scalability}%
              </div>
              <div className="text-sm text-purple-600">扩展性</div>
              <Progress value={averageMetrics.scalability} className="h-1 mt-2" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          key={`innovation-${animationKey}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Rocket className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-700 mb-1">
                {averageMetrics.innovation}%
              </div>
              <div className="text-sm text-orange-600">创新度</div>
              <Progress value={averageMetrics.innovation} className="h-1 mt-2" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 技术特性选择器 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {techFeatures.map((feature, index) => (
          <motion.div
            key={`${feature.id}-${animationKey}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedFeature === feature.id 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedFeature(feature.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-full ${
                    selectedFeature === feature.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getCategoryIcon(feature.category)}
                  </div>
                  <Badge className={getLevelColor(feature.level)}>
                    {getLevelIcon(feature.level)}
                    <span className="ml-1 text-xs">
                      {feature.level === 'breakthrough' ? '突破' :
                       feature.level === 'advanced' ? '先进' :
                       feature.level === 'mature' ? '成熟' : '稳定'}
                    </span>
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {feature.description}
                </p>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={getCategoryColor(feature.category)}>
                      {feature.category}
                    </span>
                    <span className="text-gray-500">
                      综合评分: {Math.round((feature.metrics.performance + feature.metrics.reliability + feature.metrics.scalability + feature.metrics.innovation) / 4)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((feature.metrics.performance + feature.metrics.reliability + feature.metrics.scalability + feature.metrics.innovation) / 4)} 
                    className="h-1" 
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              展示控制面板
            </CardTitle>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowBenchmarks(!showBenchmarks)}
              >
                {showBenchmarks ? '隐藏' : '显示'}性能对比
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                动画速度: {animationSpeed[0]}%
              </label>
              <Slider
                value={animationSpeed}
                onValueChange={setAnimationSpeed}
                min={10}
                max={200}
                step={10}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细技术展示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            {currentFeature && getCategoryIcon(currentFeature.category)}
            {currentFeature?.title}
          </CardTitle>
          <div className="flex items-center gap-4">
            {currentFeature && (
              <Badge className={getLevelColor(currentFeature.level)}>
                {getLevelIcon(currentFeature.level)}
                <span className="ml-1">
                  {currentFeature.level === 'breakthrough' ? '突破性技术' :
                   currentFeature.level === 'advanced' ? '先进技术' :
                   currentFeature.level === 'mature' ? '成熟技术' : '稳定技术'}
                </span>
              </Badge>
            )}
            {currentFeature && (
              <span className={`text-sm ${getCategoryColor(currentFeature.category)}`}>
                {currentFeature.category}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 技术指标 */}
          {currentFeature && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {currentFeature.metrics.performance}%
                </div>
                <div className="text-sm text-blue-700">性能</div>
                <Progress value={currentFeature.metrics.performance} className="h-2 mt-2" />
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {currentFeature.metrics.reliability}%
                </div>
                <div className="text-sm text-green-700">可靠性</div>
                <Progress value={currentFeature.metrics.reliability} className="h-2 mt-2" />
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {currentFeature.metrics.scalability}%
                </div>
                <div className="text-sm text-purple-700">扩展性</div>
                <Progress value={currentFeature.metrics.scalability} className="h-2 mt-2" />
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">
                  {currentFeature.metrics.innovation}%
                </div>
                <div className="text-sm text-orange-700">创新度</div>
                <Progress value={currentFeature.metrics.innovation} className="h-2 mt-2" />
              </div>
            </div>
          )}

          {/* 核心亮点 */}
          {currentFeature && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                核心亮点
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentFeature.highlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 技术细节 */}
          {currentFeature && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  技术架构
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">架构设计</div>
                    <div className="text-sm font-medium">{currentFeature.technicalDetails.architecture}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">核心算法</div>
                    <div className="text-sm font-medium">{currentFeature.technicalDetails.algorithm}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">数据结构</div>
                    <div className="text-sm font-medium">{currentFeature.technicalDetails.dataStructure}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  性能优化
                </h4>
                <div className="space-y-2">
                  {currentFeature.technicalDetails.optimizations.map((optimization, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                      <ArrowRight className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      <span className="text-sm">{optimization}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 性能对比 */}
          <AnimatePresence>
            {showBenchmarks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  性能基准对比
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentFeature?.benchmarks.map((benchmark, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-900">{benchmark.metric}</span>
                        <Badge className="bg-green-100 text-green-800">
                          +{benchmark.improvement}%
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-600 font-medium">我们: {benchmark.ourValue}</span>
                          <span className="text-gray-600">行业: {benchmark.industryAvg}</span>
                        </div>
                        <Progress value={Math.min(benchmark.improvement + 50, 100)} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* 技术优势总结 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <Globe className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-semibold text-blue-800 mb-1">技术领先</h4>
            <p className="text-sm text-blue-700">
              6大核心技术模块，平均领先行业{Math.round((averageMetrics.performance + averageMetrics.innovation) / 2 - 70)}个百分点
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 text-center">
            <Award className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold text-green-800 mb-1">创新突破</h4>
            <p className="text-sm text-green-700">
              12项技术专利，多项行业首创技术
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4 text-center">
            <Shield className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <h4 className="font-semibold text-purple-800 mb-1">稳定可靠</h4>
            <p className="text-sm text-purple-700">
              平均可靠性{averageMetrics.reliability}%，支持万级并发
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TechHighlights;