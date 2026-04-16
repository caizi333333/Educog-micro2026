import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// 芯智育才 (EduCog-Micro) 教学改革项目验收演示数据
// 2025-2026学年第1学期 (2025-09-01 ~ 2026-01-15)
// 机电2401 / 机电2402 班 ~40名学生
// ============================================================================

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32) for reproducible random data */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20250901);

/** Random float in [min, max) */
function randFloat(min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Random int in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}

/** Pick random element */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Normal-ish distribution via Box-Muller (clamped) */
function randNormal(mean: number, std: number, min: number, max: number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const val = mean + z * std;
  return Math.round(Math.max(min, Math.min(max, val)));
}

/** Random date between two dates */
function randDate(start: Date, end: Date): Date {
  const s = start.getTime();
  const e = end.getTime();
  return new Date(s + rng() * (e - s));
}

/** Add days to a date */
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

/** Format as CUID-like id */
let idCounter = 0;
function makeId(prefix: string): string {
  idCounter++;
  return `${prefix}_${idCounter.toString().padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Semester timeline constants
// ---------------------------------------------------------------------------
const SEMESTER_START = new Date('2025-09-01T08:00:00+08:00');
const SEMESTER_END = new Date('2026-01-15T17:00:00+08:00');

// Chapters cover weeks roughly:
const CHAPTER_SCHEDULE: { chapterId: string; moduleId: string; name: string; weekStart: number; weekEnd: number }[] = [
  { chapterId: 'ch1', moduleId: 'module-1', name: '第1章 单片机概述', weekStart: 1, weekEnd: 2 },
  { chapterId: 'ch2', moduleId: 'module-1', name: '第2章 89C51硬件结构', weekStart: 3, weekEnd: 4 },
  { chapterId: 'ch3', moduleId: 'module-1', name: '第3章 I/O端口', weekStart: 5, weekEnd: 6 },
  { chapterId: 'ch4', moduleId: 'module-2', name: '第4章 指令系统与寻址', weekStart: 7, weekEnd: 8 },
  { chapterId: 'ch5', moduleId: 'module-2', name: '第5章 C51程序设计', weekStart: 9, weekEnd: 10 },
  { chapterId: 'ch6', moduleId: 'module-3', name: '第6章 中断系统', weekStart: 11, weekEnd: 12 },
  { chapterId: 'ch7', moduleId: 'module-3', name: '第7章 定时器/计数器', weekStart: 13, weekEnd: 14 },
  { chapterId: 'ch8', moduleId: 'module-4', name: '第8章 串行通信', weekStart: 15, weekEnd: 16 },
  { chapterId: 'ch9', moduleId: 'module-4', name: '第9章 系统扩展与接口', weekStart: 17, weekEnd: 18 },
];

function weekToDate(week: number, dayOffset = 0): Date {
  return addDays(SEMESTER_START, (week - 1) * 7 + dayOffset);
}

// ---------------------------------------------------------------------------
// Student roster: 机电2401 (20人) + 机电2402 (20人)
// ---------------------------------------------------------------------------
interface StudentDef {
  name: string;
  cls: string;
  studentId: string;
  ability: number; // 0-1, affects scores and progress
}

const NAMES_2401 = [
  '王浩然', '李明远', '张宇轩', '刘博文', '陈思远',
  '杨子豪', '赵天翔', '周文博', '吴嘉伟', '孙晨阳',
  '马泽宇', '黄俊杰', '林凯文', '徐志远', '郭鑫鹏',
  '高艺博', '何宇航', '罗佳琪', '胡明哲', '唐锦程',
];

const NAMES_2402 = [
  '韩雨泽', '曹瑞祥', '冯思源', '董嘉乐', '蒋浩宇',
  '沈天磊', '魏子涵', '邓睿阳', '田文杰', '潘俊熙',
  '姜晟睿', '叶鸿飞', '余志强', '彭伟豪', '丁国栋',
  '任弘毅', '邱泽宇', '范书豪', '石振宇', '廖思远',
];

const students: StudentDef[] = [];

NAMES_2401.forEach((name, i) => {
  students.push({
    name,
    cls: '机电2401',
    studentId: `2024010${(i + 1).toString().padStart(2, '0')}`,
    ability: 0.3 + rng() * 0.65,  // range 0.3 ~ 0.95
  });
});

NAMES_2402.forEach((name, i) => {
  students.push({
    name,
    cls: '机电2402',
    studentId: `2024020${(i + 1).toString().padStart(2, '0')}`,
    ability: 0.3 + rng() * 0.65,
  });
});

// Quiz IDs matching the quiz-data.ts patterns
const QUIZ_IDS = [
  'quiz-ch1', 'quiz-ch2', 'quiz-ch3', 'quiz-ch4', 'quiz-ch5',
  'quiz-ch6', 'quiz-ch7', 'quiz-ch8', 'quiz-ch9',
];

// Experiment IDs
const EXPERIMENT_IDS = [
  'proj01', 'proj02', 'proj03', 'proj04', 'proj05',
  'proj06', 'proj07', 'proj08',
];

// Achievement definitions (must match achievement-system.ts)
const ACHIEVEMENT_DEFS = [
  { id: 'learning_time_bronze', achievementId: 'learning_time', name: '学习达人', description: '累计学习1小时', icon: '📖', category: '学习' },
  { id: 'learning_time_silver', achievementId: 'learning_time', name: '学习达人', description: '累计学习10小时', icon: '📖', category: '学习' },
  { id: 'modules_completed_bronze', achievementId: 'modules_completed', name: '知识探索者', description: '完成1个学习模块', icon: '🗺️', category: '学习' },
  { id: 'modules_completed_silver', achievementId: 'modules_completed', name: '知识探索者', description: '完成5个学习模块', icon: '🗺️', category: '学习' },
  { id: 'learning_streak_bronze', achievementId: 'learning_streak', name: '坚持不懈', description: '连续学习3天', icon: '🔥', category: '学习' },
  { id: 'learning_streak_silver', achievementId: 'learning_streak', name: '坚持不懈', description: '连续学习7天', icon: '🔥', category: '学习' },
  { id: 'quizzes_completed_bronze', achievementId: 'quizzes_completed', name: '测验达人', description: '完成1次测验', icon: '✅', category: '测验' },
  { id: 'quizzes_completed_silver', achievementId: 'quizzes_completed', name: '测验达人', description: '完成10次测验', icon: '✅', category: '测验' },
  { id: 'perfect_scores_bronze', achievementId: 'perfect_scores', name: '满分大师', description: '获得1次满分', icon: '💯', category: '测验' },
  { id: 'quiz_average_bronze', achievementId: 'quiz_average', name: '优秀学员', description: '平均分达到70分', icon: '⭐', category: '测验' },
  { id: 'quiz_average_silver', achievementId: 'quiz_average', name: '优秀学员', description: '平均分达到85分', icon: '⭐', category: '测验' },
  { id: 'experiments_completed_bronze', achievementId: 'experiments_completed', name: '实验专家', description: '完成1个实验', icon: '🔬', category: '实验' },
  { id: 'experiments_completed_silver', achievementId: 'experiments_completed', name: '实验专家', description: '完成5个实验', icon: '🔬', category: '实验' },
  { id: 'total_points_bronze', achievementId: 'total_points', name: '积分收集者', description: '累计获得500积分', icon: '🏆', category: '综合' },
];

// User actions for UserActivity
const ACTIVITY_ACTIONS = [
  'LOGIN', 'VIEW_CHAPTER', 'START_QUIZ', 'SUBMIT_QUIZ',
  'VIEW_EXPERIMENT', 'SUBMIT_EXPERIMENT', 'ASK_AI_ASSISTANT',
  'VIEW_KNOWLEDGE_GRAPH', 'VIEW_LEADERBOARD', 'DOWNLOAD_RESOURCE',
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function main() {
  console.log('========================================');
  console.log('芯智育才 教学改革项目验收 - 演示数据初始化');
  console.log('========================================');

  // Clean existing data (order matters for FK constraints)
  console.log('\n[1/9] 清理旧数据...');
  await prisma.userPointsTransaction.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.userExperiment.deleteMany();
  await prisma.learningProgress.deleteMany();
  await prisma.learningPath.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.userActivity.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // ------------------------------------------------------------------
  // 2. Create teacher (孙延才) and admin
  // ------------------------------------------------------------------
  console.log('[2/9] 创建教师与管理员账号...');
  const hashedPw = await bcrypt.hash('edu123456', 10);

  const teacher = await prisma.user.create({
    data: {
      email: 'sunyancai@qust.edu.cn',
      username: 'sunyancai',
      password: hashedPw,
      name: '孙延才',
      role: 'TEACHER',
      status: 'ACTIVE',
      teacherId: 'T20080101',
      department: '机电工程学院',
      title: '副教授',
      totalPoints: 0,
      createdAt: new Date('2025-08-20T10:00:00+08:00'),
      updatedAt: new Date('2026-01-15T10:00:00+08:00'),
      lastLoginAt: new Date('2026-01-15T09:30:00+08:00'),
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@educog.com',
      username: 'admin',
      password: hashedPw,
      name: '系统管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
      totalPoints: 0,
      createdAt: new Date('2025-08-15T10:00:00+08:00'),
      updatedAt: new Date('2026-01-15T10:00:00+08:00'),
    },
  });

  console.log(`  教师: ${teacher.name} (${teacher.username})`);
  console.log(`  管理员: ${admin.name} (${admin.username})`);

  // ------------------------------------------------------------------
  // 3. Create ~40 students
  // ------------------------------------------------------------------
  console.log('[3/9] 创建学生账号...');
  const studentPw = await bcrypt.hash('stu123456', 10);

  const createdStudents: { id: string; def: StudentDef }[] = [];

  for (const stu of students) {
    const enrollDate = randDate(
      new Date('2025-08-28T08:00:00+08:00'),
      new Date('2025-09-05T17:00:00+08:00')
    );
    const user = await prisma.user.create({
      data: {
        email: `${stu.studentId}@stu.qust.edu.cn`,
        username: stu.studentId,
        password: studentPw,
        name: stu.name,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: stu.studentId,
        class: stu.cls,
        grade: '2024级',
        major: '机械电子工程',
        totalPoints: 0,
        createdAt: enrollDate,
        updatedAt: SEMESTER_END,
        lastLoginAt: randDate(
          new Date('2026-01-05T08:00:00+08:00'),
          SEMESTER_END
        ),
      },
    });
    createdStudents.push({ id: user.id, def: stu });
  }

  console.log(`  创建 ${createdStudents.length} 名学生 (机电2401: 20, 机电2402: 20)`);

  // ------------------------------------------------------------------
  // 4. Learning Progress - students progressing through 9 chapters
  // ------------------------------------------------------------------
  console.log('[4/9] 生成学习进度数据...');
  let progressCount = 0;

  for (const stu of createdStudents) {
    // How many chapters this student has reached (based on ability + time)
    // High-ability students reach ch9, low-ability reach ch5-7
    const chaptersReached = Math.min(9, Math.max(3, Math.round(5 + stu.def.ability * 5)));

    for (let ci = 0; ci < chaptersReached; ci++) {
      const ch = CHAPTER_SCHEDULE[ci];
      const startWeek = ch.weekStart;
      const startDate = weekToDate(startWeek, randInt(0, 3));
      const isCompleted = ci < chaptersReached - 1 || rng() > 0.4;
      const progress = isCompleted ? 100 : randInt(30, 85);
      const timeSpent = randInt(1800, 7200); // 30min ~ 2hr per chapter

      const completedAt = isCompleted
        ? weekToDate(ch.weekEnd, randInt(0, 5))
        : undefined;

      await prisma.learningProgress.create({
        data: {
          userId: stu.id,
          moduleId: ch.moduleId,
          chapterId: ch.chapterId,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          progress,
          timeSpent,
          startedAt: startDate,
          completedAt: completedAt ?? null,
          lastAccessAt: completedAt ?? randDate(startDate, SEMESTER_END),
          createdAt: startDate,
          updatedAt: completedAt ?? SEMESTER_END,
        },
      });
      progressCount++;
    }
  }

  console.log(`  生成 ${progressCount} 条学习进度记录`);

  // ------------------------------------------------------------------
  // 5. Quiz Attempts - realistic score distribution
  // ------------------------------------------------------------------
  console.log('[5/9] 生成测验成绩数据...');
  let quizCount = 0;

  for (const stu of createdStudents) {
    const chaptersReached = Math.min(9, Math.max(3, Math.round(5 + stu.def.ability * 5)));

    for (let ci = 0; ci < chaptersReached; ci++) {
      const ch = CHAPTER_SCHEDULE[ci];
      const quizId = QUIZ_IDS[ci];
      // Some students attempt quizzes multiple times
      const attempts = rng() > 0.7 ? 2 : 1;

      for (let a = 0; a < attempts; a++) {
        const totalQuestions = 10;
        // Score: ability-based mean, with some noise
        const baseMean = 55 + stu.def.ability * 40; // range ~55-95
        const score = randNormal(baseMean, 8, 20, 100);
        const correctAnswers = Math.round((score / 100) * totalQuestions);
        const timeSpent = randInt(300, 1200); // 5-20 minutes

        const quizWeek = ch.weekEnd;
        const startedAt = weekToDate(quizWeek, randInt(0, 4) + a * 3);
        const completedAt = new Date(startedAt.getTime() + timeSpent * 1000);

        // Generate plausible answers JSON
        const answers: Record<string, string> = {};
        for (let q = 1; q <= totalQuestions; q++) {
          answers[`q${q}`] = pick(['A', 'B', 'C', 'D']);
        }

        await prisma.quizAttempt.create({
          data: {
            userId: stu.id,
            quizId,
            score,
            totalQuestions,
            correctAnswers,
            timeSpent,
            answers: JSON.stringify(answers),
            startedAt,
            completedAt,
            createdAt: completedAt,
          },
        });
        quizCount++;
      }
    }
  }

  console.log(`  生成 ${quizCount} 条测验记录`);

  // ------------------------------------------------------------------
  // 6. User Experiments
  // ------------------------------------------------------------------
  console.log('[6/9] 生成实验记录...');
  let expCount = 0;

  for (const stu of createdStudents) {
    const numExps = Math.min(8, Math.max(1, Math.round(2 + stu.def.ability * 7)));

    for (let ei = 0; ei < numExps; ei++) {
      const expId = EXPERIMENT_IDS[ei];
      const isCompleted = ei < numExps - 1 || rng() > 0.3;
      const startWeek = 2 + ei * 2;
      const startedAt = weekToDate(Math.min(startWeek, 17), randInt(0, 6));
      const timeSpent = randInt(2400, 7200); // 40min ~ 2hr
      const score = isCompleted ? randNormal(55 + stu.def.ability * 40, 8, 40, 100) : null;

      await prisma.userExperiment.create({
        data: {
          userId: stu.id,
          experimentId: expId,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          score: score !== null ? Math.round(score) : null,
          startedAt,
          completedAt: isCompleted ? new Date(startedAt.getTime() + timeSpent * 1000) : null,
          timeSpent: isCompleted ? timeSpent : Math.round(timeSpent * 0.4),
          attempts: isCompleted ? randInt(1, 4) : randInt(1, 2),
          createdAt: startedAt,
          updatedAt: isCompleted ? new Date(startedAt.getTime() + timeSpent * 1000) : SEMESTER_END,
        },
      });
      expCount++;
    }
  }

  console.log(`  生成 ${expCount} 条实验记录`);

  // ------------------------------------------------------------------
  // 7. User Activities (login, quiz, AI assistant, etc.)
  // ------------------------------------------------------------------
  console.log('[7/9] 生成用户活动日志...');
  let activityCount = 0;

  for (const stu of createdStudents) {
    // Each student has 30-80 activity records over the semester
    const numActivities = randInt(30, 80);
    for (let ai = 0; ai < numActivities; ai++) {
      const action = pick(ACTIVITY_ACTIONS);
      const ts = randDate(SEMESTER_START, SEMESTER_END);

      let details: string | null = null;
      if (action === 'VIEW_CHAPTER') {
        details = JSON.stringify({ chapterId: pick(CHAPTER_SCHEDULE).chapterId });
      } else if (action === 'ASK_AI_ASSISTANT') {
        const questions = [
          '定时器T0的工作模式2怎么配置？',
          '中断优先级寄存器IP各位的含义是什么？',
          'MOV和MOVX指令有什么区别？',
          '怎么用C51实现LED流水灯？',
          '串口波特率怎么计算？',
          'P0口为什么需要外接上拉电阻？',
          'DPTR和PC的区别是什么？',
          '如何使用外部中断实现按键检测？',
          'DAC0832的工作模式有哪些？',
          '看门狗定时器的作用是什么？',
        ];
        details = JSON.stringify({ question: pick(questions) });
      } else if (action === 'SUBMIT_QUIZ') {
        details = JSON.stringify({ quizId: pick(QUIZ_IDS), score: randInt(50, 100) });
      }

      await prisma.userActivity.create({
        data: {
          userId: stu.id,
          action,
          details,
          ip: `10.${randInt(1, 254)}.${randInt(1, 254)}.${randInt(1, 254)}`,
          userAgent: pick([
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/119.0',
            'Mozilla/5.0 (Linux; Android 14) Chrome/120.0',
          ]),
          createdAt: ts,
        },
      });
      activityCount++;
    }
  }

  // Teacher activities
  for (let i = 0; i < 50; i++) {
    await prisma.userActivity.create({
      data: {
        userId: teacher.id,
        action: pick(['LOGIN', 'VIEW_DASHBOARD', 'EXPORT_GRADES', 'MANAGE_QUIZ', 'VIEW_ANALYTICS']),
        details: null,
        ip: '10.10.1.100',
        createdAt: randDate(SEMESTER_START, SEMESTER_END),
      },
    });
    activityCount++;
  }

  console.log(`  生成 ${activityCount} 条活动日志`);

  // ------------------------------------------------------------------
  // 8. Achievements
  // ------------------------------------------------------------------
  console.log('[8/9] 生成成就解锁数据...');
  let achievementCount = 0;

  for (const stu of createdStudents) {
    const ab = stu.def.ability;
    // Use a map keyed by achievementId so higher tiers overwrite lower tiers
    const achievementMap = new Map<string, typeof ACHIEVEMENT_DEFS[number]>();

    // Everyone who used the platform gets learning_time bronze
    achievementMap.set('learning_time', ACHIEVEMENT_DEFS[0]); // learning_time_bronze

    // Higher ability -> more achievements
    if (ab > 0.5) {
      achievementMap.set('learning_time', ACHIEVEMENT_DEFS[1]); // silver overwrites bronze
      achievementMap.set('modules_completed', ACHIEVEMENT_DEFS[2]); // bronze
      achievementMap.set('learning_streak', ACHIEVEMENT_DEFS[4]); // bronze
      achievementMap.set('quizzes_completed', ACHIEVEMENT_DEFS[6]); // bronze
      achievementMap.set('quiz_average', ACHIEVEMENT_DEFS[9]); // bronze
      achievementMap.set('experiments_completed', ACHIEVEMENT_DEFS[11]); // bronze
    }

    if (ab > 0.65) {
      achievementMap.set('modules_completed', ACHIEVEMENT_DEFS[3]); // silver overwrites bronze
      achievementMap.set('learning_streak', ACHIEVEMENT_DEFS[5]); // silver
      achievementMap.set('quizzes_completed', ACHIEVEMENT_DEFS[7]); // silver
      achievementMap.set('experiments_completed', ACHIEVEMENT_DEFS[12]); // silver
      achievementMap.set('total_points', ACHIEVEMENT_DEFS[13]); // bronze
    }

    if (ab > 0.8) {
      achievementMap.set('perfect_scores', ACHIEVEMENT_DEFS[8]); // bronze
      achievementMap.set('quiz_average', ACHIEVEMENT_DEFS[10]); // silver overwrites bronze
    }

    for (const ach of achievementMap.values()) {
      const unlockedAt = randDate(
        addDays(SEMESTER_START, 14),
        SEMESTER_END
      );

      await prisma.userAchievement.create({
        data: {
          userId: stu.id,
          achievementId: ach.achievementId,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
          category: ach.category,
          unlockedAt,
          progress: 100,
        },
      });
      achievementCount++;
    }
  }

  console.log(`  生成 ${achievementCount} 条成就记录`);

  // ------------------------------------------------------------------
  // 9. UserProgress, LearningPaths, Points, Certificates
  // ------------------------------------------------------------------
  console.log('[9/9] 生成综合进度与积分数据...');
  let pathCount = 0;
  let certCount = 0;

  for (const stu of createdStudents) {
    const ab = stu.def.ability;
    const chaptersReached = Math.min(9, Math.max(3, Math.round(5 + ab * 5)));
    const modulesCompleted = Math.max(0, chaptersReached - 2);
    const totalTime = randInt(18000, 72000); // 5-20 hours
    const avgScore = randNormal(55 + ab * 40, 6, 40, 100);
    const streakDays = ab > 0.6 ? randInt(3, 30) : randInt(0, 5);
    const totalPoints = Math.round(avgScore * 10 + modulesCompleted * 100 + streakDays * 10);

    // Update user totalPoints
    await prisma.user.update({
      where: { id: stu.id },
      data: { totalPoints },
    });

    // UserProgress
    await prisma.userProgress.create({
      data: {
        userId: stu.id,
        modulesCompleted,
        totalTimeSpent: totalTime,
        averageScore: Math.round(avgScore * 10) / 10,
        streakDays,
        lastActiveDate: randDate(new Date('2026-01-05'), SEMESTER_END),
        createdAt: SEMESTER_START,
        updatedAt: SEMESTER_END,
      },
    });

    // Points transactions
    const txTypes = [
      { type: 'QUIZ_COMPLETE', desc: '完成章节测验', pts: randInt(30, 80) },
      { type: 'CHAPTER_COMPLETE', desc: '完成章节学习', pts: randInt(50, 100) },
      { type: 'EXPERIMENT_COMPLETE', desc: '完成实验项目', pts: randInt(40, 90) },
      { type: 'DAILY_LOGIN', desc: '每日登录', pts: 10 },
      { type: 'STREAK_BONUS', desc: '连续学习奖励', pts: randInt(20, 50) },
      { type: 'AI_INTERACTION', desc: '使用AI助手', pts: 5 },
    ];

    const numTx = randInt(8, 25);
    for (let t = 0; t < numTx; t++) {
      const tx = pick(txTypes);
      await prisma.userPointsTransaction.create({
        data: {
          userId: stu.id,
          points: tx.pts,
          type: tx.type,
          description: tx.desc,
          createdAt: randDate(SEMESTER_START, SEMESTER_END),
        },
      });
    }

    // Learning paths (some students have personalized paths)
    if (ab > 0.55 || rng() > 0.5) {
      const pathModules = CHAPTER_SCHEDULE.slice(0, chaptersReached).map(ch => ({
        moduleId: ch.moduleId,
        chapterId: ch.chapterId,
        name: ch.name,
      }));

      await prisma.learningPath.create({
        data: {
          userId: stu.id,
          name: ab > 0.7 ? '进阶学习路径' : '基础强化路径',
          description: ab > 0.7
            ? '面向能力较强的学生，侧重综合应用与项目实践'
            : '面向基础薄弱的学生，强化核心概念理解与基础实验',
          modules: JSON.stringify(pathModules),
          currentModule: Math.min(chaptersReached - 1, pathModules.length - 1),
          totalModules: pathModules.length,
          status: chaptersReached >= 8 ? 'COMPLETED' : 'ACTIVE',
          startedAt: SEMESTER_START,
          completedAt: chaptersReached >= 8 ? addDays(SEMESTER_END, -randInt(1, 20)) : null,
          createdAt: SEMESTER_START,
          updatedAt: SEMESTER_END,
        },
      });
      pathCount++;
    }

    // Certificates for top performers
    if (ab > 0.75 && chaptersReached >= 8) {
      const certNo = `EDUCOG-MCU-2025-${stu.def.studentId}`;
      await prisma.certificate.create({
        data: {
          userId: stu.id,
          type: 'COURSE_COMPLETION',
          name: '微控制器应用技术课程结业证书',
          description: '完成《微控制器应用技术》全部课程学习与考核',
          courseScore: Math.round(avgScore * 10) / 10,
          examScore: randNormal(55 + ab * 40, 6, 50, 100),
          totalScore: Math.round(avgScore * 10) / 10,
          certificateNo: certNo,
          issuedAt: addDays(SEMESTER_END, -randInt(1, 10)),
        },
      });
      certCount++;
    }
  }

  console.log(`  生成 ${pathCount} 条学习路径`);
  console.log(`  生成 ${certCount} 张结业证书`);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });
  const totalQuizzes = await prisma.quizAttempt.count();
  const totalActivities = await prisma.userActivity.count();
  const totalAchievements = await prisma.userAchievement.count();

  console.log('\n========================================');
  console.log('数据初始化完成！统计:');
  console.log(`  学生: ${totalStudents}`);
  console.log(`  测验记录: ${totalQuizzes}`);
  console.log(`  活动日志: ${totalActivities}`);
  console.log(`  成就解锁: ${totalAchievements}`);
  console.log('========================================');
  console.log('\n默认账号:');
  console.log('  教师 - 用户名: sunyancai, 密码: edu123456');
  console.log('  管理员 - 用户名: admin, 密码: edu123456');
  console.log('  学生 - 用户名: 学号(如 202401001), 密码: stu123456');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('初始化失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
