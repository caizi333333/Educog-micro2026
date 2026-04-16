import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Search, 
 
  Target, 
  TrendingUp, 
  Users, 
  Clock, 
  Star, 
  BookOpen, 
 
 
  Zap, 
  Award, 
 
  Play, 
  CheckCircle, 
  AlertCircle, 
  BarChart3, 
  Network, 
  Compass, 
  Sparkles
} from 'lucide-react';

interface KnowledgeNode {
  id: string;
  title: string;
  type: 'concept' | 'skill' | 'project' | 'theory' | 'practice';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  prerequisites: string[];
  connections: string[];
  learningTime: number; // 分钟
  completionRate: number;
  popularity: number;
  tags: string[];
  resources: {
    videos: number;
    exercises: number;
    projects: number;
    documents: number;
  };
  position: { x: number; y: number };
  mastery: number; // 0-100
  lastAccessed?: Date;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  nodes: string[];
  estimatedTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completionRate: number;
  enrolledUsers: number;
  rating: number;
  tags: string[];
  isRecommended: boolean;
  personalizedScore: number;
}

interface UserProfile {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  completedNodes: string[];
  currentPath?: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  availableTime: number; // 每周分钟数
  goals: string[];
  weakAreas: string[];
  strongAreas: string[];
}

const knowledgeNodes: KnowledgeNode[] = [
  {
    id: 'basic-concepts',
    title: '单片机基础概念',
    type: 'concept',
    difficulty: 'beginner',
    description: '了解单片机的基本概念、结构和工作原理',
    prerequisites: [],
    connections: ['8051-architecture', 'programming-basics'],
    learningTime: 45,
    completionRate: 92,
    popularity: 95,
    tags: ['基础', '概念', '入门'],
    resources: { videos: 5, exercises: 8, projects: 2, documents: 12 },
    position: { x: 100, y: 100 },
    mastery: 85
  },
  {
    id: '8051-architecture',
    title: '8051架构详解',
    type: 'theory',
    difficulty: 'intermediate',
    description: '深入学习8051单片机的内部架构和各个功能模块',
    prerequisites: ['basic-concepts'],
    connections: ['memory-management', 'io-ports', 'timers-counters'],
    learningTime: 90,
    completionRate: 78,
    popularity: 88,
    tags: ['架构', '8051', '理论'],
    resources: { videos: 8, exercises: 12, projects: 3, documents: 15 },
    position: { x: 300, y: 100 },
    mastery: 72
  },
  {
    id: 'programming-basics',
    title: '汇编语言基础',
    type: 'skill',
    difficulty: 'beginner',
    description: '学习8051汇编语言的基本语法和编程技巧',
    prerequisites: ['basic-concepts'],
    connections: ['instruction-set', 'addressing-modes'],
    learningTime: 120,
    completionRate: 85,
    popularity: 90,
    tags: ['编程', '汇编', '语法'],
    resources: { videos: 10, exercises: 20, projects: 5, documents: 18 },
    position: { x: 100, y: 300 },
    mastery: 68
  },
  {
    id: 'io-ports',
    title: 'I/O端口控制',
    type: 'practice',
    difficulty: 'intermediate',
    description: '掌握8051的I/O端口配置和控制方法',
    prerequisites: ['8051-architecture', 'programming-basics'],
    connections: ['led-control', 'button-input', 'sensor-interface'],
    learningTime: 75,
    completionRate: 82,
    popularity: 87,
    tags: ['I/O', '端口', '控制'],
    resources: { videos: 6, exercises: 15, projects: 8, documents: 10 },
    position: { x: 500, y: 200 },
    mastery: 45
  },
  {
    id: 'timers-counters',
    title: '定时器与计数器',
    type: 'practice',
    difficulty: 'intermediate',
    description: '学习定时器和计数器的配置与应用',
    prerequisites: ['8051-architecture'],
    connections: ['pwm-generation', 'frequency-measurement'],
    learningTime: 100,
    completionRate: 75,
    popularity: 83,
    tags: ['定时器', '计数器', '中断'],
    resources: { videos: 7, exercises: 18, projects: 6, documents: 14 },
    position: { x: 300, y: 300 },
    mastery: 30
  },
  {
    id: 'led-control',
    title: 'LED控制项目',
    type: 'project',
    difficulty: 'beginner',
    description: '通过LED控制项目实践I/O操作',
    prerequisites: ['io-ports'],
    connections: ['display-systems'],
    learningTime: 60,
    completionRate: 90,
    popularity: 92,
    tags: ['项目', 'LED', '实践'],
    resources: { videos: 4, exercises: 10, projects: 12, documents: 8 },
    position: { x: 700, y: 150 },
    mastery: 0
  },
  {
    id: 'sensor-interface',
    title: '传感器接口设计',
    type: 'practice',
    difficulty: 'advanced',
    description: '学习各种传感器的接口设计和数据处理',
    prerequisites: ['io-ports', 'adc-conversion'],
    connections: ['smart-home-project'],
    learningTime: 150,
    completionRate: 65,
    popularity: 78,
    tags: ['传感器', '接口', '高级'],
    resources: { videos: 9, exercises: 25, projects: 15, documents: 20 },
    position: { x: 700, y: 300 },
    mastery: 0
  },
  {
    id: 'smart-home-project',
    title: '智能家居系统',
    type: 'project',
    difficulty: 'advanced',
    description: '综合性智能家居控制系统项目',
    prerequisites: ['sensor-interface', 'communication-protocols'],
    connections: [],
    learningTime: 300,
    completionRate: 45,
    popularity: 85,
    tags: ['项目', '综合', '智能家居'],
    resources: { videos: 12, exercises: 30, projects: 20, documents: 25 },
    position: { x: 900, y: 400 },
    mastery: 0
  }
];

const learningPaths: LearningPath[] = [
  {
    id: 'beginner-path',
    title: '单片机入门之路',
    description: '从零开始学习单片机，适合完全没有基础的初学者',
    nodes: ['basic-concepts', 'programming-basics', 'io-ports', 'led-control'],
    estimatedTime: 300,
    difficulty: 'beginner',
    completionRate: 88,
    enrolledUsers: 1250,
    rating: 4.8,
    tags: ['入门', '基础', '实践'],
    isRecommended: true,
    personalizedScore: 95
  },
  {
    id: 'practical-path',
    title: '实践项目导向',
    description: '通过实际项目学习单片机应用，注重动手能力培养',
    nodes: ['basic-concepts', '8051-architecture', 'io-ports', 'led-control', 'sensor-interface'],
    estimatedTime: 450,
    difficulty: 'intermediate',
    completionRate: 76,
    enrolledUsers: 890,
    rating: 4.6,
    tags: ['项目', '实践', '应用'],
    isRecommended: false,
    personalizedScore: 82
  },
  {
    id: 'advanced-path',
    title: '高级系统设计',
    description: '面向有一定基础的学习者，专注于复杂系统设计',
    nodes: ['8051-architecture', 'timers-counters', 'sensor-interface', 'smart-home-project'],
    estimatedTime: 600,
    difficulty: 'advanced',
    completionRate: 62,
    enrolledUsers: 420,
    rating: 4.7,
    tags: ['高级', '系统', '设计'],
    isRecommended: false,
    personalizedScore: 68
  }
];

const userProfile: UserProfile = {
  id: 'user-001',
  name: '张同学',
  level: 'beginner',
  interests: ['嵌入式系统', '物联网', '智能硬件'],
  completedNodes: ['basic-concepts', 'programming-basics'],
  currentPath: 'beginner-path',
  learningStyle: 'visual',
  availableTime: 300, // 每周5小时
  goals: ['掌握8051编程', '完成LED项目', '理解定时器应用'],
  weakAreas: ['理论知识', '复杂电路'],
  strongAreas: ['动手实践', '逻辑思维']
};

const EnhancedKnowledgeGraph: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'path'>('graph');
  const [selectedPath, setSelectedPath] = useState<string>(learningPaths[0]?.id || '');
  const [showRecommendations] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 过滤节点
  const filteredNodes = knowledgeNodes.filter(node => {
    const matchesSearch = node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         node.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || node.type === filterType;
    const matchesDifficulty = filterDifficulty === 'all' || node.difficulty === filterDifficulty;
    return matchesSearch && matchesType && matchesDifficulty;
  });

  // 获取推荐节点
  const getRecommendedNodes = () => {
    return knowledgeNodes
      .filter(node => {
        // 未完成的节点
        if (userProfile.completedNodes.includes(node.id)) return false;
        
        // 检查前置条件是否满足
        const prerequisitesMet = node.prerequisites.every(prereq => 
          userProfile.completedNodes.includes(prereq)
        );
        
        return prerequisitesMet;
      })
      .sort((a, b) => {
        // 根据用户兴趣和学习风格计算推荐分数
        const scoreA = calculateRecommendationScore(a);
        const scoreB = calculateRecommendationScore(b);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  };

  const calculateRecommendationScore = (node: KnowledgeNode) => {
    let score = 0;
    
    // 基于难度匹配
    if (node.difficulty === userProfile.level) score += 30;
    else if (userProfile.level === 'beginner' && node.difficulty === 'intermediate') score += 15;
    
    // 基于兴趣匹配
    const interestMatch = node.tags.some(tag => 
      userProfile.interests.some(interest => 
        interest.toLowerCase().includes(tag.toLowerCase())
      )
    );
    if (interestMatch) score += 25;
    
    // 基于学习时间
    if (node.learningTime <= userProfile.availableTime / 4) score += 20; // 一周内可完成
    
    // 基于流行度
    score += node.popularity * 0.2;
    
    // 基于完成率
    score += node.completionRate * 0.1;
    
    return score;
  };

  // 绘制知识图谱
  useEffect(() => {
    if (viewMode !== 'graph' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制连接线
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    filteredNodes.forEach(node => {
      node.connections.forEach(connectionId => {
        const connectedNode = filteredNodes.find(n => n.id === connectionId);
        if (connectedNode) {
          ctx.beginPath();
          ctx.moveTo(node.position.x, node.position.y);
          ctx.lineTo(connectedNode.position.x, connectedNode.position.y);
          ctx.stroke();
        }
      });
    });

    // 绘制节点
    filteredNodes.forEach(node => {
      const isSelected = selectedNode === node.id;
      const isCompleted = userProfile.completedNodes.includes(node.id);
      const isRecommended = getRecommendedNodes().some(n => n.id === node.id);
      
      // 节点颜色
      let fillColor = '#f3f4f6';
      let strokeColor = '#9ca3af';
      
      if (isCompleted) {
        fillColor = '#dcfce7';
        strokeColor = '#16a34a';
      } else if (isRecommended) {
        fillColor = '#fef3c7';
        strokeColor = '#f59e0b';
      } else if (isSelected) {
        fillColor = '#dbeafe';
        strokeColor = '#3b82f6';
      }
      
      // 绘制节点圆圈
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      
      ctx.beginPath();
      ctx.arc(node.position.x, node.position.y, 30, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // 绘制节点图标
      ctx.fillStyle = strokeColor;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      
      const icon = getNodeIcon(node.type);
      ctx.fillText(icon, node.position.x, node.position.y + 5);
      
      // 绘制节点标题
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.fillText(node.title, node.position.x, node.position.y + 50);
      
      // 绘制掌握度进度条
      if (node.mastery > 0) {
        const barWidth = 40;
        const barHeight = 4;
        const barX = node.position.x - barWidth / 2;
        const barY = node.position.y + 60;
        
        // 背景
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 进度
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(barX, barY, (barWidth * node.mastery) / 100, barHeight);
      }
    });
  }, [filteredNodes, selectedNode, viewMode]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'concept': return '💡';
      case 'skill': return '🔧';
      case 'project': return '🚀';
      case 'theory': return '📚';
      case 'practice': return '⚡';
      default: return '📖';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'concept': return 'bg-blue-100 text-blue-800';
      case 'skill': return 'bg-green-100 text-green-800';
      case 'project': return 'bg-purple-100 text-purple-800';
      case 'theory': return 'bg-yellow-100 text-yellow-800';
      case 'practice': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 检查点击的节点
    const clickedNode = filteredNodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(x - node.position.x, 2) + Math.pow(y - node.position.y, 2)
      );
      return distance <= 30;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode.id);
    } else {
      setSelectedNode(null);
    }
  };

  const selectedNodeData = selectedNode 
    ? knowledgeNodes.find(n => n.id === selectedNode) 
    : null;

  const currentPath = learningPaths.find(p => p.id === selectedPath);
  const recommendedNodes = getRecommendedNodes();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 标题和统计 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-8 h-8 text-purple-600" />
            增强知识图谱
          </h1>
          <p className="text-gray-600 mt-2">
            个性化推荐 + 智能路径规划 + 学习进度追踪
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-100 text-purple-800">
            知识节点: {knowledgeNodes.length}
          </Badge>
          <Badge className="bg-blue-100 text-blue-800">
            学习路径: {learningPaths.length}
          </Badge>
          <Badge className="bg-green-100 text-green-800">
            完成进度: {Math.round((userProfile.completedNodes.length / knowledgeNodes.length) * 100)}%
          </Badge>
        </div>
      </div>

      {/* 个人学习概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">学习者档案</span>
            </div>
            <div className="space-y-1 text-sm">
              <div>姓名: {userProfile.name}</div>
              <div>等级: {userProfile.level}</div>
              <div>学习风格: {userProfile.learningStyle}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-green-600" />
              <span className="font-semibold">学习目标</span>
            </div>
            <div className="space-y-1 text-sm">
              {userProfile.goals.slice(0, 2).map((goal, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  {goal}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="font-semibold">学习时间</span>
            </div>
            <div className="space-y-1 text-sm">
              <div>每周可用: {userProfile.availableTime}分钟</div>
              <div>建议每次: 45-60分钟</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="font-semibold">学习进度</span>
            </div>
            <div className="space-y-2">
              <Progress 
                value={(userProfile.completedNodes.length / knowledgeNodes.length) * 100} 
                className="h-2" 
              />
              <div className="text-sm text-gray-600">
                {userProfile.completedNodes.length}/{knowledgeNodes.length} 已完成
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 智能推荐区域 */}
      {showRecommendations && recommendedNodes.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Sparkles className="w-5 h-5" />
              AI智能推荐
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendedNodes.map((node) => (
                <div key={node.id} className="bg-white rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={getTypeColor(node.type)}>
                      {node.type}
                    </Badge>
                    <div className="text-sm text-orange-600 font-semibold">
                      推荐度: {Math.round(calculateRecommendationScore(node))}%
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{node.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{node.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{node.learningTime}分钟</span>
                    <Button size="sm" onClick={() => setSelectedNode(node.id)}>
                      开始学习
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索和过滤 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="搜索知识节点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">所有类型</option>
          <option value="concept">概念</option>
          <option value="skill">技能</option>
          <option value="project">项目</option>
          <option value="theory">理论</option>
          <option value="practice">实践</option>
        </select>
        
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">所有难度</option>
          <option value="beginner">初级</option>
          <option value="intermediate">中级</option>
          <option value="advanced">高级</option>
        </select>
        
        <div className="flex items-center gap-1 border rounded-md">
          <Button
            variant={viewMode === 'graph' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('graph')}
          >
            <Network className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'path' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('path')}
          >
            <Compass className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 主视图 */}
        <div className="lg:col-span-3">
          <div>
            {viewMode === 'graph' && (
              <Card className="h-[600px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="w-5 h-5" />
                    知识图谱视图
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[520px]">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-pointer"
                    onClick={handleCanvasClick}
                  />
                </CardContent>
              </Card>
            )}
            {viewMode === 'list' && (
              <Card className="h-[600px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    列表视图
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[520px] overflow-y-auto">
                  <div className="space-y-4">
                    {filteredNodes.map((node) => {
                      const isCompleted = userProfile.completedNodes.includes(node.id);
                      const isRecommended = recommendedNodes.some(n => n.id === node.id);
                      
                      return (
                        <div
                          key={node.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedNode === node.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedNode(node.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getNodeIcon(node.type)}</span>
                              <div>
                                <h3 className="font-semibold text-gray-900">{node.title}</h3>
                                <p className="text-sm text-gray-600">{node.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
                              {isRecommended && <Star className="w-5 h-5 text-yellow-500" />}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <Badge className={getTypeColor(node.type)}>
                              {node.type}
                            </Badge>
                            <Badge className={getDifficultyColor(node.difficulty)}>
                              {node.difficulty}
                            </Badge>
                            <span className="text-gray-500">{node.learningTime}分钟</span>
                            <span className="text-gray-500">完成率: {node.completionRate}%</span>
                          </div>
                          
                          {node.mastery > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>掌握度</span>
                                <span>{node.mastery}%</span>
                              </div>
                              <Progress value={node.mastery} className="h-2" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            {viewMode === 'path' && (
              <Card className="h-[600px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Compass className="w-5 h-5" />
                    学习路径
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPath}
                      onChange={(e) => setSelectedPath(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      {learningPaths.map((path) => (
                        <option key={path.id} value={path.id}>
                          {path.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                <CardContent className="h-[520px] overflow-y-auto">
                  {currentPath && (
                    <div className="space-y-6">
                      {/* 路径信息 */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{currentPath.title}</h3>
                            <p className="text-sm text-gray-600">{currentPath.description}</p>
                          </div>
                          {currentPath.isRecommended && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Star className="w-3 h-3 mr-1" />
                              推荐
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">预计时间</span>
                            <div className="font-semibold">{currentPath.estimatedTime}分钟</div>
                          </div>
                          <div>
                            <span className="text-gray-500">难度等级</span>
                            <div className="font-semibold">{currentPath.difficulty}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">完成率</span>
                            <div className="font-semibold">{currentPath.completionRate}%</div>
                          </div>
                          <div>
                            <span className="text-gray-500">评分</span>
                            <div className="font-semibold flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              {currentPath.rating}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 路径节点 */}
                      <div className="space-y-4">
                        {currentPath.nodes.map((nodeId, index) => {
                          const node = knowledgeNodes.find(n => n.id === nodeId);
                          if (!node) return null;
                          
                          const isCompleted = userProfile.completedNodes.includes(node.id);
                          const isNext = !isCompleted && 
                            (index === 0 || userProfile.completedNodes.includes(currentPath.nodes[index - 1] || ''));
                          
                          return (
                            <div key={nodeId} className="flex items-center gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                  isCompleted 
                                    ? 'bg-green-500 text-white' 
                                    : isNext 
                                      ? 'bg-blue-500 text-white' 
                                      : 'bg-gray-300 text-gray-600'
                                }`}>
                                  {isCompleted ? '✓' : index + 1}
                                </div>
                                {index < currentPath.nodes.length - 1 && (
                                  <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                                )}
                              </div>
                              
                              <div className="flex-1">
                                <div className={`p-4 border rounded-lg ${
                                  isNext ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                }`}>
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h4 className="font-semibold text-gray-900">{node.title}</h4>
                                      <p className="text-sm text-gray-600">{node.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className={getTypeColor(node.type)}>
                                        {node.type}
                                      </Badge>
                                      {isNext && (
                                        <Button size="sm">
                                          <Play className="w-4 h-4 mr-1" />
                                          开始
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span>{node.learningTime}分钟</span>
                                    <span>{node.resources.videos}个视频</span>
                                    <span>{node.resources.exercises}个练习</span>
                                  </div>
                                  
                                  {node.mastery > 0 && (
                                    <div className="mt-2">
                                      <Progress value={node.mastery} className="h-2" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 节点详情 */}
          {selectedNodeData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">{getNodeIcon(selectedNodeData.type)}</span>
                  节点详情
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">{selectedNodeData.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedNodeData.description}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getTypeColor(selectedNodeData.type)}>
                    {selectedNodeData.type}
                  </Badge>
                  <Badge className={getDifficultyColor(selectedNodeData.difficulty)}>
                    {selectedNodeData.difficulty}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">学习时间:</span>
                    <span>{selectedNodeData.learningTime}分钟</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">完成率:</span>
                    <span>{selectedNodeData.completionRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">流行度:</span>
                    <span>{selectedNodeData.popularity}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">学习资源</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Play className="w-4 h-4 text-red-500" />
                      {selectedNodeData.resources.videos}个视频
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      {selectedNodeData.resources.exercises}个练习
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4 text-purple-500" />
                      {selectedNodeData.resources.projects}个项目
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-green-500" />
                      {selectedNodeData.resources.documents}个文档
                    </div>
                  </div>
                </div>
                
                {selectedNodeData.prerequisites.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">前置条件</h4>
                    {selectedNodeData.prerequisites.map((prereq, index) => {
                      const prereqNode = knowledgeNodes.find(n => n.id === prereq);
                      const isCompleted = userProfile.completedNodes.includes(prereq);
                      return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={isCompleted ? 'text-green-700' : 'text-red-700'}>
                            {prereqNode?.title || prereq}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {selectedNodeData.mastery > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">掌握度</span>
                      <span className="text-sm">{selectedNodeData.mastery}%</span>
                    </div>
                    <Progress value={selectedNodeData.mastery} className="h-2" />
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm">
                    <Play className="w-4 h-4 mr-1" />
                    开始学习
                  </Button>
                  <Button variant="outline" size="sm">
                    <BookOpen className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 学习统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                学习统计
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>总节点数</span>
                  <span>{knowledgeNodes.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>已完成</span>
                  <span className="text-green-600">{userProfile.completedNodes.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>进行中</span>
                  <span className="text-blue-600">1</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>待学习</span>
                  <span className="text-gray-600">{knowledgeNodes.length - userProfile.completedNodes.length - 1}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">类型分布</h4>
                {['concept', 'skill', 'project', 'theory', 'practice'].map(type => {
                  const count = knowledgeNodes.filter(n => n.type === type).length;
                  const completed = knowledgeNodes.filter(n => 
                    n.type === type && userProfile.completedNodes.includes(n.id)
                  ).length;
                  
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{type}</span>
                        <span>{completed}/{count}</span>
                      </div>
                      <Progress value={(completed / count) * 100} className="h-1" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" size="sm">
                <Target className="w-4 h-4 mr-2" />
                设置学习目标
              </Button>
              <Button className="w-full justify-start" variant="outline" size="sm">
                <Award className="w-4 h-4 mr-2" />
                查看成就
              </Button>
              <Button className="w-full justify-start" variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                学习小组
              </Button>
              <Button className="w-full justify-start" variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                学习报告
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EnhancedKnowledgeGraph;