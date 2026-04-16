'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Video, 
  BarChart3, 
  Image, 
  Download, 
  Play, 
  Pause, 
  RotateCcw,
  Share2,
  Eye,
  Calendar,
  Users,
  TrendingUp,
  Award,
  Target,
  Zap,
  BookOpen,
  Lightbulb,
  CheckCircle,
  Star,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface MaterialTemplate {
  id: string;
  type: 'ppt' | 'video' | 'report' | 'poster';
  title: string;
  description: string;
  thumbnail: string;
  duration?: string;
  pages?: number;
  size?: string;
  lastUpdated: Date;
  downloadCount: number;
  status: 'ready' | 'generating' | 'draft';
}

interface ShowcaseMetrics {
  totalViews: number;
  downloadCount: number;
  shareCount: number;
  userFeedback: number;
  completionRate: number;
  engagementScore: number;
}

const mockMaterials: MaterialTemplate[] = [
  {
    id: 'ppt-001',
    type: 'ppt',
    title: '芯智育才平台优化成果汇报',
    description: '全面展示平台四个阶段的优化成果，包括功能升级、用户体验提升和教学效果改善',
    thumbnail: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20presentation%20slides%20about%20AI%20education%20platform%20optimization%20results%20with%20charts%20and%20metrics&image_size=landscape_16_9',
    pages: 24,
    lastUpdated: new Date('2024-01-15T10:00:00'),
    downloadCount: 156,
    status: 'ready'
  },
  {
    id: 'video-001',
    type: 'video',
    title: '平台功能演示视频',
    description: 'AI助教、3D仿真、知识图谱等核心功能的完整演示，展示优化前后的对比效果',
    thumbnail: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=video%20thumbnail%20showing%20AI%20teaching%20assistant%20and%203D%20simulation%20interface%20modern%20educational%20technology&image_size=landscape_16_9',
    duration: '8:32',
    size: '245MB',
    lastUpdated: new Date('2024-01-14T16:30:00'),
    downloadCount: 89,
    status: 'ready'
  },
  {
    id: 'report-001',
    type: 'report',
    title: '用户测试数据分析报告',
    description: '详细的用户测试数据分析，包括满意度调研、功能使用统计和改进建议汇总',
    thumbnail: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=data%20analysis%20report%20with%20charts%20graphs%20user%20satisfaction%20metrics%20professional%20document&image_size=portrait_4_3',
    pages: 18,
    size: '12MB',
    lastUpdated: new Date('2024-01-15T09:15:00'),
    downloadCount: 67,
    status: 'ready'
  },
  {
    id: 'poster-001',
    type: 'poster',
    title: '平台创新亮点宣传海报',
    description: '突出展示平台的AI创新功能和教学效果提升，适用于会议展示和宣传推广',
    thumbnail: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20educational%20technology%20poster%20AI%20innovation%20highlights%20colorful%20professional%20design&image_size=portrait_4_3',
    size: '8MB',
    lastUpdated: new Date('2024-01-13T14:20:00'),
    downloadCount: 234,
    status: 'ready'
  }
];

const showcaseMetrics: ShowcaseMetrics = {
  totalViews: 2847,
  downloadCount: 546,
  shareCount: 128,
  userFeedback: 4.7,
  completionRate: 89.5,
  engagementScore: 92.3
};

const ResultsShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ppt': return <FileText className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'report': return <BarChart3 className="w-5 h-5" />;
      case 'poster': return <Image className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'ppt': return 'PPT演示';
      case 'video': return '视频演示';
      case 'report': return '数据报告';
      case 'poster': return '宣传海报';
      default: return '未知类型';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'generating': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready': return '已完成';
      case 'generating': return '生成中';
      case 'draft': return '草稿';
      default: return '未知';
    }
  };

  const handleGenerate = (type: string) => {
    setIsGenerating(type);
    // 模拟生成过程
    setTimeout(() => {
      setIsGenerating(null);
    }, 3000);
  };

  const handleDownload = (material: MaterialTemplate) => {
    // TODO: implement material download
  };

  const handleShare = (material: MaterialTemplate) => {
    // TODO: implement material sharing
  };

  const handlePreview = (material: MaterialTemplate) => {
    setSelectedMaterial(material);
    setPreviewMode(true);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">成果展示材料</h1>
          <p className="text-gray-600 mt-2">第四阶段：效果验证 - 生成和管理各类展示材料</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-100 text-purple-800">
            材料生成中心
          </Badge>
          <Button className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            批量分享
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            展示概览
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            材料库
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            智能生成
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            效果分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 展示指标 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">总浏览量</p>
                    <p className="text-3xl font-bold text-blue-600">{showcaseMetrics.totalViews.toLocaleString()}</p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">下载次数</p>
                    <p className="text-3xl font-bold text-green-600">{showcaseMetrics.downloadCount}</p>
                  </div>
                  <Download className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">分享次数</p>
                    <p className="text-3xl font-bold text-purple-600">{showcaseMetrics.shareCount}</p>
                  </div>
                  <Share2 className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">用户评分</p>
                    <p className="text-3xl font-bold text-yellow-600">{showcaseMetrics.userFeedback}</p>
                  </div>
                  <Star className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">完成率</p>
                    <p className="text-3xl font-bold text-indigo-600">{showcaseMetrics.completionRate}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">参与度</p>
                    <p className="text-3xl font-bold text-red-600">{showcaseMetrics.engagementScore}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 优化成果亮点 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                优化成果亮点
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">AI功能全面升级</h4>
                      <p className="text-sm text-gray-600">智能代码生成准确率提升35%，错误诊断效率提升50%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">教学体验优化</h4>
                      <p className="text-sm text-gray-600">3D仿真实验覆盖率达90%，学习路径个性化匹配度提升40%</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">用户满意度提升</h4>
                      <p className="text-sm text-gray-600">整体满意度达95%，功能使用率提升60%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">教学效果显著</h4>
                      <p className="text-sm text-gray-600">学习效率提升45%，知识掌握度提升30%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          {/* 材料库 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockMaterials.map((material) => (
              <Card key={material.id} className="hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                  <img 
                    src={material.thumbnail} 
                    alt={material.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(material.type)}
                      <Badge variant="outline">{getTypeLabel(material.type)}</Badge>
                    </div>
                    <Badge className={getStatusColor(material.status)}>
                      {getStatusLabel(material.status)}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-2">{material.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{material.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-4">
                      {material.pages && (
                        <span>{material.pages} 页</span>
                      )}
                      {material.duration && (
                        <span>{material.duration}</span>
                      )}
                      {material.size && (
                        <span>{material.size}</span>
                      )}
                    </div>
                    <span>{material.downloadCount} 下载</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handlePreview(material)}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      预览
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownload(material)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleShare(material)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="generator" className="space-y-6">
          {/* 智能生成工具 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  PPT演示生成
                </CardTitle>
                <p className="text-sm text-gray-600">自动生成专业的成果汇报PPT</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">包含内容：</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 优化前后对比分析</li>
                    <li>• 功能升级详细介绍</li>
                    <li>• 用户反馈数据展示</li>
                    <li>• 未来发展规划</li>
                  </ul>
                </div>
                <Button 
                  onClick={() => handleGenerate('ppt')} 
                  disabled={isGenerating === 'ppt'}
                  className="w-full"
                >
                  {isGenerating === 'ppt' ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      生成PPT
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-green-600" />
                  演示视频录制
                </CardTitle>
                <p className="text-sm text-gray-600">录制功能演示和使用教程视频</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">录制内容：</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• AI助教功能演示</li>
                    <li>• 3D仿真实验操作</li>
                    <li>• 知识图谱交互</li>
                    <li>• 个性化学习路径</li>
                  </ul>
                </div>
                <Button 
                  onClick={() => handleGenerate('video')} 
                  disabled={isGenerating === 'video'}
                  className="w-full"
                >
                  {isGenerating === 'video' ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      录制中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      开始录制
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  数据分析报告
                </CardTitle>
                <p className="text-sm text-gray-600">生成详细的数据分析和用户反馈报告</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">报告内容：</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 用户行为数据分析</li>
                    <li>• 功能使用统计</li>
                    <li>• 满意度调研结果</li>
                    <li>• 改进建议汇总</li>
                  </ul>
                </div>
                <Button 
                  onClick={() => handleGenerate('report')} 
                  disabled={isGenerating === 'report'}
                  className="w-full"
                >
                  {isGenerating === 'report' ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      生成报告
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5 text-orange-600" />
                  宣传材料设计
                </CardTitle>
                <p className="text-sm text-gray-600">设计专业的宣传海报和推广材料</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">设计内容：</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 功能亮点展示海报</li>
                    <li>• 成果数据可视化</li>
                    <li>• 用户评价展示</li>
                    <li>• 品牌形象设计</li>
                  </ul>
                </div>
                <Button 
                  onClick={() => handleGenerate('poster')} 
                  disabled={isGenerating === 'poster'}
                  className="w-full"
                >
                  {isGenerating === 'poster' ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      设计中...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 mr-2" />
                      开始设计
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* 效果分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>材料使用趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <TrendingUp className="w-16 h-16" />
                  <p className="ml-4">使用趋势图表</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>用户参与度分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <Users className="w-16 h-16" />
                  <p className="ml-4">参与度分析图表</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 成效总结 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                优化成效总结
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-blue-900 mb-2">技术创新</h3>
                  <p className="text-blue-700 text-sm">
                    AI功能全面升级，智能化程度显著提升，为教学提供强大技术支撑
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-green-900 mb-2">教学效果</h3>
                  <p className="text-green-700 text-sm">
                    学习效率和知识掌握度大幅提升，个性化教学效果显著
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-purple-900 mb-2">用户体验</h3>
                  <p className="text-purple-700 text-sm">
                    用户满意度达到新高，平台易用性和功能完整性获得广泛认可
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 预览模态框 */}
      {previewMode && selectedMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{selectedMaterial.title}</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setPreviewMode(false)}
                >
                  关闭
                </Button>
              </div>
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <img 
                  src={selectedMaterial.thumbnail} 
                  alt={selectedMaterial.title}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button onClick={() => handleDownload(selectedMaterial)}>
                  <Download className="w-4 h-4 mr-2" />
                  下载
                </Button>
                <Button variant="outline" onClick={() => handleShare(selectedMaterial)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  分享
                </Button>
                <Button variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  在新窗口打开
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsShowcase;