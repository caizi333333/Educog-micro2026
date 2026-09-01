// ============================================================================
// 思政图谱 (Ideological/Political Education Graph)
// 微控制器应用技术课程 - 课程思政映射体系
// 基于申报书图6、图7及表1构建
// 6个一级思政主题 + 21个二级思政元素 + 17周教学映射
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
  /** Explicit targets in ideologicalNodes. Never infer a theme from a shared KP. */
  ideologicalNodeIds: string[];
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
// Ideological Nodes - Level 1 (6 categories) + Level 2 (21 elements)
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
    description: '培养学生家国情怀、民族自豪感，增强"四个自信"，激发科技报国热情',
    relatedKnowledgePoints: ['1', '1.1', '1.1.3', '1.2', '9', '10'],
    relatedChapters: [1, 8, 9, 10],
    teachingMethod: '案例教学、主题讨论、情境体验',
    expectedOutcome: '学生能够认识国产芯片发展成就，树立科技自立自强的信念',
  },
  {
    id: 'S1.1',
    name: '国产芯片自主可控',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '通过国产STC单片机的技术优势讲解，培养学生对国产芯片的认同感和自豪感',
    relatedKnowledgePoints: ['1.1.3', '1.2.2'],
    relatedChapters: [1],
    teachingMethod: '案例分析：对比国产STC与进口AT89C51,展示国产芯片性能优势',
    caseStudy: 'STC单片机从仿制到超越的发展历程,ISP在线编程技术创新',
    expectedOutcome: '学生了解国产单片机的技术优势，增强民族自信心',
  },
  {
    id: 'S1.2',
    name: '半导体行业自立自强',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '通过中兴、华为事件分析，认识半导体行业自主可控的战略意义',
    relatedKnowledgePoints: ['10', '10.1', '10.2'],
    relatedChapters: [10],
    teachingMethod: '专题研讨：中兴事件与华为事件的启示',
    caseStudy: '2018年中兴被制裁事件、华为海思"备胎"芯片转正事件',
    expectedOutcome: '学生认识"卡脖子"问题的严峻性，激发科技报国的使命感',
  },
  {
    id: 'S1.3',
    name: '家国情怀与创意表达',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '通过爱国主题显示任务与系统设计任务，将价值表达落实为可验证的工程作品要求',
    relatedKnowledgePoints: ['8.1', '8.1.2', '9.1'],
    relatedChapters: [8, 9],
    teachingMethod: '项目驱动：完成主题显示、接口说明、测试记录和设计反思',
    caseStudy: '平台内置爱国主题显示任务情境（任务模板，不表述为既有学生成果）',
    expectedOutcome: '学生能够说明技术方案如何服务表达目标，并提交可核验的设计证据',
  },
  {
    id: 'S1.4',
    name: '科技强国与使命担当',
    level: 2,
    parentId: 'S1',
    category: 'patriotism',
    description: '认识我国在芯片领域面临的挑战，树立投身科技事业的远大理想',
    relatedKnowledgePoints: ['1', '10'],
    relatedChapters: [1, 10],
    teachingMethod: '主题讨论：新时代大学生的科技使命',
    caseStudy: '中国芯片产业"十四五"规划与人才需求分析',
    expectedOutcome: '学生理解个人成长与国家发展的关系，增强责任感与使命感',
  },

  // ========================================================================
  // S2 - 工匠精神 (Craftsmanship)
  // ========================================================================
  {
    id: 'S2',
    name: '工匠精神',
    level: 1,
    category: 'craftsmanship',
    description: '培养学生精益求精、一丝不苟的工作态度，追求卓越的职业品质',
    relatedKnowledgePoints: ['3', '4', '5', '6', '9.3'],
    relatedChapters: [3, 4, 5, 6, 9],
    teachingMethod: '过程训练、案例警示、实践强化',
    expectedOutcome: '学生养成严谨细致的编程习惯，注重代码质量与可靠性',
  },
  {
    id: 'S2.1',
    name: '精益求精的编程态度',
    level: 2,
    parentId: 'S2',
    category: 'craftsmanship',
    description: '通过指令与C51编程训练，培养学生逐条验证、关注边界的严谨态度',
    relatedKnowledgePoints: ['3', '3.1', '3.1.1', '3.2', '3.3', '3.4', '3.5', '3.6', '4', '4.6'],
    relatedChapters: [3, 4],
    teachingMethod: '编程实训：核对每条指令或语句的功能、输入边界与运行结果',
    caseStudy: '公开软件事故中的数值溢出与边界检查问题',
    expectedOutcome: '学生建立"每一行代码都可能影响全局"的质量意识',
  },
  {
    id: 'S2.2',
    name: '一丝不苟的调试作风',
    level: 2,
    parentId: 'S2',
    category: 'craftsmanship',
    description: '通过程序调试过程中对细节的关注，培养一丝不苟的工作作风',
    relatedKnowledgePoints: ['5.4', '5.6', '6.2', '6.3', '9.3'],
    relatedChapters: [5, 6, 9],
    teachingMethod: '调试训练：系统化排错方法、断点调试与单步跟踪',
    expectedOutcome: '学生掌握系统化调试方法，养成认真仔细的排错习惯',
  },
  {
    id: 'S2.3',
    name: '追求卓越的质量意识',
    level: 2,
    parentId: 'S2',
    category: 'craftsmanship',
    description: '不满足于"能用就行"，追求代码的高效性、可读性和可维护性',
    relatedKnowledgePoints: ['4.6', '9.3', '9.4'],
    relatedChapters: [4, 9],
    teachingMethod: '质量评审：依据代码规范、测试覆盖和项目文档检查实现质量',
    expectedOutcome: '学生能够用明确标准检查代码质量、测试质量和可维护性',
  },

  // ========================================================================
  // S3 - 职业道德 (Professional Ethics)
  // ========================================================================
  {
    id: 'S3',
    name: '职业道德',
    level: 1,
    category: 'ethics',
    description: '培养学生规范意识、法律约束意识，树立良好的职业道德操守',
    relatedKnowledgePoints: ['3', '4', '7', '9', '10.5'],
    relatedChapters: [2, 3, 4, 5, 7, 8, 9, 10],
    teachingMethod: '规范训练、案例讨论、对比分析',
    expectedOutcome: '学生养成遵守规范、敬畏规则的职业习惯',
  },
  {
    id: 'S3.1',
    name: '语法规范与职业规范',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '从指令系统的语法规范引申到职业规范意识，将技术规则上升到职业准则',
    relatedKnowledgePoints: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '4.6'],
    relatedChapters: [3, 4],
    teachingMethod: '类比教学：指令格式规范 → 行业标准规范 → 职业行为规范',
    caseStudy: '编程规范违反导致的软件质量事故案例分析',
    expectedOutcome: '学生理解规范的重要性，自觉遵守编程规范和职业准则',
  },
  {
    id: 'S3.2',
    name: '法律约束与知识产权',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '通过软件版权和芯片IP保护讨论，培养法律意识和知识产权保护意识',
    relatedKnowledgePoints: ['3.1', '4.1', '4.6', '10.2', '10.5'],
    relatedChapters: [3, 4, 10],
    teachingMethod: '案例讨论：开源协议、芯片IP授权、代码版权保护',
    caseStudy: 'ARM指令集授权模式与国产指令集RISC-V的开源策略',
    expectedOutcome: '学生具备知识产权保护意识，理解法律对技术行业的约束',
  },
  {
    id: 'S3.3',
    name: '诚实守信与学术诚信',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '在通信协议、实验记录、代码引用和AI辅助学习中强调如实记录与责任使用',
    relatedKnowledgePoints: ['4.6', '7.4', '9.4', '10.5'],
    relatedChapters: [4, 7, 9, 10],
    teachingMethod: '情境判断：核验AI输出、标注引用、如实记录数据并说明工具使用边界',
    expectedOutcome: '学生能够区分辅助与代做，形成可核验、可归责的学习与工程记录',
  },
  {
    id: 'S3.4',
    name: '安全生产与责任意识',
    level: 2,
    parentId: 'S3',
    category: 'ethics',
    description: '通过嵌入式系统安全性讨论，培养对产品安全性负责的责任意识',
    relatedKnowledgePoints: ['2.5', '5.2', '5.4', '8.3', '8.5', '9.3'],
    relatedChapters: [2, 5, 8, 9],
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
    description: '培养学生创新实践能力和工程素质，鼓励探索新方法、新应用',
    relatedKnowledgePoints: ['7', '8', '9', '10'],
    relatedChapters: [6, 7, 8, 9, 10],
    teachingMethod: '项目驱动、专题研讨、自主探究',
    expectedOutcome: '学生具备创新意识和工程实践能力，能够提出创新性解决方案',
  },
  {
    id: 'S4.1',
    name: '工程创新实践',
    level: 2,
    parentId: 'S4',
    category: 'innovation',
    description: '通过综合应用项目设计，培养学生将理论知识转化为工程创新的能力',
    relatedKnowledgePoints: ['6.3', '8.4', '8.5', '9.1', '10.1', '10.2', '10.5'],
    relatedChapters: [6, 8, 9, 10],
    teachingMethod: '项目实践：自主选题、方案设计、原型实现、成果展示',
    caseStudy: '平台内置智能温室等综合项目任务模板（仿真输入，不表述为既有学生成果）',
    expectedOutcome: '学生能够提交需求、接口、实现、测试和反思等阶段性证据',
  },
  {
    id: 'S4.2',
    name: '跨学科融合思维',
    level: 2,
    parentId: 'S4',
    category: 'innovation',
    description: '引导学生将单片机技术与其他学科知识融合，拓展应用视野',
    relatedKnowledgePoints: ['8.3', '8.4', '8.5', '9', '10.1', '10.2'],
    relatedChapters: [8, 9, 10],
    teachingMethod: '跨学科案例：单片机在医疗、农业、环保等领域的创新应用',
    expectedOutcome: '学生具备跨学科思维，能够发现交叉领域的创新点',
  },
  {
    id: 'S4.3',
    name: '批判性思维与问题解决',
    level: 2,
    parentId: 'S4',
    category: 'innovation',
    description: '通过对比分析不同技术方案，培养批判性思维和最优方案选择能力',
    relatedKnowledgePoints: ['7.4', '8', '9.1', '9.3', '10.5'],
    relatedChapters: [7, 8, 9, 10],
    teachingMethod: '方案对比：不同通信协议和接口方案的优劣分析',
    expectedOutcome: '学生能够多角度分析问题，选择最优技术方案',
  },

  // ========================================================================
  // S5 - 团队协作 (Teamwork)
  // ========================================================================
  {
    id: 'S5',
    name: '团队协作',
    level: 1,
    category: 'teamwork',
    description: '培养学生协调配合、大局意识，具备良好的团队合作精神',
    relatedKnowledgePoints: ['2', '7', '8', '9', '10'],
    relatedChapters: [2, 7, 8, 9, 10],
    teachingMethod: '团队项目、角色分工、互评互助',
    expectedOutcome: '学生具备团队合作能力，能够在团队中发挥积极作用',
  },
  {
    id: 'S5.1',
    name: '系统协调与大局意识',
    level: 2,
    parentId: 'S5',
    category: 'teamwork',
    description: '从单片机各部件的协调统一工作，引申到团队成员间的协调配合',
    relatedKnowledgePoints: ['2.1', '2.4', '2.6', '9.1'],
    relatedChapters: [2, 9],
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
    description: '通过团队项目的角色分工，培养明确责任、互相支持的合作精神',
    relatedKnowledgePoints: ['8.3', '8.4', '8.5', '9.1', '9.4'],
    relatedChapters: [8, 9],
    teachingMethod: '团队项目：明确分工（硬件设计、软件开发、测试验证）',
    expectedOutcome: '学生能够在团队中承担责任，完成分工任务并互相协作',
  },
  {
    id: 'S5.3',
    name: '沟通表达与技术交流',
    level: 2,
    parentId: 'S5',
    category: 'teamwork',
    description: '通过专题研讨和成果汇报，提升技术交流与表达能力',
    relatedKnowledgePoints: ['7.4', '9.4', '10.5'],
    relatedChapters: [7, 9, 10],
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
    description: '以航天工程案例为载体，培养学生求真务实、攻坚克难的科学精神',
    relatedKnowledgePoints: ['3', '4', '5', '6', '9'],
    relatedChapters: [3, 4, 5, 6, 8, 9],
    teachingMethod: '案例教学、警示教育、精神感召',
    expectedOutcome: '学生理解航天品质的内涵，树立严谨务实的科学态度',
  },
  {
    id: 'S6.1',
    name: '求真务实的科学态度',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '通过航天工程中因细微疏忽导致失败的案例，强化求真务实的态度',
    relatedKnowledgePoints: ['3.1', '3.3', '3.5', '4.6', '9.3'],
    relatedChapters: [3, 4, 9],
    teachingMethod: '案例警示：航天工程失败案例中的软件与指令错误',
    caseStudy: '公开高可靠控制系统事故中的程序验证与事实核查',
    expectedOutcome: '学生认识到技术工作中"差之毫厘，谬以千里"的道理',
  },
  {
    id: 'S6.2',
    name: '攻坚克难的拼搏精神',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '以中国航天人攻克技术难关的故事为激励，培养迎难而上的精神',
    relatedKnowledgePoints: ['5.6', '6.3', '8.4', '8.5', '9'],
    relatedChapters: [5, 6, 8, 9],
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
    relatedKnowledgePoints: ['4.6', '5.2', '5.4', '6.3', '9.3'],
    relatedChapters: [4, 5, 6, 9],
    teachingMethod: '过程管理：建立代码检查单、测试流程规范',
    caseStudy: '公开航天软件事故中的类型转换、边界检查与复核流程',
    expectedOutcome: '学生在编程实践中自觉落实严谨规范的工作流程',
  },
  {
    id: 'S6.4',
    name: '质量第一的价值取向',
    level: 2,
    parentId: 'S6',
    category: 'aerospace',
    description: '树立质量优先于进度的工程理念，宁可慢一点也要保证质量',
    relatedKnowledgePoints: ['3.3', '5.4', '6.2', '6.3', '8.3', '9.3'],
    relatedChapters: [3, 5, 6, 8, 9],
    teachingMethod: '价值引导：航天工程质量管理体系与零缺陷理念',
    expectedOutcome: '学生建立质量第一的工程价值观，不为赶进度而忽视质量',
  },
];

// ---------------------------------------------------------------------------
// Week-by-Week SIP (思政) Mapping - 17 Weeks
// Aligned with the current 10-chapter knowledge-point numbering while
// preserving the teaching intent of the application materials.
// ---------------------------------------------------------------------------

export const sipMappings: KnowledgeSipMapping[] = [
  {
    knowledgePointId: '1',
    knowledgePointName: '单片机概述',
    chapter: 1,
    weekRange: '第1周',
    ideologicalNodeIds: ['S1.1', 'S1.4'],
    ideologicalTheme: '国产芯片自主可控与使命担当',
    ideologicalContent: '从国产单片机发展、器件选型和应用边界出发，讨论核心技术自主可控与专业学习责任。',
    teachingMethod: '案例比较：核对器件资料，区分技术事实、产业判断和价值判断。',
    expectedOutcome: '学生能够依据资料说明器件差异，并形成科技报国的学习动机。',
  },
  {
    knowledgePointId: '2.4',
    knowledgePointName: '时钟与时序',
    chapter: 2,
    weekRange: '第2周',
    ideologicalNodeIds: ['S5.1'],
    ideologicalTheme: '系统协调与大局意识',
    ideologicalContent: '用统一时钟协调CPU、存储器和外设的工作节拍，说明局部动作必须服从系统约束。',
    teachingMethod: '系统图推演：逐拍检查信号关系，再反思团队接口与协同规则。',
    expectedOutcome: '学生能够解释关键时序关系，并理解接口约定对协作质量的作用。',
  },
  {
    knowledgePointId: '3.1',
    knowledgePointName: '寻址方式',
    chapter: 3,
    weekRange: '第3周',
    ideologicalNodeIds: ['S2.1', 'S3.1'],
    ideologicalTheme: '严谨态度与规范意识',
    ideologicalContent: '立即数前是否书写#号会改变操作数含义；七种寻址方式也各有适用对象和访问边界，由此把精益求精落实到可检查的语法与选择依据。',
    teachingMethod: '对比训练：逐项核对符号、操作数来源、有效地址、允许访问范围和错误后果。',
    expectedOutcome: '学生能够正确选择寻址方式，解释关键符号的作用，并按规范复核指令。',
  },
  {
    knowledgePointId: '3.2',
    knowledgePointName: '数据传送指令',
    chapter: 3,
    weekRange: '第4周',
    ideologicalNodeIds: ['S2.1'],
    ideologicalTheme: '精益求精的编程态度',
    ideologicalContent: '同一数据传送目标可能对应不同指令和寻址限制，必须逐项核对源、目标及副作用。',
    teachingMethod: '指令验证：用寄存器和存储单元前后值证明每条指令的实际效果。',
    expectedOutcome: '学生形成用运行证据验证指令理解的习惯。',
  },
  {
    knowledgePointId: '3.3',
    knowledgePointName: '算术运算指令',
    chapter: 3,
    weekRange: '第5周',
    ideologicalNodeIds: ['S6.4'],
    ideologicalTheme: '质量第一的价值取向',
    ideologicalContent: '进位、借位和溢出会改变程序判断，关键控制不能以“结果大致正确”代替边界验证。',
    teachingMethod: '边界测试：覆盖零值、最大值、溢出和符号变化并记录标志位。',
    expectedOutcome: '学生能够建立边界用例并以测试结果判断运算可靠性。',
  },
  {
    knowledgePointId: '3.5',
    knowledgePointName: '控制转移指令',
    chapter: 3,
    weekRange: '第6周',
    ideologicalNodeIds: ['S6.1'],
    ideologicalTheme: '求真务实的科学态度',
    ideologicalContent: '程序分支必须由真实条件和可复现状态决定，不能靠猜测解释运行路径。',
    teachingMethod: '路径核验：绘制控制流并逐分支提供输入、执行轨迹和结果。',
    expectedOutcome: '学生能够用执行证据解释程序路径并主动检查遗漏分支。',
  },
  {
    knowledgePointId: '4.1',
    knowledgePointName: 'Keil C51开发环境',
    chapter: 4,
    weekRange: '第7周',
    ideologicalNodeIds: ['S3.2'],
    ideologicalTheme: '工具使用与知识产权',
    ideologicalContent: '开发工具、器件库和示例代码具有授权与引用边界，能使用不等于可以无条件复制。',
    teachingMethod: '情境判断：识别软件许可、开源协议、代码引用和署名要求。',
    expectedOutcome: '学生能够在开发记录中说明工具来源、代码来源和使用权限。',
  },
  {
    knowledgePointId: '4.6',
    knowledgePointName: '编程规范',
    chapter: 4,
    weekRange: '第8周',
    ideologicalNodeIds: ['S2.3', 'S3.1', 'S3.3'],
    ideologicalTheme: '代码质量、职业规范与诚信',
    ideologicalContent: '把命名、注释、边界检查、引用说明和测试记录作为代码完成条件，而非附加装饰。',
    teachingMethod: '同伴评审：依据统一清单检查代码、引用和测试证据。',
    expectedOutcome: '学生能够提交可读、可测、可追溯的代码及说明。',
  },
  {
    knowledgePointId: '5.2',
    knowledgePointName: '89C51中断系统',
    chapter: 5,
    weekRange: '第9周',
    ideologicalNodeIds: ['S3.4', 'S6.3'],
    ideologicalTheme: '责任意识与严慎细实',
    ideologicalContent: '中断优先级和使能配置会决定紧急事件是否被及时处理，配置必须经过逐项复核。',
    teachingMethod: '配置审查：依据中断源、允许位、优先级和触发方式检查方案。',
    expectedOutcome: '学生能够说明中断配置的责任后果并完成检查记录。',
  },
  {
    knowledgePointId: '5.4',
    knowledgePointName: '中断处理流程',
    chapter: 5,
    weekRange: '第10周',
    ideologicalNodeIds: ['S2.2', 'S3.4'],
    ideologicalTheme: '调试作风与工程责任',
    ideologicalContent: '响应、保护现场、执行服务和恢复现场均不可省略，异常路径必须有明确处置。',
    teachingMethod: '故障演练：注入标志位、现场保护和返回错误并记录定位过程。',
    expectedOutcome: '学生能够按步骤排查中断故障并说明恢复依据。',
  },
  {
    knowledgePointId: '6.2',
    knowledgePointName: '工作模式',
    chapter: 6,
    weekRange: '第11周',
    ideologicalNodeIds: ['S6.4', 'S2.2'],
    ideologicalTheme: '质量意识与精确调试',
    ideologicalContent: '模式、初值、晶振频率和溢出处理共同决定定时结果，任何参数都必须有来源。',
    teachingMethod: '计算—仿真—复核：先给公式和参数，再比较理论值与仿真结果。',
    expectedOutcome: '学生能够记录参数来源、误差和适用边界。',
  },
  {
    knowledgePointId: '6.3',
    knowledgePointName: '定时器应用',
    chapter: 6,
    weekRange: '第12周',
    ideologicalNodeIds: ['S4.1', 'S6.2'],
    ideologicalTheme: '工程创新与攻坚克难',
    ideologicalContent: '将定时器基础配置组合成实时时钟、PWM等应用，创新必须建立在可验证的基础模块上。',
    teachingMethod: '小项目：提出方案、完成仿真、记录失败尝试并说明修改依据。',
    expectedOutcome: '学生能够从基础模块形成可测试的应用方案。',
  },
  {
    knowledgePointId: '7.4',
    knowledgePointName: '通信协议',
    chapter: 7,
    weekRange: '第13周',
    ideologicalNodeIds: ['S3.3', 'S5.3'],
    ideologicalTheme: '协议诚信与技术沟通',
    ideologicalContent: '通信双方只有共同遵守帧格式、时序和错误处理约定才能交换可信数据。',
    teachingMethod: '双角色联调：分别实现发送端和接收端，用协议记录定位不一致。',
    expectedOutcome: '学生能够依据协议说明接口责任并准确沟通故障现象。',
  },
  {
    knowledgePointId: '8.3',
    knowledgePointName: 'AD/DA转换',
    chapter: 8,
    weekRange: '第14周',
    ideologicalNodeIds: ['S4.2', 'S6.4'],
    ideologicalTheme: '跨学科测量与质量意识',
    ideologicalContent: '模拟量采集连接物理对象、传感电路和数字算法，结果必须同时说明精度与误差。',
    teachingMethod: '测量任务：定义单位、量程、分辨率和误差，比较理论与采样结果。',
    expectedOutcome: '学生能够解释采集数据的来源、精度和使用限制。',
  },
  {
    knowledgePointId: '8.4',
    knowledgePointName: '传感器接口',
    chapter: 8,
    weekRange: '第15周',
    ideologicalNodeIds: ['S4.2', 'S5.2'],
    ideologicalTheme: '跨学科融合与分工合作',
    ideologicalContent: '传感器应用同时涉及对象机理、电气接口、程序时序和数据解释，需要明确角色与接口。',
    teachingMethod: '角色任务：分配传感、接口、程序和测试职责，以接口表完成联调。',
    expectedOutcome: '学生能够完成分工证据并解释各模块的输入输出。',
  },
  {
    knowledgePointId: '9.1',
    knowledgePointName: '系统设计方法',
    chapter: 9,
    weekRange: '第16周',
    ideologicalNodeIds: ['S1.3', 'S5.2'],
    ideologicalTheme: '价值表达与项目责任',
    ideologicalContent: '综合项目既要实现功能，也要说明服务对象、表达目标、角色贡献和测试责任。',
    teachingMethod: '项目里程碑：需求、接口、实现、联调、答辩逐阶段提交证据。',
    expectedOutcome: '学生能够把价值目标转化为需求和验收指标，不以展示替代验证。',
  },
  {
    knowledgePointId: '10.5',
    knowledgePointName: 'AI素养与责任使用',
    chapter: 10,
    weekRange: '第17周',
    ideologicalNodeIds: ['S1.2', 'S1.4', 'S3.3', 'S4.1'],
    ideologicalTheme: '科技使命、AI素养与责任判断',
    ideologicalContent: 'AI可以辅助检索、解释和调试，但使用者必须核验事实、保护数据、标注引用并承担最终判断责任。',
    teachingMethod: '情境测验：识别幻觉、隐私风险、代做边界、引用要求和责任归属。',
    expectedOutcome: '学生能够核验AI输出、说明使用边界，并作出负责任的技术判断。',
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
 * Return only mappings that were explicitly authored for the selected
 * knowledge-point branch. This must stay separate from the broader
 * chapter/content associations stored on ideological nodes: the latter are
 * useful for discovery, but do not constitute a weekly teaching decision.
 */
export function getExplicitSipMappingsForKnowledgePoint(
  knowledgePointId: string,
): KnowledgeSipMapping[] {
  const normalizedId = knowledgePointId.trim();
  if (!normalizedId) return [];

  return sipMappings.filter((mapping) => (
    mapping.knowledgePointId === normalizedId
    || mapping.knowledgePointId.startsWith(`${normalizedId}.`)
    || normalizedId.startsWith(`${mapping.knowledgePointId}.`)
  ));
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
    '按17周教学设计覆盖现行10章课程内容。' +
    '6类育人主题、21个教学元素通过明确节点编号关联专业知识，用于定位价值判断与学习活动入口。',
} as const;
