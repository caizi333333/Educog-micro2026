// ============================================================================
// 思政图谱 (Ideological/Political Education Graph)
// 微控制器应用技术课程 - 课程思政映射体系
// 基于申报书图6、图7及表1构建
// 6个一级思政主题 + 23个二级思政元素 + 17周教学映射
// ============================================================================

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export type IdeologicalCategory =
  | 'patriotism'
  | 'craftsmanship'
  | 'ethics'
  | 'innovation'
  | 'teamwork'
  | 'aerospace';

export interface IdeologicalNode {
  id: string;
  name: string;
  level: 1 | 2;
  parentId?: string;
  category: IdeologicalCategory;
  description: string;
  relatedKnowledgePoints: string[];
  relatedChapters: number[];
  teachingMethod: string;
  caseStudy?: string;
  expectedOutcome: string;
}

export interface KnowledgeSipMapping {
  knowledgePointId: string;
  knowledgePointName: string;
  chapter: number;
  weekRange: string;
  ideologicalTheme: string;
  ideologicalContent: string;
  teachingMethod: string;
  expectedOutcome: string;
}

// ---------------------------------------------------------------------------
// Category Metadata (for UI labels, colors, icons)
// ---------------------------------------------------------------------------

export const categoryMeta: Record<
  IdeologicalCategory,
  { label: string; color: string; icon: string }
> = {
  patriotism: { label: '爱国主义教育', color: '#e53935', icon: 'flag' },
  craftsmanship: { label: '工匠精神', color: '#fb8c00', icon: 'build' },
  ethics: { label: '职业道德', color: '#43a047', icon: 'gavel' },
  innovation: { label: '创新思维', color: '#1e88e5', icon: 'lightbulb' },
  teamwork: { label: '团队协作', color: '#8e24aa', icon: 'groups' },
  aerospace: { label: '航天品质', color: '#00897b', icon: 'rocket' },
};

// ---------------------------------------------------------------------------
// Ideological Nodes - Level 1 (6 categories) + Level 2 (23 elements)
// ---------------------------------------------------------------------------

export const ideologicalNodes: IdeologicalNode[] = [
  // ========================================================================
  // S1 - 爱国主义教育 (Patriotism)
  // ========================================================================
  {
    id: 'S1',
    name: '爱国主义教育',
    level: 1,
    category: 'patriotism',
    description: '培养学生家国情怀、民族自豪感,增强"四个自信",激发科技报国热情',
    relatedKnowledgePoints: ['1', '1.1', '1.1.3', '1.2', '9', '10'],
    relatedChapters: [1, 9, 10],
    teachingMethod: '案例教学、主题讨论、情境体验',
    expectedOutcome: '学生能够认识国产芯片发展成就,树立科技自立自强的信念',
  },
  {
    id: 'S1.1',
    name: '国产芯片自主可控',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '通过国产STC单片机的技术优势讲解,培养学生对国产芯片的认同感和自豪感',
    relatedKnowledgePoints: ['1.1.3', '1.2.2'],
    relatedChapters: [1],
    teachingMethod: '案例分析：对比国产STC与进口AT89C51,展示国产芯片性能优势',
    caseStudy: 'STC单片机从仿制到超越的发展历程,ISP在线编程技术创新',
    expectedOutcome: '学生了解国产单片机的技术优势,增强民族自信心',
  },
  {
    id: 'S1.2',
    name: '半导体行业自立自强',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '通过中兴、华为事件分析,认识半导体行业自主可控的战略意义',
    relatedKnowledgePoints: ['10', '10.1', '10.2'],
    relatedChapters: [10],
    teachingMethod: '专题研讨：中兴事件与华为事件的启示',
    caseStudy: '2018年中兴被制裁事件、华为海思"备胎"芯片转正事件',
    expectedOutcome: '学生认识"卡脖子"问题的严峻性,激发科技报国的使命感',
  },
  {
    id: 'S1.3',
    name: '家国情怀与创意表达',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '通过创意彩灯设计"我为祖国庆生日",将爱国情怀融入工程实践',
    relatedKnowledgePoints: ['9', '9.1', '9.2', '9.3'],
    relatedChapters: [9],
    teachingMethod: '项目驱动：设计"我为祖国庆生日"创意彩灯作品',
    caseStudy: '学生设计国旗色彩灯、国庆主题LED显示等创意作品',
    expectedOutcome: '学生将技术能力与爱国情怀有机结合,实现知识与价值的统一',
  },
  {
    id: 'S1.4',
    name: '科技强国与使命担当',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '认识我国在芯片领域面临的挑战,树立投身科技事业的远大理想',
    relatedKnowledgePoints: ['1', '10'],
    relatedChapters: [1, 10],
    teachingMethod: '主题讨论：新时代大学生的科技使命',
    caseStudy: '中国芯片产业"十四五"规划与人才需求分析',
    expectedOutcome: '学生理解个人成长与国家发展的关系,增强责任感与使命感',
  },

  // ========================================================================
  // S2 - 工匠精神 (Craftsmanship)
  // ========================================================================
  {
    id: 'S2',
    name: '工匠精神',
    level: 1,
    category: 'craftsmanship',
    description: '培养学生精益求精、一丝不苟的工作态度,追求卓越的职业品质',
    relatedKnowledgePoints: ['3', '4', '5', '6'],
    relatedChapters: [3, 4, 5, 6],
    teachingMethod: '过程训练、案例警示、实践强化',
    expectedOutcome: '学生养成严谨细致的编程习惯,注重代码质量与可靠性',
  },
  {
    id: 'S2.1',
    name: '精益求精的编程态度',
    level: 2,
    parentId: 'S2',
    category: 'craftsmanship',
    description: '通过汇编语言编程训练,培养学生精确到每一条指令的严谨态度',
    relatedKnowledgePoints: ['5', '5.1', '5.2', '5.3', '5.4'],
    relatedChapters: [5],
    teachingMethod: '编程实训：强调每条指令的功能验证与边界测试',
    caseStudy: '软件Bug导致的重大事故：Ariane 5火箭因整数溢出爆炸',
    expectedOutcome: '学生建立"每一行代码都可能影响全局"的质量意识',
  },
  {
    id: 'S2.2',
    name: '一丝不苟的调试作风',
    level: 2,
    parentId: 'S2',
    category: 'craftsmanship',
    description: '通过程序调试过程中对细节的关注,培养一丝不苟的工作作风',
    relatedKnowledgePoints: ['5.3', '5.4', '6'],
    relatedChapters: [5, 6],
    teachingMethod: '调试训练：系统化排错方法、断点调试与单步跟踪',
    expectedOutcome: '学生掌握系统化调试方法,养成认真仔细的排错习惯',
  },
  {
    id: 'S2.3',
    name: '追求卓越的质量意识',
    level: 2,
    parentId: 'S2',
    category: 'craftsmanship',
    description: '不满足于"能用就行",追求代码的高效性、可读性和可维护性',
    relatedKnowledgePoints: ['4', '4.1', '4.2', '4.3', '4.4', '4.5'],
    relatedChapters: [4],
    teachingMethod: '代码评审：对比不同寻址方式实现的效率差异',
    expectedOutcome: '学生能够选择最优指令和寻址方式,追求程序的精炼与高效',
  },

  // ========================================================================
  // S3 - 职业道德 (Professional Ethics)
  // ========================================================================
  {
    id: 'S3',
    name: '职业道德',
    level: 1,
    category: 'ethics',
    description: '培养学生规范意识、法律约束意识,树立良好的职业道德操守',
    relatedKnowledgePoints: ['3', '4', '5'],
    relatedChapters: [3, 4, 5],
    teachingMethod: '规范训练、案例讨论、对比分析',
    expectedOutcome: '学生养成遵守规范、敬畏规则的职业习惯',
  },
  {
    id: 'S3.1',
    name: '语法规范与职业规范',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '从指令系统的语法规范引申到职业规范意识,将技术规则上升到职业准则',
    relatedKnowledgePoints: ['3', '3.1', '3.2', '3.3', '3.4'],
    relatedChapters: [3],
    teachingMethod: '类比教学：指令格式规范 → 行业标准规范 → 职业行为规范',
    caseStudy: '编程规范违反导致的软件质量事故案例分析',
    expectedOutcome: '学生理解规范的重要性,自觉遵守编程规范和职业准则',
  },
  {
    id: 'S3.2',
    name: '法律约束与知识产权',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '通过软件版权和芯片IP保护讨论,培养法律意识和知识产权保护意识',
    relatedKnowledgePoints: ['3', '5'],
    relatedChapters: [3, 5],
    teachingMethod: '案例讨论：开源协议、芯片IP授权、代码版权保护',
    caseStudy: 'ARM指令集授权模式与国产指令集RISC-V的开源策略',
    expectedOutcome: '学生具备知识产权保护意识,理解法律对技术行业的约束',
  },
  {
    id: 'S3.3',
    name: '诚实守信与学术诚信',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '在实验报告和编程作业中强调独立完成、如实记录,培养学术诚信',
    relatedKnowledgePoints: ['5', '6'],
    relatedChapters: [5, 6],
    teachingMethod: '过程管理：实验数据如实记录,代码独立完成并标注引用',
    expectedOutcome: '学生养成诚实守信的学术品格和职业操守',
  },
  {
    id: 'S3.4',
    name: '安全生产与责任意识',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '通过嵌入式系统安全性讨论,培养对产品安全性负责的责任意识',
    relatedKnowledgePoints: ['4', '5'],
    relatedChapters: [4, 5],
    teachingMethod: '案例分析：嵌入式系统安全漏洞与产品安全事故',
    caseStudy: '汽车ECU软件缺陷导致的安全召回事件',
    expectedOutcome: '学生认识到工程师对产品安全的重大责任',
  },

  // ========================================================================
  // S4 - 创新思维 (Innovation)
  // ========================================================================
  {
    id: 'S4',
    name: '创新思维',
    level: 1,
    category: 'innovation',
    description: '培养学生创新实践能力和工程素质,鼓励探索新方法、新应用',
    relatedKnowledgePoints: ['7', '8', '9', '10'],
    relatedChapters: [7, 8, 9, 10],
    teachingMethod: '项目驱动、专题研讨、自主探究',
    expectedOutcome: '学生具备创新意识和工程实践能力,能够提出创新性解决方案',
  },
  {
    id: 'S4.1',
    name: '工程创新实践',
    level: 2,
    parentId: 'S4',
    category: 'innovation',
    description: '通过综合应用项目设计,培养学生将理论知识转化为工程创新的能力',
    relatedKnowledgePoints: ['10', '10.1', '10.2', '10.3'],
    relatedChapters: [10],
    teachingMethod: '项目实践：自主选题、方案设计、原型实现、成果展示',
    caseStudy: '学生创新项目：智能温控系统、自动浇灌装置等',
    expectedOutcome: '学生能够独立完成从需求分析到系统实现的完整工程过程',
  },
  {
    id: 'S4.2',
    name: '跨学科融合思维',
    level: 2,
    parentId: 'S4',
    category: 'innovation',
    description: '引导学生将单片机技术与其他学科知识融合,拓展应用视野',
    relatedKnowledgePoints: ['8', '9', '10'],
    relatedChapters: [8, 9, 10],
    teachingMethod: '跨学科案例：单片机在医疗、农业、环保等领域的创新应用',
    expectedOutcome: '学生具备跨学科思维,能够发现交叉领域的创新点',
  },
  {
    id: 'S4.3',
    name: '批判性思维与问题解决',
    level: 2,
    parentId: 'S4',
    category: 'innovation',
    description: '通过对比分析不同技术方案,培养批判性思维和最优方案选择能力',
    relatedKnowledgePoints: ['7', '7.1', '7.2', '8'],
    relatedChapters: [7, 8],
    teachingMethod: '方案对比：不同通信协议和接口方案的优劣分析',
    expectedOutcome: '学生能够多角度分析问题,选择最优技术方案',
  },

  // ========================================================================
  // S5 - 团队协作 (Teamwork)
  // ========================================================================
  {
    id: 'S5',
    name: '团队协作',
    level: 1,
    category: 'teamwork',
    description: '培养学生协调配合、大局意识,具备良好的团队合作精神',
    relatedKnowledgePoints: ['2', '7', '8', '10'],
    relatedChapters: [2, 7, 8, 10],
    teachingMethod: '团队项目、角色分工、互评互助',
    expectedOutcome: '学生具备团队合作能力,能够在团队中发挥积极作用',
  },
  {
    id: 'S5.1',
    name: '系统协调与大局意识',
    level: 2,
    parentId: 'S5',
    category: 'teamwork',
    description: '从单片机各部件的协调统一工作,引申到团队成员间的协调配合',
    relatedKnowledgePoints: ['2', '2.1', '2.4'],
    relatedChapters: [2],
    teachingMethod: '类比教学：CPU与外设的协调 → 团队成员的协作分工',
    caseStudy: '时钟信号统一各部件工作节拍 → 团队统一目标与步调',
    expectedOutcome: '学生理解系统思维和大局意识的重要性',
  },
  {
    id: 'S5.2',
    name: '分工合作与责任担当',
    level: 2,
    parentId: 'S5',
    category: 'teamwork',
    description: '通过团队项目的角色分工,培养明确责任、互相支持的合作精神',
    relatedKnowledgePoints: ['10', '10.1', '10.2', '10.3'],
    relatedChapters: [10],
    teachingMethod: '团队项目：明确分工（硬件设计、软件开发、测试验证）',
    expectedOutcome: '学生能够在团队中承担责任,完成分工任务并互相协作',
  },
  {
    id: 'S5.3',
    name: '沟通表达与技术交流',
    level: 2,
    parentId: 'S5',
    category: 'teamwork',
    description: '通过专题研讨和成果汇报,提升技术交流与表达能力',
    relatedKnowledgePoints: ['7', '8', '10'],
    relatedChapters: [7, 8, 10],
    teachingMethod: '专题研讨：小组汇报、技术答辩、同行互评',
    expectedOutcome: '学生具备良好的技术表达和沟通协调能力',
  },

  // ========================================================================
  // S6 - 航天品质 (Aerospace Quality)
  // ========================================================================
  {
    id: 'S6',
    name: '航天品质',
    level: 1,
    category: 'aerospace',
    description: '以航天工程案例为载体,培养学生求真务实、攻坚克难的科学精神',
    relatedKnowledgePoints: ['3', '4', '5', '6'],
    relatedChapters: [3, 4, 5, 6],
    teachingMethod: '案例教学、警示教育、精神感召',
    expectedOutcome: '学生理解航天品质的内涵,树立严谨务实的科学态度',
  },
  {
    id: 'S6.1',
    name: '求真务实的科学态度',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '通过航天工程中因细微疏忽导致失败的案例,强化求真务实的态度',
    relatedKnowledgePoints: ['3', '3.1', '4', '4.1'],
    relatedChapters: [3, 4],
    teachingMethod: '案例警示：航天工程失败案例中的软件与指令错误',
    caseStudy: '猎鹰HTV-2高超音速飞行器因程序错误导致飞行失败',
    expectedOutcome: '学生认识到技术工作中"差之毫厘,谬以千里"的道理',
  },
  {
    id: 'S6.2',
    name: '攻坚克难的拼搏精神',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '以中国航天人攻克技术难关的故事为激励,培养迎难而上的精神',
    relatedKnowledgePoints: ['5', '6'],
    relatedChapters: [5, 6],
    teachingMethod: '精神感召：中国航天精神、两弹一星精神的传承',
    caseStudy: '嫦娥五号采样返回任务中的自主控制技术攻关',
    expectedOutcome: '学生具备面对困难不退缩、迎难而上的拼搏精神',
  },
  {
    id: 'S6.3',
    name: '严慎细实的工作作风',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '将航天工程"严慎细实"的工作作风融入编程和实验过程',
    relatedKnowledgePoints: ['5', '5.1', '5.2', '5.3', '5.4', '6'],
    relatedChapters: [5, 6],
    teachingMethod: '过程管理：建立代码检查单、测试流程规范',
    caseStudy: 'Ariane 5火箭因64位转16位整数溢出导致爆炸,损失3.7亿美元',
    expectedOutcome: '学生在编程实践中自觉落实严谨规范的工作流程',
  },
  {
    id: 'S6.4',
    name: '质量第一的价值取向',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '树立质量优先于进度的工程理念,宁可慢一点也要保证质量',
    relatedKnowledgePoints: ['4', '5', '6'],
    relatedChapters: [4, 5, 6],
    teachingMethod: '价值引导：航天工程质量管理体系与零缺陷理念',
    expectedOutcome: '学生建立质量第一的工程价值观,不为赶进度而忽视质量',
  },
];

// ---------------------------------------------------------------------------
// Week-by-Week SIP (思政) Mapping - 17 Weeks
// Based on申报书 Table 1 (pages 12-13)
// ---------------------------------------------------------------------------

export const sipMappings: KnowledgeSipMapping[] = [
  // Week 1: 单片机概述
  {
    knowledgePointId: '1',
    knowledgePointName: '单片机概述',
    chapter: 1,
    weekRange: '第1周',
    ideologicalTheme: '爱国主义教育',
    ideologicalContent:
      '介绍国产STC单片机的技术优势和市场份额,对比进口AT89C51,展示国产芯片从跟跑到并跑甚至领跑的发展历程,激发学生民族自豪感和科技报国热情',
    teachingMethod: '案例教学：STC单片机的ISP在线编程技术创新,国产芯片性能对比分析',
    expectedOutcome: '学生了解国产芯片发展成就,树立民族自信心,增强科技报国意识',
  },

  // Week 2: 时钟电路/CPU时序
  {
    knowledgePointId: '2',
    knowledgePointName: '硬件结构（时钟电路与CPU时序）',
    chapter: 2,
    weekRange: '第2周',
    ideologicalTheme: '大局意识与看齐意识',
    ideologicalContent:
      '以时钟信号统一各部件工作节拍为切入点,阐述"看齐意识"的重要性——如同CPU各部件必须在统一时钟驱动下协调工作,团队和组织也需要统一步调、协调一致',
    teachingMethod: '类比教学：时钟信号→统一步调,CPU协调→团队协作,总线仲裁→大局为重',
    expectedOutcome: '学生理解系统协调的重要性,树立大局意识和团队协作精神',
  },

  // Week 3: 指令系统(1) - 数据传送指令
  {
    knowledgePointId: '3',
    knowledgePointName: '指令系统 - 指令格式与数据传送指令',
    chapter: 3,
    weekRange: '第3周',
    ideologicalTheme: '规范意识',
    ideologicalContent:
      '从指令格式的严格语法规范出发,引导学生认识到:技术规范是保障系统可靠运行的基石,正如社会规范是维护社会秩序的保障,培养遵规守纪的行为自觉',
    teachingMethod: '类比教学：指令语法规范→编程规范→行业标准→法律法规的层层递进',
    expectedOutcome: '学生养成遵守技术规范的习惯,将规范意识内化为行为准则',
  },

  // Week 4: 指令系统(2) - 算术运算指令
  {
    knowledgePointId: '4',
    knowledgePointName: '指令系统 - 算术运算与逻辑运算指令',
    chapter: 4,
    weekRange: '第4周',
    ideologicalTheme: '工匠精神',
    ideologicalContent:
      '通过算术运算指令中进位、溢出等细节处理,强调"细节决定成败"的工匠精神,每一个标志位都可能影响程序的正确性',
    teachingMethod: '精细训练：溢出检测、进位处理的严格验证,强调"零容忍"的质量标准',
    expectedOutcome: '学生在编程中养成关注细节、追求精确的工匠品质',
  },

  // Week 5: 指令系统(3) - 控制转移指令
  {
    knowledgePointId: '4',
    knowledgePointName: '指令系统 - 控制转移与位操作指令',
    chapter: 4,
    weekRange: '第5周',
    ideologicalTheme: '航天品质',
    ideologicalContent:
      '引入猎鹰HTV-2高超音速飞行器案例：因控制程序中的指令错误导致飞行失败,阐述在关键控制系统中每条指令的准确性关乎生命安全和巨额投入',
    teachingMethod: '案例警示：猎鹰HTV-2飞行失败案例分析,对照控制转移指令的正确使用',
    expectedOutcome: '学生深刻认识指令准确性的极端重要性,树立求真务实的科学态度',
  },

  // Week 6: 指令系统(4) - 寻址方式综合
  {
    knowledgePointId: '4',
    knowledgePointName: '指令系统 - 寻址方式综合应用',
    chapter: 4,
    weekRange: '第6周',
    ideologicalTheme: '规范意识与法律约束',
    ideologicalContent:
      '以不同寻址方式的适用范围和使用限制为切入点,引导学生理解:正如寻址方式有其规则与边界,工程实践和社会行为也有法律和道德的约束',
    teachingMethod: '对比分析：寻址方式的规则约束→工程标准约束→法律道德约束的三层映射',
    expectedOutcome: '学生建立规则意识和法律意识,理解约束与自由的辩证关系',
  },

  // Week 7: 指令系统(5) - 指令系统总结
  {
    knowledgePointId: '4',
    knowledgePointName: '指令系统 - 系统总结与综合应用',
    chapter: 4,
    weekRange: '第7周',
    ideologicalTheme: '工匠精神与航天品质',
    ideologicalContent:
      '总结指令系统全貌,强调111条指令的精确掌握体现工匠精神,以航天嵌入式系统对指令级可靠性的极致要求为标杆',
    teachingMethod: '综合训练：指令系统知识竞赛,航天级代码质量标准讨论',
    expectedOutcome: '学生建立完整的指令体系认知,形成精益求精的专业追求',
  },

  // Week 8: 汇编程序设计(1)
  {
    knowledgePointId: '5',
    knowledgePointName: '汇编语言程序设计 - 基本结构与顺序程序',
    chapter: 5,
    weekRange: '第8周',
    ideologicalTheme: '工匠精神',
    ideologicalContent:
      '汇编语言编程要求精确到每一条指令、每一个地址,体现了工匠精神中"精益求精"的核心要义,引入Ariane 5火箭爆炸案例:因整数溢出Bug导致3.7亿美元损失',
    teachingMethod: '案例教学+实训：Ariane 5事故分析→汇编程序的严格验证流程',
    expectedOutcome: '学生认识到编程精确性的极端重要性,养成一丝不苟的编程习惯',
  },

  // Week 9: 汇编程序设计(2)
  {
    knowledgePointId: '5',
    knowledgePointName: '汇编语言程序设计 - 分支、循环与子程序',
    chapter: 5,
    weekRange: '第9周',
    ideologicalTheme: '航天品质与严慎细实',
    ideologicalContent:
      '复杂程序结构（分支、循环、嵌套）的正确性验证更加困难,引入航天工程"严慎细实"的工作作风:严格的代码审查、慎重的逻辑验证、细致的边界测试、实事求是的问题报告',
    teachingMethod: '过程训练：建立代码检查清单,实施同伴代码审查,严格的测试验证流程',
    expectedOutcome: '学生掌握系统化的程序验证方法,内化严慎细实的工作作风',
  },

  // Week 10: 中断系统(1)
  {
    knowledgePointId: '6',
    knowledgePointName: '中断系统 - 中断原理与中断响应',
    chapter: 6,
    weekRange: '第10周',
    ideologicalTheme: '工程理念与责任意识',
    ideologicalContent:
      '中断系统体现了实时响应的工程理念——当紧急事件发生时必须及时处理,引申到工程师面对突发问题时的快速响应和责任担当',
    teachingMethod: '情境教学：模拟工程现场的紧急中断处理场景,讨论工程师的责任边界',
    expectedOutcome: '学生理解实时系统的责任要求,建立工程师的责任意识',
  },

  // Week 11: 中断系统(2) + 定时器(1)
  {
    knowledgePointId: '6',
    knowledgePointName: '中断系统应用与定时/计数器原理',
    chapter: 6,
    weekRange: '第11周',
    ideologicalTheme: '创新实践',
    ideologicalContent:
      '中断与定时器的组合应用展现了系统级创新:通过合理的中断优先级设计和定时器配置,实现复杂的实时控制功能,体现创新来源于对基础知识的深度融合',
    teachingMethod: '项目驱动：设计基于中断和定时器的创新应用方案',
    expectedOutcome: '学生能够综合运用中断和定时器实现创新性功能设计',
  },

  // Week 12: 定时器(2)
  {
    knowledgePointId: '7',
    knowledgePointName: '定时/计数器 - 工作模式与应用',
    chapter: 7,
    weekRange: '第12周',
    ideologicalTheme: '团队合作与专题研讨',
    ideologicalContent:
      '通过定时器多种工作模式的对比分析,开展小组专题研讨,在团队讨论中培养合作精神和批判性思维',
    teachingMethod: '专题研讨：分组讨论定时器各模式的适用场景,小组汇报与互评',
    expectedOutcome: '学生在团队研讨中提升合作能力和技术表达能力',
  },

  // Week 13: 串行通信(1)
  {
    knowledgePointId: '7',
    knowledgePointName: '串行通信 - 通信原理与UART',
    chapter: 7,
    weekRange: '第13周',
    ideologicalTheme: '工程理念与协议精神',
    ideologicalContent:
      '串行通信协议体现了"契约精神":通信双方必须严格遵守协议约定（波特率、数据位、校验位）才能正确通信,引申到工程合作中的契约精神和诚信意识',
    teachingMethod: '类比教学：通信协议→工程合同→社会契约,强调规则遵守的重要性',
    expectedOutcome: '学生理解协议和契约精神,培养诚信合作的职业素养',
  },

  // Week 14: 串行通信(2) + 系统扩展(1)
  {
    knowledgePointId: '8',
    knowledgePointName: '串行通信应用与系统扩展技术',
    chapter: 8,
    weekRange: '第14周',
    ideologicalTheme: '创新实践与开放思维',
    ideologicalContent:
      '系统扩展体现了开放性思维:单片机通过扩展接口连接更多外设,实现功能拓展,正如个人通过开放学习、跨界合作实现能力提升',
    teachingMethod: '项目实践：设计一个需要多种扩展接口的综合系统方案',
    expectedOutcome: '学生具备系统扩展的设计能力,建立开放合作的工程思维',
  },

  // Week 15: 系统扩展(2)
  {
    knowledgePointId: '8',
    knowledgePointName: '系统扩展 - A/D、D/A与存储器扩展',
    chapter: 8,
    weekRange: '第15周',
    ideologicalTheme: '创新实践与团队合作',
    ideologicalContent:
      '复杂系统扩展需要团队分工协作完成,通过A/D采集、数据处理、D/A输出的完整链路设计,培养系统化思维和团队协作能力',
    teachingMethod: '团队项目：分组设计数据采集与控制系统,角色分工、协作完成',
    expectedOutcome: '学生在团队项目中提升系统设计能力和协作能力',
  },

  // Week 16: 人机接口/LED
  {
    knowledgePointId: '9',
    knowledgePointName: '人机接口 - 键盘、LED与LCD显示',
    chapter: 9,
    weekRange: '第16周',
    ideologicalTheme: '家国情怀',
    ideologicalContent:
      '设计"我为祖国庆生日"创意彩灯项目:利用LED控制技术设计国旗色彩变换、"70""中国"字样滚动显示等创意作品,将技术能力与爱国情怀有机融合',
    teachingMethod: '项目驱动：设计制作爱国主题LED创意作品,作品展示与评比',
    expectedOutcome: '学生将技术能力与爱国情感相结合,在创作中升华家国情怀',
  },

  // Week 17: 综合应用
  {
    knowledgePointId: '10',
    knowledgePointName: '综合应用设计',
    chapter: 10,
    weekRange: '第17周',
    ideologicalTheme: '爱国热情与为国担当',
    ideologicalContent:
      '回顾中兴被制裁事件（2018年因核心芯片依赖进口被美国"一剑封喉"）和华为事件（海思芯片"备胎"转正）,分析我国半导体行业现状与挑战,激发学生投身芯片事业、为国担当的决心',
    teachingMethod: '专题研讨：中兴华为事件→半导体行业现状→个人使命,主题演讲与讨论',
    expectedOutcome: '学生深刻理解"科技自立自强"的战略意义,立志投身芯片与嵌入式领域为国效力',
  },
];

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

/**
 * Get all ideological nodes belonging to a specific category.
 */
export function getIdeologicalByCategory(
  category: IdeologicalCategory,
): IdeologicalNode[] {
  return ideologicalNodes.filter((node) => node.category === category);
}

/**
 * Get all ideological nodes related to a specific chapter.
 */
export function getIdeologicalByChapter(chapter: number): IdeologicalNode[] {
  return ideologicalNodes.filter((node) =>
    node.relatedChapters.includes(chapter),
  );
}

/**
 * Get the SIP mapping for a specific week.
 */
export function getSipMappingByWeek(week: number): KnowledgeSipMapping | undefined {
  const weekStr = `第${week}周`;
  return sipMappings.find((m) => m.weekRange === weekStr);
}

/**
 * Get all SIP mappings related to a specific chapter.
 */
export function getSipMappingsByChapter(chapter: number): KnowledgeSipMapping[] {
  return sipMappings.filter((m) => m.chapter === chapter);
}

/**
 * Get SIP mappings by ideological theme keyword.
 */
export function getSipMappingsByTheme(themeKeyword: string): KnowledgeSipMapping[] {
  return sipMappings.filter((m) => m.ideologicalTheme.includes(themeKeyword));
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export const ideologicalGraphStats = {
  /** Total number of Level 1 categories */
  totalCategories: 6,

  /** Total number of Level 2 elements */
  totalElements: ideologicalNodes.filter((n) => n.level === 2).length,

  /** Total number of weekly SIP mappings */
  totalWeeklyMappings: sipMappings.length,

  /** Breakdown by category */
  categoryBreakdown: {
    patriotism: ideologicalNodes.filter((n) => n.category === 'patriotism').length,
    craftsmanship: ideologicalNodes.filter((n) => n.category === 'craftsmanship').length,
    ethics: ideologicalNodes.filter((n) => n.category === 'ethics').length,
    innovation: ideologicalNodes.filter((n) => n.category === 'innovation').length,
    teamwork: ideologicalNodes.filter((n) => n.category === 'teamwork').length,
    aerospace: ideologicalNodes.filter((n) => n.category === 'aerospace').length,
  },

  /** Chapters covered */
  chaptersWithSip: [...new Set(sipMappings.map((m) => m.chapter))].sort(
    (a, b) => a - b,
  ),

  /** Coverage summary */
  summary:
    '覆盖全部10章、17周教学内容,实现课程思政100%融入率。' +
    '6大思政主题、23个思政元素与270个专业知识点有机融合,形成"知识传授-能力培养-价值塑造"三位一体育人格局。',
} as const;
