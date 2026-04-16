import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  Crown,
  Star,
  Target,
  Users,
  Brain,
  Code,
  BarChart3,
  Shield,
  Rocket,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colorTheme } from '@/lib/color-theme';

interface CompetitorFeature {
  feature: string;
  eduCogMicro: {
    status: 'excellent' | 'good' | 'basic' | 'none';
    description: string;
    score: number;
  };
  traditionalLMS: {
    status: 'excellent' | 'good' | 'basic' | 'none';
    description: string;
    score: number;
  };
  basicSimulation: {
    status: 'excellent' | 'good' | 'basic' | 'none';
    description: string;
    score: number;
  };
  standardAITutor: {
    status: 'excellent' | 'good' | 'basic' | 'none';
    description: string;
    score: number;
  };
}

const competitiveFeatures: CompetitorFeature[] = [
  {
    feature: 'AI个性化学习',
    eduCogMicro: {
      status: 'excellent',
      description: '深度学习算法，实时适应学习风格',
      score: 95
    },
    traditionalLMS: {
      status: 'none',
      description: '静态内容，无个性化功能',
      score: 0
    },
    basicSimulation: {
      status: 'none',
      description: '固定模拟场景，无AI支持',
      score: 0
    },
    standardAITutor: {
      status: 'basic',
      description: '基础问答，有限个性化',
      score: 40
    }
  },
  {
    feature: '3D硬件仿真',
    eduCogMicro: {
      status: 'excellent',
      description: '真实芯片建模，内部结构可视化',
      score: 92
    },
    traditionalLMS: {
      status: 'none',
      description: '仅有静态图片和文档',
      score: 0
    },
    basicSimulation: {
      status: 'basic',
      description: '简单2D仿真，功能有限',
      score: 35
    },
    standardAITutor: {
      status: 'none',
      description: '纯文本交互，无仿真功能',
      score: 0
    }
  },
  {
    feature: '智能代码生成',
    eduCogMicro: {
      status: 'excellent',
      description: '上下文感知，专业单片机代码',
      score: 88
    },
    traditionalLMS: {
      status: 'none',
      description: '无代码生成功能',
      score: 0
    },
    basicSimulation: {
      status: 'none',
      description: '无AI代码生成',
      score: 0
    },
    standardAITutor: {
      status: 'good',
      description: '通用代码生成，非专业化',
      score: 65
    }
  },
  {
    feature: '错误诊断分析',
    eduCogMicro: {
      status: 'excellent',
      description: '专业级错误定位和修复建议',
      score: 90
    },
    traditionalLMS: {
      status: 'none',
      description: '无错误分析功能',
      score: 0
    },
    basicSimulation: {
      status: 'basic',
      description: '简单语法检查',
      score: 25
    },
    standardAITutor: {
      status: 'good',
      description: '基础错误提示，深度有限',
      score: 55
    }
  },
  {
    feature: '知识图谱导航',
    eduCogMicro: {
      status: 'excellent',
      description: '800+知识节点，智能关联',
      score: 94
    },
    traditionalLMS: {
      status: 'basic',
      description: '简单分类目录',
      score: 30
    },
    basicSimulation: {
      status: 'none',
      description: '无知识体系构建',
      score: 0
    },
    standardAITutor: {
      status: 'basic',
      description: '简单知识索引',
      score: 40
    }
  },
  {
    feature: '多模态交互',
    eduCogMicro: {
      status: 'excellent',
      description: '语音、文本、图像、手势全支持',
      score: 89
    },
    traditionalLMS: {
      status: 'basic',
      description: '仅文本和简单点击',
      score: 20
    },
    basicSimulation: {
      status: 'basic',
      description: '鼠标点击和简单输入',
      score: 30
    },
    standardAITutor: {
      status: 'good',
      description: '文本和基础语音',
      score: 60
    }
  },
  {
    feature: '学习效果预测',
    eduCogMicro: {
      status: 'excellent',
      description: 'AI预测学习结果，提前干预',
      score: 87
    },
    traditionalLMS: {
      status: 'none',
      description: '无预测分析功能',
      score: 0
    },
    basicSimulation: {
      status: 'none',
      description: '无学习分析',
      score: 0
    },
    standardAITutor: {
      status: 'basic',
      description: '简单进度跟踪',
      score: 35
    }
  },
  {
    feature: '实时协作学习',
    eduCogMicro: {
      status: 'excellent',
      description: 'AI促进的小组学习，智能匹配',
      score: 85
    },
    traditionalLMS: {
      status: 'basic',
      description: '简单论坛和作业提交',
      score: 40
    },
    basicSimulation: {
      status: 'none',
      description: '单用户模式',
      score: 0
    },
    standardAITutor: {
      status: 'basic',
      description: '一对一问答',
      score: 25
    }
  }
];

const platforms = [
  {
    id: 'eduCogMicro',
    name: 'EduCog-Micro',
    subtitle: '我们的平台',
    color: 'blue',
    highlight: true,
    icon: <Crown className="w-5 h-5" />
  },
  {
    id: 'traditionalLms',
    name: '传统LMS',
    subtitle: '如Moodle, Blackboard',
    color: 'gray',
    highlight: false,
    icon: <Users className="w-5 h-5" />
  },
  {
    id: 'basicSimulation',
    name: '基础仿真工具',
    subtitle: '如Proteus, Multisim',
    color: 'orange',
    highlight: false,
    icon: <Code className="w-5 h-5" />
  },
  {
    id: 'standardAiTutor',
    name: '标准AI导师',
    subtitle: '如ChatGPT, Claude',
    color: 'purple',
    highlight: false,
    icon: <Brain className="w-5 h-5" />
  }
];

const CompetitiveMatrix: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'good': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'basic': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'none': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'basic': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'none': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const calculateOverallScore = (platformId: string) => {
    const scores = competitiveFeatures.map(feature => {
      const platformData = feature[platformId as keyof CompetitorFeature] as any;
      return platformData.score;
    });
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  };

  const refreshAnimation = () => {
    setAnimationKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Target className="w-6 h-6 text-blue-500" />
          竞争优势对比分析
        </h2>
        <p className="text-gray-600">
          全方位对比主流教学平台，突出我们的技术优势和创新特色
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshAnimation}
          className="flex items-center gap-1"
        >
          <TrendingUp className="w-3 h-3" />
          刷新对比
        </Button>
      </div>

      {/* 综合评分概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {platforms.map((platform, index) => {
          const score = calculateOverallScore(platform.id);
          return (
            <motion.div
              key={`${platform.id}-${animationKey}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={`${platform.highlight ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                <CardContent className="p-4 text-center">
                  <div className={`mx-auto mb-3 p-3 rounded-full ${
                    platform.highlight ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {platform.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {platform.name}
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    {platform.subtitle}
                  </p>
                  <div className="space-y-2">
                    <div className={`text-3xl font-bold ${
                      platform.highlight ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {score}
                    </div>
                    <div className="text-xs text-gray-500">综合评分</div>
                    <Progress value={score} className="h-2" />
                  </div>
                  {platform.highlight && (
                    <Badge className="bg-yellow-100 text-yellow-800 mt-2 flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      行业领先
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 详细对比矩阵 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            功能特性对比矩阵
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">功能特性</th>
                  {platforms.map((platform) => (
                    <th key={platform.id} className="text-center p-4 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        {platform.icon}
                        <div>
                          <div className={platform.highlight ? 'text-blue-600' : 'text-gray-700'}>
                            {platform.name}
                          </div>
                          <div className="text-xs text-gray-500 font-normal">
                            {platform.subtitle}
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody key={animationKey}>
                {competitiveFeatures.map((feature, index) => (
                  <motion.tr
                    key={feature.feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`border-b ${colorTheme.special.hover} cursor-pointer ${
                      selectedFeature === feature.feature ? colorTheme.theme.primary.bg : ''
                    }`}
                    onClick={() => setSelectedFeature(
                      selectedFeature === feature.feature ? null : feature.feature
                    )}
                  >
                    <td className="p-4 font-medium text-gray-900">
                      {feature.feature}
                    </td>
                    
                    {/* EduCog-Micro */}
                    <td className="p-4 text-center">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(feature.eduCogMicro.status)}
                          <span className="font-semibold text-blue-600">
                            {feature.eduCogMicro.score}%
                          </span>
                        </div>
                        <Badge className={getStatusColor(feature.eduCogMicro.status)}>
                          {feature.eduCogMicro.status === 'excellent' ? '优秀' :
                           feature.eduCogMicro.status === 'good' ? '良好' :
                           feature.eduCogMicro.status === 'basic' ? '基础' : '无'}
                        </Badge>
                      </div>
                    </td>
                    
                    {/* Traditional LMS */}
                    <td className="p-4 text-center">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(feature.traditionalLMS.status)}
                          <span className="font-semibold text-gray-600">
                            {feature.traditionalLMS.score}%
                          </span>
                        </div>
                        <Badge className={getStatusColor(feature.traditionalLMS.status)}>
                          {feature.traditionalLMS.status === 'excellent' ? '优秀' :
                           feature.traditionalLMS.status === 'good' ? '良好' :
                           feature.traditionalLMS.status === 'basic' ? '基础' : '无'}
                        </Badge>
                      </div>
                    </td>
                    
                    {/* Basic Simulation */}
                    <td className="p-4 text-center">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(feature.basicSimulation.status)}
                          <span className="font-semibold text-gray-600">
                            {feature.basicSimulation.score}%
                          </span>
                        </div>
                        <Badge className={getStatusColor(feature.basicSimulation.status)}>
                          {feature.basicSimulation.status === 'excellent' ? '优秀' :
                           feature.basicSimulation.status === 'good' ? '良好' :
                           feature.basicSimulation.status === 'basic' ? '基础' : '无'}
                        </Badge>
                      </div>
                    </td>
                    
                    {/* Standard AI Tutor */}
                    <td className="p-4 text-center">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(feature.standardAITutor.status)}
                          <span className="font-semibold text-gray-600">
                            {feature.standardAITutor.score}%
                          </span>
                        </div>
                        <Badge className={getStatusColor(feature.standardAITutor.status)}>
                          {feature.standardAITutor.status === 'excellent' ? '优秀' :
                           feature.standardAITutor.status === 'good' ? '良好' :
                           feature.standardAITutor.status === 'basic' ? '基础' : '无'}
                        </Badge>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 详细说明 */}
          <AnimatePresence>
            {selectedFeature && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
              >
                <h4 className="font-semibold text-blue-800 mb-3">
                  {selectedFeature} - 详细对比
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  {platforms.map((platform) => {
                    const featureData = competitiveFeatures.find(f => f.feature === selectedFeature);
                    const platformData = featureData?.[platform.id as keyof CompetitorFeature] as any;
                    
                    return (
                      <div key={platform.id} className="space-y-2">
                        <div className={`font-medium ${platform.highlight ? 'text-blue-700' : 'text-gray-700'}`}>
                          {platform.name}
                        </div>
                        <div className="text-gray-600">
                          {platformData?.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* 优势总结 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <Rocket className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold text-green-800 mb-1">技术领先</h4>
            <p className="text-sm text-green-700">
              平均领先竞品{Math.round((calculateOverallScore('eduCogMicro') - 
              Math.max(calculateOverallScore('traditionalLms'), 
                      calculateOverallScore('basicSimulation'), 
                      calculateOverallScore('standardAiTutor'))))}分
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-semibold text-blue-800 mb-1">全面覆盖</h4>
            <p className="text-sm text-blue-700">
              8大核心功能全部达到优秀水平
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 text-center">
            <Star className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <h4 className="font-semibold text-purple-800 mb-1">创新突破</h4>
            <p className="text-sm text-purple-700">
              独有的AI+3D仿真+知识图谱融合
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompetitiveMatrix;