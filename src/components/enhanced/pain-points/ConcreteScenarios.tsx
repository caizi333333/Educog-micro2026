import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Users, 
  Clock, 
  BookOpen, 
  TrendingUp, 
  Star,
  Quote,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Pause,
  RotateCcw,
  Building2,
  GraduationCap,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colorTheme } from '@/lib/color-theme';

interface ConcreteScenario {
  id: string;
  schoolName: string;
  schoolType: '本科院校' | '职业院校' | '技师学院' | '培训机构';
  location: string;
  classInfo: {
    size: number;
    level: string;
    course: string;
    semester: string;
  };
  teacherProfile: {
    name: string;
    experience: number;
    title: string;
    photo?: string;
  };
  painPointDescription: string;
  beforeResults: {
    comprehensionRate: number;
    passRate: number;
    satisfactionScore: number;
    teachingTime: number;
    dropoutRate: number;
  };
  afterResults: {
    comprehensionRate: number;
    passRate: number;
    satisfactionScore: number;
    teachingTime: number;
    dropoutRate: number;
  };
  testimonial: {
    content: string;
    author: string;
    role: string;
    date: string;
  };
  implementationDetails: {
    duration: string;
    keyFeatures: string[];
    challenges: string[];
    solutions: string[];
  };
  timeline: {
    phase: string;
    description: string;
    duration: string;
    results: string;
  }[];
}

const scenarios: ConcreteScenario[] = [
  {
    id: 'university-embedded',
    schoolName: '华北理工大学',
    schoolType: '本科院校',
    location: '河北省唐山市',
    classInfo: {
      size: 45,
      level: '电子信息工程专业本科三年级',
      course: '嵌入式系统设计',
      semester: '2023年秋季学期'
    },
    teacherProfile: {
      name: '张教授',
      experience: 15,
      title: '副教授、硕士生导师',
    },
    painPointDescription: '学生对单片机中断机制理解困难，传统教学中抽象概念难以可视化，学生普遍反映"看不见摸不着"，实验课程与理论脱节严重。',
    beforeResults: {
      comprehensionRate: 42,
      passRate: 68,
      satisfactionScore: 6.1,
      teachingTime: 140,
      dropoutRate: 15
    },
    afterResults: {
      comprehensionRate: 87,
      passRate: 94,
      satisfactionScore: 9.3,
      teachingTime: 85,
      dropoutRate: 3
    },
    testimonial: {
      content: '使用AI教学平台后，学生们第一次真正"看见"了中断的执行过程。3D可视化让抽象的寄存器操作变得直观，AI助手能够即时回答学生的疑问，课堂活跃度明显提升。',
      author: '张教授',
      role: '华北理工大学电子信息工程学院',
      date: '2023年12月'
    },
    implementationDetails: {
      duration: '2个月试点，1学期全面应用',
      keyFeatures: [
        '3D单片机内部结构可视化',
        'AI智能答疑系统',
        '实时代码执行跟踪',
        '个性化学习路径推荐'
      ],
      challenges: [
        '初期学生对新技术适应需要时间',
        '部分复杂概念的AI解释需要优化',
        '与现有教学体系的整合'
      ],
      solutions: [
        '设置2周适应期，提供操作指南',
        '持续优化AI知识库和解释算法',
        '与教务处协调，制定混合教学方案'
      ]
    },
    timeline: [
      {
        phase: '准备阶段',
        description: '平台部署、教师培训、学生预习',
        duration: '2周',
        results: '95%学生完成平台注册和基础操作学习'
      },
      {
        phase: '试点阶段',
        description: '选择中断机制章节进行试点教学',
        duration: '4周',
        results: '理解率从42%提升到78%，获得积极反馈'
      },
      {
        phase: '全面应用',
        description: '整个课程采用AI增强教学模式',
        duration: '12周',
        results: '期末考试通过率达94%，满意度9.3分'
      },
      {
        phase: '优化改进',
        description: '基于反馈优化平台功能和教学方法',
        duration: '持续进行',
        results: '建立完善的混合教学模式'
      }
    ]
  },
  {
    id: 'vocational-debug',
    schoolName: '深圳职业技术学院',
    schoolType: '职业院校',
    location: '广东省深圳市',
    classInfo: {
      size: 38,
      level: '电子信息工程技术专科二年级',
      course: '单片机应用技术',
      semester: '2024年春季学期'
    },
    teacherProfile: {
      name: '李老师',
      experience: 8,
      title: '讲师、企业技术顾问',
    },
    painPointDescription: '学生代码调试能力薄弱，面对程序错误时束手无策，传统的"试错"方法效率低下，学生挫败感强，影响学习积极性。',
    beforeResults: {
      comprehensionRate: 35,
      passRate: 72,
      satisfactionScore: 5.8,
      teachingTime: 160,
      dropoutRate: 22
    },
    afterResults: {
      comprehensionRate: 89,
      passRate: 96,
      satisfactionScore: 9.1,
      teachingTime: 90,
      dropoutRate: 5
    },
    testimonial: {
      content: 'AI调试助手就像给每个学生配了一个专业的技术导师。它不仅能快速定位错误，还能解释错误原因，提供修改建议。学生的调试信心大大增强，编程水平突飞猛进。',
      author: '李老师',
      role: '深圳职业技术学院电子与通信工程学院',
      date: '2024年6月'
    },
    implementationDetails: {
      duration: '1个月适应，1学期深度应用',
      keyFeatures: [
        'AI智能错误诊断系统',
        '逐步调试指导',
        '错误模式识别训练',
        '调试技巧个性化推荐'
      ],
      challenges: [
        '学生基础编程能力参差不齐',
        'AI对复杂逻辑错误的分析准确性',
        '平衡AI辅助与学生独立思考能力'
      ],
      solutions: [
        '分层教学，基础薄弱学生额外辅导',
        '不断更新错误样本库，提升AI准确性',
        '设置"思考时间"，鼓励学生先独立分析'
      ]
    },
    timeline: [
      {
        phase: '基础培训',
        description: '调试基础知识和平台使用培训',
        duration: '1周',
        results: '学生掌握AI调试助手基本操作'
      },
      {
        phase: '简单调试',
        description: '语法错误和简单逻辑错误练习',
        duration: '3周',
        results: '错误定位速度提升60%'
      },
      {
        phase: '复杂调试',
        description: '算法逻辑和系统级错误训练',
        duration: '8周',
        results: '独立调试能力达到76%'
      },
      {
        phase: '项目实战',
        description: '综合项目开发和调试实战',
        duration: '4周',
        results: '项目成功率达96%'
      }
    ]
  },
  {
    id: 'technical-practice',
    schoolName: '上海工程技术大学',
    schoolType: '本科院校',
    location: '上海市松江区',
    classInfo: {
      size: 42,
      level: '自动化专业本科二年级',
      course: '微控制器原理与应用',
      semester: '2024年春季学期'
    },
    teacherProfile: {
      name: '王教授',
      experience: 12,
      title: '教授、博士生导师',
    },
    painPointDescription: '学生理论学习和实践应用脱节严重，课堂理论考试成绩尚可，但面对实际项目时无法将理论知识有效转化为实践能力。',
    beforeResults: {
      comprehensionRate: 58,
      passRate: 81,
      satisfactionScore: 6.5,
      teachingTime: 120,
      dropoutRate: 12
    },
    afterResults: {
      comprehensionRate: 91,
      passRate: 98,
      satisfactionScore: 9.4,
      teachingTime: 75,
      dropoutRate: 2
    },
    testimonial: {
      content: 'AI项目推荐引擎根据每个学生的学习进度和兴趣特点，推荐适合的实践项目。渐进式的项目难度设计让学生能够循序渐进地提升实践能力，理论与实践真正结合起来。',
      author: '王教授',
      role: '上海工程技术大学电子电气工程学院',
      date: '2024年7月'
    },
    implementationDetails: {
      duration: '1学期完整应用周期',
      keyFeatures: [
        'AI项目推荐引擎',
        '渐进式实践路径',
        '实时应用指导',
        '项目成果展示平台'
      ],
      challenges: [
        '项目库的丰富程度和更新频率',
        '不同学生能力差异的个性化适配',
        '项目评估标准的制定'
      ],
      solutions: [
        '与企业合作建立项目库，定期更新',
        'AI算法持续学习学生特征，动态调整',
        '制定多维度评估体系，注重过程评价'
      ]
    },
    timeline: [
      {
        phase: '能力评估',
        description: '学生基础能力和兴趣特征评估',
        duration: '1周',
        results: '为每个学生建立个性化档案'
      },
      {
        phase: '初级项目',
        description: 'LED控制、按键检测等基础项目',
        duration: '4周',
        results: '项目完成率达85%'
      },
      {
        phase: '中级项目',
        description: '传感器应用、通信协议等项目',
        duration: '6周',
        results: '知识应用率提升到75%'
      },
      {
        phase: '高级项目',
        description: '综合系统设计和创新项目',
        duration: '5周',
        results: '创新能力达到58%，超出预期'
      }
    ]
  }
];

const ConcreteScenarios: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>(scenarios[0]?.id || '');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineProgress, setTimelineProgress] = useState(0);

  const currentScenario = scenarios.find(s => s.id === selectedScenario) || scenarios[0];

  // 如果没有找到当前场景，返回空状态
  if (!currentScenario) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">暂无案例数据</h3>
          <p className="text-gray-500">请稍后再试</p>
        </div>
      </div>
    );
  }

  // 时间轴动画效果
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimelineProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 2;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const resetTimeline = () => {
    setTimelineProgress(0);
    setIsPlaying(false);
  };

  const calculateImprovement = (before: number, after: number, isReverse = false) => {
    if (isReverse) {
      return Math.round(((before - after) / before) * 100);
    }
    return Math.round(((after - before) / before) * 100);
  };

  const getSchoolTypeIcon = (type: string) => {
    switch (type) {
      case '本科院校': return <GraduationCap className="w-4 h-4" />;
      case '职业院校': return <Building2 className="w-4 h-4" />;
      case '技师学院': return <BookOpen className="w-4 h-4" />;
      default: return <Building2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          真实教学场景案例展示
        </h2>
        <p className="text-muted-foreground">
          基于真实院校的教学实践，展示AI平台在不同场景下的具体应用效果
        </p>
      </div>

      {/* 场景选择器 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario) => (
          <Card 
            key={scenario.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedScenario === scenario.id 
                ? `ring-2 ring-primary ${colorTheme.theme.primary.bg}` 
                : colorTheme.special.hover
            }`}
            onClick={() => setSelectedScenario(scenario.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  {getSchoolTypeIcon(scenario.schoolType)}
                  {scenario.schoolType}
                </Badge>
                <div className="flex items-center text-sm text-gray-500">
                  <MapPin className="w-4 h-4 mr-1" />
                  {scenario.location.split('省')[0]}
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {scenario.schoolName}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {scenario.classInfo.course} - {scenario.classInfo.level}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {scenario.classInfo.size}人
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{calculateImprovement(scenario.beforeResults.comprehensionRate, scenario.afterResults.comprehensionRate)}%
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 详细展示区域 */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl mb-2">{currentScenario.schoolName}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  {getSchoolTypeIcon(currentScenario.schoolType)}
                  {currentScenario.schoolType}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {currentScenario.location}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {currentScenario.classInfo.size}人班级
                </div>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800">
              案例实证
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">课程概况</TabsTrigger>
              <TabsTrigger value="problem">痛点分析</TabsTrigger>
              <TabsTrigger value="results">效果对比</TabsTrigger>
              <TabsTrigger value="testimonial">用户反馈</TabsTrigger>
              <TabsTrigger value="timeline">实施过程</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 课程信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      课程信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">课程名称:</span>
                      <span className="font-medium">{currentScenario.classInfo.course}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">学生层次:</span>
                      <span className="font-medium">{currentScenario.classInfo.level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">班级规模:</span>
                      <span className="font-medium">{currentScenario.classInfo.size}人</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">学期:</span>
                      <span className="font-medium">{currentScenario.classInfo.semester}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* 教师信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      授课教师
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">姓名:</span>
                      <span className="font-medium">{currentScenario.teacherProfile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">职称:</span>
                      <span className="font-medium">{currentScenario.teacherProfile.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">教学经验:</span>
                      <span className="font-medium">{currentScenario.teacherProfile.experience}年</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="problem" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    教学痛点描述
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800 leading-relaxed">
                      {currentScenario.painPointDescription}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-red-700">实施前的挑战</h4>
                      <ul className="space-y-2">
                        {currentScenario.implementationDetails.challenges.map((challenge, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-red-700">{challenge}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 text-green-700">解决方案</h4>
                      <ul className="space-y-2">
                        {currentScenario.implementationDetails.solutions.map((solution, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-green-700">{solution}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 实施前数据 */}
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-red-800">实施前效果</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">理解率</span>
                        <span className="font-bold text-red-600">{currentScenario.beforeResults.comprehensionRate}%</span>
                      </div>
                      <Progress value={currentScenario.beforeResults.comprehensionRate} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">通过率</span>
                        <span className="font-bold text-red-600">{currentScenario.beforeResults.passRate}%</span>
                      </div>
                      <Progress value={currentScenario.beforeResults.passRate} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">满意度</span>
                        <span className="font-bold text-red-600">{currentScenario.beforeResults.satisfactionScore}/10</span>
                      </div>
                      <Progress value={currentScenario.beforeResults.satisfactionScore * 10} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">教学用时</span>
                        <span className="font-bold text-red-600">{currentScenario.beforeResults.teachingTime}分钟</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">辍学率</span>
                        <span className="font-bold text-red-600">{currentScenario.beforeResults.dropoutRate}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 实施后数据 */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-800">实施后效果</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">理解率</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{currentScenario.afterResults.comprehensionRate}%</span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            +{calculateImprovement(currentScenario.beforeResults.comprehensionRate, currentScenario.afterResults.comprehensionRate)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={currentScenario.afterResults.comprehensionRate} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">通过率</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{currentScenario.afterResults.passRate}%</span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            +{calculateImprovement(currentScenario.beforeResults.passRate, currentScenario.afterResults.passRate)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={currentScenario.afterResults.passRate} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">满意度</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{currentScenario.afterResults.satisfactionScore}/10</span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            +{calculateImprovement(currentScenario.beforeResults.satisfactionScore, currentScenario.afterResults.satisfactionScore)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={currentScenario.afterResults.satisfactionScore * 10} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">教学用时</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{currentScenario.afterResults.teachingTime}分钟</span>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            -{calculateImprovement(currentScenario.beforeResults.teachingTime, currentScenario.afterResults.teachingTime, true)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">辍学率</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{currentScenario.afterResults.dropoutRate}%</span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            -{calculateImprovement(currentScenario.beforeResults.dropoutRate, currentScenario.afterResults.dropoutRate, true)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="testimonial" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Quote className="w-5 h-5" />
                    教师反馈
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
                    <blockquote className="text-lg text-blue-900 leading-relaxed mb-4">
                      "{currentScenario.testimonial.content}"
                    </blockquote>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-blue-800">
                          {currentScenario.testimonial.author}
                        </div>
                        <div className="text-sm text-blue-600">
                          {currentScenario.testimonial.role}
                        </div>
                      </div>
                      <div className="text-sm text-blue-500">
                        {currentScenario.testimonial.date}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-3">应用的关键功能</h4>
                      <ul className="space-y-2">
                        {currentScenario.implementationDetails.keyFeatures.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">实施周期</h4>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>{currentScenario.implementationDetails.duration}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    实施时间轴
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex items-center gap-1"
                    >
                      {isPlaying ? <Pause className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                      {isPlaying ? '暂停' : '播放'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={resetTimeline}
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      重置
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {currentScenario.timeline.map((phase, index) => {
                      const progress = Math.max(0, Math.min(100, (timelineProgress - index * 25)));
                      const isActive = timelineProgress > index * 25;
                      
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: isActive ? 1 : 0.5,
                            x: 0,
                            scale: isActive ? 1 : 0.95
                          }}
                          transition={{ duration: 0.3 }}
                          className={`relative pl-8 ${isActive ? 'border-l-2 border-blue-500' : 'border-l-2 border-gray-300'}`}
                        >
                          <div className={`absolute -left-2 w-4 h-4 rounded-full ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <div className="pb-6">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`font-semibold ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                {phase.phase}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {phase.duration}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{phase.description}</p>
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <p className="text-sm text-green-700">
                                <strong>成果:</strong> {phase.results}
                              </p>
                            </div>
                            {isActive && (
                              <div className="mt-2">
                                <Progress value={progress} className="h-1" />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
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

export default ConcreteScenarios;