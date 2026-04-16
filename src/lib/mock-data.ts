// --- Student Profile ---
const profile = {
  name: '孙延才',
  email: 'yancai.sun@example.com',
  avatarUrl: 'https://placehold.co/100x100.png',
  initial: '孙',
};

// --- Student's Learning Progress (Simulated Backend Data) ---
const learningProgress = {
  chaptersRead: [1, 2, 3, 5, 6], // Array of chapter numbers
  totalHours: 126,
  aiAssistantQueries: 12,
  knowledgeGraphNodesExplored: 18,
  simulationsRun: {
    total: 25,
    withFaults: 5,
    over50Lines: true,
    producedWaveform: true,
    waveformFrequencyHz: 1200, // For the "Waveform Engineer" achievement
    usedSerial: true,
  },
  quizzesTaken: 4,
  quizCompletionTimeMinutes: 4.5, // For "Flash" achievement
  viewedAnalyticsDays: 3, // For "Data Analyst" achievement
  usedLearningPlan: true,
};

// --- Student's Quiz Scores for each Knowledge Atom (KA) ---
const quizScores = {
  ka_memory: { score: 95 },
  ka_io: { score: 80 },
  ka_timers: { score: 45 },
  ka_interrupts: { score: 70 },
  ka_uart: { score: 88 },
  ka_cpu: { score: 92 },
  ka_addressing: { score: 85 },
  ka_instruction_set: { score: 75 },
  ka_led_scan: { score: 98 },
  ka_adc: { score: 60 },
};

// --- Mapping for KA keys to human-readable labels and links ---
export const kaMapping = [
  { key: 'ka_memory', label: '存储器结构', chapter: 'ch2', rec_query: '存储器', node_id: 'memory' },
  { key: 'ka_io', label: 'I/O 端口', chapter: 'ch3', rec_query: 'IO端口', node_id: 'io' },
  { key: 'ka_timers', label: '定时器/计数器', chapter: 'ch5', rec_query: '定时器', node_id: 'timers' },
  { key: 'ka_interrupts', label: '中断系统', chapter: 'ch6', rec_query: '中断', node_id: 'interrupts' },
  { key: 'ka_uart', label: '串行通信', chapter: 'ch9', rec_query: '串行通信', node_id: 'uart' },
  { key: 'ka_cpu', label: 'CPU结构', chapter: 'ch1', rec_query: 'CPU', node_id: 'cpu' },
  { key: 'ka_addressing', label: '寻址方式', chapter: 'ch4', rec_query: '寻址方式', node_id: 'addressing_modes' },
  { key: 'ka_instruction_set', label: '指令系统', chapter: 'ch4', rec_query: '指令', node_id: 'assembly' },
  { key: 'ka_led_scan', label: 'LED动态扫描', chapter: 'ch7', rec_query: 'LED动态扫描', node_id: 'led_scan' },
  { key: 'ka_adc', label: 'ADC应用', chapter: 'ch8', rec_query: 'ADC', node_id: 'adc_app' },
];

// --- Student's Progress in Specific Activities (for Analytics page) ---
export const studentProgressData = [
  { activity: "阅读'第5章: 定时器/计数器'", status: '已完成', credits: 10, progress: 100, href: "/#item-5" },
  { activity: "通过'在线综合测试'", status: '已通过', credits: 50, progress: 85, href: "/quiz" },
  { activity: "完成'中断系统'相关提问", status: '已完成', credits: 5, progress: 100, href: "/ai-assistant" },
  { activity: "运行'方波生成'仿真", status: '已完成', credits: 15, progress: 100, href: "/simulation" },
  { activity: "探索'I/O端口'知识图谱", status: '进行中', credits: 2, progress: 50, href: "/knowledge-graph?node=io" },
  { activity: "阅读'第9章: 串行通信'", status: '未开始', credits: 10, progress: 0, href: "/#item-9" },
];

// --- Master List of All Achievements ---
type AchievementCheck = (progress: typeof learningProgress, scores: typeof quizScores) => boolean;
export type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  criteria: string;
  category: '学习' | '实践' | '探索' | '精通' | '综合';
  check: AchievementCheck;
  unlocked?: boolean;
};

const allAchievementsList: Achievement[] = [
    // 学习类
    {
      id: "learner_start", icon: "BookOpen", title: "启航者", description: "首次完成任何章节的阅读。",
      criteria: "完成一个章节内容的学习。", category: '学习', check: p => p.chaptersRead.length >= 1
    },
    {
      id: "learner_master", icon: "Award", title: "章节大师", description: "完成所有章节的阅读。",
      criteria: "将所有9个章节标记为已读。", category: '学习', check: p => p.chaptersRead.length >= 9
    },
    {
      id: "learner_code", icon: "FileCode", title: "代码考古家", description: "查看所有章节的代码示例。",
      criteria: "此项为模拟解锁。", category: '学习', check: () => false // Placeholder
    },
    {
      id: "learner_video", icon: "MonitorPlay", title: "视频学习者", description: "观看平台推荐的教学视频。",
      criteria: "在AI助教的推荐下，点击并观看一个视频。", category: '学习', check: () => false // Placeholder
    },
    {
      id: "learner_bookworm", icon: "BookHeart", title: "书虫", description: "累计学习时长超过1小时。",
      criteria: "在课程内容页面的累计停留时间超过1小时。", category: '学习', check: p => p.totalHours > 1
    },
    
    // 探索类
    {
      id: "explore_asker", icon: "MessagesSquare", title: "提问达人", description: "向AI助教累计提问超过10次。",
      criteria: "与AI助教进行10次或以上的有效对话。", category: '探索', check: p => p.aiAssistantQueries >= 10
    },
    {
      id: "explore_graph", icon: "BrainCircuit", title: "知识探险家", description: "探索了知识图谱中15个以上的节点。",
      criteria: "在知识图谱中点击并查看超过15个不同节点的详细信息。", category: '探索', check: p => p.knowledgeGraphNodesExplored >= 15
    },
    {
      id: "explore_search", icon: "Search", title: "好奇宝宝", description: "使用模糊搜索功能超过10次。",
      criteria: "在课程内容页面使用搜索框进行10次或以上的搜索。", category: '探索', check: () => false // Placeholder
    },
    {
      id: "explore_roamer", icon: "Share2", title: "图谱漫游者", description: "通过章节筛选功能查看了5个不同的知识图谱视图。",
      criteria: "在知识图谱页面使用章节筛选器切换5次或以上。", category: '探索', check: () => false // Placeholder
    },
    {
      id: "explore_thinker", icon: "MessageCircleQuestion", title: "深度思考者", description: "向AI助教询问了关于中断优先级的问题。",
      criteria: "向AI助教提问，问题中包含“中断”和“优先级”关键词。", category: '探索', check: () => true // Assume one of the 12 queries did this
    },
    {
      id: "explore_export", icon: "FileDown", title: "报告分享家", description: "成功导出学情分析报告。",
      criteria: "在学情分析页面点击“导出为PNG”按钮。", category: '探索', check: () => false // Placeholder
    },
    
    // 实践类
    {
      id: "practice_sim_first", icon: "Cpu", title: "仿真初体验", description: "成功运行1次代码仿真。",
      criteria: "在实验仿真页面成功运行一次代码。", category: '实践', check: p => p.simulationsRun.total >= 1
    },
    {
      id: "practice_debugger", icon: "Bug", title: "故障排除者", description: "使用故障注入功能进行了3次仿真。",
      criteria: "在实验仿真页面，选择非“无故障”选项并运行仿真3次。", category: '实践', check: p => p.simulationsRun.withFaults >= 3
    },
    {
      id: "practice_waveform", icon: "Clock4", title: "波形工程师", description: "生成一个频率大于1kHz的方波。",
      criteria: "通过仿真生成一个频率超过1000Hz的'waveform'类型输出。", category: '实践', check: p => p.simulationsRun.producedWaveform && p.simulationsRun.waveformFrequencyHz > 1000
    },
    {
      id: "practice_artisan", icon: "PenTool", title: "代码工匠", description: "编写并成功仿真超过50行汇编代码。",
      criteria: "在实验仿真页面，文本框中的代码行数超过50行并成功运行。", category: '实践', check: p => p.simulationsRun.over50Lines
    },
     {
      id: "practice_serial", icon: "PlugZap", title: "串口调试员", description: "成功仿真一次包含串行通信的代码。",
      criteria: "仿真包含`SBUF`, `SCON`等串口相关寄存器操作的代码。", category: '实践', check: p => p.simulationsRun.usedSerial
    },
    
    // 精通类
    {
      id: "mastery_quiz", icon: "Target", title: "测验高手", description: "在综合测试中获得90%以上的分数。",
      criteria: "在线测评最终得分高于或等于90%。", category: '精通', check: (_p, s) => Object.values(s).reduce((a, b) => a + b.score, 0) / Object.keys(s).length >= 90
    },
    {
      id: "mastery_perfect", icon: "GraduationCap", title: "学有所成", description: "在测验中获得100%的满分。",
      criteria: "在线测评最终得分达到100%。", category: '精通', check: (_p, s) => Object.values(s).reduce((a, b) => a + b.score, 0) / Object.keys(s).length === 100
    },
    {
      id: "mastery_repeat", icon: "RotateCcw", title: "温故知新", description: "重复参加在线测评超过3次。",
      criteria: "完成在线测评的次数超过3次。", category: '精通', check: p => p.quizzesTaken > 3
    },
     {
      id: "mastery_flash", icon: "Zap", title: "闪电快手", description: "在5分钟内完成在线测评。",
      criteria: "从开始到提交在线测评的时间在5分钟以内。", category: '精通', check: p => p.quizCompletionTimeMinutes < 5
    },
    {
      id: "mastery_trust", icon: "CheckCheck", title: "推荐信赖者", description: "完成一次AI生成的个性化学习计划。",
      criteria: "通过“获取个性化学习计划”功能生成报告并查看。", category: '精通', check: p => p.usedLearningPlan
    },
    {
      id: "mastery_analyst", icon: "BarChart4", title: "数据分析师", description: "连续3天访问学情分析页面。",
      criteria: "连续3天访问`/analytics`页面。", category: '精通', check: p => p.viewedAnalyticsDays >= 3
    },
     {
      id: "mastery_perfectionist", icon: "Gem", title: "完美主义者", description: "将所有知识原子的掌握度提升到90%以上。",
      criteria: "学情分析中所有知识原子的分数均不低于90。", category: '精通', check: (_p, s) => Object.values(s).every(item => item.score >= 90)
    },
    
    // 综合类
    {
      id: "general_model", icon: "CalendarDays", title: "学习标兵", description: "连续一周登录并完成学习活动。",
      criteria: "连续7天都有学习行为（如阅读、仿真、提问等）。", category: '综合', check: () => false // Placeholder
    },
    {
      id: "general_champion", icon: "Trophy", title: "全能冠军", description: "解锁所有其他成就！",
      criteria: "获得本列表下除此项外的所有其他成就。", category: '综合', check: () => false // Placeholder, requires special logic
    },
];

// ===================================
// 2. DERIVED DATA & EXPORT
// ===================================

function processStudentData() {
  // --- Achievements ---
  const processedAchievements = allAchievementsList.map(ach => ({
    ...ach,
    unlocked: ach.check(learningProgress, quizScores),
  }));
  const unlockedAchievements = processedAchievements.filter(ach => ach.unlocked);
  const totalAchievements = processedAchievements.length;
  // Special check for the "All-Rounder" champion achievement
  const championAchievement = processedAchievements.find(a => a.id === 'general_champion');
  if (championAchievement) {
    championAchievement.unlocked = (unlockedAchievements.length === totalAchievements - 1) && !unlockedAchievements.some(a => a.id === 'general_champion');
    if(championAchievement.unlocked) unlockedAchievements.push(championAchievement);
  }
  
  // --- Stats ---
  const totalCredits = studentProgressData.reduce((acc, item) => acc + (item.progress > 0 ? item.credits : 0), 0);
  const scoreValues = Object.values(quizScores).map(s => s.score);
  const averageMastery = scoreValues.reduce((acc, score) => acc + score, 0) / scoreValues.length;

  // --- Certificate Data ---
  const highestQuizScore = Math.max(...scoreValues);
  const masteredKaCount = scoreValues.filter(score => score >= 80).length;

  return {
    profile,
    learningProgress,
    quizScores,
    allAchievements: processedAchievements,
    unlockedAchievements,
    stats: {
      totalCredits,
      averageMastery,
      achievements: {
        unlockedCount: unlockedAchievements.length,
        totalCount: totalAchievements,
        progress: (unlockedAchievements.length / totalAchievements) * 100,
      },
      certificate: {
          quizScore: highestQuizScore,
          simulationsCompleted: learningProgress.simulationsRun.total,
          knowledgePointsMastered: masteredKaCount,
      }
    },
  };
}

export const studentData = processStudentData();