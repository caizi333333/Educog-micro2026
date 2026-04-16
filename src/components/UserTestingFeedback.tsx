'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  MessageSquare, 
  BarChart3, 
  Star, 
  ThumbsUp,
  Clock,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Send,
  Download,
  Filter,
  Search
} from 'lucide-react';

interface TestingSession {
  id: string;
  userId: string;
  userName: string;
  userType: 'teacher' | 'student';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  completedTasks: number;
  totalTasks: number;
  overallRating: number;
  feedback: string;
  issues: Issue[];
  suggestions: string[];
}

interface Issue {
  id: string;
  type: 'bug' | 'usability' | 'performance' | 'feature';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  steps: string[];
  screenshot?: string;
  timestamp: Date;
}

interface FeedbackSummary {
  totalSessions: number;
  averageRating: number;
  completionRate: number;
  averageDuration: number;
  issueCount: number;
  satisfactionScore: number;
}

const mockTestingSessions: TestingSession[] = [
  {
    id: 'test-001',
    userId: 'user-001',
    userName: '张老师',
    userType: 'teacher',
    startTime: new Date('2024-01-15T09:00:00'),
    endTime: new Date('2024-01-15T10:30:00'),
    duration: 90,
    completedTasks: 8,
    totalTasks: 10,
    overallRating: 4.5,
    feedback: 'AI助教功能非常实用，特别是智能代码生成和错误诊断。界面设计直观，学生反馈很好。',
    issues: [
      {
        id: 'issue-001',
        type: 'usability',
        severity: 'medium',
        description: '知识图谱加载速度较慢',
        steps: ['打开知识图谱页面', '等待加载', '超过5秒才显示内容'],
        timestamp: new Date('2024-01-15T09:15:00')
      }
    ],
    suggestions: ['增加更多编程语言支持', '优化移动端体验']
  },
  {
    id: 'test-002',
    userId: 'user-002',
    userName: '李同学',
    userType: 'student',
    startTime: new Date('2024-01-15T14:00:00'),
    endTime: new Date('2024-01-15T15:15:00'),
    duration: 75,
    completedTasks: 9,
    totalTasks: 10,
    overallRating: 4.8,
    feedback: '实验仿真功能很棒，3D可视化帮助我更好理解电路原理。个性化学习路径很有用。',
    issues: [],
    suggestions: ['希望增加更多实验场景', '添加学习进度分享功能']
  }
];

const UserTestingFeedback: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [newFeedback, setNewFeedback] = useState({
    rating: 5,
    feedback: '',
    suggestions: ''
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 计算反馈摘要
  const feedbackSummary: FeedbackSummary = {
    totalSessions: mockTestingSessions.length,
    averageRating: mockTestingSessions.reduce((sum, session) => sum + session.overallRating, 0) / mockTestingSessions.length,
    completionRate: mockTestingSessions.reduce((sum, session) => sum + (session.completedTasks / session.totalTasks), 0) / mockTestingSessions.length * 100,
    averageDuration: mockTestingSessions.reduce((sum, session) => sum + (session.duration || 0), 0) / mockTestingSessions.length,
    issueCount: mockTestingSessions.reduce((sum, session) => sum + session.issues.length, 0),
    satisfactionScore: mockTestingSessions.filter(session => session.overallRating >= 4).length / mockTestingSessions.length * 100
  };



  const handleSubmitFeedback = () => {
    // 提交反馈逻辑
    // TODO: implement feedback submission
    // 重置表单
    setNewFeedback({ rating: 0, feedback: '', suggestions: '' });
  };

  const exportReport = () => {
    // TODO: implement report export
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">用户测试反馈收集</h1>
          <p className="text-gray-600 mt-2">第四阶段：效果验证 - 收集用户体验反馈，优化平台功能</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800">
            第四阶段：效果验证
          </Badge>
          <Button onClick={exportReport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出报告
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            测试概览
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            测试会话
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            反馈收集
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            数据分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 测试概览指标 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">总测试会话</p>
                    <p className="text-3xl font-bold text-blue-600">{feedbackSummary.totalSessions}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">平均评分</p>
                    <p className="text-3xl font-bold text-green-600">{feedbackSummary.averageRating.toFixed(1)}</p>
                  </div>
                  <Star className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">任务完成率</p>
                    <p className="text-3xl font-bold text-purple-600">{feedbackSummary.completionRate.toFixed(1)}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">平均测试时长</p>
                    <p className="text-3xl font-bold text-orange-600">{feedbackSummary.averageDuration}分钟</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">发现问题数</p>
                    <p className="text-3xl font-bold text-red-600">{feedbackSummary.issueCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">满意度</p>
                    <p className="text-3xl font-bold text-indigo-600">{feedbackSummary.satisfactionScore.toFixed(1)}%</p>
                  </div>
                  <ThumbsUp className="w-8 h-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 测试进度展示 */}
          <Card>
            <CardHeader>
              <CardTitle>测试进度概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>教师用户测试</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>学生用户测试</span>
                    <span>85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>功能测试覆盖</span>
                    <span>92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          {/* 搜索和筛选 */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索用户名或反馈内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">全部用户</option>
                <option value="teacher">教师</option>
                <option value="student">学生</option>
              </select>
            </div>
          </div>

          {/* 测试会话列表 */}
          <div className="grid grid-cols-1 gap-4">
            {mockTestingSessions.map((session) => (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{session.userName}</h3>
                        <Badge className={session.userType === 'teacher' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                          {session.userType === 'teacher' ? '教师' : '学生'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 mb-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="font-semibold">{session.overallRating}</span>
                      </div>
                      <p className="text-sm text-gray-500">{session.duration}分钟</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">任务完成情况</p>
                      <div className="flex items-center gap-2">
                        <Progress value={(session.completedTasks / session.totalTasks) * 100} className="flex-1 h-2" />
                        <span className="text-sm font-medium">{session.completedTasks}/{session.totalTasks}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">发现问题</p>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm">{session.issues.length} 个问题</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">用户反馈</p>
                    <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-md">
                      {session.feedback}
                    </p>
                  </div>

                  {session.suggestions.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">改进建议</p>
                      <div className="flex flex-wrap gap-2">
                        {session.suggestions.map((suggestion, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {suggestion}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          {/* 反馈收集表单 */}
          <Card>
            <CardHeader>
              <CardTitle>提交测试反馈</CardTitle>
              <p className="text-sm text-gray-600">请分享您的使用体验和改进建议</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  整体评分
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setNewFeedback({ ...newFeedback, rating })}
                      className={`p-1 rounded ${
                        rating <= newFeedback.rating
                          ? 'text-yellow-500'
                          : 'text-gray-300'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    {newFeedback.rating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  使用体验反馈
                </label>
                <Textarea
                  placeholder="请描述您的使用体验，包括喜欢的功能和遇到的问题..."
                  value={newFeedback.feedback}
                  onChange={(e) => setNewFeedback({ ...newFeedback, feedback: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  改进建议
                </label>
                <Textarea
                  placeholder="请提供您的改进建议和功能需求..."
                  value={newFeedback.suggestions}
                  onChange={(e) => setNewFeedback({ ...newFeedback, suggestions: e.target.value })}
                  rows={3}
                />
              </div>

              <Button onClick={handleSubmitFeedback} className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                提交反馈
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {/* 数据分析图表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>用户满意度趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <BarChart3 className="w-16 h-16" />
                  <p className="ml-4">满意度趋势图表</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>问题类型分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <AlertCircle className="w-16 h-16" />
                  <p className="ml-4">问题分布图表</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 关键洞察 */}
          <Card>
            <CardHeader>
              <CardTitle>关键洞察与建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-800">用户满意度高</h4>
                  </div>
                  <p className="text-sm text-green-700">
                    95%的用户对平台整体体验满意，AI功能和3D仿真获得特别好评。
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-800">主要优化方向</h4>
                  </div>
                  <p className="text-sm text-blue-700">
                    需要优化知识图谱加载速度，增强移动端体验，扩展编程语言支持。
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <h4 className="font-semibold text-yellow-800">性能优化建议</h4>
                  </div>
                  <p className="text-sm text-yellow-700">
                    建议对大型组件进行懒加载优化，减少首屏加载时间，提升用户体验。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserTestingFeedback;