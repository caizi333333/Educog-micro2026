import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { 
  PlayCircle, 
  PauseCircle, 
  RotateCcw, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  Zap,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colorTheme } from '@/lib/color-theme';

interface SimulationScenario {
  studentCount: number;
  difficultyLevel: 'basic' | 'intermediate' | 'advanced';
  teachingMethod: 'traditional' | 'ai-enhanced';
  realTimeMetrics: {
    comprehensionRate: number;
    engagementLevel: number;
    completionTime: number;
    satisfactionScore: number;
  };
}

interface SimulationParams {
  classSize: number;
  conceptDifficulty: number;
  timeLimit: number;
}

const InteractiveSimulator: React.FC = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [currentScenario, setCurrentScenario] = useState<'traditional' | 'ai-enhanced'>('traditional');
  const [simulationParams, setSimulationParams] = useState<SimulationParams>({
    classSize: 40,
    conceptDifficulty: 3,
    timeLimit: 90
  });
  
  const [simulationResults, setSimulationResults] = useState<{
    traditional: SimulationScenario;
    aiEnhanced: SimulationScenario;
  }>({
    traditional: {
      studentCount: 40,
      difficultyLevel: 'intermediate',
      teachingMethod: 'traditional',
      realTimeMetrics: {
        comprehensionRate: 45,
        engagementLevel: 35,
        completionTime: 120,
        satisfactionScore: 6.2
      }
    },
    aiEnhanced: {
      studentCount: 40,
      difficultyLevel: 'intermediate',
      teachingMethod: 'ai-enhanced',
      realTimeMetrics: {
        comprehensionRate: 82,
        engagementLevel: 89,
        completionTime: 75,
        satisfactionScore: 9.1
      }
    }
  });

  // 模拟运行效果
  const runSimulation = async () => {
    setIsSimulating(true);
    setSimulationProgress(0);
    
    // 根据参数计算结果
    const calculateMetrics = (method: 'traditional' | 'ai-enhanced') => {
      const baseRate = method === 'traditional' ? 0.4 : 0.8;
      const sizeImpact = Math.max(0.1, 1 - (simulationParams.classSize - 20) * 0.01);
      const difficultyImpact = Math.max(0.2, 1 - (simulationParams.conceptDifficulty - 1) * 0.15);
      
      const comprehensionRate = Math.round(baseRate * sizeImpact * difficultyImpact * 100);
      const engagementLevel = method === 'traditional' 
        ? Math.round(comprehensionRate * 0.8) 
        : Math.round(comprehensionRate * 1.1);
      const completionTime = method === 'traditional'
        ? simulationParams.timeLimit + 30
        : Math.round(simulationParams.timeLimit * 0.7);
      const satisfactionScore = method === 'traditional'
        ? Math.round(comprehensionRate * 0.1 + 2) / 10
        : Math.round(comprehensionRate * 0.08 + 5) / 10;
        
      return {
        comprehensionRate: Math.min(95, comprehensionRate),
        engagementLevel: Math.min(95, engagementLevel),
        completionTime,
        satisfactionScore: Math.min(10, satisfactionScore)
      };
    };

    // 模拟进度动画
    for (let i = 0; i <= 100; i += 5) {
      setSimulationProgress(i);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 更新结果
    setSimulationResults({
      traditional: {
        ...simulationResults.traditional,
        studentCount: simulationParams.classSize,
        realTimeMetrics: calculateMetrics('traditional')
      },
      aiEnhanced: {
        ...simulationResults.aiEnhanced,
        studentCount: simulationParams.classSize,
        realTimeMetrics: calculateMetrics('ai-enhanced')
      }
    });

    setIsSimulating(false);
  };

  const resetSimulation = () => {
    setSimulationProgress(0);
    setCurrentScenario('traditional');
    setSimulationParams({
      classSize: 40,
      conceptDifficulty: 3,
      timeLimit: 90
    });
  };

  const getImprovementPercentage = (traditional: number, aiEnhanced: number) => {
    return Math.round(((aiEnhanced - traditional) / traditional) * 100);
  };

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          教学效果交互式模拟器
        </h2>
        <p className="text-muted-foreground">
          调整参数，实时观察传统教学与AI增强教学的效果对比
        </p>
      </div>

      {/* 参数控制区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            模拟参数设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 班级规模 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                班级规模: {simulationParams.classSize}人
              </label>
              <Slider
                value={[simulationParams.classSize]}
                onValueChange={(value) => 
                  setSimulationParams(prev => ({ ...prev, classSize: value[0] ?? prev.classSize }))
                }
                min={10}
                max={80}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10人</span>
                <span>80人</span>
              </div>
            </div>

            {/* 概念难度 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                概念难度: 
                {simulationParams.conceptDifficulty === 1 && ' 基础'}
                {simulationParams.conceptDifficulty === 2 && ' 简单'}
                {simulationParams.conceptDifficulty === 3 && ' 中等'}
                {simulationParams.conceptDifficulty === 4 && ' 困难'}
                {simulationParams.conceptDifficulty === 5 && ' 高难'}
              </label>
              <Slider
                value={[simulationParams.conceptDifficulty]}
                onValueChange={(value) => 
                  setSimulationParams(prev => ({ ...prev, conceptDifficulty: value[0] ?? prev.conceptDifficulty }))
                }
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>基础</span>
                <span>高难</span>
              </div>
            </div>

            {/* 时间限制 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                授课时间: {simulationParams.timeLimit}分钟
              </label>
              <Slider
                value={[simulationParams.timeLimit]}
                onValueChange={(value) => 
                  setSimulationParams(prev => ({ ...prev, timeLimit: value[0] ?? prev.timeLimit }))
                }
                min={30}
                max={180}
                step={15}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30分钟</span>
                <span>180分钟</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button 
              onClick={runSimulation} 
              disabled={isSimulating}
              className="flex items-center gap-2"
            >
              {isSimulating ? (
                <>
                  <PauseCircle className="w-4 h-4" />
                  模拟中...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  开始模拟
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={resetSimulation}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置参数
            </Button>
          </div>

          {/* 进度条 */}
          {isSimulating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>模拟进度</span>
                <span>{simulationProgress}%</span>
              </div>
              <Progress value={simulationProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 实时结果对比 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 传统教学结果 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className={`${colorTheme.status.error.card} h-full`}>
            <CardHeader>
              <CardTitle className={`${colorTheme.status.error.text} flex items-center gap-2`}>
                <BookOpen className="w-5 h-5" />
                传统教学效果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.error.text}`}>
                    {simulationResults.traditional.realTimeMetrics.comprehensionRate}%
                  </div>
                  <div className={`text-sm ${colorTheme.status.error.text}`}>理解率</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.error.text}`}>
                    {simulationResults.traditional.realTimeMetrics.engagementLevel}%
                  </div>
                  <div className={`text-sm ${colorTheme.status.error.text}`}>参与度</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.error.text}`}>
                    {simulationResults.traditional.realTimeMetrics.completionTime}
                  </div>
                  <div className={`text-sm ${colorTheme.status.error.text}`}>用时(分钟)</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.error.text}`}>
                    {simulationResults.traditional.realTimeMetrics.satisfactionScore.toFixed(1)}
                  </div>
                  <div className={`text-sm ${colorTheme.status.error.text}`}>满意度</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${colorTheme.status.error.text}`}>
                  <AlertCircle className="w-4 h-4" />
                  <span>教师主导，学生被动接受</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${colorTheme.status.error.text}`}>
                  <AlertCircle className="w-4 h-4" />
                  <span>缺乏个性化指导</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${colorTheme.status.error.text}`}>
                  <AlertCircle className="w-4 h-4" />
                  <span>反馈机制不及时</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI增强教学结果 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className={`${colorTheme.status.success.card} h-full`}>
            <CardHeader>
              <CardTitle className={`${colorTheme.status.success.text} flex items-center gap-2`}>
                <Zap className="w-5 h-5" />
                AI增强教学效果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.success.text}`}>
                    {simulationResults.aiEnhanced.realTimeMetrics.comprehensionRate}%
                  </div>
                  <div className={`text-sm ${colorTheme.status.success.text}`}>理解率</div>
                  <Badge className={`${colorTheme.status.success.badge} text-xs mt-1`}>
                    +{getImprovementPercentage(
                      simulationResults.traditional.realTimeMetrics.comprehensionRate,
                      simulationResults.aiEnhanced.realTimeMetrics.comprehensionRate
                    )}%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.success.text}`}>
                    {simulationResults.aiEnhanced.realTimeMetrics.engagementLevel}%
                  </div>
                  <div className={`text-sm ${colorTheme.status.success.text}`}>参与度</div>
                  <Badge className={`${colorTheme.status.success.badge} text-xs mt-1`}>
                    +{getImprovementPercentage(
                      simulationResults.traditional.realTimeMetrics.engagementLevel,
                      simulationResults.aiEnhanced.realTimeMetrics.engagementLevel
                    )}%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.success.text}`}>
                    {simulationResults.aiEnhanced.realTimeMetrics.completionTime}
                  </div>
                  <div className={`text-sm ${colorTheme.status.success.text}`}>用时(分钟)</div>
                  <Badge className={`${colorTheme.status.info.badge} text-xs mt-1`}>
                    -{Math.round((1 - simulationResults.aiEnhanced.realTimeMetrics.completionTime / simulationResults.traditional.realTimeMetrics.completionTime) * 100)}%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${colorTheme.status.success.text}`}>
                    {simulationResults.aiEnhanced.realTimeMetrics.satisfactionScore.toFixed(1)}
                  </div>
                  <div className={`text-sm ${colorTheme.status.success.text}`}>满意度</div>
                  <Badge className={`${colorTheme.status.success.badge} text-xs mt-1`}>
                    +{Math.round(((simulationResults.aiEnhanced.realTimeMetrics.satisfactionScore - simulationResults.traditional.realTimeMetrics.satisfactionScore) / simulationResults.traditional.realTimeMetrics.satisfactionScore) * 100)}%
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${colorTheme.status.success.text}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>AI个性化学习路径</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${colorTheme.status.success.text}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>实时智能答疑系统</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${colorTheme.status.success.text}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>3D可视化交互体验</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 综合改善指标 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              综合改善效果分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`text-center p-4 ${colorTheme.gradient.success} rounded-lg`}>
                <div className="text-3xl font-bold text-white">
                  +{getImprovementPercentage(
                    simulationResults.traditional.realTimeMetrics.comprehensionRate,
                    simulationResults.aiEnhanced.realTimeMetrics.comprehensionRate
                  )}%
                </div>
                <div className="text-sm text-white/90 font-medium">理解率提升</div>
              </div>
              <div className={`text-center p-4 ${colorTheme.gradient.info} rounded-lg`}>
                <div className="text-3xl font-bold text-white">
                  +{getImprovementPercentage(
                    simulationResults.traditional.realTimeMetrics.engagementLevel,
                    simulationResults.aiEnhanced.realTimeMetrics.engagementLevel
                  )}%
                </div>
                <div className="text-sm text-white/90 font-medium">参与度提升</div>
              </div>
              <div className={`text-center p-4 ${colorTheme.gradient.primary} rounded-lg`}>
                <div className="text-3xl font-bold text-white">
                  -{Math.round((1 - simulationResults.aiEnhanced.realTimeMetrics.completionTime / simulationResults.traditional.realTimeMetrics.completionTime) * 100)}%
                </div>
                <div className="text-sm text-white/90 font-medium">时间节省</div>
              </div>
              <div className={`text-center p-4 ${colorTheme.gradient.warning} rounded-lg`}>
                <div className="text-3xl font-bold text-white">
                  +{Math.round(((simulationResults.aiEnhanced.realTimeMetrics.satisfactionScore - simulationResults.traditional.realTimeMetrics.satisfactionScore) / simulationResults.traditional.realTimeMetrics.satisfactionScore) * 100)}%
                </div>
                <div className="text-sm text-white/90 font-medium">满意度提升</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default InteractiveSimulator;