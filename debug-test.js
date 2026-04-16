// 简化的测试脚本来调试API
const { NextRequest } = require('next/server');

// Mock所有依赖
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        totalPoints: 0
      })
    },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue([])
    },
    learningProgress: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { timeSpent: 0 }, _count: { _all: 0 } }),
      count: jest.fn().mockResolvedValue(0)
    },
    quizAttempt: {
      aggregate: jest.fn().mockResolvedValue({ _avg: { score: 0 }, _count: { _all: 0 } }),
      count: jest.fn().mockResolvedValue(0)
    },
    userActivity: {
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } })
    }
  }
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' })
}));

jest.mock('@/lib/achievement-system', () => ({
  ACHIEVEMENTS: {
    learning_time: {
      id: 'learning_time',
      name: '学习达人',
      description: '累计学习时长',
      category: '学习',
      tiers: {
        bronze: { threshold: 3600, description: '累计学习1小时', points: 50 }
      }
    }
  }
}));

async function testAPI() {
  try {
    const { GET } = require('./src/app/api/achievements/route');
    
    const request = new NextRequest('http://localhost:3000/api/achievements', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test-token'
      }
    });
    
    const response = await GET(request);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAPI();