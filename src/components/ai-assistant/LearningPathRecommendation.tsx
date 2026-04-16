'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BookOpen, 
  Target, 
  Clock, 
  TrendingUp, 
  Star, 
  CheckCircle, 
  Circle, 
  Play, 
  Users, 
  // Award,
  Brain,
  Zap,
  Lightbulb,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

// interface LearningGoal {
//   id: string;
//   title: string;
//   description: string;
//   difficulty: 'beginner' | 'intermediate' | 'advanced';
//   estimatedTime: string;
//   prerequisites: string[];
//   skills: string[];
// }

interface LearningStep {
  id: string;
  title: string;
  type: 'theory' | 'practice' | 'project' | 'assessment';
  duration: number; // minutes
  completed: boolean;
  difficulty: number; // 1-5
  description: string;
  resources: {
    videos: number;
    exercises: number;
    projects: number;
  };
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  totalDuration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completionRate: number;
  steps: LearningStep[];
  adaptiveFeatures: string[];
  personalizedReasons: string[];
}

interface UserProfile {
  level: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  availableTime: number; // minutes per day
  goals: string[];
  weakAreas: string[];
  strengths: string[];
}

const LearningPathRecommendation: React.FC = () => {
  const [userProfile] = useState<UserProfile>({
    level: 'beginner',
    interests: ['嵌入式系统', 'IoT开发', '硬件编程'],
    learningStyle: 'visual',
    availableTime: 60,
    goals: ['掌握8051基础', '完成LED控制项目', '理解中断机制'],
    weakAreas: ['汇编语言', '寄存器操作'],
    strengths: ['C语言基础', '逻辑思维']
  });
  
  const [recommendedPaths, setRecommendedPaths] = useState<LearningPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // 模拟学习路径数据
  const mockLearningPaths: LearningPath[] = [
    {
      id: '1',
      title: '8051微控制器入门精通路径',
      description: '从零基础到熟练掌握8051微控制器编程，包含理论学习、实践练习和项目实战',
      totalDuration: '4-6周',
      difficulty: 'beginner',
      completionRate: 0,
      adaptiveFeatures: [
        '根据学习进度自动调整难度',
        '个性化练习题推荐',
        '弱项强化训练',
        '学习时间智能分配'
      ],
      personalizedReasons: [
        '匹配您的初学者水平',
        '符合您的视觉学习风格',
        '包含您感兴趣的IoT应用',
        '适合您每日60分钟的学习时间'
      ],
      steps: [
        {
          id: '1-1',
          title: '微控制器基础概念',
          type: 'theory',
          duration: 45,
          completed: false,
          difficulty: 1,
          description: '了解微控制器的基本概念、架构和应用领域',
          resources: { videos: 3, exercises: 5, projects: 0 }
        },
        {
          id: '1-2',
          title: '8051架构深入理解',
          type: 'theory',
          duration: 60,
          completed: false,
          difficulty: 2,
          description: '学习8051的内部结构、寄存器组织和存储器映射',
          resources: { videos: 4, exercises: 8, projects: 0 }
        },
        {
          id: '1-3',
          title: 'C语言编程基础',
          type: 'practice',
          duration: 90,
          completed: false,
          difficulty: 2,
          description: '掌握8051 C语言编程基础和开发环境使用',
          resources: { videos: 2, exercises: 12, projects: 1 }
        },
        {
          id: '1-4',
          title: 'GPIO控制实践',
          type: 'practice',
          duration: 75,
          completed: false,
          difficulty: 3,
          description: '学习GPIO端口控制，实现LED闪烁和按键检测',
          resources: { videos: 3, exercises: 10, projects: 2 }
        },
        {
          id: '1-5',
          title: '定时器与中断',
          type: 'theory',
          duration: 80,
          completed: false,
          difficulty: 4,
          description: '理解定时器工作原理和中断处理机制',
          resources: { videos: 4, exercises: 15, projects: 1 }
        },
        {
          id: '1-6',
          title: '综合项目：智能灯控系统',
          type: 'project',
          duration: 120,
          completed: false,
          difficulty: 4,
          description: '综合运用所学知识，开发一个智能灯光控制系统',
          resources: { videos: 2, exercises: 5, projects: 1 }
        },
        {
          id: '1-7',
          title: '知识点综合测评',
          type: 'assessment',
          duration: 30,
          completed: false,
          difficulty: 3,
          description: '全面测试8051基础知识掌握情况',
          resources: { videos: 0, exercises: 20, projects: 0 }
        }
      ]
    },
    {
      id: '2',
      title: 'IoT项目开发进阶路径',
      description: '面向物联网应用的8051高级编程，包含传感器接口、通信协议和云端连接',
      totalDuration: '6-8周',
      difficulty: 'intermediate',
      completionRate: 0,
      adaptiveFeatures: [
        '项目驱动学习模式',
        '实时代码质量分析',
        '个性化调试指导',
        '行业案例深度解析'
      ],
      personalizedReasons: [
        '符合您的IoT开发兴趣',
        '提供丰富的实践项目',
        '包含硬件编程重点内容',
        '适合进阶学习需求'
      ],
      steps: [
        {
          id: '2-1',
          title: '传感器接口编程',
          type: 'practice',
          duration: 90,
          completed: false,
          difficulty: 3,
          description: '学习各种传感器的接口方法和数据处理',
          resources: { videos: 5, exercises: 12, projects: 3 }
        },
        {
          id: '2-2',
          title: '串口通信协议',
          type: 'theory',
          duration: 75,
          completed: false,
          difficulty: 4,
          description: '掌握UART、SPI、I2C等通信协议',
          resources: { videos: 4, exercises: 10, projects: 2 }
        },
        {
          id: '2-3',
          title: '无线通信模块',
          type: 'practice',
          duration: 100,
          completed: false,
          difficulty: 4,
          description: '集成WiFi、蓝牙等无线通信模块',
          resources: { videos: 3, exercises: 8, projects: 2 }
        },
        {
          id: '2-4',
          title: '云端数据传输',
          type: 'project',
          duration: 150,
          completed: false,
          difficulty: 5,
          description: '实现设备与云平台的数据交互',
          resources: { videos: 4, exercises: 6, projects: 1 }
        },
        {
          id: '2-5',
          title: '完整IoT系统开发',
          type: 'project',
          duration: 180,
          completed: false,
          difficulty: 5,
          description: '开发一个完整的IoT监控系统',
          resources: { videos: 2, exercises: 4, projects: 1 }
        }
      ]
    },
    {
      id: '3',
      title: '汇编语言强化训练路径',
      description: '针对汇编语言薄弱环节的专项强化训练，提升底层编程能力',
      totalDuration: '3-4周',
      difficulty: 'intermediate',
      completionRate: 0,
      adaptiveFeatures: [
        '弱项针对性训练',
        '渐进式难度提升',
        '实时学习效果评估',
        '个性化练习生成'
      ],
      personalizedReasons: [
        '针对您的汇编语言薄弱点',
        '强化寄存器操作训练',
        '提供大量实践练习',
        '循序渐进的学习安排'
      ],
      steps: [
        {
          id: '3-1',
          title: '汇编语言基础语法',
          type: 'theory',
          duration: 60,
          completed: false,
          difficulty: 2,
          description: '掌握8051汇编语言的基本语法和指令集',
          resources: { videos: 4, exercises: 15, projects: 0 }
        },
        {
          id: '3-2',
          title: '寄存器操作详解',
          type: 'practice',
          duration: 80,
          completed: false,
          difficulty: 3,
          description: '深入理解各种寄存器的功能和操作方法',
          resources: { videos: 3, exercises: 20, projects: 1 }
        },
        {
          id: '3-3',
          title: '内存寻址模式',
          type: 'practice',
          duration: 70,
          completed: false,
          difficulty: 4,
          description: '掌握不同的内存寻址方式和应用场景',
          resources: { videos: 2, exercises: 18, projects: 1 }
        },
        {
          id: '3-4',
          title: '汇编与C语言混合编程',
          type: 'practice',
          duration: 90,
          completed: false,
          difficulty: 4,
          description: '学习汇编代码与C语言的混合编程技巧',
          resources: { videos: 3, exercises: 12, projects: 2 }
        },
        {
          id: '3-5',
          title: '性能优化实战',
          type: 'project',
          duration: 100,
          completed: false,
          difficulty: 5,
          description: '使用汇编语言优化关键代码段的性能',
          resources: { videos: 2, exercises: 8, projects: 1 }
        }
      ]
    }
  ];

  // 生成个性化学习路径
  const generateRecommendations = async () => {
    setIsGenerating(true);
    
    // 模拟AI分析过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 根据用户画像筛选和排序路径
    const filteredPaths = mockLearningPaths.filter(path => {
      // 根据用户水平筛选
      if (userProfile.level === 'beginner' && path.difficulty === 'advanced') return false;
      if (userProfile.level === 'advanced' && path.difficulty === 'beginner') return false;
      return true;
    });
    
    setRecommendedPaths(filteredPaths);
    setIsGenerating(false);
    setActiveTab('recommendations');
    toast.success('个性化学习路径生成完成！');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'theory': return <BookOpen className="h-4 w-4" />;
      case 'practice': return <Zap className="h-4 w-4" />;
      case 'project': return <Target className="h-4 w-4" />;
      case 'assessment': return <BarChart3 className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'theory': return '理论学习';
      case 'practice': return '实践练习';
      case 'project': return '项目实战';
      case 'assessment': return '能力评估';
      default: return '其他';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'theory': return 'bg-blue-100 text-blue-800';
      case 'practice': return 'bg-purple-100 text-purple-800';
      case 'project': return 'bg-orange-100 text-orange-800';
      case 'assessment': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">个性化学习路径推荐</h1>
        <p className="text-gray-600">基于AI分析的智能学习路径规划，让学习更高效</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            学习画像
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            推荐路径
            {recommendedPaths.length > 0 && (
              <Badge variant="secondary">{recommendedPaths.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            路径详情
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                个人学习画像
              </CardTitle>
              <CardDescription>
                AI将根据您的学习画像生成个性化的学习路径推荐
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">基本信息</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">当前水平：</span>
                      <Badge className={getDifficultyColor(userProfile.level)}>
                        {userProfile.level === 'beginner' ? '初学者' : 
                         userProfile.level === 'intermediate' ? '中级' : '高级'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">学习风格：</span>
                      <Badge variant="outline">
                        {userProfile.learningStyle === 'visual' ? '视觉型' :
                         userProfile.learningStyle === 'auditory' ? '听觉型' :
                         userProfile.learningStyle === 'kinesthetic' ? '动手型' : '混合型'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">每日学习时间：</span>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {userProfile.availableTime}分钟
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* 学习兴趣 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">学习兴趣</h3>
                  <div className="flex flex-wrap gap-2">
                    {userProfile.interests.map((interest, index) => (
                      <Badge key={index} variant="secondary">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 学习目标 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    学习目标
                  </h3>
                  <div className="space-y-2">
                    {userProfile.goals.map((goal, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {goal}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 薄弱环节 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    需要加强
                  </h3>
                  <div className="space-y-2">
                    {userProfile.weakAreas.map((area, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Circle className="h-3 w-3 text-orange-500" />
                        {area}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 优势领域 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    优势领域
                  </h3>
                  <div className="space-y-2">
                    {userProfile.strengths.map((strength, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {strength}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={generateRecommendations}
                  disabled={isGenerating}
                  size="lg"
                  className="px-8"
                >
                  {isGenerating ? (
                    <>
                      <Brain className="mr-2 h-4 w-4 animate-pulse" />
                      AI正在分析...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="mr-2 h-4 w-4" />
                      生成个性化学习路径
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {recommendedPaths.length > 0 ? (
            <>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">为您推荐的学习路径</h2>
                <p className="text-gray-600">基于您的学习画像，AI为您精心挑选了以下学习路径</p>
              </div>
              
              <div className="grid gap-6">
                {recommendedPaths.map((path, index) => (
                  <Card key={path.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">推荐 #{index + 1}</Badge>
                            <Badge className={getDifficultyColor(path.difficulty)}>
                              {path.difficulty === 'beginner' ? '初级' :
                               path.difficulty === 'intermediate' ? '中级' : '高级'}
                            </Badge>
                          </div>
                          <CardTitle className="text-xl">{path.title}</CardTitle>
                          <CardDescription className="text-base">
                            {path.description}
                          </CardDescription>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Clock className="h-3 w-3" />
                            {path.totalDuration}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <BookOpen className="h-3 w-3" />
                            {path.steps.length} 个步骤
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 个性化推荐理由 */}
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          为什么推荐给您
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {path.personalizedReasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                              {reason}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 自适应特性 */}
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          AI自适应特性
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {path.adaptiveFeatures.map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* 学习进度 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">学习进度</span>
                          <span className="text-sm text-gray-600">
                            {path.completionRate}% 完成
                          </span>
                        </div>
                        <Progress value={path.completionRate} className="h-2" />
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => {
                            setSelectedPath(path);
                            setActiveTab('details');
                          }}
                          className="flex-1"
                        >
                          查看详情
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Play className="mr-2 h-4 w-4" />
                          开始学习
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无推荐路径，请先完善学习画像并生成推荐</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {selectedPath ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedPath.title}</CardTitle>
                      <CardDescription className="text-base mt-2">
                        {selectedPath.description}
                      </CardDescription>
                    </div>
                    <Badge className={getDifficultyColor(selectedPath.difficulty)}>
                      {selectedPath.difficulty === 'beginner' ? '初级' :
                       selectedPath.difficulty === 'intermediate' ? '中级' : '高级'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedPath.steps.length}
                      </div>
                      <div className="text-sm text-gray-600">学习步骤</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedPath.totalDuration}
                      </div>
                      <div className="text-sm text-gray-600">预计时长</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedPath.completionRate}%
                      </div>
                      <div className="text-sm text-gray-600">完成进度</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">学习步骤详情</h3>
                {selectedPath.steps.map((step, index) => (
                  <Card key={step.id} className={`${step.completed ? 'bg-green-50 border-green-200' : ''}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            step.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {step.completed ? <CheckCircle className="h-4 w-4" /> : index + 1}
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-lg">{step.title}</h4>
                              <p className="text-gray-600 mt-1">{step.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(step.type)}
                              <Badge className={getTypeColor(step.type)}>
                                {getTypeLabel(step.type)}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-gray-500" />
                              <span>{step.duration}分钟</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Star className="h-3 w-3 text-gray-500" />
                              <span>难度 {step.difficulty}/5</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Play className="h-3 w-3 text-gray-500" />
                              <span>{step.resources.videos} 视频</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-3 w-3 text-gray-500" />
                              <span>{step.resources.exercises} 练习</span>
                            </div>
                          </div>
                          
                          {!step.completed && (
                            <Button size="sm" className="mt-2">
                              <Play className="mr-2 h-3 w-3" />
                              开始学习
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">请先选择一个学习路径查看详情</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LearningPathRecommendation;