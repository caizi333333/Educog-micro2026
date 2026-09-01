import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function shanghaiDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function shanghaiHour(value: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(value));
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return json({ error: '未授权' }, 401);
    }

    const decoded = await verifyToken(token);
    if (!decoded || !decoded.userId) {
      return json({ error: '无效的令牌' }, 401);
    }

    const userId = decoded.userId;

    // Fetch user statistics
    const [
      learningProgress,
      quizHistory,
      experiments,
      runCodeCount,
      debugSuccessCount,
    ] = await Promise.all([
      // Learning progress
      prisma.learningProgress.findMany({
        where: { userId },
        select: {
          moduleId: true,
          chapterId: true,
          progress: true,
          timeSpent: true,
          completedAt: true,
        }
      }),

      // Quiz history
      prisma.quizAttempt.findMany({
        where: { userId },
        select: {
          score: true,
          completedAt: true,
        }
      }),

      // Experiments (simulations)
      prisma.userExperiment.findMany({
        where: { userId },
        select: {
          experimentId: true,
          completedAt: true,
        }
      }),

      prisma.userActivity.count({ where: { userId, action: 'RUN_CODE' } }),
      prisma.userActivity.count({ where: { userId, action: 'DEBUG_SUCCESS' } }),
    ]);

    // Calculate statistics
    const stats = {
      // Learning achievements
      modules_completed: learningProgress.filter(p => p.progress >= 100).length,
      
      // Practice achievements (real activity counts)
      code_runs: runCodeCount,
      debug_success: debugSuccessCount,
      experiments_completed: new Set(experiments.map(e => e.experimentId)).size,
      
      // Continuous achievements
      daily_streak: calculateDailyStreak(learningProgress),
      
      // Challenge achievements
      perfect_quiz: quizHistory.filter(q => q.score === 100).length,
      speed_completion: learningProgress.filter(p => 
        p.timeSpent && p.timeSpent < 300 && p.progress >= 100 // Less than 5 minutes
      ).length,
      
      // Time-based achievements
      night_study: learningProgress.filter(p => {
        if (!p.completedAt) return false;
        const hour = shanghaiHour(new Date(p.completedAt));
        return hour >= 2 && hour < 5;
      }).length > 0 ? 1 : 0,
      
      morning_study: learningProgress.filter(p => {
        if (!p.completedAt) return false;
        const hour = shanghaiHour(new Date(p.completedAt));
        return hour >= 5 && hour < 8;
      }).length > 0 ? 1 : 0,
      
      // These metrics do not yet have authoritative event sources. Keep their
      // compatibility values at zero and expose that limitation explicitly.
      questions_answered: 0,
      discussions_started: 0,
      
      // Hidden achievements (placeholder)
      easter_egg_found: 0,
      bugs_reported: 0,
      continuous_hours: calculateMaxContinuousHours(learningProgress),
    };

    return json({
      stats,
      unavailableMetrics: [
        'questions_answered',
        'discussions_started',
        'easter_egg_found',
        'bugs_reported',
      ],
    });

  } catch (error: unknown) {
    console.error('Failed to fetch user stats:', error);
    return json(
      { error: '获取用户统计失败' },
      500
    );
  }
}

interface LearningProgressStats {
  moduleId: string;
  chapterId: string | null;
  progress: number;
  timeSpent: number;
  completedAt: Date | null;
}

function calculateDailyStreak(
  learningProgress: LearningProgressStats[]
): number {
  const dates = [...new Set(learningProgress
    .filter(p => p.completedAt)
    .map(p => shanghaiDateKey(new Date(p.completedAt!))))]
    .sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) return 0;

  const today = shanghaiDateKey(new Date());
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const currentDate = dates[i - 1];
    const previousDate = dates[i];
    if (!currentDate || !previousDate) continue;
    
    const diffDays = Math.round(
      (Date.parse(`${currentDate}T00:00:00Z`) - Date.parse(`${previousDate}T00:00:00Z`))
      / 86_400_000,
    );
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}



// Helper function to calculate maximum continuous hours
function calculateMaxContinuousHours(learningProgress: LearningProgressStats[]): number {
  if (learningProgress.length === 0) return 0;
  
  // Sort by date
  const sessions = learningProgress
    .filter(p => p.completedAt && p.timeSpent)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());
  
  let maxHours = 0;
  let previousCompletion: Date | null = null;
  let currentSessionTime = 0;
  
  for (const session of sessions) {
    const sessionDate = new Date(session.completedAt!);
    
    if (!previousCompletion) {
      previousCompletion = sessionDate;
      currentSessionTime = session.timeSpent / 3600; // Convert seconds to hours
    } else {
      const timeDiff = (sessionDate.getTime() - previousCompletion.getTime()) / (1000 * 60 * 60);
      
      // If less than 1 hour gap, consider it the same session
      if (timeDiff < 1) {
        currentSessionTime += session.timeSpent / 3600;
      } else {
        maxHours = Math.max(maxHours, currentSessionTime);
        currentSessionTime = session.timeSpent / 3600;
      }
      previousCompletion = sessionDate;
    }
  }
  
  maxHours = Math.max(maxHours, currentSessionTime);
  return Math.floor(maxHours);
}

function readOnlyResponse(): NextResponse {
  const response = json({ error: '统计数据由服务端学习记录生成，不支持客户端修改' }, 405);
  response.headers.set('Allow', 'GET');
  return response;
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return readOnlyResponse();
}

export async function PUT(_request: NextRequest): Promise<NextResponse> {
  return readOnlyResponse();
}

export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  return readOnlyResponse();
}

export async function PATCH(_request: NextRequest): Promise<NextResponse> {
  return readOnlyResponse();
}
